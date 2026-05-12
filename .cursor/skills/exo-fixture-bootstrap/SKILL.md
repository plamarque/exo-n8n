---
name: exo-fixture-bootstrap
description: >-
  Configure and use eXo MCP in Cursor to bootstrap demo data for portfolio workflows. Enumerates
  root workflow folders under workflows/ that contain fixtures/FIXTURE_BOOTSTRAP_PROMPT.md, loads
  those prompts as imperative natural-language instructions, follows SPEC + config.env.example,
  merges discovered KEY=value into the repository root .env (with user conflict resolution), and
  optionally writes local/generated-<shortId>.env as a scratch copy. Use when preparing a tenant.
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

   **WF04 (`wf04-metadata-enrichment`):** The fixture prompt requires a **one-time** MCP call to **`get_my_spaces`** during bootstrap only, to fill **`WF04_SPACE_ID`** and **`EXO_SPACE_NAME`** in root **`.env`**. The canonical **`workflow.json`** does **not** call **`get_my_spaces`** at runtime ([SPEC.technical.md §7](../../../workflows/wf04-metadata-enrichment/SPEC.technical.md)); discovery stays in this bootstrap path. **`npm run generate:workflow-json`** / deploy inject from **`.env`** into literals: **`EXO_SPACE_NAME`** → **`Prepare AI Input`** **`spaceName`**, **`WF04_SPACE_ID`** → **`List Documents`** MCP **Manual** **`parameters.value.space_id`**—no n8n **`$vars.EXO_SPACE_NAME`** or **`$vars.WF04_SPACE_ID`** in canonical JSON.

3. Follow the prompt’s **ordered steps** using **search-then-create** (idempotent names). Call only tools the spec allows; note **gaps** where the prompt says MANUAL or n8n-only.
4. **Output — merge into repository root `.env`** (primary):
   - Build the **bootstrap map**: one entry per key in `config.env.example` (skip comment-only lines), using discovered values or a `# MISSING: <reason>` comment if you add a placeholder line (prefer omitting unset keys unless the prompt requires a stub).
   - **Path:** `.env` at the **repository root** (same file as [`.env.example`](../../../.env.example); gitignored). If `.env` does **not** exist, tell the user to copy `.env.example` → `.env` first **or** create `.env` with only the merged keys plus a short header comment—**do not** overwrite a missing file silently if the user expected API keys elsewhere.
   - **Parse safely:** preserve existing lines (comments, blanks, unrelated keys). For each bootstrap `KEY`:
     - If **absent** from `.env`: append under a trailing marker block  
       `# --- exo-fixture-bootstrap (<shortId>) ---`  
       then `KEY=value`.
     - If **present** and value **equals** (trimmed, ignore surrounding quotes rules consistent with existing file): skip.
     - If **present** and value **differs**: **stop and ask the user** (e.g. AskQuestion): **Overwrite** with the newly discovered value or **Keep existing** (skip that key only). Do not pick silently. If the user aborts the whole run, leave `.env` unchanged from before this workflow.
   - **Never** delete or reorder unrelated keys. Do not commit `.env`.
5. **Optional scratch copy:** write **`local/generated-<shortId>.env`** with the same bootstrap map for that run (helps diffing). See [`local/README.md`](../../../local/README.md).
6. **Remind:** REST deploy injects **`EXO_MCP_ENDPOINT`** and portfolio fallbacks from `.env` **before PUT** ([`applyPortfolioEnvOverridesBeforePush`](../../../tools/lib/n8n-workflow-deploy-core.mjs)). Run **`npm run generate:workflow-json`** only if you want those values **saved** into `workflow.json` in git (full hardcode, no `$vars`).

## Part D — Portfolio order and audits

When the user says `all`, run **one folder at a time** in an order you state up front (lexicographic shortId is reproducible; portfolio audit order WF01→WF04 matches [EXO-MCP-WORKFLOW-TOOL-MAP.md](../../../docs/EXO-MCP-WORKFLOW-TOOL-MAP.md) when those workflows are in scope).

If MCP **lacks** a tool for a step, document the gap in the operator response and point to the **Known gaps** table in the prompt + the audit doc—**do not** invent tool names.

## Output contract summary

| Artifact | Committed? |
|----------|------------|
| `FIXTURE_BOOTSTRAP_PROMPT.md` | Yes |
| Repository root `.env` | **No** (gitignored); **primary** merge target for bootstrap keys |
| `local/generated-<shortId>.env` | **No** (optional scratch copy) |
| `.cursor/mcp.json` | **No** |

## Escalation

- Spec/prompt/tool map conflict: prefer **SPEC.technical.md**, then record drift in [docs/ISSUES.md](../../../docs/ISSUES.md).
- Tenant-specific MCP missing tools: update the **audit row** in [EXO-MCP-WORKFLOW-TOOL-MAP.md](../../../docs/EXO-MCP-WORKFLOW-TOOL-MAP.md) when you confirm behavior on a live server.
