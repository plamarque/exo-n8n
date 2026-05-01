# WF01 — Fixture bootstrap prompt (email dispatch)

**Authoritative refs:** [SPEC.technical.md](../SPEC.technical.md), [config.env.example](../config.env.example).

## Goal

Ensure **eXo MCP** can **list mailbox traffic**, **create tasks** in a known **project**, and **assign** users so the WF01 demo runs without editing canonical `workflow.json`.

## Operator placeholders


| Placeholder         | Example              | Notes                                                                                                            |
| ------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DEMO_PROJECT_NAME` | `Art2Rue Operations` | Stable label used with `**list_projects`** search-then-match.                                                    |
| `MAILBOX_READY`     | `yes` / `no`         | MCP OAuth identity must see messages for `**list_emails`**—often requires tenant mail setup outside this prompt. |


## Prerequisites outside MCP

- **Users:** Assignees referenced by the graph / LLM mapping (**e.g.** `claire`, `louis`, `lucie`) must exist—provision via **eXo admin** if needed ([SPEC.functional.md](../SPEC.functional.md), technical §6).
- **Mailbox:** Demo mail must be visible to the MCP credential (same tenant as `**EXO_MCP_ENDPOINT`**).
- **n8n:** MCP OAuth credential + LLM credential configured separately.

## Ordered bootstrap steps

1. Confirm `**EXO_MCP_ENDPOINT`** matches the MCP URL configured for **both** Cursor (bootstrap session) and **n8n** MCP HTTP nodes.
2. Call `**list_projects`** (per WF02 discovery pattern—same tenancy tool surface). Search results for `**DEMO_PROJECT_NAME`** (case-insensitive substring acceptable unless tenant forbids).
  - If no match and MCP exposes **no** create-project tool: **MANUAL** — create project in eXo UI, repeat `**list_projects`**.
  - Capture numeric `**project_id`** → `**WF01_PROJECT_ID`** (graph defaults to `**3**` if unset—override on non-demo tenants).
3. Optionally call `**list_emails**` with small limit to prove mailbox visibility (non-empty optional depending on tenant mail volume).
4. **Merge** into repository root **`.env`** (see meta-skill Part C): at least `EXO_MCP_ENDPOINT`, `WF01_PROJECT_ID`; ask the user on conflicting existing values (overwrite vs keep). Optionally also write `local/generated-wf01.env` as a scratch copy.

## Fixture files (paths)

No WF01-specific binary fixtures in-repo; relies on live mailbox content.

## Variables to emit


| Variable           | Source                    |
| ------------------ | ------------------------- |
| `EXO_MCP_ENDPOINT` | User / tenant URL         |
| `WF01_PROJECT_ID`  | `**list_projects**` match |


*(Legacy keys in older copies of `config.env.example`—canonical graph uses `**WF01_PROJECT_ID*`* + `**EXO_MCP_ENDPOINT**` only.)*

## Known gaps


| Gap                         | Fallback                       |
| --------------------------- | ------------------------------ |
| User provisioning           | eXo admin UI                   |
| Mail routing / OAuth scopes | Tenant mail + credential setup |
| Project creation API absent | Create board/project in UI     |
