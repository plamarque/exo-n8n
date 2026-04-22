# Workflow 01 - Email to Task (MVP)

## Files
- `n8n/workflows/workflow-01-email-to-task.json`
- `n8n/config/workflow-01.env.example`

## Scope implemented
- Email intake trigger (manual + every 5 min).
- MCP email polling (`list_emails`) and detail fetch (`get_email_by_id`).
- Rule-based qualification (priority, assignee, SLA due date).
- Project + status resolution (`list_projects`, `list_project_statuses`).
- Task creation MCP-first (`create_task_in_project`) with REST fallback (`POST /tasks`).
- Evidence comment on created task (`add_task_comment`).
- SLA sweep every hour with overdue reminder and escalation (`list_tasks`, `assign_task`, `add_task_comment`).

## Assumptions
- The MCP endpoint accepts a JSON payload in this shape:
  - `{ "tool": "<tool_name>", "arguments": { ... } }`
- The MCP response may be wrapped in `[{"type":"text","text":"<json-string>"}]` and is parsed in Code nodes.
- REST fallback uses bearer token auth.

## Import in n8n
1. Import `n8n/workflows/workflow-01-email-to-task.json`.
2. Define env vars from `n8n/config/workflow-01.env.example`.
3. Run with `Manual Trigger` for first validation.
4. Activate workflow after endpoint contract validation.

## Next hardening steps
1. Replace static keyword rules with configurable data source.
2. Add assignee capacity check (via `list_assigned_tasks`).
3. Add idempotency persisted in Data Store (instead of workflow static data only).
4. Add per-node MCP->REST fallback for assignment/comment/status update.
