# Workflow 01 - Email dispatch (technical specification)

> Product rules: [SPEC.functional.md](SPEC.functional.md). Canonical graph: [workflow.json](workflow.json). Shared parser utility: [../unwrap-mcp-json/](../unwrap-mcp-json/).

## 1) Scope and artifacts

- Canonical export in git: `workflows/wf01-email-dispatch/workflow.json`.
- Shared dependency: `workflows/unwrap-mcp-json/workflow.json`.
- Deploy manifest: `workflows/wf01-email-dispatch/subworkflow-dependencies.json`.
- Remote id is tenant-bound and configured through root `.env` (`N8N_WORKFLOW_ID_WF01`, optional when the export already carries a root `id`).

## 2) Configuration

- `EXO_MCP_ENDPOINT` in root `.env` — consumed by **`npm run generate:workflow-json`** to set each MCP Client `parameters.endpointUrl`; canonical git JSON may hold a demo literal until you generate.
- `WF01_PROJECT_ID` - optional target project id for `create_task_in_project`.
- MCP OAuth credential (n8n `mcpOAuth2Api`) must be valid for the target tenant.
- LLM credential must be configured for routing/model nodes.

Default behavior: if `WF01_PROJECT_ID` is missing, the workflow falls back to project id `3` in the demo export. Override this on any other tenant.

## 3) MCP contract

### 3.1 Tools used

- `list_emails`
- `create_task_in_project`
- `assign_task`
- Shared utility `UTIL - Unwrap MCP JSON` called after list/create MCP nodes.

### 3.2 Response envelope

Most MCP tools return text-wrapped JSON:

```json
[ { "type": "text", "text": "{...json...}" } ]
```

The workflow unwraps this envelope before extraction (`Unwrap MCP Emails`, `Unwrap MCP Create Task`).

### 3.3 Reference payloads

Create task (`create_task_in_project`, built in `createTaskInput`):

```json
{
  "project_id": 3,
  "title": "Access issue to ticketing",
  "description": "<div>...</div>",
  "assignee": "louis",
  "priority": "HIGH"
}
```

Assign task (`assign_task`):

```json
{
  "task_id": 14,
  "username": "louis"
}
```

## 4) Technical sequence

1. Trigger (`Manual Start` or `Intake Every 5m`).
2. `MCP List Emails` (`list_emails`, empty JSON object `{}` — the tenant MCP tool does not accept pagination fields such as `limit` / `offset`).
3. `Unwrap MCP Emails`.
4. `Split Out Emails` (one item per message).
5. `Normalize Email` and `Filter - Has Email ID`.
6. `AI Router` + parser, then `Normalize AI Output`.
7. `IF Clearly Actionable` guardrail.
8. Build payload and HTML (`Build MCP Payload`, `Render Task Description HTML`).
9. `MCP Create Task` then `Unwrap MCP Create Task`.
10. Extract assignment fields (`task_id`, `username`) and validate (`IF Has Task ID`).
11. Success branch: `MCP Assign Task`; failure branch: `Stop - Missing task_id`.

## 5) Data and mappings

### 5.1 Structured LLM output contract

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

`slaHours` is kept for future use; current WF01 does not compute due dates.

### 5.2 Mapping rules

Assignee mapping:

- Allowed: `louis`, `claire`, `lucie`.
- Fallback: `claire`.

Priority mapping:

- Allowed by MCP create: `LOW`, `NORMAL`, `HIGH`.
- `URGENT` is normalized to `HIGH`.
- Unknown values fall back to `NORMAL`.

## 6) Validation and operations


1. Keep `N8N_WORKFLOW_ID_UNWRAP` aligned for REST deploy.
2. Re-run behavior can create duplicates because email idempotency is not yet persisted.

Suggested follow-ups:

1. Persist idempotency by `emailId`.
2. Move SLA sweep/proof comments to dedicated follow-up flows if needed.
3. Externalize assignee/priority mapping into a config source.
