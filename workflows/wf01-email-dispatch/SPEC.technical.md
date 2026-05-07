# Workflow 01 - Email dispatch (technical specification, tutorial version)

> Product rules: [SPEC.functional.md](SPEC.functional.md). Canonical graph: [workflow.json](workflow.json).

## 1) Scope and artifacts

- Canonical export in git: `workflows/wf01-email-dispatch/workflow.json`.
- Deploy manifest: `workflows/wf01-email-dispatch/subworkflow-dependencies.json`.
- Remote id is tenant-bound and configured through root `.env` (`N8N_WORKFLOW_ID_WF01`, optional when the export already carries a root `id`).

## 2) Configuration

- `EXO_MCP_ENDPOINT` in root `.env` — consumed by **`npm run generate:workflow-json`** to set each MCP Client `parameters.endpointUrl`; canonical git JSON may hold a demo literal until you generate.
- `WF01_PROJECT_ID` - optional target project id for `create_task_in_project`.
- MCP OAuth credential (n8n `mcpOAuth2Api`) must be valid for the target tenant.
- LLM credential must be configured for routing/model nodes.

Default behavior: if `WF01_PROJECT_ID` is missing, the workflow falls back to project id `3` in the demo export.

## 3) MCP contract

### 3.1 Tools used

- `list_emails`
- `create_task_in_project`
- `assign_task`
- Shared utility `UTIL - Unwrap MCP JSON` called after `create_task_in_project` in this tutorial version.

### 3.2 Response envelope

MCP tools may return text-wrapped JSON:

```json
[ { "type": "text", "text": "{...json...}" } ]
```

In this tutorial version, `create_task_in_project` and `assign_task` use direct field access from MCP output.

## 4) Technical sequence (simplified)

1. Trigger (`Manual Start`).
2. `MCP List Emails` (`list_emails`, empty JSON object `{}`).
3. `Split Out Emails` (split `content[0].text` into one item per email).
4. `IF Has Required Email Fields` (drop entries missing any required field for routing: `email_id`, `subject`, `content.body`, `sender.address`).
5. `AI Router` + parser.
6. `Normalize AI Output`.
7. `IF Actionable` guardrail.
8. `Build Create Task Input` (project id, title, HTML description, assignee, priority).
9. `MCP Create Task`.
10. `IF Has Task ID` (checks `content[0].text.task_id` / `content[0].text.id`).
11. Success branch: `MCP Assign Task`; failure branch: `Stop - Missing task_id`.

## 5) Data and mappings

### 5.1 Structured LLM output contract (tutorial)

```json
{
  "action_required": true,
  "response_expected": true,
  "action_confidence": 0.92,
  "assignee_username": "louis",
  "priority": "HIGH",
  "task_title": "Ticketing VPN incident",
  "summary": "VPN outage that blocks sales."
}
```

### 5.2 Mapping rules

Assignee mapping:

- Allowed: `louis`, `claire`, `lucie`.
- Fallback: `claire`.

Priority mapping:

- Allowed by MCP create: `LOW`, `NORMAL`, `HIGH`.
- `URGENT` is normalized to `HIGH`.
- Unknown values fall back to `NORMAL`.

## 6) Validation and operations

1. Re-run behavior can create duplicates because email idempotency is not yet persisted.

Suggested follow-ups:

1. Add persisted idempotency by `emailId`.
2. Re-introduce richer payload hardening if needed for production stability.
