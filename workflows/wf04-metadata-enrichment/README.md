# WF04 — Metadata enrichment (background document hygiene)

**TL;DR** — On a **schedule** or **manual** run, resolve an eXo **space by name**, scan documents, and for each **new or changed** file (within a **per-run cap**) call **structured LLM output** to propose a **short description** and **categories**, then **write back** through MCP and **record state** in an n8n **Data Table** so reruns stay incremental.

---

## Problem context

Without steady upkeep, document libraries accumulate **weak titles**, **missing descriptions**, and **inconsistent tagging**. Manual cleanup does not scale; fully automated tagging without guardrails can **overwrite** trusted metadata. Teams need a **hybrid**: platform writes with **AI assist**, **bounded batch size**, and **idempotency**.

## Automation objective

- **Require** a configured space name (fail fast if missing).
- **Ensure** a tracking table exists for processed documents.
- **List** space documents, **normalize** fields, and **filter** to items that are new or **changed** since last run.
- For each selected item: **read** full document context, **load category tree**, run **structured** LLM analysis, **update description**, **assign categories** by resolved ids.
- **Upsert** tracking rows and emit a short **processing summary**.

## High-level flow (conceptual)

1. **Trigger** — manual start or daily schedule.
2. **Validate input** — require `$vars.EXO_SPACE_NAME` (strict).
3. **Bootstrap** — create `exo_processed_documents` Data Table if needed.
4. **Resolve space** — `get_my_spaces` → pick id by name.
5. **Search & normalize** — `search_documents`, map ids and timestamps.
6. **Incremental filter** — compare with tracking; apply **per-run limit** (safety).
7. **Per document** — `get_document_by_id`, `get_category_tree`, LLM structured output, MCP writes in order.
8. **Record & summarize** — upsert tracking; aggregate counts.

## n8n design choices (not a node-by-node list)


| Area             | Choice                                   | Why                                                                                            |
| ---------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Safety           | **Hard cap** on documents per execution  | Prevents runaway LLM + MCP cost on large libraries ([SPEC.functional.md](SPEC.functional.md)). |
| Correctness      | **Structured LLM output** (schema)       | Keeps descriptions short and categories machine-verifiable before MCP writes.                  |
| Idempotency      | **Data Table `exo_processed_documents`** | Same conceptual pattern as WF02 merge path—**skip** unchanged docs across days.                |
| Failure handling | **Explicit stops** after partial writes  | Documented in technical spec when description succeeds but category assignment fails.          |
| MCP              | **No REST fallback**                     | MCP-first portfolio consistency ([SPEC.technical.md](SPEC.technical.md)).                      |


## MCP eXo interaction model

Tools used (see [SPEC.technical.md](SPEC.technical.md)):

- `get_my_spaces` — resolve **space id** from `**EXO_SPACE_NAME`**.
- `search_documents` — enumerate candidates in the space.
- `get_document_by_id` — fetch details for enrichment.
- `get_category_tree` — resolve **category_id** values before assignment.
- `update_document_description` — persist summary text.
- `add_content_to_category` — attach resolved categories.

## Operational considerations

- `**EXO_SPACE_NAME`** — mandatory `$vars` setting; workflow stops if empty ([SPEC.functional.md](SPEC.functional.md)).
- **Tenant differences** — category names and ids vary; always resolve via `**get_category_tree`** output rather than hardcoding ids except in demos.
- **Snapshots** — secondary exports under `fixtures/` are for traceability, not canonical graphs ([SPEC.technical.md](SPEC.technical.md)).

## References


| Artifact                                                                         | Role                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [workflow.json](workflow.json)                                                   | Canonical n8n export for import and API.               |
| [SPEC.functional.md](SPEC.functional.md)                                         | Goals, limits, acceptance criteria.                    |
| [SPEC.technical.md](SPEC.technical.md)                                           | Sequence, MCP tools, Data Table, LLM schema.           |
| [fixtures/workflow.export.snapshot.json](fixtures/workflow.export.snapshot.json) | Secondary full snapshot (traceability).                |
| `fixtures/`                                                                      | Additional extracts / debug snapshots — not canonical. |


## Video walkthrough



**Short video:** *TBD*

---

## Specifications (concise)

- `[SPEC.functional.md](SPEC.functional.md)` — goals and acceptance criteria.
- `[SPEC.technical.md](SPEC.technical.md)` — sequence, MCP, data, status.
- **Secondary export** (full snapshot): `[fixtures/workflow.export.snapshot.json](fixtures/workflow.export.snapshot.json)`

## Instance reference

- Last aligned with n8n MCP `get_workflow_details` (workflowId: `aze2wAktXHYrTBTr`).

## Runtime behavior (summary)

- Manual trigger or daily schedule (e.g. 02:00).
- Requires `$vars.EXO_SPACE_NAME` (strict).
- eXo MCP for spaces, documents, categories.
- `gpt-4o-mini` with structured output for description and categories.
- Data table `exo_processed_documents` for idempotency.

## Demo runbook

See [SPEC.technical.md](SPEC.technical.md) §6 — set space name, manual start, verify eXo fields and tracking rows.