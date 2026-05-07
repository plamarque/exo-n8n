# ADR 0003 - Prefer native n8n nodes over Code nodes (low-code)

## Status

Accepted

## Context

This repository’s portfolio workflows integrate eXo through MCP and, in some cases, AI nodes. Early iterations and reverse-engineered exports tended to rely on **Code** nodes for parsing, branching, HTML, and glue logic. That approach:

- Hides **business rules** and **control flow** in JavaScript instead of visible **Set**, **IF**, **Split Out**, **Merge**, **Data Table**, and **Execute Workflow** nodes.
- Makes **peer review** and **operational debugging** harder: the canvas no longer tells the story; readers must open each Code block.
- Duplicates patterns (for example MCP envelope handling) across workflows unless factored into **shared sub-workflows**.

Teams asked for a **low-code** posture: maximize native n8n building blocks so that maintainers and integrators can reason about behavior from the graph and split specifications.

## Decision

1. **Default:** Prefer **native n8n nodes** for orchestration, branching, deduplication, persistence (including **Data Table** + **Merge** patterns), and reuse (**Execute Workflow** to shared UTILs such as unwrap MCP JSON).
2. **Exceptions:** Use **Code** nodes only when a small, named block is **clearer and safer** than equivalent expressions—for example:
   - Focused **HTML** composition for task or note bodies.
   - **Narrow guards** (for example ensuring **Merge** inputs are non-empty when SQL-style joins would otherwise yield zero rows).
   - **Response normalization** where a dozen-line script beats unmaintainable inline expressions—prefer pulling repeated logic into a **sub-workflow** when it crosses workflows.
3. **Documentation:** Residual Code surfaces remain **explicitly described** in each workflow’s `SPEC.technical.md` (and README tables where used), including role and approximate scope—not buried without traceability.

This ADR does **not** mandate zero Code nodes; it mandates **intentional** Code with native-first defaults.

## Consequences

- Refactors toward native patterns are **normative** when they improve clarity without fragile workarounds; optional further tweaks stay in `docs/ISSUES.md` when deferred.
- **Governance:** Cross-cutting guidance stays in [ARCH.md](../ARCH.md) (*Architectural Constraints*); workflow-specific truth stays in `workflows/*/SPEC.*.md`.
- **Tooling:** local `validateWorkflow` on canonical `workflow.json` before publish (see [WORKFLOW.md](../WORKFLOW.md)) remains mandatory regardless of Code vs native mix.

## Related

- [0004-didactic-workflow-simplification-slices.md](0004-didactic-workflow-simplification-slices.md) — optional tutorial-oriented simplification and robustness trade-offs (complements native-first defaults).
- [0002-repository-layout-workflows.md](0002-repository-layout-workflows.md) — canonical JSON per workflow and layout.
