# ADR 0002 - Repository layout for n8n workflows

## Status

Accepted

## Context

The repository is a collection of four n8n workflows integrating eXo via MCP, with documentation that grew at the root and under `n8n/workflows/`. We need a predictable layout: one directory per workflow, canonical JSON artifacts, optional fixtures, shared sub-workflows, and minimal `tools/`.

## Decision

1. **Layout**
  - `workflows/wf01-email-to-task/`, `workflows/wf02-validation-documentaire/`, `workflows/wf03-copil-hebdomadaire/`, `workflows/wf04-document-enrichment-ai/`.
  - Each contains at minimum: `README.md`, `SPEC.functional.md`, `SPEC.technical.md`, `workflow.json` (canonical), `config.env.example`, and optionally `fixtures/`.
  - Cross-cutting sub-workflows live under `workflows/shared/subworkflows/<name>/` with their own `workflow.json` and `README.md`.
2. **Canonical JSON**
  - `workflow.json` in each workflow folder is the **source of truth** for review, import, and MCP validation.
  - **WF04**: the canonical file is the **import**-oriented n8n JSON (same content as the former `workflow-04-document-enrichment-ai.import.json`) because it is suitable for re-import and API `PUT` updates. The full export from n8n is kept as a **secondary snapshot** under `workflows/wf04-document-enrichment-ai/fixtures/workflow.export.snapshot.json` for diffing against the server when needed.
  - **WF03**: the `workflow-03-reporting-hebdo.server.json` file from the n8n API is sometimes wrapped in an object with a `workflow` key. The canonical `workflow.json` is the **inner workflow** object only (n8n import format). A copy of the raw API response is preserved under `fixtures/api-response.snapshot.json` for traceability.
  - **WF01, WF02**: the former root JSON file content becomes `workflow.json` unchanged in semantics.
3. **Tools**
  - Only `tools/inventory-code-nodes.mjs` and `tools/wf04-push-to-n8n-api.mjs` are kept at repository root. Other ad-hoc scripts are removed; restore from git history if needed.
4. **Documentation**
  - Portfolio-level contract stays in `docs/SPEC.md`, `docs/ARCH.md`, etc. Per-workflow detail lives under `workflows/wf**/` and links back to the global docs.

## Consequences

- All internal links and README paths must be updated to `workflows/...`.
- The old `n8n/` tree is removed after migration; audit and generated data move under the relevant `workflows/.../fixtures` or `docs` references.
- Conflicts between legacy `.env.example` files and current specs are tracked in `docs/ISSUES.md` when they persist.

## Related

- [0001-documentation-governance-layout.md](0001-documentation-governance-layout.md)