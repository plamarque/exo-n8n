# Architecture

## Overview

The repository is a documentation and artifact workspace for n8n workflows that automate eXo scenarios through MCP and, in some workflows, OpenAI-compatible AI nodes.

There is no observed application package manifest at the repository root. The executable artifacts are primarily n8n `workflow.json` files, optional `fixtures/`, a small `tools/` directory, and governance docs under `docs/`.

## Repository Structure

- `workflows/`: one folder per portfolio workflow (WF01–WF04) plus `shared/subworkflows/` for reusable pieces (for example [unwrap MCP JSON](../workflows/shared/subworkflows/unwrap-mcp-json/)).
- `workflows/*/` layout: `workflow.json` (canonical), `README.md`, `SPEC.functional.md`, `SPEC.technical.md` (or split technical docs for WF03), `config.env.example`, optional `fixtures/`.
- `tools/`: minimal maintenance scripts (validation of canonical `workflow.json`, optional REST push to n8n via [push-workflow-to-n8n-api.mjs](../tools/push-workflow-to-n8n-api.mjs)). See [DEVELOPMENT.md](DEVELOPMENT.md).
- `docs/`: normative and tracking documentation (for example [SPEC.md](SPEC.md), [WORKFLOW.md](WORKFLOW.md), [ISSUES.md](ISSUES.md)).
- `docs/ADR/`: architecture decision records, including [0002](ADR/0002-repository-layout-workflows.md) (layout and canonical JSON policy) and [0003](ADR/0003-prefer-native-n8n-nodes.md) (prefer native nodes over Code for low-code maintainability).

## External Systems

- **eXo (demo MCP)**: project exploration and tool contracts were validated against a demo server; a current reference base URL is `https://exo-mips-ft.meeds.io/mcp-server/mcp` (always align credentials and `EXO_MCP_ENDPOINT` in n8n to the target tenant).
- **n8n**: workflows are edited and executed in n8n; this repository holds JSON exports. **Publish paths:** (1) REST `PUT` of canonical `workflow.json` via [push-workflow-to-n8n-api.mjs](../tools/push-workflow-to-n8n-api.mjs) and root `.env` credentials; (2) **n8n MCP** in Cursor to validate, create/update workflows, and inspect executions. **Normative gates before publish** (mandatory local `validateWorkflow` on `workflow.json`; recommended MCP `validate_workflow` when publishing SDK `code` via MCP) are defined in [WORKFLOW.md](WORKFLOW.md#deployment-validation-policy). Optional Cursor MCP connection uses [`.cursor/mcp.json.example`](../.cursor/mcp.json.example) (copy locally; see [DEVELOPMENT.md](DEVELOPMENT.md#cursor-and-mcp-recommended)); real `mcp.json` is not committed.

## High-Level Components

### n8n Runtime

n8n hosts and executes the workflows. Observed node types include:

- Manual, schedule, webhook, and response nodes.
- MCP Client nodes.
- Set, IF, Filter, Split Out, Merge, Limit, Data Table, Stop and Error nodes.
- LangChain/OpenAI model, agent, and structured output parser nodes.
- Code nodes where custom JavaScript is still used.

### eXo MCP Integration

Workflows call eXo through MCP tools. Observed tool families include:

- Email intake: `list_emails`.
- Tasks and projects: `create_task_in_project`, `assign_task`, `add_task_comment`, `update_task_status`, `list_tasks`, `list_projects`, `list_project_statuses`.
- Documents: `search_documents`, `get_document_by_id`, `update_document_description`, `add_content_to_category`.
- Spaces, notes, categories, and agenda-related tools are documented in WF03 technical exploration files.

### AI Layer

AI nodes are used for:

- WF01 email routing/classification.
- WF03 steering committee (COPIL) signal analysis and agenda suggestions.
- WF04 document metadata (descriptions and category suggestions).

Structured output parsers are used where downstream workflow logic depends on fixed fields.

### Persistence

Observed persistence patterns:

- WF04 uses n8n Data Table `exo_processed_documents` for incremental document processing.
- WF02 (refactored 2026-04-27) uses two n8n Data Tables — `wf02_processed_documents` for intake idempotency (parity with WF04) and `wf02_approvals` for split/join approval state, replacing the previous `$getWorkflowStaticData` map. Both tables are self-bootstrapped at the top of the intake branch via `Ensure Tracking Table` / `Ensure Approvals Table` (`createIfNotExists`, `onError: continueRegularOutput`).
- WF01 persistent email idempotence is identified as missing.

## Integration Pattern

The recurring architecture is:

1. Trigger a workflow manually, on schedule, or through webhook.
2. Call eXo MCP tools.
3. Normalize MCP responses, often from text-wrapped JSON envelopes.
4. Apply workflow-specific business rules.
5. Optionally invoke AI with structured output.
6. Write back to eXo through MCP tools.
7. Track state when needed through Data Tables or workflow data.

## Architectural Constraints

- MCP response normalization is a cross-cutting concern because several eXo MCP responses may arrive as arrays containing serialized JSON in `text`.
- Native n8n nodes are preferred for visible business logic when they remain maintainable; narrow exceptions for Code nodes are recorded in [ADR 0003](ADR/0003-prefer-native-n8n-nodes.md).
- Code nodes are acceptable for complex HTML composition, state merging, or response normalization when native nodes would obscure the behavior.
- Environment-specific IDs and URLs should be configurable where workflows need to move between eXo/n8n environments.

## Assumptions And Uncertainties

- [ASSUMPTION] n8n cloud is the primary execution environment for at least some workflows, based on workflow IDs, webhook URLs, and API synchronization scripts.
- [UNCERTAIN] The repository does not define a single package manager workflow; scripts are plain Node.js modules and may rely on the local Node version.
- [UNCERTAIN] Some workflow exports may be snapshots of remote state rather than the authoritative source for redeploying every workflow.