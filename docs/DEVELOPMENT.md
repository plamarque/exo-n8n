# Development And Operations

## Repository Type

This repository is primarily an n8n/eXo workflow artifact workspace. It contains canonical `workflow.json` files per workflow, split specifications under `workflows/`, an optional [audit](audit-code-vs-native.md), generated [inventory](inventory-code-nodes.json), and a minimal [tools/](../tools/) directory.

[UNCERTAIN] No root `package.json` was observed, so there is no single repository-level install/test command documented here.

## Local Prerequisites

- Node.js capable of running ES modules used by scripts in `tools/`.
- Access to the target n8n instance when synchronizing workflows through the n8n API (optional; MCP n8n is the preferred path when available in Cursor).
- eXo MCP credentials configured in n8n for workflow execution. Demo endpoint (reference): `https://exo-mips-ft.meeds.io/mcp-server/mcp` — always match `EXO_MCP_ENDPOINT` to the environment under test.
- OpenAI or compatible credentials configured in n8n for workflows using AI nodes.

## Workflow lifecycle (expected)

1. **Edit** the canonical JSON in the repo: `workflows/wf0X-.../workflow.json`.
2. **Validate** with the n8n MCP (`validate_workflow` / SDK patterns in your MCP client).
3. **Deploy** with `update_workflow` or `create_workflow_from_code` (or import JSON in the n8n UI for ad-hoc tests).
4. **Run** on the instance and **inspect executions** in n8n for debugging.
5. Optional: push a known workflow back from local file via the API (WF04) using [wf04-push-to-n8n-api.mjs](../tools/wf04-push-to-n8n-api.mjs) when you need a quick sync without using MCP for that step.

## Useful scripts

From the repository root:

```bash
node tools/inventory-code-nodes.mjs
```

This regenerates `docs/inventory-code-nodes.json` and prints totals for n8n **Code** nodes (skips `fixtures/` when scanning for `workflow.json`).

WF03 only — the large **Compose COPIL Note** `jsCode` is maintained in `[tools/_compose_raw.js](../tools/_compose_raw.js)`. After editing that file, re-embed it into the workflow with:

```bash
python3 tools/patch_wf03_english.py
```

(The script also refreshes the **Build Report Context** English literals and should be re-run when those nodes change in isolation.)

WF04 only — push canonical JSON to a remote n8n instance (requires API key):

- Script: [tools/wf04-push-to-n8n-api.mjs](../tools/wf04-push-to-n8n-api.mjs)
- Environment: `N8N_BASE_URL`, `N8N_API_KEY`
- Source file: [workflows/wf04-document-enrichment-ai/workflow.json](../workflows/wf04-document-enrichment-ai/workflow.json)
- Target workflow id (built into script): `aze2wAktXHYrTBTr`

## Configuration

Example `config.env.example` files live **next to each workflow** (for example [workflows/wf02-document-validation/config.env.example](../workflows/wf02-document-validation/config.env.example)).

- Do not put real tokens in example files.
- Verify each example against the current workflow-specific README and specs before using it in an environment.
- Prefer n8n **Variables** for runtime values that differ across environments.

## Validation notes

- **WF01**: import [workflows/wf01-email-to-task/workflow.json](../workflows/wf01-email-to-task/workflow.json); ensure shared [unwrap sub-workflow](../workflows/shared/subworkflows/unwrap-mcp-json/workflow.json); verify MCP eXo and OpenAI credentials; run `Manual Start`. See [wf01 README](../workflows/wf01-email-to-task/README.md).
- **WF02**: import [workflows/wf02-document-validation/workflow.json](../workflows/wf02-document-validation/workflow.json); set variables from [config.env.example](../workflows/wf02-document-validation/config.env.example); test webhook. See [wf02 README](../workflows/wf02-document-validation/README.md).
- **WF03**: use [workflows/wf03-weekly-copil/README.md](../workflows/wf03-weekly-copil/README.md) and technical specs for IDs, notes, and agenda. Canonical JSON: [workflows/wf03-weekly-copil/workflow.json](../workflows/wf03-weekly-copil/workflow.json); raw API snapshot: [api-response.snapshot.json](../workflows/wf03-weekly-copil/fixtures/api-response.snapshot.json).
- **WF04**: set `$vars.EXO_SPACE_NAME`; verify MCP OAuth, OpenAI, and Data Table; see [wf04 README](../workflows/wf04-document-enrichment-ai/README.md).

## Operational safety

- Keep `workflow.json`, per-workflow README and specs, and remote n8n workflow IDs in sync.
- Record failed validations in [ISSUES.md](ISSUES.md).
- Record durable layout or integration decisions in [ADR/](ADR/).

