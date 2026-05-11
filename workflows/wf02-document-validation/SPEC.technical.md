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

Observed variants include plain objects and short status strings (for example `"Done"` after status updates). **`Unwrap MCP Create Task`** calls the shared UTIL sub-workflow. **`search_documents`** and **`get_document_by_id`** stay on the **raw MCP Client** envelope where applicable: **`content[0].text`** is an **array** of rows after **`search_documents`**, and a **single document object** (or one-element array) after **`get_document_by_id`** in the canonical tenant (see §3.3–§4.1). If **`text`** is a JSON string or nested differently, restore UTIL + Set or widen expressions (§7).

### 3.3 `search_documents` → Split Out → merge (SQL field mapping)

**[ASSUMPTION]** Each item from **`MCP Search Folder Docs`** includes **`content`**: an array whose first element has **`type`: `text`** and **`text`**: an **array** of eXo document objects (`document_id`, `updated_date`, `created_date`, `name`, `url`, `created_username`, …). **`Split Out Documents`** uses **`fieldToSplitOut`: `content[0].text`** (one output item per document). If a tenant returns **`text`** as a JSON string, a different nesting, or an empty **`content`**, restore **UTIL + Set** or widen the path; see §7.

**`Merge Docs to Process`** uses n8n **Merge → SQL Query**, which runs on **AlaSQL** (not SQLite). Do **not** use SQLite-only functions such as **`json_extract`** — they fail at runtime (`alasql.fn.json_extract is not a function`). Prefer plain column paths on structured inputs, e.g. **`input1.created_username.username AS uploader`**.

**`Merge Docs to Process`** (`combineBySql`): **input1** is each split row (API shape: **`document_id`**, **`updated_date`**, **`created_date`**, **`name`**, **`url`**, **`created_username`** object). **`updatedDate`** uses **`COALESCE(updated_date, created_date)`** only. **input2** is each row from **`Get Processed Docs`** (directly into the Merge; **`alwaysOutputData`** on the Data Table node helps empty-table runs). The **`WHERE`** clause keeps unseen docs or rows whose coalesced timestamp is **greater than** **`lastProcessedDate`**. Trust consistent ISO date strings for lexical comparison; if a tenant stores **`lastProcessedDate`** in another format, normalize or widen the expression.

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

The **`MCP Create Task`** node uses **Manual** input (resource mapper), **`inputMode`: `manual`**. Mapped fields:

- **`project_id`** — **numeric literal** in git (`2` for the reference tenant). **`npm run generate:workflow-json`** and **`./tools/deploy.sh wf02`** replace it from **`WF02_PROJECT_ID`** in the repository root **`.env`** when set (`applyWf02CreateTaskProjectIdFromEnv` in [n8n-workflow-deploy-core.mjs](../../tools/lib/n8n-workflow-deploy-core.mjs)), matching WF01’s literal board id pattern (avoids empty MCP Client payloads from `$vars` expressions).
- **`title`** — short label from **`Merge Docs to Process`** (`Validation - …`, extension stripped).
- **`description`** — from **`Render Task Description HTML`** (`$json.html`).
- **`assignee`** — document uploader (**`Merge Docs to Process`**.**`uploader`**), fallback **`claire`** per [SPEC.functional.md](SPEC.functional.md) §3.
- **`coworkers`** — **`['nadia', 'etienne']`** (demo artistic / technical leads per SPEC.functional §3).
- **`priority`** — **`NORMAL`**.

Other unused optional tool parameters remain in `schema` with **`removed: true`** where omitted (same hygiene pattern as WF01).

## 4) Technical sequence

### 4.1 Intake branch (manual start / schedule)

1. **Triggers** (**`Manual Start`** / **`Schedule Intake (5m)`**) fan out to **two parallel branches**: (A) **`MCP Search Folder Docs`** and (B) **`Ensure Tracking Table`** → **`Get Processed Docs`** → **`Merge Docs to Process`** (**input 2**).
2. **Branch A:** **`MCP Search Folder Docs`** → **`Split Out Documents`** on **`content[0].text`** (one item per search hit; see §3.3).
3. **`Merge Docs to Process`** — SQL **`combineBySql`** joins when both branches have supplied data: **input1** = split rows from branch A, **input2** = processed-doc rows from branch B (`documentId`, `lastProcessedDate`, …); see §3.3 for column names and aliases.
4. **`MCP Get Document By ID`** — raw MCP item (**`content[0].text`** …); **no UTIL** on this hop (§3.2).
5. **`Build Task Description Context`** then **`Render Task Description HTML`** — task body includes document context and **approval URLs built before the task exists**, so those URLs contain **`cycle_id`**, **`role`**, and **`actor`** only (no eXo **`task_id`** yet).
6. **`MCP Create Task`** — **`create_task_in_project`** mapping per §3.5 (`project_id` literal + **`WF02_PROJECT_ID`** injection from **`.env`** when present).
7. **`MCP Post Approval Form Links`** — **`add_task_comment`** right after create: HTML comment whose links repeat the same **`cycle_id`** / roles but add **`task_id=`** from **`MCP Create Task`** output. Approvers should prefer these links (or any URL that includes **`task_id`**) so the Form hidden field is populated.
8. **`Ensure Approvals Table (intake)`** (`createIfNotExists`, **`executeOnce`**) immediately before **`Seed Approval Row`** (Data Table row stores **`task_id`** from **`MCP Create Task`**), then **`Update Tracking Doc`** for `wf02_processed_documents`.

### 4.2 Approval form branch (`/form/.../approve`)

1. Form receives `task_id`, `cycle_id`, `role`, `actor`, `decision`, optional `reason`. Hidden **`task_id`** is only reliable when the opened URL includes **`task_id`** as a query parameter (see **`MCP Post Approval Form Links`** in §4.1).
2. **`Parse Approval`** maps the submitted item to typed fields: **`Number($json.task_id ?? $json.query?.task_id)`**, **`$json.cycle_id`**, **`$json.role`**, **`String($json.decision).toUpperCase()`**, **`$json.reason ?? ''`**, **`cycleKey`** = **`$json.cycle_id`**.
3. Validate payload and required reject reason (single **`IF Valid Approval`** gate).
4. **`Ensure Approvals Table (form branch)`** (`createIfNotExists`, **`executeOnce`**) immediately before **`Get Approval Rows`** (covers cold-start form submissions if the approvals table was never created on intake).
5. **`Get Approval Rows`** — Data Table **Get** with a single filter: `cycleKey` **equals** the value from **`Parse Approval`** (`cycleKey` / `cycle_id`). It must match the row written at intake (**`Seed Approval Row`**) and the `cycle_id` query parameter on approval links. If keys differ (double-encoding, manual edits), the row will not load and downstream behavior degrades.
6. **`MCP Add Decision Comment`**, **`MCP Set Task In Progress`**, and **`Upsert Approval Row`** read fields from **`Parse Approval`** and **`Get Approval Rows`**. **`Upsert`** **`task_id`** uses **`Parse Approval`** first, then falls back to **`Get Approval Rows`** so an empty form **`task_id`** does not overwrite the seeded row with **`0`**.
7. **`Set Effective Decisions`** — **`n8n-nodes-base.set`** immediately after **`Upsert Approval Row`**, with **`includeOtherFields`** so the Data Table row (including **`task_id`**) stays on the item. Two string fields: **`effectiveArtistic`** and **`effectiveTechnical`** from `$json.artistic_decision ?? 'PENDING'` and `$json.technical_decision ?? 'PENDING'` (post-upsert merged values, aligned with Upsert column mappings).
8. **`Switch Approval Outcome`** — **`n8n-nodes-base.switch`** in **expression** mode with **3 outputs** (`numberOutputs: 3`). The `output` expression reads **`$json.effectiveArtistic`** / **`$json.effectiveTechnical`**: **`PENDING` on either lane → 0**; **both `APPROVED` → 1**; **else → 2**. **Output 0** → **Form End - Pending**; **output 1** → **`MCP Set Done`** + approved final comment + **Form End - Approved**; **output 2** → **`MCP Keep InProgress`** + rejected final comment + **Form End - Rejected**.

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

- `role` must be exactly `artistic` or `technical` (as pre-filled by the task links).
- `decision` is accepted only as **`APPROVED`** or **`REJECTED`** after **`Parse Approval`** (canonical radio values are uppercased from the form submission).
- Rejected decisions require a non-empty reason.
- Join rule: close only when both role decisions are `APPROVED`.
- **`cycleKey` contract:** the approval link `cycle_id` (and `cycleKey` after **`Parse Approval`**) must be **byte-identical** to the `cycleKey` stored in **`wf02_approvals`** at seed time. **`Get Approval Rows`** filters with `eq` on that column; tolerant decoding or alternate key shapes are intentionally not applied in downstream expressions.

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
- **`Merge Docs to Process` returns no rows** (green node, “No output data”) when the SQL **`WHERE`** filters out **every** **`input1`** row — usually **expected idempotency**: **`input2`** already has a **`documentId`** match with **`lastProcessedDate`** **≥** (lexically for ISO strings) **`COALESCE(updated_date, created_date)`** from search, so unchanged docs are skipped. Inspect **Merge → Input 2** (**`Get Processed Docs`** output): if you see real **`documentId`** rows with timestamps, **`wf02_processed_documents`** was **not** empty for that execution (clear it and re-run to force re-processing). With an **empty** processed-doc table, **`Get Processed Docs`** may emit **no items**; the canonical graph relies on **`alwaysOutputData`: true** on that node and verified Merge **SQL** behaviour on your n8n version so **`LEFT JOIN`** still treats documents as unseen.

Suggested follow-ups:

1. Add signed approval tokens and stronger role checks.
2. Add explicit duplicate-submit protection (`last write wins` is current behavior).
3. Optionally resolve status ids dynamically at runtime.

## 7) Didactic simplification slice (ADR 0004)

This graph is **tutorial-oriented**: explainability on the canvas takes priority over maximal envelope tolerance.

- **Unwrap scope (Option B):** **`Unwrap MCP Create Task`** only — **`Execute Workflow`** (UTIL) for **`create_task_in_project`** responses. **`search_documents`** and **`get_document_by_id`** use **native MCP item** paths (**`content[0].text`**) without UTIL on those hops (see §3.2, §4.1).
- **Native HTML:** Task body uses the **HTML** node; template is **expression-backed** from **`MCP Get Document By ID`** + **`Merge Docs to Process`** (no **`Build Task Fields`** Set node).
- **MCP hygiene:** **`MCP Create Task`** uses **Manual** parameter rows and `removed: true` on unused optional fields (§3.5).
- **Shorter expressions:** **`MCP Create Task`** (**`title`**, **`assignee`**, **`coworkers`**) read **`Merge Docs to Process`** / fixed demo usernames (§3.5); **`project_id`** is a literal overridden from **`.env`** on generate/deploy. **`Extract Task ID`** (**`cycle_id`**, **`document_id`**, **`author_username`**) uses **`Merge Docs to Process`** only; **`task_id`** unwraps UTIL **`payload`** for **`create_task_in_project`**; narrow **`task.task_id`** fallback remains.
- **Deferred table bootstrap:** **`Ensure Tracking Table`** still sits immediately before **`Get Processed Docs`**, but both are on a **second branch** started from the **same trigger** as **`MCP Search Folder Docs`** (parallel folder read vs table read). **`Ensure Approvals Table (intake)`** runs immediately before **`Seed Approval Row`**; **`Ensure Approvals Table (form branch)`** runs immediately before **`Get Approval Rows`** (same schema, idempotent `createIfNotExists`; **`executeOnce`** limits redundant work per execution branch).
- **MCP search clarity:** **`MCP Search Folder Docs`** uses **Manual** parameters so all `search_documents` fields are visible on the canvas; **`parent_folder_id`** is a deploy-time literal (not `$vars`).

**Deferred hardening** (reintroduce if you need multi-tenant robustness without assumptions): add **`Unwrap MCP Search Folder Docs`** + **Set** if **`search_documents`** responses stop matching **`content[0].text`** as an array; add **`Unwrap MCP Get Document`** + **Set** if **`get_document_by_id`** stops exposing a structured **`content[0].text`** document (string envelope or nested shape); add a small **Code** step before the Merge to synthesize a placeholder **`input2`** row when **Get Processed** returns zero items, if an n8n upgrade regresses empty **`input2`** handling; widen **`Extract Task ID`** for nested MCP shapes; keep documenting gaps in [ISSUES.md](../../docs/ISSUES.md).

