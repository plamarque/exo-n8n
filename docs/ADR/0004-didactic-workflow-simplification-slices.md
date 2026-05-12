# ADR 0004 - Didactic workflow simplification (“tutorial slices”)

## Status

Accepted

## Context

The portfolio includes workflows that serve **demos, onboarding, and teaching** as well as operational use. WF01 (email dispatch) was refactored explicitly for **explainability**: fewer nodes, simpler expressions, and fewer defensive layers so each step on the canvas maps to one clear idea.

That goal **trades robustness for clarity**: a tutorial slice may omit unwrap sub-workflows, skip redundant MCP calls, or avoid exhaustive field validation when those choices make the graph easier to narrate without changing the core business story.

Without written rules, “simplify WF02–WF04 like WF01” stays ambiguous and risks contradicting [ADR 0003](0003-prefer-native-n8n-nodes.md) (native-first) or deployment policy in [WORKFLOW.md](../WORKFLOW.md).

## Decision

1. **Named pattern:** A **didactic simplification slice** is an intentional refactor of a canonical `workflow.json` (and its `SPEC.*.md` / `README.md`) to apply the **practices below**, while keeping **local `validateWorkflow` before publish** mandatory and recording any **tenant-specific assumptions** in the workflow technical spec.

2. **Practices (normative checklist for each slice):**
   - **One main idea per node** — Prefer nodes that answer a single question on the canvas; split combined “normalize + decide + format” into separate steps only when it helps readability, or merge when a single native node (e.g. **HTML**) replaces a chain of opaque steps.
   - **Minimal expressions** — Prefer short n8n expressions and direct references to prior node output; add `String()`, `.slice()`, case transforms, or priority remapping **only** where the tool or n8n strictly requires them. Avoid “defensive styling” in expressions for tutorial exports.
   - **Loop by native split** — Use **Split Out** (or equivalent native patterns) to turn list payloads into **one item per entity** instead of hiding iteration in **Code** when the data shape allows it.
   - **IF / Filter for noise, not matrices** — Use **IF** or **Filter** to drop items that cannot proceed (missing ids, empty required fields), not to encode large validation taxonomies.
   - **MCP envelopes** — When the tenant response is already usable (e.g. list payloads in `content[0].text`), **prefer direct field access + Split Out** over a shared **unwrap** sub-workflow **for that tutorial slice**; document `[ASSUMPTION]` or tenant notes in `SPEC.technical.md` if other tenants wrap differently.
   - **HTML and templates** — Prefer the **HTML** node (or a small, readable template) for fixed-layout bodies when it is clearer than a **Code** node; reserve **Code** for logic that is genuinely shorter or safer in script (see [ADR 0003](0003-prefer-native-n8n-nodes.md)).
   - **MCP Client tool arguments** — Canonical portfolio graphs use **Manual** parameter mapping (one field per tool argument) for readability. Do not pass **empty optional fields** that break some servers; persist the resource-mapper **`schema`** with **`removed: true`** on unused tool parameters. **JSON** input mode is reserved only for a documented exception (e.g. a tool shape that Manual cannot express cleanly); record the choice in the workflow `SPEC.technical.md`.
   - **Align AI with tool enums** — **Structured Output Parser** JSON Schema (e.g. `enum` for priority) and the **system prompt** must match MCP allow-lists; no values that the next node cannot send.
   - **No redundant MCP steps** — Omit calls that duplicate work already done in a prior tool invocation (e.g. **assignee** on `create_task_in_project` when a separate **`assign_task`** adds no value on the target tenant—reintroduce only if proven necessary).
   - **Document the trade-off** — Each simplified workflow’s `SPEC.technical.md` should state that the graph is **tutorial-oriented** and list deferred hardening (idempotency, stricter guards, unwrap compatibility) in [ISSUES.md](../ISSUES.md) or a “Follow-ups” subsection when applicable.

3. **Scope:** These practices apply to **optional** refactors tracked as **slices** in [PLAN.md](../PLAN.md). They do **not** relax [WORKFLOW.md](../WORKFLOW.md) deployment validation or invent runtime behavior not reflected in the JSON and specs.

## Consequences

- **WF02, WF03, WF04** may be refactored incrementally using the same checklist; each slice updates canonical `workflow.json`, per-workflow specs, and cross-project docs when observable portfolio rules change.
- **Operational** workflows may stay more defensive; divergences between “tutorial” and “production” variants should be explicit in specs or ISSUES.
- **[ADR 0003](0003-prefer-native-n8n-nodes.md)** remains the default for native vs Code; this ADR adds **didactic** priorities and **explicit robustness trade-offs**.

## Related

- [0003-prefer-native-n8n-nodes.md](0003-prefer-native-n8n-nodes.md) — native-first, intentional Code.
- [0002-repository-layout-workflows.md](0002-repository-layout-workflows.md) — canonical `workflow.json` per workflow.
- [WORKFLOW.md](../WORKFLOW.md) — documentation roles and deployment validation policy.
- [PLAN.md](../PLAN.md) — tracking for WF02–WF04 simplification slices.
