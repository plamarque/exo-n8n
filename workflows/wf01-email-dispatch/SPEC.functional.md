# Workflow 01 - Email dispatch (functional specification)

> See `[SPEC.technical.md](SPEC.technical.md)` for the JSON artifact, n8n sequence, and MCP payloads. Portfolio summary: `[../../docs/SPEC.md](../../docs/SPEC.md)`.

## 1) Goal

Automate triage of incoming Art2Rue festival emails and create eXo tasks only for messages that are clearly actionable.

The workflow uses native n8n nodes for intake, guardrails, and triage, plus an **HTML** node for the task description. There is no utility sub-workflow and no **Code** node on the canonical graph.

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
2. Expand the MCP response with **Split Out** on `content[0].text` (one item per email).
3. Drop items missing any required field for routing: `email_id`, `subject`, `content.body`, `sender.address`.
4. Structured LLM analysis per remaining email (`action_required`, `action_confidence`, `assignee_username`, `priority`, `task_title`, `summary`).
5. Create a task only when `action_required` is true and `action_confidence` ≥ 0.7.
6. Map assignee and priority from structured LLM output into `create_task_in_project`.
7. Create an eXo task in the target project with `assignee`, `priority`, title, and HTML description in the same `create_task_in_project` call — no separate `assign_task` step.

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
- `create_task_in_project` receives a valid `project_id` (tutorial graph uses literal `3` in `workflow.json`; edit for other tenants), plus `assignee` aligned with AI output.
- MCP or n8n surfaces errors if task creation fails; there is no extra guard node after create in the tutorial graph.