# ADR 0002 - Repository layout for n8n workflows

## Status

Accepted

## Context

The repository is a collection of four n8n workflows integrating eXo via MCP, with documentation that needed a predictable layout: one directory per workflow, canonical JSON artifacts, optional fixtures, shared sub-workflows, and minimal `tools/`.

## Decision

1. **Layout**
  - `workflows/wf01-email-to-task/`, `workflows/wf02-document-validation/`, `workflows/wf03-weekly-copil/`, `workflows/wf04-document-enrichment-ai/`.
  - Each contains at minimum: `README.md`, `SPEC.functional.md`, `SPEC.technical.md`, `workflow.json` (canonical), `config.env.example`, and optionally `fixtures/`.
  - Cross-cutting sub-workflows live under `workflows/shared/subworkflows/<name>/` with their own `workflow.json` and `README.md`.
2. **Canonical JSON**
  - `workflow.json` in each workflow folder is the **source of truth** for review, import, and MCP validation.
  - **WF04**: the canonical file is **import**-oriented n8n JSON (suitable for re-import and API `PUT` updates). A **secondary snapshot** of a full n8n export lives under `workflows/wf04-document-enrichment-ai/fixtures/workflow.export.snapshot.json` for diffing against the server when needed.
  - **WF03**: raw n8n API responses may wrap the workflow in an object with a `workflow` key. The canonical `workflow.json` is the **inner workflow** object only (n8n import format). A copy of a raw API response is preserved under `fixtures/api-response.snapshot.json` for traceability.
  - **WF01, WF02**: `workflow.json` is the single canonical export per workflow folder.
3. **Tools**
  - Small automation helpers live under `tools/` (for example `inventory-code-nodes.mjs`, `push-workflow-to-n8n-api.mjs`, `validate-workflow-json.mjs`). Document new scripts in [DEVELOPMENT.md](../DEVELOPMENT.md).
4. **Documentation**
  - Portfolio-level contract stays in `docs/SPEC.md`, `docs/ARCH.md`, etc. Per-workflow detail lives under `workflows/wf**/` and links back to the global docs.

## Consequences

- All internal links and README paths must use `workflows/...`.
- Audit and generated data belong under the relevant `workflows/.../fixtures` or `docs/` paths as documented per workflow.
- Conflicts between older `.env.example` files and current specs are tracked in `docs/ISSUES.md` when they persist.

## Related

- [0001-documentation-governance-layout.md](0001-documentation-governance-layout.md)