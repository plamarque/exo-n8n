# WF03 — Weekly steering preparation

**TL;DR** — Automate the **weekly steering committee prep pack**: list open project tasks, ask an LLM for an **HTML progress narrative**, a **suggested agenda**, and **watch items**, then **create or update** the weekly meeting note and refresh the **recurring calendar** invite with the right link and description — without copy-paste.

## Video walkthrough

Prefer a short screencast before the long read?

**Short video (FR voice-over):** [Loom — WF03 weekly steering preparation](https://www.loom.com/share/aeb338dd0ef54d678ef9752370db64b2)

French partner article aligned with that recording (wf03 section): [docs/ARTICLE-FR-partenaires-eXo.md](../../docs/ARTICLE-FR-partenaires-eXo.md).

## n8n canvas

![WF03 — Weekly steering preparation workflow in the n8n editor](wf03.png)

**Manual Start** or **Weekly Preparation (Thu 08:00)** → **Prepare Steering Config** → **MCP List Project Tasks** → **Analyze Steering Signals** with **OpenAI Steering Model** and **Steering Structured Output** → **HTML Build AI Agenda** → two parallel branches:

- **Branch A — agenda setup:** **MCP Update Agenda Event (Initial)** sets the event **summary** only → **MCP Invite Participants** refreshes attendees.
- **Branch B — meeting note:** **MCP Get Template Note** → **HTML Build AI Watch Items** → **HTML Build Annexes Links** → **Compose Steering Note HTML** → **MCP Search Existing Note** → **IF Note Exists** → **MCP Update Steering Note** or **MCP Create Steering Note** → **Note Info** with `note_url` and `note_id`.

**Merge Branches** combines both paths → **HTML Build Agenda Description** → **MCP Update Agenda Event (Final)** posts the full event **description** with the note link and AI agenda. Self-contained graph on one canvas. For tool names and payloads, see [`workflow.json`](workflow.json) and [SPEC.technical.md](SPEC.technical.md).

---

## Problem context

Governance meetings repeat on a **fixed cadence**, but preparation is often **manual**: re-open tasks, rewrite the same sections, fix links, and align the calendar invite. Teams want **one handout in eXo** — note, tasks, and calendar — with **fresh content** each week and **minimal busywork**.

## Automation objective

- Resolve **meeting date**, note title, and related dates from **Prepare Steering Config**.
- **List** open project tasks via MCP **`list_tasks`** and pass them to a **single LLM call** that returns an HTML **progress narrative**, a **suggested agenda**, **watch items**, localized agenda labels, and a short summary — all in the configured **`language`**.
- **Create or update** the weekly child note from the template and AI blocks.
- **Update** the standing agenda event: **summary** and attendees early on branch A; **description** with the note link after branch B completes.

## Prerequisites

WF03 binds to **specific eXo objects** — space, template note, reports parent, task project, and recurring agenda event. On a **new tenant**, create or clone the demo layout, read ids from the eXo UI or MCP, then align root `.env` with [config.env.example](config.env.example). Details: [SPEC.technical.md](SPEC.technical.md) §2.

**eXo**

| Prerequisite | Typical `.env` key | Why |
|--------------|-------------------|-----|
| **Space** | `WF03_SPACE_ID` | Scopes notes, tasks, and agenda calls. |
| **Template note** | `WF03_TEMPLATE_NOTE_ID` | HTML skeleton with section tokens for the weekly handout. |
| **Parent note** for weekly children | `WF03_REPORTS_PARENT_NOTE_ID` | Anchor for create/update of the week’s note. |
| **Task project** | `WF03_PROJECT_ID` | `list_tasks` input for the AI progress narrative. |
| **Recurring agenda event** | `WF03_AGENDA_PARENT_EVENT_ID` | Calendar object receiving summary, description, and invites. |
| **Meeting owner label** | `WF03_MEETING_OWNER` | Display string in generated note content. |
| **Output language** | `WF03_LANGUAGE` | All AI strings and agenda description labels; defaults to `English` if unset. |
| **Attendee usernames** | `WF03_ATTENDEE_USERNAMES` | Comma-separated; must **exist** on the tenant — see [SPEC.functional.md](SPEC.functional.md) §4. |
| **Watch-list thresholds** | `WF03_STAGNATION_DAYS`, `WF03_BLOCKED_DAYS`, `WF03_OVERLOAD_THRESHOLD` | Optional tuning for LLM vigilance hints. |

**n8n**

| Prerequisite | Why |
|--------------|-----|
| **MCP OAuth** + `EXO_MCP_ENDPOINT` | Notes, tasks, and agenda via MCP; rewrite endpoint with `npm run generate:workflow-json` or deploy. |
| **OpenAI** or equivalent | **Analyze Steering Signals** AI Agent and structured output parser. |
| **Self-contained graph** | No `subworkflow-dependencies.json`; set `N8N_WORKFLOW_ID_WF03` in root `.env` for deploy only. |

**Also in `Prepare Steering Config`:** demo literals `space_slug` and `exo_base_url` for annex links — **not** rewritten from `.env`; edit `workflow.json` if your tenant URL shape differs.

If any id is wrong, create/upsert paths may **fail** or link the **wrong** object — verify ids after a tenant copy.

## Runtime variables

Set keys in **repository root `.env`**. **`./tools/deploy.sh wf03`** and **`npm run generate:workflow-json`** rewrite **`Prepare Steering Config`** via **`applyWf03PrepareSteeringConfigFromEnv`** ([`tools/lib/n8n-workflow-deploy-core.mjs`](../../tools/lib/n8n-workflow-deploy-core.mjs)). No n8n Variables / `$vars.*` at runtime.

| Variable | Meaning |
|----------|---------|
| `EXO_MCP_ENDPOINT` | MCP endpoint for all WF03 MCP Client nodes. |
| `WF03_SPACE_ID` | eXo space id. |
| `WF03_PROJECT_ID` | Task project for `list_tasks`. |
| `WF03_TEMPLATE_NOTE_ID` | Template note id. |
| `WF03_REPORTS_PARENT_NOTE_ID` | Parent note for weekly child notes. |
| `WF03_AGENDA_PARENT_EVENT_ID` | Recurring agenda event id. |
| `WF03_MEETING_OWNER` | Owner label in note HTML. |
| `WF03_LANGUAGE` | AI output language, e.g. `English`, `Français`. |
| `WF03_ATTENDEE_USERNAMES` | Comma-separated usernames for `invite_users_to_agenda_event`. |
| `WF03_STAGNATION_DAYS`, `WF03_BLOCKED_DAYS`, `WF03_OVERLOAD_THRESHOLD` | LLM threshold hints. |
| `N8N_WORKFLOW_ID_WF03` | Remote workflow id for REST deploy; empty on first POST-create. |

## High-level flow

1. **Trigger** — **Manual Start** or **Weekly Preparation (Thu 08:00)**.
2. **Prepare Steering Config** — meeting dates, note title, ids, roster, thresholds, `language`, and URL building blocks.
3. **MCP List Project Tasks** — `list_tasks` with `hide_completed_tasks: true`.
4. **Analyze Steering Signals** — one structured LLM call → `suggested_agenda`, `progress_report` HTML, `vigilances`, `summary`, and localized agenda description fields.
5. **HTML Build AI Agenda** — `<ul>` from `suggested_agenda`; split point for parallel branches.
6. **Branch A** — **MCP Update Agenda Event (Initial)** sets summary `Weekly steering - <meeting_date>` only; **MCP Invite Participants** syncs attendees.
7. **Branch B** — load template, build watch items and annexes HTML, **Compose Steering Note HTML** patches tokens `[SUGGESTED_AGENDA_*]`, `[REPORT_AVANCEMENT_*]`, `[POINTS_A_DISCUTER_*]`, `[ANNEXES_LIENS_*]`; search by title → update or create note → **Note Info** exposes `note_url` / `note_id`.
8. **Merge and finalize** — **Merge Branches** → **HTML Build Agenda Description** → **MCP Update Agenda Event (Final)** writes the full description with the note link.

## n8n design choices

| Area | Choice | Why |
|------|--------|-----|
| Readability | **Self-contained graph** | Tutorial slice (ADR 0004): one canvas, one clear step per node. See [SPEC.technical.md §7](SPEC.technical.md#7-didactic-simplification-slice-adr-0004) for deferred hardening. |
| Two-branch structure | **Parallel paths** after **HTML Build AI Agenda**, merged before the final agenda update | Agenda summary and invites can proceed without waiting for note composition; one post-merge trail for description + final event update. |
| Progress report | **AI narrative** HTML in `progress_report` | Surfaces notable and stalled work for a steering read-ahead without duplicating the task board as a static table. |
| Language | **`WF03_LANGUAGE` → `Prepare Steering Config.language`** | Predictable multilingual output; template body is not used for language detection. |
| MCP parsing | **`content[0].text.<field>`** | Direct expressions on MCP Client items; see [SPEC.technical.md](SPEC.technical.md) §3.2. |
| Native vs Code | **HTML** nodes for fixed blocks; **one short Code** node for template token surgery | ADR 0004: prefer native nodes where layout is stable. |
| Configuration | **Plain literals** in `workflow.json`; deploy from root `.env` | Avoids n8n `$vars` inconsistencies across Cloud tenants. |

## MCP eXo interaction model

WF03 is the **broadest** portfolio demo: **Notes**, **Tasks**, and **Agenda**. Tools include `get_note`, `search_notes`, `create_child_note`, `update_note`, `list_tasks`, `update_agenda_event`, and `invite_users_to_agenda_event`. See [SPEC.technical.md](SPEC.technical.md) §3 for payloads and envelope shape.

## Operational considerations

- **Demo ids** — set `WF03_*` in root `.env` and run **`npm run generate:workflow-json`** or **`./tools/deploy.sh wf03`** before testing on a new tenant.
- **OAuth / OpenAI** — authorize MCP and LLM credentials on the target n8n instance.
- **Trust the data** — responses are read as `content[0].text.<field>`; envelope mismatches surface as expression errors, not silent fallbacks.

## Code vs native

The graph uses **Set**, **HTML**, **IF**, **Merge**, and an **AI Agent** with structured output, plus one **`Compose Steering Note HTML`** Code node for template patching.

## Import and deploy

**REST:** From the repo root, `./tools/deploy.sh wf03` — see [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md). No `subworkflow-dependencies.json`; only this workflow is deployed. On a fresh tenant, leave `N8N_WORKFLOW_ID_WF03` empty: the first deploy POST-creates the workflow and writes the id back — [Deploy bootstrap](../../docs/DEVELOPMENT.md#deploy-bootstrap-env-driven). Use `--dry-run` to preview the PUT target once the id is set.

**Manual UI:** Import `workflow.json`. Run **`npm run generate:workflow-json`** so `EXO_MCP_ENDPOINT` and `WF03_*` literals match your tenant; verify MCP OAuth and OpenAI on the instance.

## References

| Artifact | Role |
|----------|------|
| [../../docs/ARTICLE-FR-partenaires-eXo.md](../../docs/ARTICLE-FR-partenaires-eXo.md) | French partner article — wf03 section, Loom, screenshots. |
| [workflow.json](workflow.json) | Canonical export — name on instance: `WF03 - Weekly steering preparation`. |
| [SPEC.functional.md](SPEC.functional.md) | Goals, actors, note shape, business rules. |
| [SPEC.technical.md](SPEC.technical.md) | MCP contract, sequence, operations, didactic slice notes. |
| [fixtures/steering-template-note.md](fixtures/steering-template-note.md) | Editorial template reference. |
| [fixtures/api-response.snapshot.json](fixtures/api-response.snapshot.json) | API snapshot for traceability. |
| [config.env.example](config.env.example) | Example `.env` keys for deploy injection. |
