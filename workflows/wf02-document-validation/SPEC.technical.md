# Workflow 02 - Technical specification (QAUI exploration + n8n)

> Product rules: [SPEC.functional.md](SPEC.functional.md).

## n8n artifacts (repository)

- Canonical export in git: `workflows/wf02-document-validation/workflow.json`.
- Sub-workflow dependency manifest: `workflows/wf02-document-validation/subworkflow-dependencies.json` declares the shared unwrap (`workflows/shared/subworkflows/unwrap-mcp-json/workflow.json`) for the three `Unwrap MCP …` nodes; `./deploy.sh wf02` deploys the dependency first and injects its remote id from `N8N_WORKFLOW_ID_UNWRAP` into the parent at PUT time.
- Remote n8n workflow id: pinned in repository root `.env` as `N8N_WORKFLOW_ID_WF02`. Tenant-bound; see [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md#rest-deploy-to-n8n) and [.env.example](../../.env.example).

## 11) MCP exploration (QAUI) and evidence level

1. Session (2026-04-22, after MCP reauth):
- eXo QAUI connector is reachable; required tools are available.
- Live calls validated on QAUI for this workflow.

2. Tools checked live

- `get_my_spaces`, `list_projects`, `list_project_statuses`, `list_tasks`, `search_documents`, `get_document_by_id`, `list_users_of_space_by_role`, `create_task_in_project`, `assign_task`, `add_task_comment`, `update_task_status`, `get_task_by_id`

3. Observed facts

- Project `Programmation Festival` — `project_id=117`
- Project `117` statuses: `ToDo=474`, `InProgress=475`, `WaitingOn=476`, `Done=477`
- Users in space `66`: `nadia`, `etienne`, `claire`
- Test mutation on `task_id=398` — create, assign, comments, status

4. Conclusion: MCP-first execution is feasible; this spec is grounded in those live calls.

## 12) Technical design

### 12.1 MCP tools (by step)

1. **Detect/read** — `search_documents`, `get_document_by_id`
2. **Context** (optional) — `list_projects`, `list_project_statuses`, `list_users_of_space_by_role`
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

**Create task**

```json
{
  "project_id": 117,
  "title": "Validation - <TITLE>",
  "description": "<html summary + document link + two approval links>",
  "assignee": "claire",
  "coworkers": ["nadia", "etienne"],
  "status_id": 475,
  "priority": "NORMAL"
}
```

**Assign** — `assign_task` with `task_id`, `username`

**Add comment** — e.g. `Stamp artistic: APPROVED. Reason: ...`

**Close** — `update_task_status` to `status_id` for `Done` (477 in current demo)

### 12.4 n8n orchestration (as implemented in repo `workflow.json`)

Refactored 2026-04-27 to push 6 Code nodes down to a single justified residue (`Render Task Description HTML`, ~5 LOC). The unwrap step reuses the shared sub-workflow [workflows/shared/subworkflows/unwrap-mcp-json/workflow.json](../shared/subworkflows/unwrap-mcp-json/workflow.json) (parity with WF01); idempotency uses an n8n **Data Table** + **Merge (combineBySql)** (parity with WF04). See [docs/audit-code-vs-native.md](../../docs/audit-code-vs-native.md) section *WF02 native refactor*.

**Intake branch (Manual Start / Schedule 5m)**

1. **Triggers** — `Manual Start` or `Schedule Intake (5m)`.
2. **Bootstrap tables** — `Ensure Tracking Table` (Data Table create `wf02_processed_documents` with `createIfNotExists`) → `Ensure Approvals Table` (Data Table create `wf02_approvals` with `createIfNotExists`); both `onError: continueRegularOutput` so re-running is safe.
3. **List** — `MCP Search Folder Docs` (`search_documents`). `parent_folder_id` resolves from n8n variable `WF02_PARENT_FOLDER_ID` when non-empty; otherwise it defaults to the **exo-mips-ft** programming folder id `ced6e9c539805e114bd65696b26bd073`. All MCP Client nodes use `endpointUrl` = `$vars.EXO_MCP_ENDPOINT` with the same **fallback** as WF03 (`https://exo-mips-ft.meeds.io/mcp-server/mcp`) when the variable is unset.
4. **Unwrap MCP envelope** — `Unwrap MCP Search Folder Docs` (Execute Workflow → shared unwrap sub-workflow). Depending on the MCP tool shape, the next item may expose hits under `payload.documents` **or** as plain document rows under `payload.content` (or JSON-in-`type: "text"` parts inside `content`).
5. **Coalesce + split** — `Coalesce Documents List` (Set) builds a single array field `documents`: prefers `payload.documents`, then walks `payload.content` (array or single object). Each element may be a bare document row (`document_id` on the part) or an MCP-style envelope `{ type: \"text\", text: ... }` where **`text` is either a JSON string, an array of document rows, or one document object** (exo-mips-ft shape). The expression also accepts an input item whose JSON is a one-element array wrapper. `Split Out Documents` uses `fieldToSplitOut: documents` → `Filter - Has document_id`. If `documents` is empty, the run ends without error (expected when the folder has no files).
6. **Normalize** — `Normalize Docs` (Set: `id`, `updatedDate`, `name`, `url`, `uploader`).
7. **Dedup join** — `Get Processed Docs` (Data Table get all rows from `wf02_processed_documents`, `executeOnce`, `alwaysOutputData`) feeds input2; `Normalize Docs` also feeds input1 of `Merge Docs to Process` (combineBySql LEFT JOIN, same shape as WF04 — keeps rows where the doc is unseen or the `updatedDate` is newer than the stored `lastProcessedDate`).
8. **Load** — `MCP Get Document By ID` (`get_document_by_id`) → `Unwrap MCP Get Document` (Execute Workflow).
9. **Build task fields** — `Build Task Fields` (Set: `document_id`, `cycle_id` = `documentId:updatedDate`, `docName`, `title`, `author_username`, `docUrl`).
10. **Render description** — `Render Task Description HTML` (residual Code, ~5 LOC, HTML-only): builds the description string and the final `createTaskInput`, parity with WF01.
11. **Create task** — `MCP Create Task` (`create_task_in_project`) → `Unwrap MCP Create Task` → `Extract Task ID` (Set, mirrors WF01 `Extract Task Assignment`; reads `payload.task_id || payload.id || payload.task.task_id` and pulls `cycle_id`/`document_id`/`author_username` from `Build Task Fields`).
12. **Guard** — `IF Has Task ID` (true → continue; false → `Stop - Missing task_id` with `raw_create_payload`).
13. **Initial comment** — `MCP Add Initial Comment` (`add_task_comment`) with two approval links:
    - `...&role=artistic&actor=nadia`
    - `...&role=technical&actor=etienne`
14. **Seed approval row** — `Seed Approval Row` (Data Table upsert on `wf02_approvals` keyed by `cycleKey = task_id:cycle_id`; `artistic_decision` / `technical_decision` default `PENDING`).
15. **Mark processed** — `Update Tracking Doc` (Data Table upsert on `wf02_processed_documents`; sets `lastProcessedDate = $now.toISO()` so subsequent intake cycles skip the doc until its `updated_date` advances).

**Webhook branch (`POST /webhook/wf02-doc-validation/approve`)**

1. **Webhook** — `Approval Webhook` accepts `task_id`, `cycle_id`, `role`, `decision`, `reason` from body or query.
2. **Parse** — `Parse Approval` (Set: reads `body.* ?? query.*`, normalizes `role` lower-case and `decision` upper-case, also exposes `cycleKey`).
3. **Validate** — `IF Valid Approval` (requires `task_id > 0`, non-empty `cycle_id`, `role`, `decision`); invalid → `Stop - Invalid approval payload`.
4. **Comment decision** — `MCP Add Decision Comment` (`add_task_comment`).
5. **Read state** — `Get Approval Rows` (Data Table get, `returnAll`, `executeOnce`) returns the full approvals table; the next Set node finds the row by `cycleKey` via `find()` on `$('Get Approval Rows').all()`.
6. **Merge decision** — `Merge Decision` (Set, role-conditional assignments: writes the new `<role>_decision`/`<role>_reason`/`<role>_at = $now.toISO()`, keeps the other role's columns from the stored row).
7. **Write state** — `Upsert Approval Row` (Data Table upsert on `wf02_approvals` keyed by `cycleKey`).
8. **Compute join** — `Compute Join` (Set: `joinReady` if both decisions are not `PENDING`; `bothApproved` if both are `APPROVED`).
9. **Branch** — `IF Join Ready` (false → `Respond Pending`); when ready, `IF Both Approved`:
   - **true** — `MCP Set Done` (`update_task_status` → `WF02_DONE_STATUS_ID`) → `MCP Final Comment Approved` → `Respond Approved`.
   - **false** — `MCP Keep InProgress` (`update_task_status` → `WF02_INPROGRESS_STATUS_ID`) → `MCP Final Comment Rejected` → `Respond Rejected`.

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

`role` in the webhook must match `artistic` or `technical` (case-insensitive — `Parse Approval` lower-cases the value).

Approval state is now visible on the n8n canvas (Data Table rows) instead of the opaque `$getWorkflowStaticData` map used previously. This addresses the open follow-up tracked in [docs/ISSUES.md](../../docs/ISSUES.md).

### 12.6 Webhook URL (reference)

- Base: `WF02_APPROVAL_BASE_URL` or n8n production host + `webhook/wf02-doc-validation/approve`
- Query: `role`, `actor`, `task_id`, `cycle_id`, and decision payload when using forms.

**Security** — production should add short-lived signed tokens, strict role checks, and idempotent handling (not all implemented in the demo JSON).

### 12.7 Status id mapping (demo, 2026-04-22)

- `InProgress=475`, `Done=477` (also `ToDo=474`, `WaitingOn=476`)

### 12.8 Risks and mitigations

- **Heterogeneous MCP** — unwrapped through the shared sub-workflow [workflows/shared/subworkflows/unwrap-mcp-json/workflow.json](../shared/subworkflows/unwrap-mcp-json/workflow.json) (no more per-workflow Code parser; parity with WF01).
- **Duplicate file processing** — `wf02_processed_documents` Data Table + `Merge (combineBySql)` LEFT JOIN (parity with WF04).
- **Data Table prerequisite** — the n8n Data Tables feature must be available on the target tenant. The workflow self-bootstraps via `Ensure Tracking Table` / `Ensure Approvals Table` (`createIfNotExists`, `onError: continueRegularOutput`); on a fresh tenant the first run is the one that materialises the schema.
- **Double submit same role** — last write wins in `Merge Decision` (can be hardened by an extra `IF` checking `<role>_decision !== 'PENDING'`).
- **Author** — default `claire` if uploader is missing (computed in `Build Task Fields`).
- **Status id drift** — `list_project_statuses` for dynamic resolution in future iterations.
- **Approval webhook hardening** — production should add short-lived signed tokens, strict role checks, and idempotent comment/status side-effects (not implemented in the demo JSON).

## 13) n8n node map (abridged)

- **MCP Client** for `search_documents`, `get_document_by_id`, `create_task_in_project`, `add_task_comment`, `update_task_status`.
- **Execute Workflow** (3×) calling the shared `Unwrap MCP JSON` sub-workflow after each MCP call.
- **Data Table** (5×) — `Ensure Tracking Table` / `Ensure Approvals Table` (create with `createIfNotExists`), `Get Processed Docs` and `Get Approval Rows` (get with `returnAll` + `executeOnce`), `Update Tracking Doc` / `Seed Approval Row` / `Upsert Approval Row` (upsert).
- **Merge (combineBySql)** — `Merge Docs to Process` LEFT JOIN for intake idempotency.
- **Set** (6×) — `Coalesce Documents List`, `Normalize Docs`, `Build Task Fields`, `Extract Task ID`, `Parse Approval`, `Merge Decision`, `Compute Join`.
- **IF** — `IF Has Task ID`, `IF Valid Approval`, `IF Join Ready`, `IF Both Approved`.
- **Filter** — `Filter - Has document_id` (drops MCP results without `document_id`).
- **Set + Split Out** — `Coalesce Documents List` normalises MCP hits to a `documents` array; `Split Out Documents` expands that field.
- **Code** — single residual `Render Task Description HTML` (~5 LOC, HTML-only, parity with WF01).
- **Webhook** + **Respond to Webhook** + **Stop and Error** — async approvals + structured rejection of invalid payloads.

### Design notes

- `Webhook + Respond` keeps split/join asynchronous and is easier than a single long-running merge when reviewers click links days apart.

## 14) Validation before production hardening

1. Re-import workflow JSON; verify `WF02_*` and `EXO_MCP_ENDPOINT`.
2. Place test files in the watched folder; confirm one task per document.
3. Approve with two test POSTs: `role=artistic&decision=APPROVED` and `role=technical&decision=APPROVED`.
4. Reject case: e.g. one `REJECTED` → should **not** move to `Done`.
