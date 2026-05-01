---
name: n8n-workflow-deploy-gate
description: >-
  Enforces local @n8n/workflow-sdk validation before publish. Supports two deploy channels:
  (1) REST push of canonical workflow.json via ./tools/deploy.sh (or npm run deploy:workflow) and root .env;
  (2) optional --emit-sdk then n8n MCP validate_workflow before update_workflow. Use when
  editing workflows/wf*-/workflow.json or syncing to a remote n8n instance.
---

# n8n workflow deploy gate

## Choose a deploy channel (do not mix unintentionally)

| Goal | Channel | After local validation |
|------|---------|-------------------------|
| Parity with git / CI / canonical JSON | **REST API** | `./tools/deploy.sh wf0X` or `unwrap` (same as `npm run deploy:workflow -- …`; [push-workflow-to-n8n-api.mjs](../../../tools/push-workflow-to-n8n-api.mjs)) |
| Cursor + SDK `code` already generated | **n8n MCP** | `validate_workflow` then `update_workflow` with the same `code` |

Publishing **SDK `code`** without going through the same `workflow.json` validation path is a different artifact than REST **JSON** publish; align with the user on which source wins.

## Prerequisites

- **Normative policy:** [docs/WORKFLOW.md](../../../docs/WORKFLOW.md#deployment-validation-policy) (*Deployment validation policy*). Local validation on `workflow.json` is **mandatory** before any publish.
- **REST push credentials:** copy [`.env.example`](../../../.env.example) → **`.env`** at the repository root; set `N8N_BASE_URL` and `N8N_API_KEY`. Set `N8N_WORKFLOW_ID_*` when the canonical `workflow.json` has no top-level `id` (see [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md#root-env-for-repository-tooling)). Optionally set **`EXO_MCP_ENDPOINT`** (same name as n8n `$vars.EXO_MCP_ENDPOINT`) so REST deploy injects the MCP Client `endpointUrl` fallback literal before `PUT` — see [docs/DEVELOPMENT.md — REST deploy to n8n](../../../docs/DEVELOPMENT.md#rest-deploy-to-n8n).
- **Cursor and MCP (SDK path only):** [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md#cursor-and-mcp-recommended). Copy [`.cursor/mcp.json.example`](../../mcp.json.example) to a **local, git-ignored** `.cursor/mcp.json`; never commit real secrets.
- **Tooling commands:** [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md#useful-scripts) (`npm run validate:workflows`, [validate-workflow.sh](../../../tools/validate-workflow.sh)).

## Procedure (in order)

### 1. Local validation (mandatory)

From the repository root, after `npm install`:

- All workflows: `npm run validate:workflows`, or
- One portfolio id: `./tools/validate-workflow.sh wf01` (supports `wf01`–`wf04` and `unwrap`).

**Stop** if validation fails, unless the exception is already recorded in [docs/ISSUES.md](../../../docs/ISSUES.md) per the deployment policy.

### 2a. REST: push canonical JSON (default for repo parity)

1. Ensure the remote workflow id is known: either `N8N_WORKFLOW_ID_WF…` in `.env` or a top-level `"id"` in the canonical `workflow.json` for that tenant (see per-workflow `SPEC.technical.md` / `README.md`, e.g. [wf01 SPEC.technical.md](../../../workflows/wf01-email-dispatch/SPEC.technical.md), [wf03 README.md](../../../workflows/wf03-weekly-steering/README.md), [wf04 SPEC.technical.md](../../../workflows/wf04-metadata-enrichment/SPEC.technical.md); unwrap id in wf01 spec).
2. Run `./tools/deploy.sh wf0X` (runs local validation again before `PUT` by default). Portfolios with **`subworkflow-dependencies.json`** (WF01, WF03) deploy declared sub-workflows first, then the parent, with in-memory **Execute Workflow** id injection (see [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md#portfolio-deploy-dependencies-manifest)). Use `--dry-run` to skip PUT/POST while still GETting remotes for merge logs; use `--no-deps` to skip the manifest; use `--create-missing-deps` for first-time POST of missing dependencies (not with `--dry-run` when ids are still missing). Use `--skip-validate` only with care.

MCP `validate_workflow` does **not** apply to this path.

### 2b. Optional: emit SDK code for the n8n MCP (when using MCP to deploy, not JSON import)

- `./tools/validate-workflow.sh wf0X --emit-sdk` (writes `work/wf0X.generated.mjs` by default, git-ignored) **after** local validation passes.
- Read the generated file content as the MCP `code` string. The MCP `validate_workflow` tool only accepts **fluent SDK `code`**, not raw `workflow.json`.

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
