# Workflow 01 - Email dispatch (technical specification)

> See `[SPEC.functional.md](SPEC.functional.md)` for product context and rules. n8n artifact: `[workflow.json](workflow.json)` ; shared sub-workflow: `[../shared/subworkflows/unwrap-mcp-json/](../shared/subworkflows/unwrap-mcp-json/)`.

## 1) Reference artifacts

- Final workflow (repo): `workflows/wf01-email-dispatch/workflow.json`.
- Remote n8n workflow: `zeVd0scWqU5vcOUq` (`WF01 - Email dispatch`).
- Utility sub-workflow: `UTIL - Unwrap MCP JSON` (`E4OAThogWRG93MUG`).
- Local sub-workflow: `workflows/shared/subworkflows/unwrap-mcp-json/workflow.json`.

## 2) MCP tools

### 2.1 eXo MCP

- `list_emails`
- `create_task_in_project`
- `assign_task`

### 2.2 n8n / utility sub-workflow

- `UTIL - Unwrap MCP JSON` (`E4OAThogWRG93MUG`) is called with `Execute Workflow` after `list_emails` and after `create_task_in_project`.

## 3) Variables and configuration

- `EXO_MCP_ENDPOINT` — eXo MCP endpoint used by `MCP Client` nodes.
- `WF01_PROJECT_ID` — optional eXo target project.

If `WF01_PROJECT_ID` is not set, the workflow uses `3` (project `Festival Art2Rue` on the eXo MIPS instance).

## 4) Current technical sequence

1. `Manual Start` or `Intake Every 5m`.
2. `MCP List Emails`: `list_emails` with `{ "limit": 50, "offset": 0 }`.
3. `Unwrap MCP Emails`: turns the MCP response into a usable JSON payload.
4. `Split Out Emails`: one n8n item per email.
5. `Normalize Email`: extracts useful fields.
6. `Filter - Has Email ID`: drop items without `emailId`.
7. `AI Router`: triage with `Routing Model` and `Routing Output Parser`.
8. `Normalize AI Output`: maps LLM output to native fields.
9. `IF Clearly Actionable`: enforces guardrails.
10. `Build MCP Payload`: assignee, label, priority, title.
11. `Render Task Description HTML`: builds HTML description and `createTaskInput`.
12. `MCP Create Task`: `create_task_in_project`.
13. `Unwrap MCP Create Task`: decodes the create response.
14. `Extract Task Assignment`: `task_id`, `username`, `raw_create_payload`.
15. `IF Has Task ID`: `task_id` must be a positive number.
16. True branch: `MCP Assign Task` — `assign_task`.
17. False branch: `Stop - Missing task_id` stops with a clear error.

## 5) Expected LLM output

The structured parser expects output compatible with:

```json
{
  "action_required": true,
  "response_expected": true,
  "action_confidence": 0.92,
  "assignee_username": "louis",
  "priority": "HIGH",
  "slaHours": 4,
  "task_title": "Ticketing VPN incident",
  "summary": "VPN outage.",
  "next_action": "Diagnose.",
  "rationale": "Technical issue."
}
```

`slaHours` is kept in the LLM contract for future use; the current workflow does not compute due dates or run an SLA sweep.

## 6) Mapping rules

### Assignee

- Allowed: `louis`, `claire`, `lucie`.
- Any other value falls back to `claire`.
- Displayed labels: `Louis`, `Claire`, `Lucie`.

### Priority

- `create_task_in_project` accepts `LOW`, `NORMAL`, `HIGH`.
- `URGENT` maps to `HIGH` (not a supported enum value in create).
- Unknown values fall back to `NORMAL`.

## 7) Reference payloads

### 7.1 Create task: `create_task_in_project`

The workflow builds this under `createTaskInput`:

```json
{
  "project_id": 3,
  "title": "Access issue to ticketing",
  "description": "<div>...</div>",
  "assignee": "louis",
  "priority": "HIGH"
}
```

### 7.2 Assign: `assign_task`

```json
{
  "task_id": 14,
  "username": "louis"
}
```

## 8) Observed validation

Last known server run:

- n8n execution: `1117`;
- status: success;
- created tasks: `13` and `14`;
- project: `Festival Art2Rue` (`project_id=3`);
- `create_task_in_project` validated;
- `task_id` extraction via `Unwrap MCP Create Task` validated.

Direct `assign_task` with `{ "task_id": 13, "username": "louis" }` was also validated.

## 9) Possible improvements

1. Persist idempotency by `emailId`.
2. Reintroduce an SLA sweep in a separate workflow if the demo needs it.
3. Add a proof comment after task creation.
4. Resolve the target project by name when multiple eXo environments are used.
5. Externalize assignee/priority rules in a config table.
6. Remove the last **Code** node if native HTML rendering becomes maintainable.

