# Workflow 02 - Technical specification (QAUI exploration + n8n)

> Product rules: [SPEC.functional.md](SPEC.functional.md).

## n8n artifacts (repository)

- Canonical export in git: `workflows/wf02-document-validation/workflow.json`.
- Sub-workflow dependency manifest: `workflows/wf02-document-validation/subworkflow-dependencies.json` declares the shared unwrap (`workflows/shared/subworkflows/unwrap-mcp-json/workflow.json`) for the three `Unwrap MCP …` nodes; `./tools/deploy.sh wf02` deploys the dependency first and injects its remote id from `N8N_WORKFLOW_ID_UNWRAP` into the parent at PUT time.
- Remote n8n workflow id: pinned in repository root `.env` as `N8N_WORKFLOW_ID_WF02`. Tenant-bound; see [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md#rest-deploy-to-n8n) and [.env.example](../../.env.example).

## 11) MCP exploration (QAUI) and evidence level

1. Session (2026-04-22, after MCP reauth):
- eXo QAUI connector is reachable; required tools are available.
- Live calls validated on QAUI for this workflow.

2. Tools checked live

- `get_my_spaces`, `list_projects`, `list_project_statuses`, `list_tasks`, `search_documents`, `get_document_by_id`, `list_users_of_space_by_role`, `create_task_in_project`, `assign_task`, `add_task_comment`, `update_task_status`, `get_task_by_id`

3. Observed facts

- **exo-mips-ft** default board for WF02 tasks: **`project_id=2`** (eXo name `Programation` in live MCP responses). Older QAUI notes referenced `project_id=117` with status ids `474`–`477`; other tenants need **`list_project_statuses`** (MCP tool) for their `project_id`.
- **`list_project_statuses`** with `project_id: 2` (live MCP 2026-04-27): **`ToDo` = 5**, **`InProgress` = 6**, **`WaitingOn` = 7**, **`Done` = 8** (matches `column_position` 0–3). New tasks start in **ToDo** after `create_task_in_project`.
- Users in space `66`: `nadia`, `etienne`, `claire`
- Test mutation on `task_id=398` — create, assign, comments, status

4. Conclusion: MCP-first execution is feasible; this spec is grounded in those live calls.

## 12) Technical design

### 12.1 MCP tools (by step)

1. **Detect/read** — `search_documents`, `get_document_by_id`
2. **Context** (optional) — `list_projects`, **`list_project_statuses`** (input: `{ "project_id": <int> }`; returns all dashboard columns with `name`, `status_id`, `column_position`—use to set `WF02_INPROGRESS_STATUS_ID` / `WF02_DONE_STATUS_ID`), `list_users_of_space_by_role`
3. **Task** — `create_task_in_project`, `assign_task`, `add_task_comment`, `update_task_status`, `list_tasks`

### 12.2 MCP I/O (envelope)

Responses are often an array of `{ "type": "text", "text": "{...json string...}" }` — the workflow uses a `parseMcp` pattern before business logic. Some tools may return a plain object.

**Observed:**

- `update_task_status` may return a short string such as `"Done"`.
- `create_task_in_project` returns a rich task (ids, link, assignee, …).
- `add_task_comment` returns comment metadata.

### 12.3 Example tool payloads (reference)

**List documents in programming folder**

```json
{ "query": "", "parent_folder_id": "ced6e9c539805e114bd65696b26bd073", "limit": 200, "offset": 0 }
```

**Read a document** — `get_document_by_id` with `document_id`.

**Create task** — `create_task_in_project` (minimal payload on exo-mips-ft)

The MCP tool validates a **fixed JSON shape** per the tool description (e.g. **`project_id` as a number**, snake_case keys). Sending `coworkers` or `status_id` on create triggers *allowed Tool input types* errors on some tenants. The n8n MCP Client may display **`projectId`** in error text even when the workflow sends `project_id`—keep **`project_id`** in `workflow.json`.

Minimal shape validated live on **project 2** (English stand-in for a real title/description):

```json
{
  "project_id": 2,
  "title": "Sample task title",
  "description": "Plain or HTML description body",
  "assignee": "patrice",
  "priority": "NORMAL"
}
```

**Typical success body** (unwrap exposes this as `payload`): top-level numeric **`task_id`**, string **`title`** / **`description`**, **`link`**, **`assignee`** as an object (`username`, `display_name`, …), **`status`** as `{ "name": "To Do", "status_id": 5, … }`, **`project_id`**, **`project_name`**, **`space_id`**, timestamps, etc. `Extract Task ID` reads `payload.task_id` (and fallbacks) after `Unwrap MCP Create Task`.

Other tools in this workflow (e.g. `update_task_status`) use their own field names (`task_id`, `status_id`) as in `workflow.json`.

After a successful create, the workflow calls **`update_task_status`** once to move the task to **In progress** (`WF02_INPROGRESS_STATUS_ID`; repository default **`6`** for exo-mips-ft project **2**, from `list_project_statuses`). Reviewers `nadia` / `etienne` are reached through the **approval links** in the first comment (not via a `coworkers` field on create).

**Assign** — `assign_task` with `task_id`, `username`

**Add comment** — e.g. `Stamp artistic: APPROVED. Reason: ...`

**Close** — `update_task_status` to `status_id` for **Done** (`WF02_DONE_STATUS_ID`; default **`8`** for exo-mips-ft project **2**—override per tenant via `list_project_statuses`, see §11.3).

### 12.4 n8n orchestration (as implemented in repo `workflow.json`)

Refactored 2026-04-27 (native refactor); residual Code: **`Render Task Description HTML`** (~5 LOC, HTML-only) plus **`Ensure Merge Processed Input`** (~8 LOC — ensures `combineBySql` input2 is never empty when `wf02_processed_documents` has zero rows; AlaSQL LEFT JOIN otherwise yields no merge output). The unwrap step reuses the shared sub-workflow [workflows/shared/subworkflows/unwrap-mcp-json/workflow.json](../shared/subworkflows/unwrap-mcp-json/workflow.json) (parity with WF01); idempotency uses an n8n **Data Table** + **Merge (combineBySql)** (parity with WF04). See [docs/audit-code-vs-native.md](../../docs/audit-code-vs-native.md) section *WF02 native refactor*.

**Intake branch (Manual Start / Schedule 5m)**

1. **Triggers** — `Manual Start` or `Schedule Intake (5m)`.
2. **Bootstrap tables** — `Ensure Tracking Table` (Data Table create `wf02_processed_documents` with `createIfNotExists`) → `Ensure Approvals Table` (Data Table create `wf02_approvals` with `createIfNotExists`); both `onError: continueRegularOutput` so re-running is safe.
3. **List** — `MCP Search Folder Docs` (`search_documents`). `parent_folder_id` resolves from n8n variable `WF02_PARENT_FOLDER_ID` when non-empty; otherwise it defaults to the **exo-mips-ft** programming folder id `ced6e9c539805e114bd65696b26bd073`. All MCP Client nodes use `endpointUrl` = `$vars.EXO_MCP_ENDPOINT` with the same **fallback** as WF03 (`https://exo-mips-ft.meeds.io/mcp-server/mcp`) when the variable is unset.
4. **Unwrap MCP envelope** — `Unwrap MCP Search Folder Docs` (Execute Workflow → shared unwrap sub-workflow). Depending on the MCP tool shape, the next item may expose hits under `payload.documents` **or** as plain document rows under `payload.content` (or JSON-in-`type: "text"` parts inside `content`).
5. **Coalesce + split** — `Coalesce Documents List` (Set) builds a single array field `documents`: prefers `payload.documents`, then walks `payload.content` (array or single object). Each element may be a bare document row (`document_id` on the part) or an MCP-style envelope `{ type: \"text\", text: ... }` where **`text` is either a JSON string, an array of document rows, or one document object** (exo-mips-ft shape). The expression also accepts an input item whose JSON is a one-element array wrapper. `Split Out Documents` uses `fieldToSplitOut: documents` → `Filter - Has document_id`. If `documents` is empty, the run ends without error (expected when the folder has no files).
6. **Normalize** — `Normalize Docs` (Set: `id`, `updatedDate`, `name`, `url`, `uploader`).
7. **Dedup join** — `Get Processed Docs` (Data Table get all rows from `wf02_processed_documents`, `executeOnce`, `alwaysOutputData`) → **`Ensure Merge Processed Input`** (Code, `runOnceForAllItems`: if no rows were returned, emits one sentinel row so **`Merge Docs to Process`** always receives a non-empty `input2`; avoids AlaSQL producing zero rows when the tracking table is empty) → `Merge Docs to Process` input2; `Normalize Docs` feeds input1 (`combineBySql` LEFT JOIN — same SQL shape as WF04 — keeps rows where the doc is unseen or the `updatedDate` is newer than the stored `lastProcessedDate`).
8. **Load** — `MCP Get Document By ID` (`get_document_by_id`) → `Unwrap MCP Get Document` (Execute Workflow).
9. **Build task fields** — `Build Task Fields` (Set: `document_id`, `cycle_id` = `documentId:updatedDate`, `docName`, `title`, `author_username`, `docUrl`).
10. **Render description** — `Render Task Description HTML` (residual Code, ~5 LOC, HTML-only): builds the description string and `createTaskInput` with **numeric** `project_id` from `WF02_PROJECT_ID` (default **2** on exo-mips-ft), plus `title`, `description`, `assignee`, `priority` (minimal create; see §12.3).
11. **Create task** — `MCP Create Task` (`create_task_in_project`) → `Unwrap MCP Create Task` → `Extract Task ID` (Set, mirrors WF01 `Extract Task Assignment`; reads `payload.task_id` / `payload.id` / `payload.task.task_id`, and **`payload.content[0].text.task_id`** when `text` is a structured task object—exo-mips-ft MCP shape). Shared [unwrap-mcp-json](../shared/subworkflows/unwrap-mcp-json/workflow.json) now hoists `{ payload: { content: … } }` and treats **`content[].text` as object** so `payload` is usually the flat task row before this Set runs.
12. **Guard** — `IF Has Task ID` (true → continue; false → `Stop - Missing task_id` with `raw_create_payload`).
13. **Status** — `MCP Set Task In Progress` (`update_task_status` → `WF02_INPROGRESS_STATUS_ID`) after `task_id` is known (create alone does not pass `status_id` on this MCP).
14. **Initial comment** — `MCP Add Initial Comment` (`add_task_comment`) with two **GET** links (HTML `<a href>`): `task_id`, `cycle_id`, `role`, `actor` — **no** prefilled `decision` so reviewers choose **Approved** or **Rejected** on the hosted form.
15. **Seed approval row** — `Seed Approval Row` (Data Table upsert on `wf02_approvals` keyed by `cycleKey = task_id:cycle_id`; `artistic_decision` / `technical_decision` default `PENDING`).
16. **Mark processed** — `Update Tracking Doc` (Data Table upsert on `wf02_processed_documents`; sets `lastProcessedDate = $now.toISO()` so subsequent intake cycles skip the doc until its `updated_date` advances).

**Approval form branch (`/form/.../wf02-doc-validation/approve` on the n8n host)** — **`Approval Form Trigger`** (n8n Form Trigger): the **comment links use the Form base URL** (`WF02_APPROVAL_BASE_URL`, default `.../form/wf02-doc-validation/approve` — **not** `/webhook/...`). **GET** pre-fills hidden fields (`task_id`, `cycle_id`, `role`, `actor`). The form exposes **`Decision`** as **radio**: **Approved** / **Rejected** (stored as `APPROVED` / `REJECTED`), **`Reason`** as textarea (required workflow-wise when **Rejected** — enforced by **`IF Missing Reject Reason`** → **`Form End - Missing Reject Reason`**). Submit button **Submit decision**. **`responseMode`: `lastNode`** and terminal **`n8n Form`** nodes (**`operation`: `completion`**) return the HTTP completion page.

1. **Trigger** — `Approval Form Trigger` submits `task_id`, `cycle_id`, `role`, `actor`, `decision`, optional `reason`; `Parse Approval` reads from the item JSON and from `body.* ?? query.*` where present.
2. **Parse** — `Parse Approval` (Set: normalizes `role` lower-case, normalizes `decision` to `APPROVED` \| `REJECTED` (empty if invalid), optional `reason` for the eXo comment, `cycleKey`).
3. **Validate** — `IF Valid Approval` (`task_id > 0`, non-empty `cycle_id`, `role`, non-empty `decision`, `decision ∈ {APPROVED, REJECTED}`); invalid → **`Form End - Invalid Approval`**.
4. **Reject reason gate** — `IF Missing Reject Reason` (`decision === REJECTED` and blank trimmed `reason`) → **`Form End - Missing Reject Reason`**; otherwise → **`MCP Add Decision Comment`** (stamp text includes decision and optional reason, same as before).
5. **Comment decision** — `MCP Add Decision Comment` (`add_task_comment`).
6. **Read state** — `Get Approval Rows` (Data Table get, `returnAll`, `executeOnce`) returns the full approvals table; **`Merge Decision`** is a **Code** node (`mode: runOnceForAllItems`) so the merge is real JavaScript: it looks up the row for the current `cycleKey` and applies the new stamp for the current `role`. (Do not use long `={{ ... }}` IIFEs in a Set here — the expression parser treats `}}` as end of expression, which breaks `})() }}`.)
7. **Merge decision** — `Merge Decision` (Set, role-conditional assignments: writes the new `<role>_decision`/`<role>_reason`/`<role>_at = $now.toISO()`, keeps the other role's columns from the stored row).
8. **Write state** — `Upsert Approval Row` (Data Table upsert on `wf02_approvals` keyed by `cycleKey`).
9. **Compute join** — `Compute Join` (Set: `joinReady` if both decisions are not `PENDING`; `bothApproved` if both are `APPROVED`).
10. **Branch** — `IF Join Ready` (false → `Form End - Pending`); when ready, `IF Both Approved`:
    - **true** — `MCP Set Done` (`update_task_status` → `WF02_DONE_STATUS_ID`) → `MCP Final Comment Approved` → `Form End - Approved`.
    - **false** — `MCP Keep InProgress` (`update_task_status` → `WF02_INPROGRESS_STATUS_ID`) → `MCP Final Comment Rejected` → `Form End - Rejected` (covers `REJECTED` stamps or mixed outcomes until both roles have stamped — task stays **In progress** until **both** are **APPROVED**).

### 12.5 State model (Data Tables, replaces previous `$getWorkflowStaticData` keys)

The workflow now persists state in two n8n **Data Tables** (created by `Ensure Tracking Table` / `Ensure Approvals Table` with `createIfNotExists` so the workflow is self-bootstrapping on a fresh tenant).

**`wf02_processed_documents`** — intake idempotency (parity with WF04 `exo_processed_documents`).

| Column              | Type     | Notes                                                                 |
| ------------------- | -------- | --------------------------------------------------------------------- |
| `documentId`        | string   | Match key for upsert.                                                 |
| `lastProcessedDate` | dateTime | `$now.toISO()` written when the cycle's task is created (step 15).   |
| `cycleId`           | string   | `documentId:updatedDate` — last cycle this document went through.    |

**`wf02_approvals`** — per-cycle approval state.

| Column               | Type     | Notes                                                                 |
| -------------------- | -------- | --------------------------------------------------------------------- |
| `cycleKey`           | string   | Composite primary key `task_id:cycle_id`; matching column for upsert. |
| `task_id`            | number   | n8n task id from `create_task_in_project`.                            |
| `cycle_id`           | string   | `document_id:updated_date`.                                           |
| `document_id`        | string   | Source document id.                                                   |
| `author_username`    | string   | Document uploader (defaulted to `claire`).                            |
| `artistic_decision`  | string   | `PENDING` \| `APPROVED` \| `REJECTED`.                                |
| `artistic_reason`    | string   | Optional free text; default `""`.                                     |
| `artistic_at`        | string   | ISO timestamp when the artistic stamp was written; default `""`.      |
| `technical_decision` | string   | Same enum as artistic.                                                |
| `technical_reason`   | string   | Optional free text.                                                   |
| `technical_at`       | string   | ISO timestamp.                                                        |

`role` in the approval payload must match `artistic` or `technical` (case-insensitive — `Parse Approval` lower-cases the value).

Approval state is now visible on the n8n canvas (Data Table rows) instead of the opaque `$getWorkflowStaticData` map used previously. This addresses the open follow-up tracked in [docs/ISSUES.md](../../docs/ISSUES.md).

### 12.6 Approval form URL (reference)

- Base: `WF02_APPROVAL_BASE_URL` **must** be the **Form** URL, e.g. `https://<n8n-host>/form/wf02-doc-validation/approve` (trailing slash is stripped in the comment node). **Do not** set it to `/webhook/...` or task links will open the wrong entrypoint and may show a blank response.
- Query: `role`, `actor`, `task_id`, `cycle_id`, and `decision` (links from the initial comment default to `decision=APPROVED`).

**Security** — production should add short-lived signed tokens, strict role checks, and idempotent handling (not all implemented in the demo JSON).

### 12.7 Status id mapping (demo, 2026-04-22)

- Status ids are **per project/board**: use MCP **`list_project_statuses`** with `{ "project_id": <id> }`. exo-mips-ft **project 2**: `ToDo=5`, `InProgress=6`, `WaitingOn=7`, `Done=8` (§11.3). Legacy project **117** used `474`–`477`.

### 12.8 Risks and mitigations

- **Heterogeneous MCP** — unwrapped through the shared sub-workflow [workflows/shared/subworkflows/unwrap-mcp-json/workflow.json](../shared/subworkflows/unwrap-mcp-json/workflow.json) (no more per-workflow Code parser; parity with WF01).
- **Duplicate file processing** — `wf02_processed_documents` Data Table + `Merge (combineBySql)` LEFT JOIN (parity with WF04).
- **Data Table prerequisite** — the n8n Data Tables feature must be available on the target tenant. The workflow self-bootstraps via `Ensure Tracking Table` / `Ensure Approvals Table` (`createIfNotExists`, `onError: continueRegularOutput`); on a fresh tenant the first run is the one that materialises the schema.
- **Double submit same role** — last write wins in `Merge Decision` (can be hardened by an extra `IF` checking `<role>_decision !== 'PENDING'`).
- **Author** — default `claire` if uploader is missing (computed in `Build Task Fields`).
- **Status id drift** — `list_project_statuses` for dynamic resolution in future iterations.
- **Approval form hardening** — production should add short-lived signed tokens, strict role checks, and idempotent comment/status side-effects (not implemented in the demo JSON).

## 13) n8n node map (abridged)

- **MCP Client** for `search_documents`, `get_document_by_id`, `create_task_in_project`, `update_task_status` (intake: set In progress after create; webhook: Done / In progress), `add_task_comment`.
- **Execute Workflow** (3×) calling the shared `Unwrap MCP JSON` sub-workflow after each MCP call.
- **Data Table** (5×) — `Ensure Tracking Table` / `Ensure Approvals Table` (create with `createIfNotExists`), `Get Processed Docs` and `Get Approval Rows` (get with `returnAll` + `executeOnce`), `Update Tracking Doc` / `Seed Approval Row` / `Upsert Approval Row` (upsert).
- **Merge (combineBySql)** — `Merge Docs to Process` LEFT JOIN for intake idempotency.
- **Set** (5×) — `Coalesce Documents List`, `Normalize Docs`, `Build Task Fields`, `Extract Task ID`, `Parse Approval`, `Compute Join`.
- **Code** — **`Ensure Merge Processed Input`** (~8 LOC, empty-processed-table guard), **`Merge Decision`** (approval row lookup + stamp merge — avoids fragile `={{ }}` IIFEs / `}}` clashes), **`Render Task Description HTML`** (~5 LOC, HTML-only).
- **IF** — `IF Has Task ID`, `IF Valid Approval`, `IF Missing Reject Reason`, `IF Join Ready`, `IF Both Approved`.
- **Filter** — `Filter - Has document_id` (drops MCP results without `document_id`).
- **Set + Split Out** — `Coalesce Documents List` normalises MCP hits to a `documents` array; `Split Out Documents` expands that field.
- **Form Trigger** + **n8n Form** (`operation`: `completion`, `respondWith`: `text`) for all approval HTTP responses + **Stop and Error** (intake branch only).

### Design notes

- **Form Trigger + Form End** keeps split/join asynchronous: each reviewer opens a **form** link (not a raw webhook URL), submits once, and gets a completion page. `WF02_APPROVAL_BASE_URL` must point at the **Form** path so links are not confused with `/webhook/...`.

## 14) Validation before production hardening

1. Re-import workflow JSON; verify `WF02_*` and `EXO_MCP_ENDPOINT`.
2. Place test files in the watched folder; confirm one task per document.
3. Approve via the two **form** links in the task comment (or equivalent): open each URL, confirm on the form, so each role submits with the pre-filled `role` / `task_id` / `cycle_id` / `decision`.
4. Reject case: e.g. one `REJECTED` → should **not** move to `Done`.
