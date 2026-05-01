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

- **REST + canonical `workflow.json`** (default for parity with git and for CI): `./tools/deploy.sh <wf01|…|unwrap>` or `npm run deploy:workflow -- <same>` after filling root `.env` (see below). Pushes the same graph you validate locally (the deploy script strips export-only fields the n8n API rejects).
- **n8n MCP + SDK `code`:** use when you are already in Cursor with MCP configured: `--emit-sdk` then `validate_workflow` → `update_workflow`. Does not replace gate (1) on `workflow.json`.

## Local Prerequisites

- Node.js **18+** with `npm install` at the repo root (ES modules in `tools/` plus `@n8n/workflow-sdk` and `dotenv` for validation and REST deploy).
- Access to the target n8n instance when synchronizing workflows through the n8n **REST API** (root `.env` with `N8N_BASE_URL` / `N8N_API_KEY`) **or** through the **n8n MCP** in Cursor (separate bearer token in `.cursor/mcp.json`); pick one path per operation so the published artifact matches intent.
- eXo MCP credentials configured in n8n for workflow execution. Demo endpoint (reference): `https://exo.example.com/mcp-server/mcp` — always match `EXO_MCP_ENDPOINT` to the environment under test.
- OpenAI or compatible credentials configured in n8n for workflows using AI nodes.
- (Optional) **Cursor + MCP:** to use the n8n and eXo MCP servers from Cursor, see [Cursor and MCP (recommended)](#cursor-and-mcp-recommended).

## Root `.env` for repository tooling

Optional **local-only** file at the repository root (git-ignored). Use it for **n8n instance API** credentials consumed by [push-workflow-to-n8n-api.mjs](../tools/push-workflow-to-n8n-api.mjs) and [download-workflow-from-n8n-api.mjs](../tools/download-workflow-from-n8n-api.mjs), not for n8n workflow runtime variables (those stay in n8n **Variables** / per-workflow `config.env.example`).

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

### eXo fixture bootstrap (agents)

Prepare tenant ids for WF01–WF04 without inventing JSON manifests:

- **Convention:** [FIXTURE_BOOTSTRAP_PROMPTS.md](FIXTURE_BOOTSTRAP_PROMPTS.md) (`workflows/*/fixtures/FIXTURE_BOOTSTRAP_PROMPT.md`).
- **Cursor skill:** [`.cursor/skills/exo-fixture-bootstrap/SKILL.md`](../.cursor/skills/exo-fixture-bootstrap/SKILL.md) (MCP URL/auth confirmation, load Markdown prompts, emit **`local/generated-wf0x.env`**).
- **Tool inventory + bootstrap audits:** [EXO-MCP-WORKFLOW-TOOL-MAP.md](EXO-MCP-WORKFLOW-TOOL-MAP.md).

## Workflow lifecycle (expected)

1. **Edit** the canonical JSON in the repo: `workflows/wf0X-.../workflow.json`.
2. **Validate locally** (mandatory before publish; see [WORKFLOW.md — Deployment validation policy](WORKFLOW.md#deployment-validation-policy)) with `npm run validate:workflows`, `npm run validate:workflow -- <path>`, or `./tools/validate-workflow.sh wf0X` (see [Convenience shell](#convenience-shell)). Optionally emit an MCP-ready SDK file: `node tools/validate-workflow-json.mjs <path> --emit-sdk work/<name>.mjs` or `./tools/validate-workflow.sh wf01 --emit-sdk` (ignored by git). When deploying that SDK via MCP, run `validate_workflow` on the same `code` before `update_workflow` / `create_workflow_from_code` (recommended second gate).
3. **Deploy** to n8n: **(a)** `./tools/deploy.sh wf0X` (or `unwrap`) / `npm run deploy:workflow -- …` to `PUT` via the REST API (see [REST deploy to n8n](#rest-deploy-to-n8n)), **(b)** manual UI import, or **(c)** MCP `update_workflow` / `create_workflow_from_code` with validated SDK `code` if you generated it in step 2.
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

### REST deploy to n8n

Implementation: [tools/push-workflow-to-n8n-api.mjs](../tools/push-workflow-to-n8n-api.mjs). Short shell wrapper: [tools/deploy.sh](../tools/deploy.sh). Same portfolio ids as [validate-workflow.sh](../tools/validate-workflow.sh) (`wf01` … `wf04`, `unwrap`).

```bash
./tools/deploy.sh wf04
./tools/deploy.sh wf04 --dry-run
./tools/deploy.sh wf01 --skip-validate
# equivalent:
npm run deploy:workflow -- wf04
```

- Loads `[.env](../.env.example)` from the **repository root** (see [Root `.env` for repository tooling](#root-env-for-repository-tooling)).
- By default runs local `validateWorkflow` on the target `workflow.json` before `PUT`. Use `--skip-validate` only with care.
- `--dry-run` skips **PUT** and **POST** (including `--create-missing-deps` creates). It still performs **GET** on each dependency and the parent so credential merge can be simulated and URLs are printed. Do not combine `--dry-run` with `--create-missing-deps` when a dependency has no resolvable remote id (the run fails with an explicit message); resolve ids first via `.env`, dependency JSON top-level `"id"`, or parent **Execute Workflow** `parameters.workflowId`, then dry-run again.
- The script sends a **schema-safe** subset of the export (n8n rejects extra top-level fields, `id` and `tags` in the body, and some `settings` keys such as `availableInMCP` / `binaryMode`). After a push, confirm **Available in MCP** and other UI-only options in n8n if your workflow relied on them.
- **MCP endpoint URL (`EXO_MCP_ENDPOINT`):** portfolio MCP Client nodes use `={{$vars.EXO_MCP_ENDPOINT || "https://exo.example.com/mcp-server/mcp"}}` in canonical `workflow.json` (neutral placeholder). After credential merge, if **repository root** `.env` sets **`EXO_MCP_ENDPOINT`** to a URL starting with `http://` or `https://`, deploy rewrites the **fallback literal** in every MCP Client `endpointUrl` before `PUT`. The name matches n8n Variable **`EXO_MCP_ENDPOINT`** so operators use one identifier in both places; other repo tooling may read the same env key. When the env var is unset, the committed placeholder is sent unchanged. At execution time, if n8n Variables define `$vars.EXO_MCP_ENDPOINT`, that value is used and the string fallback is ignored when the variable is non-empty.
- **Credentials on PUT:** canonical JSON omits `credentials`. The deploy script **GET**s the existing remote workflow, **merges** `credentials` from the server onto local nodes by matching **`node.id`**, then `PUT`s (n8n returns `{ id, name }` references only — no secrets in git). Merge only fills a credential **slot** when the local node has no reference for that type; it does **not** replace a non-empty but stale credential id. If the remote workflow was **active**, it is **deactivated** before `PUT` and **re-activated** afterward when possible; if re-activate fails, the workflow stays inactive and a warning explains next steps.
- **MCP OAuth2 fallback (`mcpOAuth2Api`):** after merge, the script loads `GET /api/v1/credentials` and resolves a binding in this order: **`N8N_MCP_CREDENTIAL_ID`** (optional **`N8N_MCP_CREDENTIAL_NAME`** is the `{name}` label stored beside that id in the workflow JSON, defaulting to `MCP OAuth2 API` when empty) → if the id is **not** set, **`N8N_MCP_CREDENTIAL_NAME`** selects a credential by **exact** display name on the instance (type `mcpOAuth2Api`) → if the instance has **exactly one** `mcpOAuth2Api` credential, use it. If **`N8N_MCP_CREDENTIAL_ID`** is set, or name-only resolution succeeds, deploy **applies** that `{id,name}` to **every** MCP Client node that uses OAuth2 authentication (overwrites existing references — use this to fix outdated ids in git after recreating a credential on the server). If only the **singleton** heuristic applies, deploy **only attaches** `mcpOAuth2Api` where the reference is still missing (same as before). Warnings are printed when name lookup matches zero or more than one credential, or when multiple `mcpOAuth2Api` credentials exist and no env disambiguator is set.
- **OpenAI fallback (`openAiApi` / `lmChatOpenAi`):** after merge, `GET /api/v1/credentials` resolves a binding in this order: **`N8N_OPENAI_CREDENTIAL_ID`** (optional **`N8N_OPENAI_CREDENTIAL_NAME`** as the `{name}` label beside that id in the workflow JSON, defaulting to `OpenAI API` when empty) → if the id is **not** set, **`N8N_OPENAI_CREDENTIAL_NAME`** as an **exact** `openAiApi` display name on the instance → **singleton** when exactly one `openAiApi` exists. If there is **still** no binding and this workflow uses `lmChatOpenAi`, deploy tries **`N8N_OPENAI_REFERENCE_WORKFLOW_ID`** or **`N8N_WORKFLOW_ID_WF01`** to copy `{id,name}` from the first `lmChatOpenAi` on that remote workflow. Use this reference-workflow path when several `openAiApi` credentials exist and a known workflow (typically WF01) is already correctly wired in the n8n UI; setting `N8N_OPENAI_REFERENCE_WORKFLOW_ID=<remote workflow id>` lets the deploy reuse that existing binding instead of hard-coding a credential id. **Force-apply** (overwrites existing `openAiApi` refs on all `lmChatOpenAi` nodes) when the binding comes from explicit id, name-only resolution, or reference workflow; **fill-missing only** when the binding comes from the **singleton** heuristic. Warnings mirror the MCP pattern for ambiguous name lookup or multiple credentials. Prefer fixing node ids to match the remote or attaching credentials once in the n8n UI over relying on env overrides when you need a different credential per workflow.

### REST pull from n8n (download `workflow.json`)

Use this when you changed a workflow **in the n8n editor** (for example sticky notes, layout) and want the **canonical** `workflow.json` in git to match the server (see [WORKFLOW.md — Deployment validation policy](WORKFLOW.md#deployment-validation-policy)).

Implementation: [tools/download-workflow-from-n8n-api.mjs](../tools/download-workflow-from-n8n-api.mjs). Shell wrapper: [tools/download_workflow.sh](../tools/download_workflow.sh). Same portfolio ids as deploy and [validate-workflow.sh](../tools/validate-workflow.sh) (`wf01` … `wf04`, `unwrap`).

```bash
./tools/download_workflow.sh wf01
./tools/download_workflow.sh wf03 --dry-run
./tools/download_workflow.sh wf02 --no-deps
npm run download:workflow -- wf04
```

- Uses the same **root `.env`** as deploy: `N8N_BASE_URL`, `N8N_API_KEY`, and `N8N_WORKFLOW_ID_*` (or top-level `"id"` on the local file) to know which remote workflow to `GET`.
- **Overwrites** the target `workflow.json` with the full API response (pretty-printed JSON). Review the diff in git; the n8n API may order object keys differently from your previous file, so the first pull can look noisy even when the graph is unchanged.
- **Credentials:** the saved file contains the same **credential references** (`{ id, name }` on nodes) that a normal n8n export or the live instance would show — not secret values, but still environment-specific ids. Treat downloads like exports when deciding what to commit.
- After each file write, runs local **`validateWorkflow`** on that path (same gate as the rest of the repo), unless you pass `--skip-validate` (not recommended).
- **`subworkflow-dependencies.json`:** when that manifest exists next to the portfolio workflow, the script **downloads listed dependencies first** (same remote id resolution as deploy), then the parent — so UTIL sub-workflows stay aligned. Use `--no-deps` to update only the portfolio workflow you named.
- **`--dry-run`:** no writes; still **GET**s from n8n and prints the URL, remote id, and basic counts (including sticky-note nodes).

### Portfolio deploy dependencies manifest

Some portfolio folders include **`subworkflow-dependencies.json`** next to `workflow.json` (for example [wf03](../workflows/wf03-weekly-steering/subworkflow-dependencies.json); WF01 and WF03 today). When present, [tools/push-workflow-to-n8n-api.mjs](../tools/push-workflow-to-n8n-api.mjs) **deploys dependencies first** (same GET → merge credentials → PUT behavior as the parent), builds an injection map, then **PUT**s the parent. Remote **Execute Workflow** targets are **not** written back to git: the script patches `parameters.workflowId` **in memory** before the parent PUT.

**Schema (version 1):** top-level `{ "version": 1, "dependencies": [ … ] }`. Each entry:

| Field | Meaning |
|-------|---------|
| `path` | Path to the dependency `workflow.json`, relative to the portfolio directory (may use `../shared/…` for cross-portfolio UTILs). |
| `remoteIdEnv` | Environment variable name holding the remote n8n workflow id for that dependency (for example `N8N_WORKFLOW_ID_UNWRAP`). |
| `parentExecuteWorkflowNodeNames` | Exact `name` values of **Execute Workflow** nodes on the **parent** graph to receive that dependency’s remote id at deploy time. |

**Resolution order for each dependency’s remote id:** value of `remoteIdEnv` in `.env`, else top-level `"id"` on the dependency JSON if present, else the first matching parent **Execute Workflow** node’s `parameters.workflowId` among `parentExecuteWorkflowNodeNames`. If still empty: use `./tools/deploy.sh wf03 --create-missing-deps` (once) to **POST**-create on n8n and print `.env` lines — **not** with `--dry-run` when ids are missing.

**Flags:** `--no-deps` skips the manifest even if present; `--create-missing-deps` POST-creates missing dependencies; [tools/deploy.sh](../tools/deploy.sh) forwards all arguments to the Node script.

**WF03 first-time tenant:** Prefer `./tools/deploy.sh wf03 --create-missing-deps` over editing canonical JSON. The legacy [tools/import-wf03-subworkflows.mjs](../tools/import-wf03-subworkflows.mjs) entrypoint is deprecated and forwards to the same deploy command.

## How runtime variables are passed to workflows

There are two different configuration channels in this repository:

1. **Repository root `.env`** (copied from [`.env.example`](../.env.example))
   - Used by repository tooling (`deploy.sh`, REST push/pull scripts, credential/id merge logic).
   - Not read by n8n workflow runtime nodes directly.

2. **n8n runtime variables** (used in workflow expressions such as `$vars.EXO_MCP_ENDPOINT` or `$vars.WF02_PROJECT_ID`)
   - Set these in your **n8n instance** (Variables UI), or through your n8n environment variable mechanism.
   - These values are resolved when the workflow executes in n8n.

### Recommended setup flow

1. Open each workflow's `config.env.example` and copy the variables relevant to your tenant.
2. In n8n, set those keys as runtime variables (same names) before first run.
3. Keep root `.env` only for repository tooling (`N8N_BASE_URL`, `N8N_API_KEY`, `N8N_WORKFLOW_ID_*`, optional deploy overrides).

### Important behavior

- `workflow.json` is the canonical graph and is not templated by this repository.
- Runtime variables are not expanded into `workflow.json` during local validation.
- During execution, n8n resolves `$vars.*` from the target instance variable store.


## Configuration

Example `config.env.example` files live **next to each workflow** (for example [workflows/wf02-document-validation/config.env.example](../workflows/wf02-document-validation/config.env.example)).

- Do not put real tokens in example files.
- Verify each example against the current workflow-specific README and specs before using it in an environment.
- Prefer n8n **Variables** for runtime values that differ across environments.

## Validation notes

- **WF01**: import [workflows/wf01-email-dispatch/workflow.json](../workflows/wf01-email-dispatch/workflow.json); ensure shared [unwrap sub-workflow](../workflows/shared/subworkflows/unwrap-mcp-json/workflow.json); verify MCP eXo and OpenAI credentials; run `Manual Start`. See [wf01 README](../workflows/wf01-email-dispatch/README.md).
- **WF02**: import [workflows/wf02-document-validation/workflow.json](../workflows/wf02-document-validation/workflow.json); set variables from [config.env.example](../workflows/wf02-document-validation/config.env.example); test webhook. See [wf02 README](../workflows/wf02-document-validation/README.md).
- **WF03**: use [workflows/wf03-weekly-steering/README.md](../workflows/wf03-weekly-steering/README.md) and technical specs for IDs, notes, and agenda. REST-deploy with `./tools/deploy.sh wf03` (dependencies from `subworkflow-dependencies.json` run first). For a fresh tenant without UTIL ids, `./tools/deploy.sh wf03 --create-missing-deps`. Canonical JSON: [workflows/wf03-weekly-steering/workflow.json](../workflows/wf03-weekly-steering/workflow.json); raw API snapshot: [api-response.snapshot.json](../workflows/wf03-weekly-steering/fixtures/api-response.snapshot.json).
- **WF04**: set `$vars.EXO_SPACE_NAME`; verify MCP OAuth, OpenAI, and Data Table; see [wf04 README](../workflows/wf04-metadata-enrichment/README.md).

## Operational safety

- Keep `workflow.json`, per-workflow README and specs, and remote n8n workflow IDs in sync.
- Record failed validations in [ISSUES.md](ISSUES.md).
- Record durable layout or integration decisions in [ADR/](ADR/).

