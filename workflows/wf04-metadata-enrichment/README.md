# WF04 — Metadata enrichment (background document hygiene)

**TL;DR** — On a **schedule** or **manual** run, resolve an eXo **space by name**, scan documents, and for each **new or changed** file (within a **per-run cap**) call **structured LLM output** to propose a **short description** and **categories**, then **write back** through MCP and **record state** in an n8n **Data Table** so reruns stay incremental.

## Video walkthrough

Prefer a short screencast before the long read? Replace the placeholder with your published URL (or embed) when ready.

**Short video:** *TBD*

## n8n canvas (overview)

![WF04 — Metadata enrichment workflow in the n8n editor](wf04.png)

Validate space input → **Data Table** tracking → list/filter documents → per-item **get** + **category tree** + structured LLM → MCP updates → tracking upsert. For the exact sequence, open [`workflow.json`](workflow.json) in n8n or read [SPEC.technical.md](SPEC.technical.md) (section 3).

---

## Problem context

Without steady upkeep, document libraries accumulate **weak titles**, **missing descriptions**, and **inconsistent tagging**. Manual cleanup does not scale; fully automated tagging without guardrails can **overwrite** trusted metadata. Teams need a **hybrid**: platform writes with **AI assist**, **bounded batch size**, and **idempotency**.

## Automation objective

- **Require** a configured space name (fail fast if missing).
- **Ensure** a tracking table exists for processed documents.
- **List** space documents, **normalize** fields, and **filter** to items that are new or **changed** since last run.
- For each selected item: **read** full document context, **load category tree**, run **structured** LLM analysis, **update description**, **assign categories** by resolved ids.
- **Upsert** tracking rows and emit a short **processing summary**.

## Prerequisites (eXo tenant and n8n)

**eXo**

| Prerequisite | Why |
|--------------|-----|
| **Space** with a **name** that **exactly** matches the n8n variable **`EXO_SPACE_NAME`** | The workflow resolves the target space with `get_my_spaces`; a **missing or mismatched name** stops the run by design ([SPEC.functional.md](SPEC.functional.md), [SPEC.technical.md](SPEC.technical.md) §2). **Create** the space (or fix the variable) before first run. |
| **Documents** in that space | `search_documents` lists candidates; an **empty** space yields **no work** (not an error if the graph allows it — see technical spec). |
| **Category tree** with usable **labels** | `get_category_tree` feeds the LLM + `add_content_to_category`; **ids** are **resolved at runtime** on your tenant (do not assume demo ids). |
| **MCP permissions** for `update_document_description` and `add_content_to_category` | Writes must be allowed for the MCP user. |

**n8n**

| Prerequisite | Why |
|--------------|-----|
| **`$vars.EXO_SPACE_NAME`** set (strict) | Same as space name on eXo; no default. |
| **MCP Client** + endpoint | All reads and writes are MCP-first. |
| **OpenAI** (or configured **lmChatOpenAi**) for **`gpt-4o-mini`** structured output | As in [SPEC.technical.md](SPEC.technical.md) §2–3. |
| **Data Table** `exo_processed_documents` | Auto-created by the graph for **idempotency**; no manual bootstrap. |

**Operational** — per-run **document cap** and **no rollback** on partial failure: see [SPEC.functional.md](SPEC.functional.md) §4 and [SPEC.technical.md](SPEC.technical.md) §3.

## Runtime variables (what they mean, and where to set them)

Set these in **n8n Variables** (or equivalent instance env mapping), because WF04 resolves runtime keys through `$vars.*`.

| Variable | Meaning | Where to set |
|----------|---------|--------------|
| `EXO_SPACE_NAME` | Target eXo space name (required, strict). | n8n Variables. |
| `EXO_MCP_ENDPOINT` | MCP endpoint used by WF04 MCP nodes. | n8n Variables (or node-level default expression). |

WF04's runtime behavior depends on these variables in n8n; root `.env` remains reserved for repository deploy/pull tooling.

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

- `get_my_spaces` — resolve **space id** from **`EXO_SPACE_NAME`** (n8n `$vars`).
- `search_documents` — enumerate candidates in the space.
- `get_document_by_id` — fetch details for enrichment.
- `get_category_tree` — resolve **category_id** values before assignment.
- `update_document_description` — persist summary text.
- `add_content_to_category` — attach resolved categories.

## Operational considerations

- **`EXO_SPACE_NAME`** — mandatory `$vars` setting; workflow stops if empty ([SPEC.functional.md](SPEC.functional.md)).
- **Tenant differences** — category names and ids vary; always resolve via **`get_category_tree`** output rather than hardcoding ids except in demos.
- **Snapshots** — secondary exports under `fixtures/` are for traceability, not canonical graphs ([SPEC.technical.md](SPEC.technical.md)).

## References


| Artifact                                                                         | Role                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [workflow.json](workflow.json)                                                   | Canonical n8n export for import and API.               |
| [SPEC.functional.md](SPEC.functional.md)                                         | Goals, limits, acceptance criteria.                    |
| [SPEC.technical.md](SPEC.technical.md)                                           | Sequence, MCP tools, Data Table, LLM schema.           |
| [fixtures/workflow.export.snapshot.json](fixtures/workflow.export.snapshot.json) | Secondary full snapshot (traceability).                |
| `fixtures/`                                                                      | Additional extracts / debug snapshots — not canonical. |

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