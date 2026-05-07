---
name: n8n-workflow-deploy-gate
description: >-
  Enforces local @n8n/workflow-sdk validation before publish. Supports two deploy channels:
  (1) REST push of canonical workflow.json via ./tools/deploy.sh (or npm run deploy:workflow) and root .env;
  (2) optional --emit-sdk then n8n MCP validate_workflow before update_workflow. Use when
  editing workflows/*/workflow.json or syncing to a remote n8n instance.
---

# n8n workflow deploy gate

## Choose a deploy channel (do not mix unintentionally)

| Goal | Channel | After local validation |
|------|---------|-------------------------|
| Parity with git / CI / canonical JSON | **REST API** | `./tools/deploy.sh <shortId>` or `./tools/deploy.sh all` (same as `npm run deploy:workflow -- …`; [push-workflow-to-n8n-api.mjs](../../../tools/push-workflow-to-n8n-api.mjs)) |
| Cursor + SDK `code` already generated | **n8n MCP** | `validate_workflow` then `update_workflow` with the same `code` |

Publishing **SDK `code`** without going through the same `workflow.json` validation path is a different artifact than REST **JSON** publish; align with the user on which source wins.

## Prerequisites

- **Normative policy:** [docs/WORKFLOW.md](../../../docs/WORKFLOW.md#deployment-validation-policy) (*Deployment validation policy*). Local validation on `workflow.json` is **mandatory** before any publish.
- **REST push credentials:** copy [`.env.example`](../../../.env.example) → **`.env`** at the repository root; set `N8N_BASE_URL` and `N8N_API_KEY`. Leave `N8N_WORKFLOW_ID_<SHORTID>` empty for a fresh tenant: the first `./tools/deploy.sh <shortId>` POST-creates the workflow on n8n and writes the new id back into `.env` (see [docs/DEVELOPMENT.md — Deploy bootstrap (.env-driven)](../../../docs/DEVELOPMENT.md#deploy-bootstrap-env-driven)). Set **`EXO_MCP_ENDPOINT`** (and optional **`WF01_PROJECT_ID`**, **`WF02_*`**, **`WF03_*`**, **`EXO_SPACE_NAME`**) so REST deploy injects MCP URLs and portfolio fallback literals **in memory** before POST/PUT (`applyPortfolioEnvOverridesBeforePush`). Optionally run **`npm run generate:workflow-json`** to persist the same into `workflow.json` on disk — see [docs/DEVELOPMENT.md — Generate workflow JSON from `.env`](../../../docs/DEVELOPMENT.md#generate-workflow-json-from-env).
- **Cursor and MCP (SDK path only):** [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md#cursor-and-mcp-recommended). Copy [`.cursor/mcp.json.example`](../../mcp.json.example) to a **local, git-ignored** `.cursor/mcp.json`; never commit real secrets.
- **Tooling commands:** [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md#useful-scripts) (`npm run validate:workflows`, [validate-workflow.sh](../../../tools/validate-workflow.sh)).

## Procedure (in order)

### 1. Local validation (mandatory)

From the repository root, after `npm install`:

- All workflows: `npm run validate:workflows`, or
- One shortId: `./tools/validate-workflow.sh wf01` (resolves `workflows/wf01-*/workflow.json` via [resolve-workflow-json.mjs](../../../tools/resolve-workflow-json.mjs); same rules as deploy).

**Stop** if validation fails, unless the exception is already recorded in [docs/ISSUES.md](../../../docs/ISSUES.md) per the deployment policy.

### 2a. REST: push canonical JSON (default for repo parity)

1. Resolve the remote workflow id: deploy reads `N8N_WORKFLOW_ID_<SHORTID>` from `.env`. When unset, deploy POST-creates the workflow on n8n and writes the new id back into `.env` (see [docs/DEVELOPMENT.md — Deploy bootstrap (.env-driven)](../../../docs/DEVELOPMENT.md#deploy-bootstrap-env-driven)). The legacy top-level `"id"` fallback on `workflow.json` was removed.
2. Run `./tools/deploy.sh <shortId>` or `./tools/deploy.sh all` (runs local validation again before each `POST`/`PUT` by default). Workflows with **`subworkflow-dependencies.json`** deploy declared sub-workflows first, then the parent, with in-memory **Execute Workflow** id injection (see [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md#portfolio-deploy-dependencies-manifest)). Use `--dry-run` to preview without POST/PUT or `.env` writes (deps fail-fast under dry-run when their id is unset); use `--no-deps` to skip the manifest. The legacy `--create-missing-deps` flag is accepted as a no-op alias (auto-create on missing ids is now the default). Use `--skip-validate` only with care.

MCP `validate_workflow` does **not** apply to this path.

### 2b. Optional: emit SDK code for the n8n MCP (when using MCP to deploy, not JSON import)

- `./tools/validate-workflow.sh wf01 --emit-sdk` (writes `work/wf01.generated.mjs` by default, git-ignored) **after** local validation passes.
- Read the generated file content as the MCP `code` string. The MCP `validate_workflow` tool only accepts **fluent SDK `code`**, not raw `workflow.json`. Regenerate from the **current** canonical `workflow.json` (after **`npm run generate:workflow-json`** if you bake tenant URLs from `.env`).

### 3. n8n MCP: validate then update (recommended when passing SDK `code`)

1. Get the **remote n8n `workflowId`** for the target workflow from the per-workflow spec, not by guessing.
2. Call **n8n MCP** `validate_workflow` with the full `code` string from step 2b.
3. If the result is valid, call `update_workflow` with the **same** `code` and that `workflowId` (and optional `description`).

**Do not** skip local validation in step 1 and rely only on MCP. MCP and local SDK can diverge on versions; the policy treats MCP validation as a **second** line of defense for SDK `code` deploys.

### 4. JSON-only manual import (n8n UI)

If the user imports `workflow.json` through the UI only, MCP `validate_workflow` does not apply. Step 1 remains **mandatory**.

## Out of scope

Runtime behavior (eXo OAuth, OpenAI, n8n execution quotas) is not validated by `validateWorkflow` or MCP `validate_workflow` alone—see [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md).

## Source of truth

- Policy: [docs/WORKFLOW.md](../../../docs/WORKFLOW.md#deployment-validation-policy)
- Commands: [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md)

If this runbook and the policy disagree, follow **docs/WORKFLOW.md** and update this skill.
