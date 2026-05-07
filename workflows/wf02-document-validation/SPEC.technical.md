# Workflow 02 - Document validation (technical specification)

> Product rules: [SPEC.functional.md](SPEC.functional.md). Canonical graph: [workflow.json](workflow.json). Shared parser utility: [../unwrap-mcp-json/](../unwrap-mcp-json/).

## 1) Scope and artifacts

- Canonical export in git: `workflows/wf02-document-validation/workflow.json`.
- Dependency manifest: `workflows/wf02-document-validation/subworkflow-dependencies.json` (unwrap deployed first on REST push).
- Remote id is tenant-bound via root `.env` (`N8N_WORKFLOW_ID_WF02`, optional when the export already carries a root `id`).
- This document describes the final MCP-first implementation (no QA spike narrative).

## 2) Configuration

Required runtime variables:

- `EXO_MCP_ENDPOINT` in root `.env` — **`npm run generate:workflow-json`** writes the MCP Client `parameters.endpointUrl` literals; canonical graph may use a demo URL until then.
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

### 3.3 Coalesce after unwrap (tutorial assumption)

**[ASSUMPTION]** After **`Unwrap MCP Search Folder Docs`**, each item is shaped like the UTIL sub-workflow output: `{ payload: <object> }`, where `payload` is either `{ documents: [...] }`, a bare array of document rows, or a single document object with `document_id`. The **`Coalesce Documents List`** Set node expands that into a `documents` array for **Split Out** only — it no longer re-parses raw MCP `content[]` or markdown-fenced JSON. Tenants where `search_documents` still reaches Coalesce without going through UTIL unwrap, or with a different top-level shape, need the older defensive coalesce restored or an extra normalization step.

### 3.4 Reference payloads

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

### 3.5 `create_task_in_project` in canonical `workflow.json`

The **`MCP Create Task`** node uses **Manual** input (resource mapper). Mapped fields: `project_id` (from `WF02_PROJECT_ID` with demo fallback), `title`, `description` (from the **HTML** node output), `assignee`, `priority` (`NORMAL`). Unused optional tool parameters remain in `schema` with **`removed: true`** so UI re-import does not send empty ghosts (same pattern as WF01).

## 4) Technical sequence

### 4.1 Intake branch (manual start / schedule)

1. `search_documents` on `WF02_PARENT_FOLDER_ID` (triggers connect **directly** to this MCP step — no Data Table nodes at workflow entry).
2. Unwrap + coalesce into `documents[]`, then split one item per document.
3. Filter + normalize document fields (`id`, `updatedDate`, `name`, uploader, links).
4. **`Ensure Tracking Table`** (`createIfNotExists`, **`executeOnce`**) immediately before **`Get Processed Docs`** — the tracking table is introduced only when the graph first needs to read it for the merge.
5. LEFT JOIN with processed-table snapshot (`Merge Docs to Process`) to keep only unseen or updated documents.
6. `get_document_by_id` for each selected item.
7. Build task fields (`cycle_id`, title, author fallback, links) from unwrap payload with Merge fallbacks.
8. Render description with the **HTML** node (fixed template; WF01-style).
9. `create_task_in_project` (**Manual** MCP mapping) → unwrap → extract `task_id` (flattened `payload` from UTIL).
10. Guard `task_id`; stop with explicit error when missing.
11. Move task to `WF02_INPROGRESS_STATUS_ID`.
12. Add initial comment containing approval form links.
13. **`Ensure Approvals Table (intake)`** (`createIfNotExists`, **`executeOnce`**) immediately before **`Seed Approval Row`**, then update `wf02_processed_documents`.

### 4.2 Approval form branch (`/form/.../approve`)

1. Form receives `task_id`, `cycle_id`, `role`, `actor`, `decision`, optional `reason`.
2. Parse and normalize (`role` lowercased, decision enum normalization).
3. Validate payload and required reject reason.
4. Add decision comment to task.
5. **`Ensure Approvals Table (form branch)`** (`createIfNotExists`, **`executeOnce`**) immediately before **`Get Approval Rows`** (covers cold-start form submissions if the approvals table was never created on intake).
6. Read current approval row and merge the new stamp.
7. Upsert merged row into `wf02_approvals`.
8. Compute `joinReady` and `bothApproved`.
9. If not join-ready: return pending form completion.
10. If both approved: set `WF02_DONE_STATUS_ID` + final approved comment.
11. Else: keep `WF02_INPROGRESS_STATUS_ID` + final rejected comment.

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
- Table schemas are bootstrapped through **`createIfNotExists`** on **`Ensure …`** nodes placed **just before** first read or write (not at the trigger).

Suggested follow-ups:

1. Add signed approval tokens and stronger role checks.
2. Add explicit duplicate-submit protection (`last write wins` is current behavior).
3. Optionally resolve status ids dynamically at runtime.

## 7) Didactic simplification slice (ADR 0004)

This graph is **tutorial-oriented**: explainability on the canvas takes priority over maximal envelope tolerance.

- **Unwrap scope (Option B):** All three **`Unwrap MCP …`** Execute Workflow calls are **kept** so heterogeneous MCP envelopes still normalize before business logic. **`Coalesce Documents List`** was shortened to assume UTIL output (see §3.3) instead of duplicating full envelope parsing.
- **Native HTML:** Task body uses the **HTML** node, not a Code node with manual escaping.
- **MCP hygiene:** **`MCP Create Task`** uses **Manual** parameter rows and `removed: true` on unused optional fields (§3.5).
- **Shorter expressions:** **`Build Task Fields`** and **`Extract Task ID`** assume UTIL has already flattened `payload` for `get_document_by_id` / `create_task_in_project`; a narrow fallback for `task.task_id` remains in **`Extract Task ID`**.
- **Deferred table bootstrap:** **`Ensure Tracking Table`** runs immediately before **`Get Processed Docs`**. **`Ensure Approvals Table (intake)`** runs immediately before **`Seed Approval Row`**; **`Ensure Approvals Table (form branch)`** runs immediately before **`Get Approval Rows`** (same schema, idempotent `createIfNotExists`; **`executeOnce`** limits redundant work per execution branch).

**Deferred hardening** (reintroduce if you need multi-tenant robustness without assumptions): restore the long Coalesce expression; widen **`Extract Task ID`** for nested `content[0].text` shapes; keep documenting gaps in [ISSUES.md](../../docs/ISSUES.md).

