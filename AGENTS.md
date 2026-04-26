# Agent Instructions

This repository is governed by documentation-first rules for AI-assisted work.

## Scope

- Treat `docs/SPEC.md`, `docs/DOMAIN.md`, `docs/ARCH.md`, `docs/WORKFLOW.md`, and `docs/ADR/` as normative documentation.
- Treat `docs/PLAN.md` and `docs/ISSUES.md` as tracking documents, not as sources of functional truth.
- Treat per-workflow documentation under `workflows/*/` (for example `SPEC.functional.md`, `SPEC.technical.md`, `README.md`) as reference material that may be more detailed than the cross-project governance docs in `docs/`.

## Required Workflow

1. Read the relevant governance docs before changing workflows, scripts, configuration, or project documentation.
2. If changing expected behavior, update `docs/SPEC.md` and any affected workflow-specific spec.
3. If changing architecture, dependencies, deployment shape, or major orchestration patterns, update `docs/ARCH.md` and add an ADR in `docs/ADR/` when the decision is durable.
4. If changing domain vocabulary, entities, actors, or business rules, update `docs/DOMAIN.md`.
5. If discovering bugs, limitations, or deferred work, update `docs/ISSUES.md`.
6. If changing delivery status or next steps, update `docs/PLAN.md`.
7. If changing setup, runbooks, scripts, or validation commands, update `docs/DEVELOPMENT.md`.

## Constraints

- Do not modify application code as part of documentation-governance maintenance unless the user explicitly asks for implementation work.
- Do not invent behavior that is not observable in code, exports, configuration, or existing specifications. Mark inferred content with `[ASSUMPTION]` or `[UNCERTAIN]`.
- Keep exported n8n workflow JSON and local documentation consistent. When they disagree, mark the conflict in `docs/ISSUES.md` before changing behavior.
- Do not commit secrets. Example environment files may contain placeholders only.