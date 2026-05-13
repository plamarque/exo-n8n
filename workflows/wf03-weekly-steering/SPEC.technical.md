# Workflow 03 - Weekly steering preparation (technical specification)

> Product rules: [SPEC.functional.md](SPEC.functional.md). Canonical graph: [workflow.json](workflow.json). Workflow tutorial: [README.md](README.md).

## 1) Scope and artifacts

- Canonical export in git: `workflows/wf03-weekly-steering/workflow.json` (didactic slice, ADR 0004 — self-contained: no `subworkflow-dependencies.json`, no `subworkflows/`).
- No utility sub-workflows for this slice. All composition (progress table, AI agenda/watch HTML, annexes links, template token surgery) lives in the parent.

## 2) Configuration

Runtime business identifiers — held as **plain literals** in the canonical `workflow.json` (no n8n `$vars.*`). REST deploy and **`npm run generate:workflow-json`** rewrite each assignment of the **`Prepare Steering Config`** Set node from repository root `.env` (see [`config.env.example`](config.env.example); helper: **`applyWf03PrepareSteeringConfigFromEnv`** in [`tools/lib/n8n-workflow-deploy-core.mjs`](../../tools/lib/n8n-workflow-deploy-core.mjs)):

- `WF03_SPACE_ID` → `space_id`
- `WF03_PROJECT_ID` → `project_id`
- `WF03_TEMPLATE_NOTE_ID` → `template_note_id`
- `WF03_REPORTS_PARENT_NOTE_ID` → `reports_parent_note_id`
- `WF03_AGENDA_PARENT_EVENT_ID` → `agenda_parent_event_id`
- `WF03_STAGNATION_DAYS`, `WF03_BLOCKED_DAYS`, `WF03_OVERLOAD_THRESHOLD` — LLM/watch thresholds
- `WF03_MEETING_OWNER` → `meeting_owner` (plain string)
- `WF03_LANGUAGE` → `language` (plain string, free-form — controls the AI agent output language; defaults to `English` in canonical JSON)
- `WF03_ATTENDEE_USERNAMES` → `attendee_usernames` (comma-separated → trimmed array expression)

Static demo fields kept as literals in the Set (overridable by editing the file before deploy if needed): `space_slug`, `exo_base_url`.

Deploy-time remote id (root `.env`, tenant-bound): `N8N_WORKFLOW_ID_WF03`. No subworkflow ids required.

Connectivity and credentials:

- `EXO_MCP_ENDPOINT` in root `.env` — **`npm run generate:workflow-json`** sets MCP Client `endpointUrl`; canonical graph carries a demo literal until then.
- MCP OAuth credential (`mcpOAuth2Api`) for notes/tasks/agenda calls.
- LLM credential for the **`Analyze Steering Signals`** AI Agent.

## 3) MCP contract

### 3.1 Tools used by WF03

- Notes: `get_note`, `search_notes`, `create_child_note`, `update_note`
- Tasks: `list_tasks`
- Agenda: `update_agenda_event`, `invite_users_to_agenda_event`

### 3.2 Response envelope (didactic slice)

The graph reads MCP responses directly through the n8n MCP Client item shape — no unwrap sub-workflow:

```text
$('<MCP node>').item.json.content[0].text.<field>
```

Concretely:

- `MCP Get Template Note` → `content[0].text.html_content` (template HTML body). Loaded inside **Branch B** (after `HTML Build AI Agenda`) — it is no longer on the pre-AI critical path because the LLM language is now imposed by `Prepare Steering Config.language` (no template-body language detection).
- `MCP List Project Tasks` → `content[0].text.tasks` (array of task objects). The **`Analyze Steering Signals`** AI Agent reads this array directly via `JSON.stringify(...)` inside its prompt — no per-task HTML rendering, no Split Out / Aggregate loop. The LLM is responsible for picking the **notable items** (statuses, priorities, stagnation, blockers) and producing the narrative.
- `MCP Search Existing Note` → `content[0].text` is **directly an array** of `{ note_id, title, ... }` (no `notes` wrapper key on this tenant). The **`IF Note Exists`** condition and the **`MCP Update Steering Note` → `note_id`** expression both filter on `n.title.trim() === note_title`.
- `MCP Update Steering Note` / `MCP Create Steering Note` → `content[0].text.url` and `content[0].text.note_id`. Both extracted by the **`Note Info`** Set node into `note_url` / `note_id`, so the post-merge **`HTML Build Agenda Description`** template only references `$('Note Info').item.json.note_url`. When the tenant returns different fields, edit the **`Note Info`** assignments accordingly.

### 3.3 Reference payload shape

`list_tasks` request shape (Manual MCP Client parameters on **`MCP List Project Tasks`**, no JSON-mode):

| Field | Value |
|-------|-------|
| `project_id` | `={{ $('Prepare Steering Config').item.json.project_id }}` |
| `limit` | `100` |
| `offset` | `0` |
| `hide_completed_tasks` | `true` (excludes Done tasks from the weekly report) |
| `include_change_log` | `false` |

## 4) Technical sequence (single parent graph)

The graph splits into **two parallel branches** after `HTML Build AI Agenda` and re-merges via `Merge Branches` before the final agenda update.

1. **Trigger** — `Manual Start` or `Weekly Preparation (Thu 08:00)` schedule.
2. **`Prepare Steering Config`** (Set v3.4) — emits ids, roster, thresholds, `meeting_date`, `next_meeting_date`, `meeting_date_plus_2`, `meeting_start_iso`, `note_title`, `space_slug`, `exo_base_url`, and the new `language` (default `English`, overridable by `WF03_LANGUAGE`).
3. **`MCP List Project Tasks`** (Manual, `list_tasks`).
4. **`Analyze Steering Signals`** (`@n8n/n8n-nodes-langchain.agent` v3.1) with the **`OpenAI Steering Model`** language model and **`Steering Structured Output`** parser. Receives the full task array and the configured language, and returns `{ suggested_agenda[], progress_report (HTML), vigilances[], summary, agenda_label_support, agenda_label_agenda, agenda_outro_text }` — all string fields produced in `Prepare Steering Config.language`. The prompt references `MCP List Project Tasks` and `Prepare Steering Config` and defines distinct roles for each field (narrative `progress_report` vs short `vigilances` bullets; three localized labels for the agenda event description). The template HTML body is **not** in the prompt anymore.
5. **`HTML Build AI Agenda`** — `<ul>...</ul>` of the agent's `suggested_agenda[]`. This node is the split point.

**Branch A — agenda event setup (early)**

6a. **`MCP Update Agenda Event (Initial)`** (Manual, `update_agenda_event`) — posts `event_id` + `summary` only (`Weekly steering - <meeting_date>`). The description is deliberately left untouched until the note URL is known.

7a. **`MCP Invite Participants`** (Manual, `invite_users_to_agenda_event`) — single consolidated node (replaces the previous `(After Update)` / `(After Create)` duplicates).

**Branch B — meeting note composition**

6b. **`MCP Get Template Note`** (Manual, `get_note`) — reads the template body (moved into Branch B).

7b. **`HTML Build AI Watch Items`** — `<ul>...</ul>` of the agent's `vigilances[]`.

8b. **`HTML Build Annexes Links`** — Useful-links block built from `Prepare Steering Config` literals.

9b. **`Compose Steering Note HTML`** (single `runOnceForEachItem` Code node) — patches the template body with token substitution: `[[NOTE_TITLE]]`, `[[MEETING_DATE]]`, `[[MEETING_OWNER]]`, `[[NEXT_MEETING_DATE]]`, `[[MEETING_DATE_PLUS_2]]`, plus four section wraps. `[REPORT_AVANCEMENT_START/END]` is filled with `progress_report` (HTML emitted directly by the LLM); the other three (`[SUGGESTED_AGENDA_*]`, `[POINTS_A_DISCUTER_*]`, `[ANNEXES_LIENS_*]`) come from the corresponding HTML nodes.

10b. **`MCP Search Existing Note`** (Manual, `search_notes`).

11b. **`IF Note Exists`** (native If v2.3) — condition `content[0].text.filter(n => n.title.trim() === note_title).length > 0`. True → **`MCP Update Steering Note`**; False → **`MCP Create Steering Note`**.

12b. **`Note Info`** (Set v3.4) — two incoming edges (Update + Create); emits `{ note_url, note_id }` from `content[0].text.{url,note_id}`.

**Merge and finalize**

13. **`Merge Branches`** (`n8n-nodes-base.merge` v3.2, `combine` + `combineByPosition`) — two inputs: index 0 = `MCP Invite Participants` (Branch A), index 1 = `Note Info` (Branch B). Yields a single item carrying both branches' state.

14. **`HTML Build Agenda Description`** — composes the final agenda event description: localized `agenda_label_support`, link to `$('Note Info').item.json.note_url`, `<h4>` heading from `agenda_label_agenda`, the AI agenda HTML, and the localized `agenda_outro_text` outro.

15. **`MCP Update Agenda Event (Final)`** (Manual, `update_agenda_event`) — posts `event_id` + `description` only (summary was already set in Branch A).

## 5) Data and mappings

### 5.1 Core id mapping

`Prepare Steering Config` (Set v3.4) — every assignment is a plain literal in canonical JSON; deploy overrides them from `.env` (§2).

### 5.2 LLM output contract

Structured output schema (used by **`Steering Structured Output`**, n8n `outputParserStructured` v1.3):

```json
{
  "suggested_agenda": ["..."],
  "progress_report": "<p>...</p><h4>Notable items</h4><ul><li>/task:ID ... @username ...</li></ul>",
  "vigilances": ["..."],
  "summary": "...",
  "agenda_label_support": "Meeting support",
  "agenda_label_agenda": "Suggested agenda",
  "agenda_outro_text": "Prepared automatically from project 3 tasks."
}
```

Field roles (enforced by the prompt and system message of **`Analyze Steering Signals`**) — **every string field is produced in the language configured in `Prepare Steering Config.language`** (imposed by the prompt; no auto-detection from a template body):

- `suggested_agenda` — 3-6 short discussion topics. Rendered as `<ul>` by **`HTML Build AI Agenda`**.
- `progress_report` — **HTML string emitted directly by the LLM**: an opener paragraph (1-2 sentences) followed by 2-3 `<h4>` subsections in the configured language. Each subsection holds **3-4 items max**, each `<li>` formatted on two lines (`<strong>/task:ID Title</strong> - @username - <em>priority - status</em><br/>one short rationale sentence`). No task ID repeats across subsections, no date dump, no `undefined`/`null` placeholders. Injected as-is by **`Compose Steering Note HTML`** into `[REPORT_AVANCEMENT_*]`. Replaces the previous static HTML table built from `Split Out` + `Aggregate`.
- `vigilances` — 3-5 discussion items, each itself an HTML string with `<strong>Title</strong><br/>` + 1-2 sentences of context (and optionally a localized "Decision to take" sentence). Each item is wrapped in `<li>` by **`HTML Build AI Watch Items`** and injected into `[POINTS_A_DISCUTER_*]`. Distinct from `progress_report` content.
- `summary` — single-sentence opener. Available for future use; not currently injected.
- `agenda_label_support` / `agenda_label_agenda` / `agenda_outro_text` — three short localized strings used by the post-merge **`HTML Build Agenda Description`** to render the agenda event description body in the configured language (no static English labels left on the canvas).

All output is advisory; the meeting is the system of record.

### 5.3 Template tokens

The template note in eXo (id `WF03_TEMPLATE_NOTE_ID`) is expected to carry the English template laid out in [fixtures/steering-template-note.md](fixtures/steering-template-note.md). The didactic Compose Code only performs literal `replaceAll` on `[[...]]` tokens plus four section wraps:

- `[SUGGESTED_AGENDA_START/END]` ← `HTML Build AI Agenda` (LLM `suggested_agenda[]` rendered as `<ul>`)
- `[REPORT_AVANCEMENT_START/END]` ← `Analyze Steering Signals` output `progress_report` (HTML string emitted directly by the LLM, injected as-is)
- `[POINTS_A_DISCUTER_START/END]` ← `HTML Build AI Watch Items` (LLM `vigilances[]` rendered as `<ul>`)
- `[ANNEXES_LIENS_START/END]` ← `HTML Build Annexes Links` (static `<ul>` of useful links, language-agnostic)

The output language is **imposed by `Prepare Steering Config.language`** (defaults to `English`, overridable by `WF03_LANGUAGE` from root `.env`). The agent's prompt receives the value as `Output language (mandatory): <language>` and produces every string field in that language — `progress_report` subsection headings, vigilance titles + `Decision to take` labels, and the three agenda description fields (`agenda_label_support`, `agenda_label_agenda`, `agenda_outro_text`). No static translation table in `Compose Steering Note HTML`, no HTML entity decoding, no template-shape inference. The template body is not passed to the LLM; it is only consumed by the Code node for token substitution.

### 5.4 Idempotency logic

- One weekly note per computed `note_title` (`Festival Art2Rue - Weekly steering - YYYY-MM-DD`).
- `IF Note Exists` decides between `MCP Update Steering Note` and `MCP Create Steering Note`; the title-match filter is the upsert key.
- Agenda keeps a stable `agenda_parent_event_id` and receives weekly summary + description refresh.

## 6) Validation and operations

Validation checklist:

1. Verify all `WF03_*` variables in repository root `.env` match existing tenant objects.
2. Run **`npm run validate:workflow -- workflows/wf03-weekly-steering/workflow.json`** (or `./tools/validate-workflow.sh wf03`) before deploy ([n8n-workflow-deploy-gate](../../.cursor/skills/n8n-workflow-deploy-gate/SKILL.md)).
3. Verify MCP + LLM credentials on the target n8n instance.
4. Run the workflow and confirm:
   - template fetch and AI `progress_report` HTML render against the demo project,
   - note upsert behavior (title-match update vs new child note),
   - agenda description points to the generated note,
   - attendee list stays aligned with `WF03_ATTENDEE_USERNAMES`.

Operational watch points:

- The graph trusts MCP envelopes at `content[0].text.<field>`. A tenant that wraps responses differently will surface as a downstream expression error rather than a quiet fallback.
- Large HTML updates may require longer MCP/HTTP timeouts (current per-node timeouts: 60–90 s).
- The `progress_report` HTML is **emitted by the LLM**: it can vary in shape (paragraph + subsections) and may occasionally include heading levels or list nesting beyond the example. The compose Code injects it as-is; downstream consumers (eXo Notes) must tolerate this surface.

## 7) Didactic simplification slice (ADR 0004)

This graph is **tutorial-oriented**: explainability on the canvas takes priority over defensive shape tolerance.

- **Removed:** 5 `Unwrap MCP …` Execute Workflow hops and both WF03 UTIL sub-workflows (`UTIL - WF03 build report context`, `UTIL - WF03 compose steering note HTML`), plus the **`Bundle Inputs For Build Report`**, **`Bundle Inputs For Compose`**, and **`Decide Note Upsert`** intermediate Set / Code nodes. All n8n `$vars.WF03_*` references are gone; canonical JSON holds plain literals.
- **Added:** `n8n-nodes-base.html` nodes for the AI lists and annexes (`HTML Build AI Agenda`, `HTML Build AI Watch Items`, `HTML Build Annexes Links`, `HTML Build Agenda Description`). One short `runOnceForEachItem` **`Compose Steering Note HTML`** Code node remains for template token surgery.
- **Replaced (table → AI narrative):** the static HTML progress table (`Split Out Tasks` + `HTML Render Task Row` + `Aggregate Task Rows` + `HTML Build Progress Table`) is gone. The `[REPORT_AVANCEMENT_*]` section is now filled with `progress_report`, an HTML string produced **directly by the LLM** from a semantic analysis of statuses, priorities, ages, and recent updates. Rationale: the previous tabular projection duplicated information already legible inside eXo Tasks and added 4 nodes for marginal explanatory value; a narrative report surfaces notable items and stalled tasks more clearly for a steering meeting.
- **Restructured (two parallel branches):** after `HTML Build AI Agenda`, the graph splits into **Branch A** (`MCP Update Agenda Event (Initial)` → `MCP Invite Participants`) and **Branch B** (`MCP Get Template Note` → `HTML Build AI Watch Items` → `HTML Build Annexes Links` → `Compose Steering Note HTML` → `MCP Search Existing Note` → `IF Note Exists` → upsert → `Note Info`). Both branches re-converge via `Merge Branches` (`combine` + `combineByPosition`), then `HTML Build Agenda Description` → `MCP Update Agenda Event (Final)` writes the final event description with the meeting-note link. This **consolidates six previously duplicated nodes** (`HTML Build Agenda Description (Update/Create)`, `MCP Update Agenda After Update/Create`, `MCP Invite Participants After Update/Create`) into one single trail post-merge. The agenda event also receives its summary as early as possible (Branch A) instead of waiting for the note composition to finish.
- **Language imposed via configuration:** `Prepare Steering Config.language` (default `English`, overridable by `WF03_LANGUAGE`) is passed to the agent as `Output language (mandatory): <language>`. Replaces the previous LLM-side language detection from the template HTML body, which is no longer in the prompt.
- **MCP Manual mapping everywhere:** each MCP Client tool argument is a direct upstream expression (`$('Prepare Steering Config').item.json.<field>`, `$('Compose Steering Note HTML').item.json.<field>`, etc.) — no intermediate "bundle" objects.
- **`$vars` removal:** the canonical graph has zero `$vars.*` references. Deploy from root `.env` rewrites Set assignments via **`applyWf03PrepareSteeringConfigFromEnv`** ([`tools/lib/n8n-workflow-deploy-core.mjs`](../../tools/lib/n8n-workflow-deploy-core.mjs)) — both in-memory before REST push and on disk via `npm run generate:workflow-json`. Mirrors WF04's literal-injection pattern.
- **`[ASSUMPTION]`** — the eXo template note (`WF03_TEMPLATE_NOTE_ID`) carries the four section tokens listed in §5.3 (`[SUGGESTED_AGENDA_*]`, `[REPORT_AVANCEMENT_*]`, `[POINTS_A_DISCUTER_*]`, `[ANNEXES_LIENS_*]`). The natural language of generated content is **imposed by `Prepare Steering Config.language`** (set on a tenant by `WF03_LANGUAGE` in root `.env`); the canonical fixture [fixtures/steering-template-note.md](fixtures/steering-template-note.md) is kept in English per repository language policy but the deployed template on a tenant may be in any language. The didactic compose step does no manual translation, no entity decoding, no template-shape fallback.

**Deferred hardening** (reintroduce only when a tenant requires it):

1. Re-add `unwrap-mcp-json` Execute Workflow hops if MCP responses on a tenant stop matching `content[0].text.<field>` (string envelopes or nested shape variations).
2. Re-add a deterministic HTML progress table (Split Out + Aggregate + HTML) if a tenant requires a fixed shape rather than a model-emitted narrative (e.g. for downstream parsing of the report block).
3. Validate `progress_report` HTML against an allow-list of tags / structure if eXo Notes ever rejects unexpected markup.
4. Add stronger upsert guards for concurrent reruns on the same meeting slot (current behavior is last-write-wins).
5. Externalize `space_slug` / `exo_base_url` to `.env` if multiple tenant URL shapes are needed.
