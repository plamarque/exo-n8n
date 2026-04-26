# Workflow 02 - Technical specification (QAUI exploration + n8n)

> Product rules: [SPEC.functional.md](SPEC.functional.md).

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
{ "query": "", "parent_folder_id": "b468cb5639805e11480baa56164da90c", "limit": 200, "offset": 0 }
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

1. **Triggers** — `Manual Start`, or schedule every 5 minutes.
2. **List** — `search_documents` with `parent_folder_id` (variable or default).
3. **Dedup** — global static list of `document_id:updated_date` keys.
4. **Load** — `get_document_by_id`.
5. **Build task** — `Build Task Payload` (Code): title, HTML description, author/coworkers, status `InProgress`.
6. **Create** — `create_task_in_project`; extract `task_id`.
7. **Initial comment** — `add_task_comment` with two links:
   - `...&role=artistic&actor=nadia`
   - `...&role=technical&actor=etienne`
8. **Register state** — `workflow` static data key `task_id:cycle_id` with empty stamps `PENDING` for `artistic` and `technical`.
9. **Webhook** — `POST` `/webhook/wf02-doc-validation/approve` (path fixed in the node) with `task_id`, `cycle_id`, `role`, `decision`, `reason` (from body or query).
10. **Parse** — normalize payload.
11. **Comment decision** — `add_task_comment` with text `Stamp <role>: <decision>`.
12. **Update state** — merge decision; compute `joinReady` and `bothApproved` where decisions are not `PENDING` and both match `APPROVED`.
13. **If join and both approved** — `update_task_status` → `Done` + final comment in English in current export.
14. **If join and not both approved** — keep `InProgress` + rejection-style comment.
15. **If one decision still pending** — `Respond to Webhook` with `status: pending`.

### 12.5 Minimal state model (implementation)

```json
{
  "task_id": 0,
  "cycle_id": "docId:version",
  "approvals": {
    "artistic": { "actor": "nadia", "decision": "PENDING|APPROVED|REJECTED", "reason": "", "at": "" },
    "technical": { "actor": "etienne", "decision": "PENDING|APPROVED|REJECTED", "reason": "", "at": "" }
  }
}
```

`role` in the webhook must match the keys `artistic` and `technical`.

### 12.6 Webhook URL (reference)

- Base: `WF02_APPROVAL_BASE_URL` or n8n production host + `webhook/wf02-doc-validation/approve`
- Query: `role`, `actor`, `task_id`, `cycle_id`, and decision payload when using forms.

**Security** — production should add short-lived signed tokens, strict role checks, and idempotent handling (not all implemented in the demo JSON).

### 12.7 Status id mapping (demo, 2026-04-22)

- `InProgress=475`, `Done=477` (also `ToDo=474`, `WaitingOn=476`)

### 12.8 Risks and mitigations

- **Heterogeneous MCP** — single parse helper in Code nodes.
- **Duplicate file processing** — `document_id + updated_date` dedup.
- **Double submit same role** — last write wins in current logic (can be hardened).
- **Author** — default `claire` if uploader is missing.
- **Status id drift** — `list_project_statuses` for dynamic resolution in future iterations.

## 13) n8n node map (abridged)

- **MCP client** for all `search_documents`, `get_document_by_id`, `create_task_in_project`, `add_task_comment`, `update_task_status`.
- **Code** for deduplication, payload, approval state, webhook parsing, join logic.
- **Webhook** + **Respond to Webhook** for async approvals.
- **IF** for join and both-approved.

### Design notes

- `Webhook + Respond` keeps split/join asynchronous and is easier than a single long-running merge when reviewers click links days apart.

## 14) Validation before production hardening

1. Re-import workflow JSON; verify `WF02_*` and `EXO_MCP_ENDPOINT`.
2. Place test files in the watched folder; confirm one task per document.
3. Approve with two test POSTs: `role=artistic&decision=APPROVED` and `role=technical&decision=APPROVED`.
4. Reject case: e.g. one `REJECTED` → should **not** move to `Done`.
