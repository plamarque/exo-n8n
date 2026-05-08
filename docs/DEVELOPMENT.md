# Development And Operations

## Repository Type

This repository is primarily an n8n/eXo workflow artifact workspace. It contains canonical `workflow.json` files per workflow, split specifications under `workflows/`, and a minimal [tools/](../tools/) directory.

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

- **REST + canonical `workflow.json`** (default for parity with git and for CI): `./tools/deploy.sh <shortId|all>` or `npm run deploy:workflow -- <same>` after filling root `.env` (see [Root workflow shortId](#root-workflow-shortid)). Pushes the same graph you validate locally (the deploy script strips export-only fields the n8n API rejects). **Tenant literals** (MCP URL, WF\*\* ids, space name, …) come from committed or generated JSON — use [Generate workflow JSON from `.env`](#generate-workflow-json-from-env) before validate/deploy when you maintain values in `.env` instead of n8n Variables.
- **n8n MCP + SDK `code`:** use when you are already in Cursor with MCP configured: `--emit-sdk` then `validate_workflow` → `update_workflow`. Does not replace gate (1) on `workflow.json`.

## Local Prerequisites

- Node.js **18+** with `npm install` at the repo root (ES modules in `tools/` plus `@n8n/workflow-sdk` and `dotenv` for validation and REST deploy).
- Access to the target n8n instance when synchronizing workflows through the n8n **REST API** (root `.env` with `N8N_BASE_URL` / `N8N_API_KEY`) **or** through the **n8n MCP** in Cursor (separate bearer token in `.cursor/mcp.json`); pick one path per operation so the published artifact matches intent.
- eXo MCP credentials configured in n8n for workflow execution. Canonical graphs may carry demo literals and `$vars || …` patterns; run **`npm run generate:workflow-json`** (root `.env`) to hardcode tenant values into `workflow.json` on disk before validate/deploy when you do not rely on n8n Variables.
- OpenAI or compatible credentials configured in n8n for workflows using AI nodes.
- (Optional) **Cursor + MCP:** to use the n8n and eXo MCP servers from Cursor, see [Cursor and MCP (recommended)](#cursor-and-mcp-recommended).

## Root `.env` for repository tooling

Optional **local-only** file at the repository root (git-ignored). Primary use: **n8n instance API** credentials for [push-workflow-to-n8n-api.mjs](../tools/push-workflow-to-n8n-api.mjs) and [download-workflow-from-n8n-api.mjs](../tools/download-workflow-from-n8n-api.mjs). It may also hold **`EXO_MCP_ENDPOINT`**, **`WF01_PROJECT_ID`**, **`WF02_*`**, **`WF03_*`**, **`EXO_SPACE_NAME`**, … — [push-workflow-to-n8n-api.mjs](../tools/push-workflow-to-n8n-api.mjs) applies MCP URLs and portfolio **fallback literals** in **memory** before each PUT/POST (`applyPortfolioEnvOverridesBeforePush`). Optionally run **`npm run generate:workflow-json`** to **persist** the same values into `workflow.json` on disk. The [exo-fixture-bootstrap](../.cursor/skills/exo-fixture-bootstrap/SKILL.md) skill merges bootstrap keys into the same `.env`. Per-workflow `[config.env.example](../workflows/wf02-document-validation/config.env.example)` documents the canonical key names.

1. Copy `[.env.example](../.env.example)` → `.env` at the repo root.
2. Set `N8N_BASE_URL` and `N8N_API_KEY`. **Leave `N8N_WORKFLOW_ID_<SHORTID>` empty for a fresh tenant**: the first `./tools/deploy.sh <shortId>` POST-creates the workflow on n8n and writes the returned id back into `.env` (see [Deploy bootstrap (.env-driven)](#deploy-bootstrap-env-driven)). Once set, subsequent runs are regular PUT updates. ShortId = folder name before the first `-`, or the full folder name if there is no hyphen; uppercase in env (e.g. `wf01` → `N8N_WORKFLOW_ID_WF01`, `unwrap` → `N8N_WORKFLOW_ID_UNWRAP`).
3. **CI / pipelines:** do not commit `.env`; inject the **same variable names** as protected secrets in your runner. CI typically pre-populates `N8N_WORKFLOW_ID_*` (the auto-write path is a developer convenience, not required at runtime).

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

### eXo fixture bootstrap (agents)

Prepare tenant ids for WF01–WF04 without inventing JSON manifests:

- **Convention:** [FIXTURE_BOOTSTRAP_PROMPTS.md](FIXTURE_BOOTSTRAP_PROMPTS.md) (`workflows/*/fixtures/FIXTURE_BOOTSTRAP_PROMPT.md`).
- **Cursor skill:** `[.cursor/skills/exo-fixture-bootstrap/SKILL.md](../.cursor/skills/exo-fixture-bootstrap/SKILL.md)` (MCP URL/auth confirmation, load Markdown prompts, **merge** discovered keys into repository root `**.env`** with user conflict handling; optional `local/generated-wf0x.env` scratch copy).
- **Tool inventory + bootstrap audits:** [EXO-MCP-WORKFLOW-TOOL-MAP.md](EXO-MCP-WORKFLOW-TOOL-MAP.md).

## Generate workflow JSON from `.env`

When your n8n plan cannot rely on **Variables** (`$vars`), put tenant values in the repository root `.env`:

1. **Deploy only:** `./tools/deploy.sh` already injects `EXO_MCP_ENDPOINT` (MCP Client URLs) and portfolio **`||` fallbacks** from `.env` **in memory** before PUT — no separate step required for that behavior.
2. **Persist into git JSON:** run **`npm run generate:workflow-json`** (or `node tools/generate-workflow-json-from-env.mjs`) to rewrite `workflows/**/workflow.json` (skips `fixtures/`; use `--dry-run` to preview). That removes `$vars` indirection in saved files for keys you set in `.env`.
3. **Validate** and **deploy** as usual.

Implementation: [tools/generate-workflow-json-from-env.mjs](../tools/generate-workflow-json-from-env.mjs) calls `applyPortfolioHardcodeFromEnv` in [tools/lib/n8n-workflow-deploy-core.mjs](../tools/lib/n8n-workflow-deploy-core.mjs). **WF02** additionally patches **`MCP Create Task` → `project_id`** from **`WF02_PROJECT_ID`** via **`applyWf02CreateTaskProjectIdFromEnv`** (same hook runs **in memory** on `./tools/deploy.sh wf02` before PUT).

**Git:** either commit generated JSON on a tenant branch or regenerate locally before each deploy — do not commit production secrets in tracked files you publish.

## Workflow lifecycle

1. **Edit** the canonical JSON in the repo: `workflows/<folder>/workflow.json` (optionally after **`npm run generate:workflow-json`**).
2. **Validate locally** `./tools/validate-workflow.sh <workflowId>`
3. **Deploy to n8n**: `./tools/deploy.sh <workflowId>`
4. **Run** on the instance and **inspect executions** in n8n for debugging.

### Deploy bootstrap (`.env`-driven)

`./tools/deploy.sh <shortId>` (and `npm run deploy:workflow -- <shortId>`) resolve the remote n8n workflow id **only** from `N8N_WORKFLOW_ID_<SHORTID>` in repository root `.env`:

- **Set** → `PUT /api/v1/workflows/:id` (regular update). The same applies to dependencies declared in [`subworkflow-dependencies.json`](#portfolio-deploy-dependencies-manifest) (resolved via the dependency’s `remoteIdEnv`).
- **Unset** → `POST /api/v1/workflows` to create the workflow on n8n, then write the returned id back into repository root `.env`. If a previous value was already there, it is commented with a timestamp and the new line is appended just below it. If no key existed, a `# --- deploy auto-bootstrap ---` section is appended at end of file. The next `deploy` becomes a regular PUT.
- `--dry-run` **never** POST-creates and **never** writes `.env`. When the env id is missing under dry-run, deploy logs what it would do and exits successfully (deps fail-fast with a clear message because deps must be created before the parent injection map is built).

To recreate a workflow from scratch on the same tenant:

1. Delete it on n8n (UI or API).
2. Clear the matching `N8N_WORKFLOW_ID_*` line in `.env` (or comment it out).
3. Re-run `./tools/deploy.sh <shortId>`. The new id is written back automatically.

The legacy `--create-missing-deps` flag is accepted as a no-op alias (auto-create is now the default for missing dependency ids).

### Workflow folders

Root workflows live in **immediate** subfolders of `workflows/` that contain `workflows/<folder>/workflow.json`.

- **shortId** (CLI argument to `deploy.sh`, `download_workflow.sh`, `validate-workflow.sh`): substring of `<folder>` **before the first `-`**, or the **entire** `<folder>` if there is no hyphen.
  - Examples: `workflows/wf01-email-dispatch/` → `wf01`; `workflows/unwrap-mcp-json/` → `unwrap`; `workflows/billing/` → `billing`.
- **Uniqueness:** only one root folder may yield a given shortId (no two folders like `wf01-a` and `wf01-b`).
- **Remote id env:** `N8N_WORKFLOW_ID_<SHORTID_UPPERCASE>` (same rule as in [tools/lib/n8n-workflow-portfolio.mjs](../tools/lib/n8n-workflow-portfolio.mjs)).
- **Deploy or download everything:** `./tools/deploy.sh all` / `./tools/download_workflow.sh all` — processes every discovered shortId in **lexicographic** order (fail-fast on first error). Declared dependency order inside a root workflow is still controlled by `subworkflow-dependencies.json`.

### Pull from n8n

Use this when you changed a workflow **in the n8n editor** (for example sticky notes, layout) and want the **canonical** `workflow.json` in git to match the server (see [WORKFLOW.md — Deployment validation policy](WORKFLOW.md#deployment-validation-policy)).

### Portfolio deploy dependencies manifest

Some portfolio folders include `**subworkflow-dependencies.json`**/ When present,  `deploy.sh`  **deploys dependencies first** (, builds an injection map, then deploys the parent. 

**Schema (version 1):** top-level `{ "version": 1, "dependencies": [ … ] }`. Each entry:


| Field                            | Meaning                                                                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `path`                           | Path to the dependency `workflow.json`, relative to the portfolio directory (may use `../<other-root-folder>/…` for UTIL graphs stored beside other root workflows). |
| `remoteIdEnv`                    | Environment variable name holding the remote n8n workflow id for that dependency (for example `N8N_WORKFLOW_ID_UNWRAP`).                                             |
| `parentExecuteWorkflowNodeNames` | Exact `name` values of **Execute Workflow** nodes on the **parent** graph to receive that dependency’s remote id at deploy time.                                     |


**Resolution order for each dependency’s remote id:** value of `remoteIdEnv` in `.env`, else the first matching parent **Execute Workflow** node’s `parameters.workflowId` among `parentExecuteWorkflowNodeNames`. If still empty, deploy POST-creates the dependency on n8n and writes the new id back into `.env` (see [Deploy bootstrap (.env-driven)](#deploy-bootstrap-env-driven)). `--dry-run` cannot bootstrap missing dependency ids and exits with an explicit error in that case.

**Flags:** `--no-deps` skips the manifest even if present; `--create-missing-deps` is a deprecated alias (auto-create on missing ids is now the default); [tools/deploy.sh](../tools/deploy.sh) forwards all arguments to the Node script.

**WF03 first-time tenant:** plain `./tools/deploy.sh wf03` is enough — UTILs and unwrap will be POST-created and persisted in `.env` on the first run. The legacy [tools/import-wf03-subworkflows.mjs](../tools/import-wf03-subworkflows.mjs) entrypoint is deprecated and forwards to the same deploy command.

## How runtime variables are passed to workflows

There are two different configuration channels in this repository:

1. **Repository root `.env`** (copied from `[.env.example](../.env.example)`)
  - Used by repository tooling (`deploy.sh`, REST push/pull scripts, credential/id merge logic).
  - Not read by n8n workflow runtime nodes directly.
2. **n8n runtime variables** (`$vars.*`) — optional if you run **`npm run generate:workflow-json`**, which removes those indirections from JSON for keys present in root `.env`.
  - If you skip generation, set matching keys in the **n8n Variables** UI (or instance env) so expressions resolve at execution time.

### Recommended setup flow

1. Open each workflow's `config.env.example` and copy the variables relevant to your tenant into root `.env`.
2. Either run **`npm run generate:workflow-json`** then validate/deploy, **or** paste the same keys into n8n Variables and deploy canonical JSON without generating.
3. Keep root `.env` for API deploy credentials (`N8N_BASE_URL`, `N8N_API_KEY`, `N8N_WORKFLOW_ID_*`) and, when using the generator, for `EXO_MCP_ENDPOINT` / portfolio keys.

### Important behavior

- `workflow.json` is the canonical graph. **`generate-workflow-json-from-env`** mutates it on disk when you choose that workflow.
- Local **validation** does not load `.env`; generation is an explicit step.
- After generation, n8n **Variables** are not required for fields that no longer reference `$vars`.
- **Without generation**, canonical JSON may still use demo literals and `$vars || …` patterns; align Variables or edit nodes in the UI.

## Configuration

Example `config.env.example` files live **next to each workflow** (for example [workflows/wf02-document-validation/config.env.example](../workflows/wf02-document-validation/config.env.example)).

- Do not put real tokens in example files.
- Verify each example against the current workflow-specific README and specs before using it in an environment.
- Prefer **`npm run generate:workflow-json`** when n8n **Variables** are unavailable; otherwise Variables remain valid for `$vars` expressions in canonical JSON.

## Validation notes

- **WF01**: import [workflows/wf01-email-dispatch/workflow.json](../workflows/wf01-email-dispatch/workflow.json); ensure [unwrap UTIL](../workflows/unwrap-mcp-json/workflow.json) is available on the instance (or rely on REST deploy with `subworkflow-dependencies.json`); verify MCP eXo and OpenAI credentials; run `Manual Start`. See [wf01 README](../workflows/wf01-email-dispatch/README.md).
- **WF02**: import [workflows/wf02-document-validation/workflow.json](../workflows/wf02-document-validation/workflow.json); set variables from [config.env.example](../workflows/wf02-document-validation/config.env.example); test webhook. See [wf02 README](../workflows/wf02-document-validation/README.md).
- **WF03**: use [workflows/wf03-weekly-steering/README.md](../workflows/wf03-weekly-steering/README.md) and technical specs for IDs, notes, and agenda. REST-deploy with `./tools/deploy.sh wf03` (dependencies from `subworkflow-dependencies.json` run first; UTILs and unwrap are POST-created on a fresh tenant and the new ids written back to `.env`). Canonical JSON: [workflows/wf03-weekly-steering/workflow.json](../workflows/wf03-weekly-steering/workflow.json); raw API snapshot: [api-response.snapshot.json](../workflows/wf03-weekly-steering/fixtures/api-response.snapshot.json).
- **WF04**: set `$vars.EXO_SPACE_NAME`; verify MCP OAuth, OpenAI, and Data Table; see [wf04 README](../workflows/wf04-metadata-enrichment/README.md).

## Operational safety

- Keep `workflow.json`, per-workflow README and specs, and remote n8n workflow IDs in sync.
- Record failed validations in [ISSUES.md](ISSUES.md).
- Record durable layout or integration decisions in [ADR/](ADR/).