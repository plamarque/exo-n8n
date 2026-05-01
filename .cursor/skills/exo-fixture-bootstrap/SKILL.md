---
name: exo-fixture-bootstrap
description: >-
  Configure and use eXo MCP in Cursor to bootstrap demo data for portfolio workflows. Enumerates
  root workflow folders under workflows/ that contain fixtures/FIXTURE_BOOTSTRAP_PROMPT.md, loads
  those prompts as imperative natural-language instructions, follows SPEC + config.env.example,
  emits gitignored env output. Use when preparing a tenant for n8n demos.
---

# eXo fixture bootstrap (meta-skill)

## When to use

- Preparing an **eXo tenant** so portfolio workflows (WF01–WF04 and peers) can run with correct **n8n `$vars`** (or equivalent env).
- You have **Cursor** (or compatible) with MCP and need a **repeatable agent procedure** driven by repo **Markdown prompts**, not hardcoded per-workflow skills.

## Non-goals

- Changing **canonical** [`workflow.json`](../../../workflows/wf03-weekly-steering/workflow.json) demo defaults for a specific tenant (values belong in **n8n Variables** or a **gitignored** `*.env` file).
- Validating graphs (use [n8n-workflow-deploy-gate](../n8n-workflow-deploy-gate/SKILL.md) for publish).

## Prerequisites (read first)

- **Convention:** [docs/FIXTURE_BOOTSTRAP_PROMPTS.md](../../../docs/FIXTURE_BOOTSTRAP_PROMPTS.md) and template [docs/templates/FIXTURE_BOOTSTRAP_PROMPT.template.md](../../../docs/templates/FIXTURE_BOOTSTRAP_PROMPT.template.md).
- **Tool vs workflow map + gaps:** [docs/EXO-MCP-WORKFLOW-TOOL-MAP.md](../../../docs/EXO-MCP-WORKFLOW-TOOL-MAP.md).
- **Cursor MCP setup:** [docs/DEVELOPMENT.md — Cursor and MCP recommended](../../../docs/DEVELOPMENT.md#cursor-and-mcp-recommended), [`.cursor/mcp.json.example`](../../mcp.json.example).

## Part A — MCP configuration (user-in-the-loop)

1. Confirm the user has an **eXo MCP** server URL (scheme + host + path, e.g. `https://<host>/mcp-server/mcp` or as deployed). **The same tenant** must be used by **n8n** workflow credentials.
2. Instruct copying [`.cursor/mcp.json.example`](../../mcp.json.example) → **`.cursor/mcp.json`** (gitignored) and setting **`YOUR_EXO_MCP_HOST`** / any **bearer or OAuth** fields that project uses. **Never** commit real tokens or production hostnames.
3. If the MCP host’s catalog is locked until login, complete **`mcp_auth`** (or equivalent) when the server exposes it—see host `STATUS` in the IDE.
4. Before every tool invocation, **read the MCP tool descriptor/schema** for that server (parameter names differ by build).

## Part B — Discover portfolio prompts

1. Enumerate **immediate** child directories of `workflows/` that contain **`fixtures/FIXTURE_BOOTSTRAP_PROMPT.md`** (skip folders without that file, e.g. shared UTIL-only roots that have no fixture prompt).
2. Derive the **shortId** for each folder: substring before the first `-` in the folder name, or the full folder name if there is no hyphen (same rule as [docs/DEVELOPMENT.md — Root workflow shortId](../../../docs/DEVELOPMENT.md#root-workflow-shortid)).
3. Ask the user **which workflow** to run (a discovered shortId, or `all` in a stable order — e.g. lexicographic by shortId, or WF01→WF04 when those prompts exist).

## Part C — Execute for one workflow

1. **Read** `workflows/<folder>/fixtures/FIXTURE_BOOTSTRAP_PROMPT.md` end-to-end.
2. **Read** the same folder’s **`SPEC.technical.md`** and **`config.env.example`** for exact **MCP tool names**, payload shapes, and **variable keys** (these override any drift in the prompt).
3. Follow the prompt’s **ordered steps** using **search-then-create** (idempotent names). Call only tools the spec allows; note **gaps** where the prompt says MANUAL or n8n-only.
4. **Output:** write **`local/generated-<shortId>.env`** (e.g. `local/generated-wf03.env`) at the repo root with `KEY=value` lines for every variable the workflow needs (from `config.env.example`), using discovered values or `MISSING=` comments. See [`local/README.md`](../../../local/README.md). **Do not commit** `*.env`.
5. Remind the user to **paste** values into **n8n Variables** (or instance env) for the target workflow.

## Part D — Portfolio order and audits

When the user says `all`, run **one folder at a time** in an order you state up front (lexicographic shortId is reproducible; portfolio audit order WF01→WF04 matches [EXO-MCP-WORKFLOW-TOOL-MAP.md](../../../docs/EXO-MCP-WORKFLOW-TOOL-MAP.md) when those workflows are in scope).

If MCP **lacks** a tool for a step, document the gap in the operator response and point to the **Known gaps** table in the prompt + the audit doc—**do not** invent tool names.

## Output contract summary

| Artifact | Committed? |
|----------|------------|
| `FIXTURE_BOOTSTRAP_PROMPT.md` | Yes |
| `local/generated-<shortId>.env` | **No** (gitignored via `*.env` and `local/*` exception rules) |
| `.cursor/mcp.json` | **No** |

## Escalation

- Spec/prompt/tool map conflict: prefer **SPEC.technical.md**, then record drift in [docs/ISSUES.md](../../../docs/ISSUES.md).
- Tenant-specific MCP missing tools: update the **audit row** in [EXO-MCP-WORKFLOW-TOOL-MAP.md](../../../docs/EXO-MCP-WORKFLOW-TOOL-MAP.md) when you confirm behavior on a live server.
