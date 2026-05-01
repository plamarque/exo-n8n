# Workflow 02 - Document validation (technical specification)

> Product rules: [SPEC.functional.md](SPEC.functional.md). Canonical graph: [workflow.json](workflow.json). Shared parser utility: [../unwrap-mcp-json/](../unwrap-mcp-json/).

## 1) Scope and artifacts

- Canonical export in git: `workflows/wf02-document-validation/workflow.json`.
- Dependency manifest: `workflows/wf02-document-validation/subworkflow-dependencies.json` (unwrap deployed first on REST push).
- Remote id is tenant-bound via root `.env` (`N8N_WORKFLOW_ID_WF02`, optional when the export already carries a root `id`).
- This document describes the final MCP-first implementation (no QA spike narrative).

## 2) Configuration

Required runtime variables:

- `EXO_MCP_ENDPOINT` - MCP endpoint used by all MCP Client nodes.
- `WF02_PARENT_FOLDER_ID` - watched folder id for document intake.
- `WF02_PROJECT_ID` - target project id for created validation tasks.
- `WF02_INPROGRESS_STATUS_ID` - status id used after task creation and on rejection branch.
- `WF02_DONE_STATUS_ID` - status id used when both approvals are `APPROVED`.
- `WF02_APPROVAL_BASE_URL` - hosted n8n Form URL (`.../form/...`), not `/webhook/...`.

Credentials and dependencies:

- n8n MCP credential (`mcpOAuth2Api`) must be authorized for document/task operations.
- Shared unwrap sub-workflow id must be resolvable (`N8N_WORKFLOW_ID_UNWRAP`) for REST deploy.

## 3) MCP contract

### 3.1 Tools used

Read/intake:

- `search_documents`
- `get_document_by_id`

Task lifecycle:

- `create_task_in_project`
- `assign_task`
- `add_task_comment`
- `update_task_status`
- `get_task_by_id` (support/validation path)
- `list_tasks` (support/validation path)

Optional setup/inspection:

- `list_projects`
- `list_project_statuses`
- `list_users_of_space_by_role`

### 3.2 Response envelope

The workflow handles heterogeneous MCP outputs. Typical wrapped shape:

```json
[{ "type": "text", "text": "{...json...}" }]
```

Observed variants include plain objects and short status strings (for example `"Done"` after status updates). The shared unwrap utility plus local normalization nodes handle this.

### 3.3 Reference payloads

Search in watched folder:

```json
{ "query": "", "parent_folder_id": "<folder-id>", "limit": 200, "offset": 0 }
```

Create task (minimal validated shape):

```json
{
  "project_id": 2,
  "title": "Sample task title",
  "description": "Plain or HTML description body",
  "assignee": "patrice",
  "priority": "NORMAL"
}
```

Status update:

```json
{ "task_id": 398, "status_id": 8 }
```

## 4) Technical sequence

### 4.1 Intake branch (manual start / schedule)

1. Ensure Data Tables exist (`wf02_processed_documents`, `wf02_approvals`).
2. `search_documents` on `WF02_PARENT_FOLDER_ID`.
3. Unwrap + coalesce into `documents[]`, then split one item per document.
4. Normalize document fields (`id`, `updatedDate`, `name`, uploader, links).
5. LEFT JOIN with processed-table snapshot to keep only unseen or updated documents.
6. `get_document_by_id` for each selected item.
7. Build task fields (`cycle_id`, title, author fallback, links).
8. Render description HTML and create task payload.
9. `create_task_in_project` -> unwrap -> extract `task_id`.
10. Guard `task_id`; stop with explicit error when missing.
11. Move task to `WF02_INPROGRESS_STATUS_ID`.
12. Add initial comment containing approval form links.
13. Seed approval row in `wf02_approvals` and update `wf02_processed_documents`.

### 4.2 Approval form branch (`/form/.../approve`)

1. Form receives `task_id`, `cycle_id`, `role`, `actor`, `decision`, optional `reason`.
2. Parse and normalize (`role` lowercased, decision enum normalization).
3. Validate payload and required reject reason.
4. Add decision comment to task.
5. Read current approval row and merge the new stamp.
6. Upsert merged row into `wf02_approvals`.
7. Compute `joinReady` and `bothApproved`.
8. If not join-ready: return pending form completion.
9. If both approved: set `WF02_DONE_STATUS_ID` + final approved comment.
10. Else: keep `WF02_INPROGRESS_STATUS_ID` + final rejected comment.

## 5) Data and mappings

### 5.1 Data tables

`wf02_processed_documents` (intake idempotency):

- `documentId`
- `lastProcessedDate`
- `cycleId`

`wf02_approvals` (per-cycle split/join state):

- `cycleKey` (`task_id:cycle_id`)
- `task_id`, `cycle_id`, `document_id`, `author_username`
- `artistic_decision`, `artistic_reason`, `artistic_at`
- `technical_decision`, `technical_reason`, `technical_at`

### 5.2 Approval payload mapping

- `role` must resolve to `artistic` or `technical` (case-insensitive).
- `decision` must resolve to `APPROVED` or `REJECTED`.
- Rejected decisions require a non-empty reason.
- Join rule: close only when both role decisions are `APPROVED`.

### 5.3 Status mapping

Status ids are project-specific. Resolve through MCP `list_project_statuses` on the target `WF02_PROJECT_ID` and set:

- `WF02_INPROGRESS_STATUS_ID`
- `WF02_DONE_STATUS_ID`

## 6) Validation and operations

Validation checklist:

1. Verify all `WF02_*` variables and MCP credential.
2. Upload sample docs to the watched folder and run intake.
3. Confirm one task per new/updated document.
4. Submit both approval forms and verify split/join behavior.
5. Check Data Table rows update as expected.

Operational notes:

- The workflow is MCP-first; no REST fallback path is documented here.
- `WF02_APPROVAL_BASE_URL` must remain a Form URL, never a raw webhook URL.
- First run self-bootstraps table schemas through `createIfNotExists` nodes.

Suggested follow-ups:

1. Add signed approval tokens and stronger role checks.
2. Add explicit duplicate-submit protection (`last write wins` is current behavior).
3. Optionally resolve status ids dynamically at runtime.

