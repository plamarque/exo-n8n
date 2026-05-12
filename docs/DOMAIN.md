# Domain Model

## Context

The project domain is workflow automation between n8n and eXo for festival project operations. The scenarios use Art2Rue / Festival Art de Rue examples to demonstrate task intake, document validation, meeting preparation, and document enrichment.

## Core Terms

- eXo: target collaboration platform used for tasks, documents, spaces, notes, categories, and agenda objects.
- n8n: workflow automation runtime that orchestrates triggers, MCP calls, AI nodes, Data Tables, and webhook handling.
- MCP: protocol and node/tool layer used to access eXo capabilities from workflows.
- Workflow export: canonical `workflow.json` under `workflows/<name>/` (see [ADR 0002](ADR/0002-repository-layout-workflows.md)).
- SDK artifact: optional reference files (for example under `workflows/**/fixtures/`) that are not the primary execution artifact.
- Data Table: n8n persistence mechanism used for tracking processed documents or workflow state.
- Code node: n8n custom JavaScript node. The current project tries to reduce unnecessary Code nodes while keeping them where native nodes are not practical.
- **COPIL / steering committee:** **COPIL** is conventional French project shorthand for a recurring **steering committee** (the underlying French phrase is *comité de pilotage*). In English prose, **steering committee** or **steering group** is the clearest default. **SteerCo** is informal corporate shorthand in some organizations, not a universal standard. WF03 still uses `COPIL` in several n8n node names and titles so exports stay aligned with the demo tenant.

## Actors

- Email requester: sender of an incoming email that may become an eXo task.
- Task assignee: eXo user assigned to a created task. WF01 maps AI output to `louis`, `claire`, or `lucie` via the `assignee` field on `create_task_in_project` (no separate `assign_task` in the tutorial graph).
- Document author/uploader: user who submits or updates a document for validation.
- Direction Artistique: WF02 approval authority represented by `nadia`.
- Direction Technique: WF02 approval authority represented by `etienne`.
- Steering committee participants (COPIL roster in the demo): `claire`, `etienne`, `louis`, `nadia`, `antoine`, and `emma`.
- Workflow operator: person importing, validating, activating, or running workflows in n8n.

## Main Entities

- Email: incoming message read by WF01 through `list_emails`.
- Task: eXo task created or updated through MCP tools such as `create_task_in_project`, `assign_task` (used in other workflows), `add_task_comment`, and `update_task_status`.
- Document: eXo document read, validated, enriched, or categorized by workflows.
- DMS: document management system; English equivalent of the French acronym GED (electronic document management).
- Approval: WF02 decision with role, actor, decision, optional reason, task, and validation cycle.
- Note: eXo note used by WF03 as a steering committee (COPIL) template or generated meeting note.
- Agenda event: eXo calendar event used by WF03 for the weekly steering committee (COPIL) invitation.
- Category: eXo classification term used by WF04 document enrichment.
- Category cache row: WF04 Data Table row in **`exo_category_cache`** (`category_id`, `category_label`) synchronized from **`get_category_tree`** for lookup.
- Processed document record: WF04 Data Table row keyed by document and last processed state.

## Observable Business Rules

- WF01 creates tasks only when an email is clearly actionable and expects a response.
- WF01 maps unknown assignees to `claire` and unknown priorities to `NORMAL`.
- WF02 requires two equivalent approvals before final completion.
- WF02 treats refusal as a correction/rework path rather than a successful closure.
- WF03 AI suggestions support the meeting; they do not replace human decisions.
- WF04 relies on operator-configured **`space_id`** and display **`spaceName`** literals (from **`.env`** + generate/deploy); the didactic graph does not validate them with an entry IF.
- WF04 skips unchanged documents already represented in the tracking table.
- WF04 persists a flattened category catalogue in **`exo_category_cache`** for lookup during assignment (one small **Code** node walks **`get_category_tree`** nesting before upsert; suggested labels are resolved with Data Table **get**).

## Assumptions And Uncertainties

- [ASSUMPTION] The festival examples are demonstration fixtures, not necessarily production tenant data.
- [ASSUMPTION] Usernames listed in workflow specs are valid in the targeted demo environments when those workflows are run.
- [UNCERTAIN] The exact production activation status of WF03 is not fully established from the current repository documentation.
- [UNCERTAIN] Some example configuration files appear older than the latest workflow-specific documentation; conflicts should be resolved before using them as deployment truth.

