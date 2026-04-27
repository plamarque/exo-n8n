# Workflow 01 - Email dispatch (functional specification)

> See `[SPEC.technical.md](SPEC.technical.md)` for the JSON artifact, n8n sequence, and MCP payloads. Portfolio summary: `[../../docs/SPEC.md](../../docs/SPEC.md)`.

## 1) Goal

Automate triage of incoming Art2Rue festival emails and create eXo tasks only for messages that are clearly actionable.

The final workflow prefers native n8n nodes for normalization, guardrails, and data extraction. A single **Code** node remains for controlled HTML in the task description.

## 2) Business context

The city of Chevigny is preparing the Art2Rue festival. The project team centralizes interaction in eXo, but some requests still arrive by email.

Useful examples for the demo:

- VPN outage for the ticketing vendor;
- DMS access for partners;
- urgent question on a missing document;
- informational message that should **not** create a task.

The point is to show that an n8n + eXo MCP flow can turn actionable email into assigned tasks while skipping ambiguous or purely informative mail.

## 3) In-scope behavior

1. Read emails with `list_emails`.
2. Decode MCP envelopes via sub-workflow `UTIL - Unwrap MCP JSON`.
3. Normalize email fields: `emailId`, `subject`, `body`, `sender`, `receivedAt`.
4. Filter emails without an identifier.
5. Structured LLM analysis per email.
6. Create a task only when all three are true: `actionRequired=true`, `responseExpected=true`, `actionConfidence >= 0.7`.
7. Native resolution of assignee and priority from LLM output.
8. Create an eXo task in the target project.
9. Native extraction of `task_id` from the MCP response.
10. Hard failure if creation returns no `task_id`.
11. Assign the task with `assign_task`.

## 4) Out of scope (current)

- No REST fallback.
- No dynamic project/status resolution through `list_projects` or `list_project_statuses`.
- No SLA sweep, automatic nudge, or manager escalation.
- No automatic proof comment after task creation.
- No persisted idempotency to avoid duplicates on re-runs.
- No `get_email_by_id`: `list_emails` provides what this workflow needs.

These may be future improvements; they are not part of the current final workflow.

## 5) Acceptance criteria

- Clearly actionable email → eXo task.
- Non-actionable or ambiguous email → no task.
- Created tasks have a title, HTML description, priority, and assignee.
- `create_task_in_project` receives a valid `project_id` (`WF01_PROJECT_ID` or default `3`).
- A create response with no `task_id` stops the workflow explicitly.
- `assign_task` uses the expected MCP `username` field.