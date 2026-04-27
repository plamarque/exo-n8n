# Development And Operations

## Repository Type

This repository is primarily an n8n/eXo workflow artifact workspace. It contains canonical `workflow.json` files per workflow, split specifications under `workflows/`, an optional [audit](audit-code-vs-native.md), generated [inventory](inventory-code-nodes.json), and a minimal [tools/](../tools/) directory.

**Language:** committed files are **English-only** (docs, workflow strings, script comments/messages). See [AGENTS.md](../AGENTS.md) for the full policy and the small exception for legacy external-data matching.

## Node toolchain (workflow SDK)

- Root [package.json](../package.json) pins `**@n8n/workflow-sdk`** for **local** validation and optional codegen of MCP-oriented SDK bundles, and `**dotenv`** so REST deploy scripts load a **repository-root** `.env` (see [Root `.env` for repository tooling](#root-env-for-repository-tooling)).
- After cloning: `npm install` from the repository root.
- **Source of truth** remains each canonical `**workflow.json`**. Generated files under `work/` are **git-ignored** scratch output (optional `--emit-sdk`).

### Where validation runs


| Step                                                  | Where                                                   | What                                                                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Structural / expression checks** on `workflow.json` | **Local** (`validateWorkflow` from `@n8n/workflow-sdk`) | `npm run validate:workflows` or [validate-workflow-json.mjs](../tools/validate-workflow-json.mjs) — no n8n server required.                                                        |
| **MCP `validate_workflow`**                           | **n8n MCP host** (Cursor / cloud)                       | Same SDK rules, but input must be **fluent SDK `code`**, not raw JSON. Use `--emit-sdk work/....mjs` locally, then paste or feed that file to MCP if you need MCP-side validation. |
| **Runtime** (credentials, MCP eXo, quotas)            | **Your n8n instance**                                   | UI/API import + execute; not replaced by local SDK validation.                                                                                                                     |


### Policy (normative)

Publishing workflows must follow the **deployment validation policy** in [WORKFLOW.md — Deployment validation policy](WORKFLOW.md#deployment-validation-policy): **local `validateWorkflow` on `workflow.json` is mandatory** before any publish; **MCP `validate_workflow` on the final SDK `code` is recommended** when you deploy via MCP `update_workflow` / `create_workflow_from_code`. JSON-only UI/API import still requires local validation; MCP structural validation does not apply to that path.

**Deploy channel (choose deliberately):**

- **REST + canonical `workflow.json`** (default for parity with git and for CI): `./deploy.sh <wf01|…|unwrap>` or `npm run deploy:workflow -- <same>` after filling root `.env` (see below). Pushes the same graph you validate locally (the deploy script strips export-only fields the n8n API rejects).
- **n8n MCP + SDK `code`:** use when you are already in Cursor with MCP configured: `--emit-sdk` then `validate_workflow` → `update_workflow`. Does not replace gate (1) on `workflow.json`.

## Local Prerequisites

- Node.js **18+** with `npm install` at the repo root (ES modules in `tools/` plus `@n8n/workflow-sdk` and `dotenv` for validation and REST deploy).
- Access to the target n8n instance when synchronizing workflows through the n8n **REST API** (root `.env` with `N8N_BASE_URL` / `N8N_API_KEY`) **or** through the **n8n MCP** in Cursor (separate bearer token in `.cursor/mcp.json`); pick one path per operation so the published artifact matches intent.
- eXo MCP credentials configured in n8n for workflow execution. Demo endpoint (reference): `https://exo-mips-ft.meeds.io/mcp-server/mcp` — always match `EXO_MCP_ENDPOINT` to the environment under test.
- OpenAI or compatible credentials configured in n8n for workflows using AI nodes.
- (Optional) **Cursor + MCP:** to use the n8n and eXo MCP servers from Cursor, see [Cursor and MCP (recommended)](#cursor-and-mcp-recommended).

## Root `.env` for repository tooling

Optional **local-only** file at the repository root (git-ignored). Use it for **n8n instance API** credentials consumed by [push-workflow-to-n8n-api.mjs](../tools/push-workflow-to-n8n-api.mjs), not for n8n workflow runtime variables (those stay in n8n **Variables** / per-workflow `config.env.example`).

1. Copy `[.env.example](../.env.example)` → `.env` at the repo root.
2. Set `N8N_BASE_URL` and `N8N_API_KEY`. For each workflow you REST-deploy, set `N8N_WORKFLOW_ID_WF…` **unless** the canonical `workflow.json` already contains a top-level `"id"` (remote n8n workflow id from that tenant’s export). Workflows without a root `id` (for example WF02/WF04 in some exports) still need the matching `N8N_WORKFLOW_ID_*` entry. See per-workflow `SPEC.technical.md` / `README.md` for reference ids.
3. **CI / pipelines:** do not commit `.env`; inject the **same variable names** as protected secrets in your runner.

Per-workflow `[config.env.example](../workflows/wf02-document-validation/config.env.example)` files document **execution-time** values inside n8n (webhook URLs, space names, etc.). They are **not** a substitute for `N8N_API_KEY`.

## Cursor and MCP (recommended)

This section is the **recommended setup for [Cursor](https://cursor.com/)** in this repository. It is **not** a requirement to edit `workflow.json` or run local SDK validation. Contributors using **other IDEs or agent clients** should adapt the same two endpoints (n8n MCP + eXo MCP) in their own configuration; tenant hosts and tokens remain per-environment and **must not** be committed.

**Why two MCP servers**


| Server (name in config) | Role in this project                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `n8n-mcp`               | n8n Workflow SDK validation and workflow create/update (see [Policy (normative)](#policy-normative)); depends on your **n8n Cloud tenant**. |
| `eXo MCP`               | eXo platform tools used by the workflows; depends on your **eXo / tenant** MCP base URL.                                                    |


**Setup (forks and new machines)**

1. Copy the committed example: `**.cursor/mcp.json.example`** → `**.cursor/mcp.json`** in your clone (the real file is git-ignored; never add an exception for it).
2. Replace the placeholders in `.cursor/mcp.json`:


| Placeholder                 | Replace with                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `YOUR_N8N_TENANT_SUBDOMAIN` | Your n8n Cloud **tenant** subdomain (the part before `.app.n8n.cloud` in the URL). **Not** a workflow name.                                                 |
| `YOUR_N8N_MCP_BEARER_TOKEN` | Bearer token issued for MCP access to that n8n instance (from n8n; rotate if leaked).                                                                       |
| `YOUR_EXO_MCP_HOST`         | Hostname for your eXo MCP server (and path as deployed; the example path `/mcp-server/mcp` matches a common eXo MCP URL shape — align to your environment). |


1. Restart Cursor (or reload MCP) so the servers connect.
2. **Do not** commit `.cursor/mcp.json`, bearer tokens, or production hostnames. Only the committed `[.cursor/mcp.json.example](../.cursor/mcp.json.example)` (placeholders) should be in git.

**Related:** project runbook in `[.cursor/skills/n8n-workflow-deploy-gate/SKILL.md](../.cursor/skills/n8n-workflow-deploy-gate/SKILL.md)` (deploy/validation sequence).

## Workflow lifecycle (expected)

1. **Edit** the canonical JSON in the repo: `workflows/wf0X-.../workflow.json`.
2. **Validate locally** (mandatory before publish; see [WORKFLOW.md — Deployment validation policy](WORKFLOW.md#deployment-validation-policy)) with `npm run validate:workflows`, `npm run validate:workflow -- <path>`, or `./tools/validate-workflow.sh wf0X` (see [Convenience shell](#convenience-shell)). Optionally emit an MCP-ready SDK file: `node tools/validate-workflow-json.mjs <path> --emit-sdk work/<name>.mjs` or `./tools/validate-workflow.sh wf01 --emit-sdk` (ignored by git). When deploying that SDK via MCP, run `validate_workflow` on the same `code` before `update_workflow` / `create_workflow_from_code` (recommended second gate).
3. **Deploy** to n8n: **(a)** `./deploy.sh wf0X` (or `unwrap`) / `npm run deploy:workflow -- …` to `PUT` via the REST API (see [REST deploy to n8n](#rest-deploy-to-n8n)), **(b)** manual UI import, or **(c)** MCP `update_workflow` / `create_workflow_from_code` with validated SDK `code` if you generated it in step 2.
4. **Run** on the instance and **inspect executions** in n8n for debugging.

## Useful scripts

From the repository root (after `npm install`):

```bash
npm run validate:workflows
```

Validates every `workflows/**/workflow.json` except under `fixtures/`, using `@n8n/workflow-sdk`’s `validateWorkflow`.

```bash
npm run validate:workflow -- workflows/wf01-email-dispatch/workflow.json
```

Single-file validation. Add `--emit-sdk work/wf01.generated.mjs` to write an SDK module (under `work/`, git-ignored) for MCP or experiments.

### Convenience shell

Shell helper: [tools/validate-workflow.sh](../tools/validate-workflow.sh). From the repository root, pass a short portfolio id instead of the full path:


| Id              | Resolves to                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `wf01` … `wf04` | The single `workflows/wf0X-*/workflow.json` for that prefix                                                                   |
| `unwrap`        | [workflows/shared/subworkflows/unwrap-mcp-json/workflow.json](../workflows/shared/subworkflows/unwrap-mcp-json/workflow.json) |


```bash
./tools/validate-workflow.sh wf01
./tools/validate-workflow.sh wf01 --emit-sdk
```

`--emit-sdk` with **no** following path writes `work/<id>.generated.mjs` (for example `work/wf01.generated.mjs`). With a path, it forwards to the Node script unchanged.

```bash
./tools/validate-workflow.sh wf01 --emit-sdk work/custom.mjs
```

**MCP bridge:** local steps only validate or emit the file. Pushing to n8n via MCP still requires a separate step: use the generated `.mjs` as the `code` argument for `validate_workflow`, then `update_workflow` (with the remote workflow id), or import `workflow.json` via UI/API. Nothing in this shell calls the MCP server.

```bash
node tools/inventory-code-nodes.mjs
```

This regenerates `docs/inventory-code-nodes.json` and prints totals for n8n **Code** nodes (skips `fixtures/` when scanning for `workflow.json`).

### REST deploy to n8n

Implementation: [tools/push-workflow-to-n8n-api.mjs](../tools/push-workflow-to-n8n-api.mjs). Short wrapper at the repo root: [deploy.sh](../deploy.sh). Same portfolio ids as [validate-workflow.sh](../tools/validate-workflow.sh) (`wf01` … `wf04`, `unwrap`).

```bash
./deploy.sh wf04
./deploy.sh wf04 --dry-run
./deploy.sh wf01 --skip-validate
# equivalent:
npm run deploy:workflow -- wf04
```

- Loads `[.env](../.env.example)` from the **repository root** (see [Root `.env` for repository tooling](#root-env-for-repository-tooling)).
- By default runs local `validateWorkflow` on the target `workflow.json` before `PUT`. Use `--skip-validate` only with care.
- `--dry-run` prints the target URL and exits without calling n8n.
- The script sends a **schema-safe** subset of the export (n8n rejects extra top-level fields, `id` and `tags` in the body, and some `settings` keys such as `availableInMCP` / `binaryMode`). After a push, confirm **Available in MCP** and other UI-only options in n8n if your workflow relied on them.
- **Credentials on PUT:** canonical JSON omits `credentials`. The deploy script **GET**s the existing remote workflow, **merges** `credentials` from the server onto local nodes by matching **`node.id`**, then `PUT`s (n8n returns `{ id, name }` references only — no secrets in git). If the remote workflow was **active**, it is **deactivated** before `PUT` and **re-activated** afterward when possible; if re-activate fails, the workflow stays inactive and a warning explains next steps.
- **Fallback overrides:** if merge leaves some MCP or OpenAI nodes without a reference (new node ids, empty remote, etc.), the script fills gaps using `N8N_MCP_OAUTH2_CREDENTIAL_*` / `N8N_OPENAI_CREDENTIAL_*` when set, otherwise a **single** matching credential type on the instance (with a warning when multiple exist). If the OpenAI credential list is ambiguous or unavailable, the script can reuse the `openAiApi` `{id,name}` from the first configured `lmChatOpenAi` on another workflow: set `N8N_OPENAI_REFERENCE_WORKFLOW_ID`, or rely on `N8N_WORKFLOW_ID_WF01` when set (typical: same binding as WF01 without editing WF03 in the UI). Prefer fixing node ids to match the remote or attaching credentials once in the n8n UI over relying on env overrides when you need a different credential per workflow.

## Configuration

Example `config.env.example` files live **next to each workflow** (for example [workflows/wf02-document-validation/config.env.example](../workflows/wf02-document-validation/config.env.example)).

- Do not put real tokens in example files.
- Verify each example against the current workflow-specific README and specs before using it in an environment.
- Prefer n8n **Variables** for runtime values that differ across environments.

## Validation notes

- **WF01**: import [workflows/wf01-email-dispatch/workflow.json](../workflows/wf01-email-dispatch/workflow.json); ensure shared [unwrap sub-workflow](../workflows/shared/subworkflows/unwrap-mcp-json/workflow.json); verify MCP eXo and OpenAI credentials; run `Manual Start`. See [wf01 README](../workflows/wf01-email-dispatch/README.md).
- **WF02**: import [workflows/wf02-document-validation/workflow.json](../workflows/wf02-document-validation/workflow.json); set variables from [config.env.example](../workflows/wf02-document-validation/config.env.example); test webhook. See [wf02 README](../workflows/wf02-document-validation/README.md).
- **WF03**: use [workflows/wf03-weekly-steering/README.md](../workflows/wf03-weekly-steering/README.md) and technical specs for IDs, notes, and agenda. Canonical JSON: [workflows/wf03-weekly-steering/workflow.json](../workflows/wf03-weekly-steering/workflow.json); raw API snapshot: [api-response.snapshot.json](../workflows/wf03-weekly-steering/fixtures/api-response.snapshot.json).
- **WF04**: set `$vars.EXO_SPACE_NAME`; verify MCP OAuth, OpenAI, and Data Table; see [wf04 README](../workflows/wf04-metadata-enrichment/README.md).

## Operational safety

- Keep `workflow.json`, per-workflow README and specs, and remote n8n workflow IDs in sync.
- Record failed validations in [ISSUES.md](ISSUES.md).
- Record durable layout or integration decisions in [ADR/](ADR/).

