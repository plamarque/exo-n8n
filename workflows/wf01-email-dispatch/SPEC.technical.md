# Workflow 01 - Email dispatch (technical specification, tutorial version)

> Product rules: [SPEC.functional.md](SPEC.functional.md). Canonical graph: [workflow.json](workflow.json).

## 1) Scope and artifacts

- Canonical export in git: `workflows/wf01-email-dispatch/workflow.json`.
- Deploy manifest: `workflows/wf01-email-dispatch/subworkflow-dependencies.json`.
- Remote id is tenant-bound and configured through root `.env` (`N8N_WORKFLOW_ID_WF01`, optional when the export already carries a root `id`).

## 2) Configuration

- `EXO_MCP_ENDPOINT` in root `.env` — consumed by **`npm run generate:workflow-json`** to set each MCP Client `parameters.endpointUrl`; canonical git JSON may hold a demo literal until you generate.
- **`project_id` for `create_task_in_project`** is a **literal `3`** in the `MCP Create Task` node **Parameters** (manual input mode) in `workflow.json`. Change it there for a non-demo tenant (this tutorial graph does not read `WF01_PROJECT_ID` from n8n Variables).
- MCP OAuth credential (n8n `mcpOAuth2Api`) must be valid for the target tenant.
- LLM credential must be configured for routing/model nodes.

## 3) MCP contract

### 3.1 Tools used

- `list_emails`
- `create_task_in_project` (includes `assignee` in the payload; no separate `assign_task` in this tutorial graph)

### 3.2 Response envelope

MCP tools may return text-wrapped JSON:

```json
[ { "type": "text", "text": "{...json...}" } ]
```

In this tutorial version, `create_task_in_project` output is read from the MCP Client node result (`content[0].text` pattern when needed); the graph does not call `assign_task`.

### 3.3 `create_task_in_project` — tool parameters

Parameter names accepted by the MCP tool (align with your tenant’s published schema):

| Parameter     | Required | Notes |
| ------------- | -------- | ----- |
| `project_id`  | **yes**  | Numeric project / board id. |
| `title`       | **yes**  | Task title. |
| `description` | no       | e.g. HTML body. |
| `assignee`    | no       | Username to assign; WF01 maps this from AI `assignee_username` (no follow-up `assign_task`). |
| `coworkers`   | no       | Optional collaborator field per server contract. |
| `start_date`  | no       | Per server format. |
| `end_dtte`    | no       | [UNCERTAIN] Name as provided for this server; confirm whether the tool uses `end_dtte` vs `end_date`. |
| `due_date`    | no       | Per server format. |
| `priority`    | no       | Enum: **`NONE`**, **`LOW`**, **`NORMAL`**, **`HIGH`** only (MCP / n8n resource mapper). The AI Router system prompt must use this set only — not `URGENT` or other labels. |
| `status_id`   | no       | Optional initial status; resolve via `list_project_statuses` when needed. |

Only **`project_id`** and **`title`** are mandatory; all other fields are optional for the tool call.

The tutorial graph sends only: `project_id`, `title`, `description`, `assignee`, `priority`. It does **not** include `coworkers`, `start_date`, `end_date` / `end_dtte`, `due_date`, or `status_id` (omitted so the tool is not called with empty optional fields that can fail on some servers).

**Canonical `workflow.json` shape:** `MCP Create Task` uses **Manual** input with n8n’s **resource mapper**. Besides `parameters.value`, the export keeps a full `parameters.schema` for the tool (types, required flags, `priority` options). Unused tool parameters are present in `schema` with **`removed: true`** so re-import into n8n does not re-open “empty” mapped rows that break the MCP call. After editing in the UI, re-export and align this block if your tenant’s tool schema changes.

## 4) Technical sequence (simplified)

1. Trigger (`Manual Start`).
2. `MCP List Emails` (`list_emails`, empty JSON object `{}`).
3. `Split Out Emails` (split `content[0].text` into one item per email).
4. `IF Has Required Email Fields` (drop entries missing any required field for routing: `email_id`, `subject`, `content.body`, `sender.address`).
5. `AI Router` + parser.
6. `IF Actionable` guardrail (reads structured output fields directly from `AI Router`).
7. `Render Task Description HTML` (task body from email + AI `summary`).
8. `MCP Create Task` (**Input mode: Manual** — one row per tool argument: `project_id`, `title`, `description`, `assignee`, `priority`). End of main path; assignee is set in this call.

## 5) Data and mappings

### 5.1 Structured LLM output contract (tutorial)

The **Routing Output Parser** uses **Schema type: Define using JSON Schema** (`schemaType: manual`) with `additionalProperties: false`, **`priority`** enum `NONE|LOW|NORMAL|HIGH`, and **`assignee_username`** enum `louis|claire|lucie`. `action_confidence` is constrained to `0..1`.

Example payload:

```json
{
  "action_required": true,
  "action_confidence": 0.92,
  "assignee_username": "louis",
  "priority": "HIGH",
  "task_title": "Ticketing VPN incident",
  "summary": "VPN outage that blocks sales."
}
```

### 5.2 Mapping rules

Assignee routing:

- `assignee_username` comes directly from structured AI output and is sent as `assignee` on `create_task_in_project` (no `assign_task` node).
- Responsibility scope used by AI routing:
  - `louis`: technical/IT operations (VPN, network, security/access, password, incident/bug, DMS access issues).
  - `claire`: administration and city coordination (permits, official documents, circulation plan, planning, coordination, dossiers).
  - `lucie`: partners and communication topics (partners, campaigns, newsletter, media, festival communication, ticketing communication).

Priority routing:

- `priority` is passed through unchanged from structured AI output into `create_task_in_project` (no enum remapping in the graph). Values must already be one of **`NONE`**, **`LOW`**, **`NORMAL`**, **`HIGH`** so the MCP call matches the tool schema.

## 6) Validation and operations

1. Re-run behavior can create duplicates because email idempotency is not yet persisted.

Suggested follow-ups:

1. Add persisted idempotency by `emailId`.
2. Re-introduce richer payload hardening if needed for production stability.
