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
- `WF02_PARENT_FOLDER_ID` (root **`.env`**) — watched folder id for document intake. Canonical **`MCP Search Folder Docs`** uses **Manual** tool parameters with a literal `parent_folder_id` (reference tenant default in git). **`npm run generate:workflow-json`** and REST deploy rewrite that literal from `WF02_PARENT_FOLDER_ID` when set (see `WF02_CANONICAL_PARENT_FOLDER_ID` in deploy tooling). The graph does **not** read `$vars.WF02_PARENT_FOLDER_ID` at runtime.
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

Observed variants include plain objects and short status strings (for example `"Done"` after status updates). **`Unwrap MCP Get Document`** and **`Unwrap MCP Create Task`** call the shared UTIL sub-workflow. **`search_documents`** stays on the **raw MCP Client** item shape: **`content[0].text`** is an **array of document rows** (same pattern as WF01/WF04 Split Out).

### 3.3 `search_documents` → Split Out → merge (SQL field mapping)

**[ASSUMPTION]** Each item from **`MCP Search Folder Docs`** includes **`content`**: an array whose first element has **`type`: `text`** and **`text`**: an **array** of eXo document objects (`document_id`, `updated_date`, `created_date`, `name`, `url`, `created_username`, …). **`Split Out Documents`** uses **`fieldToSplitOut`: `content[0].text`** (one output item per document). If a tenant returns **`text`** as a JSON string, a different nesting, or an empty **`content`**, restore **UTIL + Set** or widen the path; see §7.

**`Merge Docs to Process`** uses n8n **Merge → SQL Query**, which runs on **AlaSQL** (not SQLite). Do **not** use SQLite-only functions such as **`json_extract`** — they fail at runtime (`alasql.fn.json_extract is not a function`). Prefer plain column paths on structured inputs, e.g. **`input1.created_username.username AS uploader`**.

**`Merge Docs to Process`** (`combineBySql`): **input1** is each split row (API shape: **`document_id`**, **`updated_date`**, **`created_date`**, **`name`**, **`url`**, **`created_username`** object). **`updatedDate`** uses **`COALESCE(updated_date, created_date)`** only. **input2** is each row from **`Get Processed Docs`** after **`Ensure Merge Processed Input`**. The **`WHERE`** clause keeps unseen docs or rows whose coalesced timestamp is **greater than** **`lastProcessedDate`**. Trust consistent ISO date strings for lexical comparison; if a tenant stores **`lastProcessedDate`** in another format, normalize or widen the expression.

### 3.4 Reference payloads

Search in watched folder (canonical **Manual** mapping on **`MCP Search Folder Docs`**; **`limit` 100** / **`offset` 0** pulls a broad candidate set; **`Merge Docs to Process`** then filters to new or updated documents against **`wf02_processed_documents`**):

```json
{ "query": "", "parent_folder_id": "<folder-id>", "limit": 100, "offset": 0 }
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

1. **Triggers** (**`Manual Start`** / **`Schedule Intake (5m)`**) fan out to **two parallel branches**: (A) **`MCP Search Folder Docs`** and (B) **`Ensure Tracking Table`** → **`Get Processed Docs`** → **`Ensure Merge Processed Input`**.
2. **Branch A:** **`MCP Search Folder Docs`** → **`Split Out Documents`** on **`content[0].text`** (one item per search hit; see §3.3).
3. **`Merge Docs to Process`** — SQL **`combineBySql`** joins when both branches have supplied data: **input1** = split rows from branch A, **input2** = processed-doc rows from branch B (`documentId`, `lastProcessedDate`, …); see §3.3 for column names and aliases.
4. `get_document_by_id` for each selected item.
5. Build task fields (`cycle_id`, title, author fallback, links) from unwrap payload with Merge fallbacks.
6. Render description with the **HTML** node (fixed template; WF01-style).
7. `create_task_in_project` (**Manual** MCP mapping) → unwrap → extract `task_id` (flattened `payload` from UTIL).
8. Guard `task_id`; stop with explicit error when missing.
9. Move task to `WF02_INPROGRESS_STATUS_ID`.
10. Add initial comment containing approval form links.
11. **`Ensure Approvals Table (intake)`** (`createIfNotExists`, **`executeOnce`**) immediately before **`Seed Approval Row`**, then update `wf02_processed_documents`.

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
- Table schemas are bootstrapped through **`createIfNotExists`** on **`Ensure …`** nodes: intake uses **`Ensure Tracking Table`** at the **same time as** the MCP search (parallel from the trigger), still **before** **`Get Processed Docs`** on that branch; approvals ensures stay **just before** first seed or read on the form branch.
- **`Merge Docs to Process` returns no rows** (green node, “No output data”) when the SQL **`WHERE`** filters out **every** **`input1`** row — usually **expected idempotency**: **`input2`** already has a **`documentId`** match with **`lastProcessedDate`** **≥** (lexically for ISO strings) **`COALESCE(updated_date, created_date)`** from search, so unchanged docs are skipped. Inspect **Merge → Input 2** (`Ensure Merge Processed Input`): if you see real **`documentId`** rows with timestamps, **`wf02_processed_documents`** was **not** empty for that execution (clear it and re-run to force re-processing). **`Ensure Merge Processed Input`** drops Data Table rows missing **`documentId`** so an empty / malformed read still falls back to the placeholder row for the LEFT JOIN.

Suggested follow-ups:

1. Add signed approval tokens and stronger role checks.
2. Add explicit duplicate-submit protection (`last write wins` is current behavior).
3. Optionally resolve status ids dynamically at runtime.

## 7) Didactic simplification slice (ADR 0004)

This graph is **tutorial-oriented**: explainability on the canvas takes priority over maximal envelope tolerance.

- **Unwrap scope (Option B):** **`Unwrap MCP Get Document`** and **`Unwrap MCP Create Task`** use **`Execute Workflow`** (UTIL). **`search_documents`** uses **native Split Out** on **`content[0].text`** only — no UTIL and no **`documents`** / coalesce layer (see §3.3).
- **Native HTML:** Task body uses the **HTML** node, not a Code node with manual escaping.
- **MCP hygiene:** **`MCP Create Task`** uses **Manual** parameter rows and `removed: true` on unused optional fields (§3.5).
- **Shorter expressions:** **`Build Task Fields`** and **`Extract Task ID`** assume UTIL has already flattened `payload` for `get_document_by_id` / `create_task_in_project`; a narrow fallback for `task.task_id` remains in **`Extract Task ID`**.
- **Deferred table bootstrap:** **`Ensure Tracking Table`** still sits immediately before **`Get Processed Docs`**, but both are on a **second branch** started from the **same trigger** as **`MCP Search Folder Docs`** (parallel folder read vs table read). **`Ensure Approvals Table (intake)`** runs immediately before **`Seed Approval Row`**; **`Ensure Approvals Table (form branch)`** runs immediately before **`Get Approval Rows`** (same schema, idempotent `createIfNotExists`; **`executeOnce`** limits redundant work per execution branch).
- **MCP search clarity:** **`MCP Search Folder Docs`** uses **Manual** parameters so all `search_documents` fields are visible on the canvas; **`parent_folder_id`** is a deploy-time literal (not `$vars`).

**Deferred hardening** (reintroduce if you need multi-tenant robustness without assumptions): add **`Unwrap MCP Search Folder Docs`** + **Set** if **`search_documents`** responses stop matching **`content[0].text`** as an array; widen **`Extract Task ID`** for nested MCP shapes; keep documenting gaps in [ISSUES.md](../../docs/ISSUES.md).

