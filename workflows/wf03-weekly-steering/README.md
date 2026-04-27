# Workflow 03 - Weekly steering preparation

**Terminology:** **COPIL** is French project shorthand for a **steering committee** (*comité de pilotage*). In English, *steering committee* (or *steering group*) is the clearest wording; *SteerCo* is informal jargon in some companies, not a universal acronym. This workflow’s export still uses `COPIL` in several **node names** to match the demo environment; the portfolio workflow title uses English *steering*.

## Files

| File | Role |
|------|------|
| [`workflow.json`](workflow.json) | Canonical n8n export (see [ADR 0002](../../docs/ADR/0002-repository-layout-workflows.md)). |
| [`fixtures/api-response.snapshot.json`](fixtures/api-response.snapshot.json) | Raw API response (workflow + `triggerInfo`) kept for traceability. |
| [`SPEC.functional.md`](SPEC.functional.md) | Goals, rules, and acceptance criteria. |
| [`SPEC.technical-exo-mips.md`](SPEC.technical-exo-mips.md) | eXo MIPS MCP contract (notes, projects, agenda, etc.). |
| [`SPEC.technical-mcp.md`](SPEC.technical-mcp.md) | eXo QAUI MCP exploration (phase 1). |
| [`fixtures/steering-template-note.md`](fixtures/steering-template-note.md) | Note template (editorial reference). |
| [`config.env.example`](config.env.example) | Example n8n variables. |
| [`subworkflows/`](subworkflows/) | WF03-only UTIL exports (build report + compose HTML); not shared across other portfolio workflows. |

## Sub-workflows

**Unwrap** is cross-portfolio under [`workflows/shared/subworkflows/`](../shared/subworkflows/unwrap-mcp-json/README.md); the two UTIL graphs live only under this workflow directory. For **REST deploy from git**, use `./deploy.sh wf03` from the repository root: [subworkflow-dependencies.json](subworkflow-dependencies.json) lists unwrap plus the two UTILs in order; the deploy script **PUT**s each dependency, then injects remote **`workflowId`** values into the parent **in memory** (from `.env`, optional UTIL JSON top-level `id`, or the **Execute Workflow** values already in `workflow.json`). Override per-tenant ids with `N8N_WORKFLOW_ID_UNWRAP`, `N8N_WORKFLOW_ID_WF03_BUILD_REPORT`, and `N8N_WORKFLOW_ID_WF03_COMPOSE` in root `.env` if they differ from the reference graph.

| UTIL | Repo path | Reference remote id (demo export in parent `workflow.json`) |
|------|-----------|----------------------------------------------------------------|
| Unwrap MCP JSON | [../shared/subworkflows/unwrap-mcp-json/](../shared/subworkflows/unwrap-mcp-json/) | `E4OAThogWRG93MUG` |
| WF03 build report context | [subworkflows/wf03-build-report-context/](subworkflows/wf03-build-report-context/) | `KBsZj9ClCJX2wNFH` |
| WF03 compose steering note HTML | [subworkflows/wf03-compose-steering-note-html/](subworkflows/wf03-compose-steering-note-html/) | `dDeDXkNJkWxxqxPb` |

## Identifiers (from spec)

- n8n workflow: `1suyxKutB174p7b4` (name on the instance: `WF03 - Weekly steering preparation`).

## Code vs native audit

WF03’s main graph now favors **Set**, **Execute Workflow** (shared unwrap + two WF03 UTILs), and a single small **Decide Note Upsert** Code node; HTML/report composition lives in UTIL sub-workflows. See [`docs/ISSUES.md`](../../docs/ISSUES.md) and [audit `docs/audit-code-vs-native.md`](../../docs/audit-code-vs-native.md).

## Import

**REST (recommended):** From the repo root, `./deploy.sh wf03` (see [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md#portfolio-deploy-dependencies-manifest)). First-time UTILs on a new n8n tenant: `./deploy.sh wf03 --create-missing-deps`, then add printed lines to `.env`. Use `./deploy.sh wf03 --dry-run` to print PUT targets (GETs still run for credential merge). Use `./deploy.sh wf03 --no-deps` only if you intentionally skip the manifest.

**Manual UI:** Import [UTIL - Unwrap MCP JSON](../shared/subworkflows/unwrap-mcp-json/workflow.json), [UTIL - WF03 build report context](subworkflows/wf03-build-report-context/workflow.json), and [UTIL - WF03 compose steering note HTML](subworkflows/wf03-compose-steering-note-html/workflow.json); align **Execute Workflow** ids in `workflow.json` if your instance assigned different ids. Then import `workflow.json` (or MCP `validate_workflow` / `update_workflow`). Set `EXO_MCP_ENDPOINT` and the `WF03_*` variables from the graph / technical specs; verify MCP OAuth and OpenAI on the target instance.
