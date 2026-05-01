# Workflow 03 - Weekly steering preparation (technical specification)

> Product rules: [SPEC.functional.md](SPEC.functional.md). Canonical graph: [workflow.json](workflow.json). Workflow tutorial: [README.md](README.md).

## 1) Scope and artifacts

- Canonical export in git: `workflows/wf03-weekly-steering/workflow.json`.
- Workflow-specific utility graphs:
  - `workflows/wf03-weekly-steering/subworkflows/wf03-build-report-context/workflow.json`
  - `workflows/wf03-weekly-steering/subworkflows/wf03-compose-steering-note-html/workflow.json`
- Shared utility graph:
  - `workflows/unwrap-mcp-json/workflow.json`
- Dependency manifest: `workflows/wf03-weekly-steering/subworkflow-dependencies.json`.

## 2) Configuration

Variables expected by the parent workflow (see `config.env.example`):

- `EXO_MCP_ENDPOINT`
- `WF03_SPACE_ID`
- `WF03_PROJECT_ID`
- `WF03_TEMPLATE_NOTE_ID`
- `WF03_REPORTS_PARENT_NOTE_ID`
- `WF03_AGENDA_PARENT_EVENT_ID`
- `WF03_MEETING_OWNER`
- `WF03_ATTENDEE_USERNAMES`
- `WF03_STAGNATION_DAYS`
- `WF03_BLOCKED_DAYS`
- `WF03_OVERLOAD_THRESHOLD`

Deploy-time remote ids (root `.env`, tenant-bound):

- `N8N_WORKFLOW_ID_WF03`
- `N8N_WORKFLOW_ID_UNWRAP`
- `N8N_WORKFLOW_ID_WF03_BUILD_REPORT`
- `N8N_WORKFLOW_ID_WF03_COMPOSE`

Credentials:

- MCP OAuth credential for notes/tasks/agenda calls.
- LLM credential for agenda/watch suggestions.

## 3) MCP contract

### 3.1 Tools used by WF03

- Spaces: `get_all_spaces` (or equivalent list call used by your MCP host)
- Notes: `get_note`, `search_notes`, `create_child_note`, `update_note`
- Tasks: `list_tasks`
- Agenda: `update_agenda_event`, `invite_users_to_agenda_event`

### 3.2 Response envelope

Most tools return text-wrapped payloads:

```json
[ { "type": "text", "text": "{...json or plain string...}" } ]
```

Parsing rule used across the graph:

1. unwrap outer list/object payload,
2. parse JSON in `text` when applicable,
3. keep string statuses as-is (`"Done"`, id-like strings).

### 3.3 Reference payload shape

`list_tasks` request shape used for the report context:

```json
{
  "project_id": 3,
  "limit": 100,
  "offset": 0,
  "hide_completed_tasks": false,
  "include_change_log": false
}
```

## 4) Technical sequence

1. Load static config (space/project/template/parent/agenda ids + attendee list + thresholds).
2. Resolve meeting date/occurrence for the generated title.
3. Read template note (`get_note`).
4. List tasks (`list_tasks`) and build report context.
5. Run LLM structured suggestion step (`suggested_agenda`, `vigilances`, `summary`).
6. Compose note HTML from template + report + AI sections.
7. Upsert weekly note (`search_notes` then `update_note` or `create_child_note`).
8. Update agenda description with the generated note link.
9. Re-invite participant list when needed (`invite_users_to_agenda_event`).

## 5) Data and mappings

### 5.1 Core id mapping

The workflow relies on stable ids configured through variables:

- space id (`WF03_SPACE_ID`)
- task project id (`WF03_PROJECT_ID`)
- template note id (`WF03_TEMPLATE_NOTE_ID`)
- reports parent note id (`WF03_REPORTS_PARENT_NOTE_ID`)
- agenda anchor event id (`WF03_AGENDA_PARENT_EVENT_ID`)

### 5.2 LLM output contract

Suggested output structure used by the compose phase:

```json
{
  "suggested_agenda": ["..."],
  "vigilances": ["..."],
  "summary": "..."
}
```

The output is advisory only; the meeting remains human-led.

### 5.3 Idempotency logic

- One weekly note per computed title.
- Upsert strategy avoids duplicate note creation on retries.
- Agenda keeps a stable event id and receives weekly description/link refresh.

## 6) Validation and operations

Validation checklist:

1. Verify all `WF03_*` variables match existing tenant objects.
2. Verify MCP + LLM credentials in n8n.
3. Run workflow and confirm:
  - note upsert behavior,
  - report section populated from tasks,
  - agenda description points to the generated note,
  - attendee list remains aligned.

Operational watch points:

- Parser must tolerate wrapped JSON and plain-string responses.
- Keep title convention stable to preserve idempotent search-before-create behavior.
- Large HTML updates may require longer MCP/HTTP timeouts.

Suggested follow-ups:

1. Further reduce remaining code nodes where native nodes are maintainable.
2. Add stronger guardrails for concurrent reruns on the same meeting slot.
3. Externalize additional formatting conventions if multiple steering templates are needed.

