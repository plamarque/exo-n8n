---
name: n8n-workflow-deploy-gate
description: >-
  Enforces the local @n8n/workflow-sdk validation and optional --emit-sdk codegen, then
  n8n MCP validate_workflow before update_workflow when publishing SDK code to n8n. Use
  when editing workflows/wf*-/workflow.json, deploying to n8n via Cursor MCP, or when
  the user asks to push, import, or sync workflows to a remote n8n instance.
---

# n8n workflow deploy gate

## Prerequisites

- **Normative policy:** [docs/WORKFLOW.md](../../../docs/WORKFLOW.md#deployment-validation-policy) (*Deployment validation policy*). Local validation on `workflow.json` is **mandatory** before any publish.
- **Cursor and MCP (hosts):** [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md#cursor-and-mcp-recommended). Copy [`.cursor/mcp.json.example`](../../mcp.json.example) to a **local, git-ignored** `.cursor/mcp.json` and set tenant hostnames and bearer; never commit real secrets.
- **Tooling commands:** [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md#useful-scripts) (`npm run validate:workflows`, [validate-workflow.sh](../../../tools/validate-workflow.sh)).

## Procedure (in order)

### 1. Local validation (mandatory)

From the repository root, after `npm install`:

- All workflows: `npm run validate:workflows`, or
- One portfolio id: `./tools/validate-workflow.sh wf01` (supports `wf01`–`wf04` and `unwrap`).

**Stop** if validation fails, unless the exception is already recorded in [docs/ISSUES.md](../../../docs/ISSUES.md) per the deployment policy.

### 2. Optional: emit SDK code for the n8n MCP (when using MCP to deploy, not JSON import)

- `./tools/validate-workflow.sh wf0X --emit-sdk` (writes `work/wf0X.generated.mjs` by default, git-ignored) **after** local validation passes.
- Read the generated file content as the MCP `code` string. The MCP `validate_workflow` tool only accepts **fluent SDK `code`**, not raw `workflow.json`.

### 3. n8n MCP: validate then update (recommended when passing SDK `code`)

1. Get the **remote n8n `workflowId`** for the target workflow from the per-workflow spec (e.g. [workflows/wf01-email-to-task/SPEC.technical.md](../../../workflows/wf01-email-to-task/SPEC.technical.md)), not by guessing.
2. Call **n8n MCP** `validate_workflow` with the full `code` string from step 2.
3. If the result is valid, call `update_workflow` with the **same** `code` and that `workflowId` (and optional `description`).

**Do not** skip local validation in step 1 and rely only on MCP. MCP and local SDK can diverge on versions; the policy treats MCP validation as a **second** line of defense for SDK `code` deploys.

### 4. JSON-only deploy (UI or REST)

If the user imports `workflow.json` only, MCP `validate_workflow` does not apply. Step 1 remains **mandatory**.

## Out of scope

Runtime behavior (eXo OAuth, OpenAI, n8n execution quotas) is not validated by `validateWorkflow` or MCP `validate_workflow` alone—see [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md).

## Source of truth

- Policy: [docs/WORKFLOW.md](../../../docs/WORKFLOW.md#deployment-validation-policy)
- Commands: [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md)

If this runbook and the policy disagree, follow **docs/WORKFLOW.md** and update this skill.
