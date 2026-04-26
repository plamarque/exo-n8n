# ADR 0001 - Documentation Governance Layout

## Status

Accepted

## Context

The repository already contains workflow-specific specifications, n8n exports, scripts, configuration examples, and audit material. The documentation was useful but scattered across the repository root and workflow folders without a single normative `docs/` contract.

AI-assisted development needs a stable convention for where functional specifications, architecture, planning, issues, and operational notes live.

## Decision

Use this layout:

- `AGENTS.md` at repository root for agent and contributor instructions.
- `docs/WORKFLOW.md` for documentation governance rules.
- `docs/SPEC.md` for cross-workflow functional specification.
- `docs/DOMAIN.md` for domain vocabulary and business rules.
- `docs/ARCH.md` for architecture and integration structure.
- `docs/ADR/` for durable architecture decisions.
- `docs/PLAN.md` for delivery tracking.
- `docs/ISSUES.md` for bugs, limitations, and deferred work.
- `docs/DEVELOPMENT.md` for setup, validation, and operational notes.

Workflow-specific Markdown files remain valid detailed references, but the cross-project governance docs define the top-level contract.

## Consequences

- Future changes must update the governance document that corresponds to the type of change.
- Plan and issue tracking are separated from normative behavior.
- Descriptive claims must be grounded in observed files or explicitly marked as assumptions or uncertainties.