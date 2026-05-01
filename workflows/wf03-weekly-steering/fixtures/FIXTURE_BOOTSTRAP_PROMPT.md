# WF03 — Fixture bootstrap prompt (weekly steering)

**Authoritative refs:** [SPEC.technical.md](../SPEC.technical.md), [config.env.example](../config.env.example).

## Goal

Align **space**, **task project**, **template note**, **reports parent note**, **recurring agenda anchor**, and **attendee roster** strings so WF03 can **`get_note`**, **`list_tasks`**, upsert weekly notes, and refresh **`update_agenda_event`**.

## Operator placeholders

| Placeholder | Example | Notes |
|-------------|---------|--------|
| `STEERING_SPACE_NAME` | Program steering space | Match **`get_all_spaces`** listing |
| `TASK_PROJECT_NAME` | Steering backlog | **`list_projects`** / UI |
| `TEMPLATE_NOTE_TITLE` | Weekly template | Align with editorial intent ([steering-template-note.md](steering-template-note.md)) |
| `REPORTS_PARENT_TITLE` | Weekly reports parent | Parent for **`create_child_note`** upserts |
| `AGENDA_EVENT_TITLE` | COPIL recurring invite | Stable **`WF03_AGENDA_PARENT_EVENT_ID`** anchor |

## Prerequisites outside MCP

- **Users:** **`WF03_ATTENDEE_USERNAMES`** comma-list must exist (`claire`, `etienne`, …)—**admin** provisioning.
- **Agenda:** Recurring event creation often **UI-only** if MCP lacks calendar-create/search.

## Ordered bootstrap steps

1. **`EXO_MCP_ENDPOINT`:** verify parity Cursor ↔ n8n.
2. **`WF03_SPACE_ID`:** **`get_all_spaces`** (or tenant-equivalent). Match **`STEERING_SPACE_NAME`** search-then-capture id; create space via **admin/UI** if absent.
3. **`WF03_PROJECT_ID`:** **`list_projects`** scoped per tenant conventions—match **`TASK_PROJECT_NAME`**; capture **`project_id`**.
4. **`WF03_TEMPLATE_NOTE_ID`:** locate template note under space (browse/search MCP); **`get_note`** to validate body matches expectations vs [steering-template-note.md](steering-template-note.md); capture id (create note structure in UI if MCP insufficient).
5. **`WF03_REPORTS_PARENT_NOTE_ID`:** locate parent note **`REPORTS_PARENT_TITLE`**; validate visibility for MCP credential.
6. **`WF03_AGENDA_PARENT_EVENT_ID`:** locate recurring event **`AGENDA_EVENT_TITLE`** (MCP calendar tools **if available**, else UI); capture stable numeric/string event id expected by **`update_agenda_event`** payload contract.
7. Optional: **`list_users_of_space_by_role`** (when exposed) to sanity-check **`WF03_ATTENDEE_USERNAMES`**.
8. Set literals **`WF03_MEETING_OWNER`**, **`WF03_STAGNATION_DAYS`**, **`WF03_BLOCKED_DAYS`**, **`WF03_OVERLOAD_THRESHOLD`** per operator preference (defaults in `config.env.example`).
9. **Merge** **all** keys from `config.env.example` into repository root **`.env`** (meta-skill Part C; conflict → ask overwrite vs keep). Optional scratch: `local/generated-wf03.env`.

## Fixture files (paths)

| Path | Purpose |
|------|---------|
| [steering-template-note.md](steering-template-note.md) | Editorial reference for template note body—not uploaded wholesale into MCP |

## Variables to emit

| Variable | Source |
|----------|--------|
| `EXO_MCP_ENDPOINT` | Verified URL |
| `WF03_SPACE_ID` | Spaces listing |
| `WF03_PROJECT_ID` | Projects listing |
| `WF03_TEMPLATE_NOTE_ID` | Notes discovery + **`get_note`** |
| `WF03_REPORTS_PARENT_NOTE_ID` | Notes discovery |
| `WF03_AGENDA_PARENT_EVENT_ID` | Calendar/event discovery |
| `WF03_MEETING_OWNER` | Operator |
| `WF03_ATTENDEE_USERNAMES` | Operator |
| `WF03_STAGNATION_DAYS` | Operator |
| `WF03_BLOCKED_DAYS` | Operator |
| `WF03_OVERLOAD_THRESHOLD` | Operator |

## Known gaps

| Gap | Fallback |
|-----|----------|
| Space/project/note/event creation absent from MCP | eXo UI |
| Attendee provisioning | Admin users/groups |
