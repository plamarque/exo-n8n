# Workflow 03 — eXo **MIPS** MCP technical contract

> Product context: [SPEC.functional.md](SPEC.functional.md).  
> This document describes the **production-oriented** MCP host (`mcp__exo_mips__`) and the business ids validated for the WF03 steering committee (COPIL) workflow.  
> A separate file documents QAUI exploration: [SPEC.technical-mcp.md](SPEC.technical-mcp.md).

## 1) Purpose

- Summarize the MCP response envelope every node must parse.  
- List verified input/output shape for the tools the workflow actually calls.  
- Document the recommended MCP sequence to implement the weekly steering committee pack (COPIL assets).  
- Freeze configuration before wiring the final n8n graph (see [config.env.example](config.env.example)).

**Observation date:** 2026-04-24 (Europe/Paris) on the eXo MIPS instance used for this portfolio.

## 2) Test context (observed)

After a dataset reset, a minimal set was re-created. **Current stable references (post-restore):**

- `space_id=1` — `Festival Art2Rue` (naming as shown in UI)  
- `project_id=3` — `Festival Art2Rue` (task board for the report)  
- `template_note_id=25` — steering committee note template (HTML; labeled COPIL in the demo)  
- `reports_parent_note_id=6` — parent note that holds weekly reports  
- `agenda_parent_event_id=13` — standing agenda anchor (UI title may still show `Weekly COPIL`)  
- `task` samples exist for `list_tasks` and comment threads.

### 2.1 Template `25` validation (MIPS)

- `get_note` / `get_space_note_tree` show template `25` with headings matching `fixtures/copil-template-note.md` (or the HTML the workflow strips).  
- `child_notes` under the reports parent are consistent with a weekly **child** per meeting.

## 3) MCP response envelope (critical for n8n)

Most tools return a wrapper:

```json
[ { "type": "text", "text": "{...json or plain string...}" } ]
```

You **must** parse: outer array → `text` → `JSON.parse` when applicable. Some returns are plain strings (`"Done"`, numeric ids as string). Timeouts: allow several seconds for heavy note or agenda calls.

## 4) Tool inventory (MIPS) — what WF03 relies on

**Spaces** — `get_all_spaces` (or `get_my_spaces` on QAUI; on MIPS the workflow uses a fixed `space_id` in variables).  

**Notes** — `get_note` (`note_id=25` for the template, child creation uses `parent_note_id=6` via `create_child_note` / `update_note` depending on strategy; current JSON uses `create_child_note` and `search_notes` for upsert by title).  

**Tasks** — `list_tasks` for `project_id=3` (and optional `list_project_activity_since` for richer signals in future).  

**Agenda** — `update_agenda_event` on the configured `event_id=13` and `invite_users_to_agenda_event` to refresh the attendee list.  

(Exact call order matches `workflow.json`; treat this document as the **business** contract, the JSON as the **source of truth** for parameters.)

**Example: list tasks (shape)**

```json
{ "project_id": 3, "limit": 100, "offset": 0, "hide_completed_tasks": false, "include_change_log": false }
```

## 5) Recommended technical sequence (MIPS)

1. **Load static config** — `space_id`, `project_id`, `template_note_id`, `reports_parent_note_id`, `agenda_parent_event_id`, participant list, stagnation/blocked thresholds (see env example).  
2. **Get template** — `get_note` (template) to copy HTML.  
3. **List project tasks** — `list_tasks` for the HTML table + to build the LLM context payload.  
4. **LLM** (OpenAI) — `suggested_agenda[]`, `vigilances[]`, `summary` as structured output.  
5. **Compose HTML** — merge into template, replace markers such as `SUGGESTED_AGENDA` / `REPORT` blocks, normalize headings to English in the current export.  
6. **Upsert note** — `search_notes` to detect an existing child with the same title, then `update_note` or `create_child_note` accordingly.  
7. **Update agenda** — `update_agenda_event` with a description containing the new note link; re-invite participants with `invite_users_to_agenda_event` when needed.  

## 6) Implementation watch points

1. **Parser** must survive envelope + string-only responses.  
2. **Idempotency** — one note per computed title; avoid duplicate child notes if the run retries.  
3. **Agenda** — `update` before `create` when `event_id` is stable; the MIPS API does not always expose a rich recurrence object—what matters is a stable `event_id` that n8n updates weekly.  
4. **LLM** output is advisory: keep the schema fixed (`suggested_agenda`, `vigilances`, `summary`).

## 7) Pre-flight checklist (MIPS)

- [ ] `WF03_SPACE_ID` / `WF03_PROJECT_ID` / template / parent / agenda ids set in n8n.  
- [ ] `EXO_MCP_ENDPOINT` points to the right cluster (`…/mcp-server/mcp`).  
- [ ] `WF03_ATTENDEE_USERNAMES` matches a comma-separated list of eXo usernames.  
- [ ] `WF03_STAGNATION_DAYS` / `WF03_BLOCKED_DAYS` / `WF03_OVERLOAD_THRESHOLD` aligned with the functional spec.  
- [ ] OAuth credential for `mcpOAuth2Api` valid on the Cloud instance.  

**Confirmed id bundle for this environment**

| Name | id |
|------|-----|
| Space | `1` |
| Project (task scope) | `3` |
| Template note | `25` |
| Report parent | `6` |
| Agenda anchor | `13` |

## 8) Conclusion (MIPS)

`mcp__exo_mips__` exposes every primitive WF03 needs: notes, tasks, agenda. The canonical automation is captured in this repo’s `workflow.json`; this document explains the business ids and the parsing rules that n8n **Code** nodes must continue to follow until native nodes replace the parsing and HTML work described in [docs/ISSUES.md](../../docs/ISSUES.md).
