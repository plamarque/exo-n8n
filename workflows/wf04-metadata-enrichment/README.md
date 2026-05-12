# WF04 — Metadata enrichment (background document hygiene)

**TL;DR** — On a **schedule** or **manual** run, use a configured eXo **`space_id`** (**`WF04_SPACE_ID`**) to **scan** documents, and for each **new or changed** file (within a **per-run cap**) call **structured LLM output** to propose a **short description** and **categories**, then **write back** through MCP and **record state** in an n8n **Data Table** so reruns stay incremental. **`EXO_SPACE_NAME`** labels tracking and LLM context.

## Video walkthrough

Prefer a short screencast before the long read?

**Short video (FR voice-over):** [Loom — WF04 metadata enrichment](https://www.loom.com/share/fe21624ca7a94363b33d21f2e3a66815)

French tutorial copy aligned with that recording: [README.fr.md](README.fr.md).

## n8n canvas (overview)

![WF04 — Metadata enrichment workflow in the n8n editor](wf04.png)

Triggers fan out to **List Documents** (MCP), **Ensure Tracking Table**, and **Ensure Category Table** in parallel → merge/filter → rendezvous at **Ready to Process** (**Merge**, **chooseBranch**: wait for **`Limit to 5 Documents`** + **`Get Categories`**, output documents only) so the category table is refreshed before **`Process Each Document`** → per-item **`Read Document`** + structured LLM → Data Table category lookup → MCP updates → tracking upsert. For the exact sequence, open [`workflow.json`](workflow.json) in n8n or read [SPEC.technical.md](SPEC.technical.md) (sections 3–4).

---

## Problem context

Without steady upkeep, document libraries accumulate **weak titles**, **missing descriptions**, and **inconsistent tagging**. Manual cleanup does not scale; fully automated tagging without guardrails can **overwrite** trusted metadata. Teams need a **hybrid**: platform writes with **AI assist**, **bounded batch size**, and **idempotency**.

## Automation objective

- **Resolve** **`space_id`** from the plain integer in **List Documents** MCP **Manual** `parameters.value.space_id` (demo **`1`** in git; root **`.env`** **`WF04_SPACE_ID`** via **`npm run generate:workflow-json`** / deploy rewrites that field—**no** n8n **`$vars.WF04_SPACE_ID`**). **`spaceName`** comes from `={{ "Festival Art2Rue - Documents" }}` (demo), rewritten from root **`.env`** **`EXO_SPACE_NAME`**—**no** **`$vars.EXO_SPACE_NAME`**. There is **no** in-graph guard on empty names or invalid ids (didactic trade-off).
- **Ensure** a tracking table exists on a **parallel branch** right before reading processed rows (same idea as WF02).
- **List** space documents via **`search_documents`**, **split** the MCP payload into one item per document, and **merge** with tracking so only items that are new or **changed** since last run are processed.
- **Warm** the **`exo_category_cache`** Data Table from **`get_category_tree`** (flatten + **`Sync Category Table`**) before **`Ready to Process`** waits on **`Get Categories`** alongside **`Limit to 5 Documents`**.
- For each selected item: **read** full document context, run **structured** LLM analysis, **update description**, **assign categories** only when **`Lookup Category By Label`** returns a **`category_id`** for the suggested name.
- **Upsert** tracking rows and emit a short **processing summary**.

## Prerequisites (eXo tenant and n8n)

**eXo**

| Prerequisite | Why |
|--------------|-----|
| **Space** whose **`space_id`** matches **`WF04_SPACE_ID`** and whose display name aligns with **`EXO_SPACE_NAME`** for reporting | The graph does **not** call **`get_my_spaces`** at runtime—discover **`space_id`** once during bootstrap ([fixtures/FIXTURE_BOOTSTRAP_PROMPT.md](fixtures/FIXTURE_BOOTSTRAP_PROMPT.md)). Wrong **`WF04_SPACE_ID`** targets the wrong library with no in-graph name check. |
| **Documents** in that space | `search_documents` lists candidates; an **empty** space yields **no work** (not an error if the graph allows it — see technical spec). |
| **Category tree** with usable **labels** | **`get_category_tree`** runs **once** per execution; **`exo_category_cache`** stores **`category_id`** / **`category_label`** for lookup and LLM lists (**exact label copy** required for assignment). |
| **MCP permissions** for `update_document_description` and `add_content_to_category` | Writes must be allowed for the MCP user. |

**n8n**

| Prerequisite | Why |
|--------------|-----|
| **`WF04_SPACE_ID`** / **`EXO_SPACE_NAME`** in root **`.env`** | Injected into **`workflow.json`** by **`npm run generate:workflow-json`** and/or REST deploy as **literals** in **List Documents** / **Prepare AI Input**—canonical JSON does **not** use n8n **`$vars`** for these keys. |
| **MCP Client** + endpoint | All reads and writes are MCP-first. |
| **OpenAI** (or configured **lmChatOpenAi**) for **`gpt-4o-mini`** structured output | As in [SPEC.technical.md](SPEC.technical.md) §2–3. |
| **Data Table** `exo_processed_documents` / **`exo_category_cache`** | Auto-created by the graph (**idempotency** + category lookup materialization); no manual bootstrap. |

**Operational** — per-run **document cap** and **no rollback** on partial failure: see [SPEC.functional.md](SPEC.functional.md) §4 and [SPEC.technical.md](SPEC.technical.md) §3.

## Runtime variables (what they mean, and where to set them)

Prefer **repository root `.env`** plus **`npm run generate:workflow-json`** (persist into **`workflow.json`**) and/or REST deploy (in-memory injection). Canonical JSON does **not** read **`EXO_SPACE_NAME`** or **`WF04_SPACE_ID`** from n8n **`$vars`**—only **`.env`** rewrites the **`spaceName`** string literal and the numeric **`space_id`** on **List Documents** MCP **Manual** parameters.

| Variable | Meaning | Where to set |
|----------|---------|--------------|
| `WF04_SPACE_ID` | eXo **`space_id`** (digits) for **`search_documents`** (plain integer in **List Documents** MCP **Manual** `parameters.value`). | Root `.env` + **`npm run generate:workflow-json`** and/or deploy. |
| `EXO_SPACE_NAME` | Display / tracking / LLM context string (injected into **`Prepare AI Input`** **`spaceName`** literal). | Root `.env` + **`npm run generate:workflow-json`** / deploy only—not n8n Variables in canonical JSON. |
| `EXO_MCP_ENDPOINT` | MCP endpoint used by WF04 MCP nodes. | Root `.env` + **`npm run generate:workflow-json`**; canonical graph may store a demo literal until then. |

Root `.env` may hold `WF04_SPACE_ID`, `EXO_SPACE_NAME`, and `EXO_MCP_ENDPOINT` for **`npm run generate:workflow-json`**, which rewrites `workflow.json` on disk ([docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md)).

## High-level flow (conceptual)

1. **Trigger** — manual start or daily schedule.
2. **Parallel** — **`List Documents`** (MCP) on one branch; **`Ensure Tracking Table`** → **`Get Processed For Doc`** on the other; both feed the **Merge** that picks new/changed docs (no separate **Workflow Input** / IF—trust **`.env`** + generate/deploy).
3. **Search & split** — `search_documents` with configured **`space_id`**; **Split Out** expands hits; **Merge** SQL compares **`document_id`** / **`updated_date`** from MCP rows to the tracking table and aliases columns for downstream nodes.
4. **Incremental filter** — compare with tracking; apply **per-run limit** (safety).
5. **Category prefetch** — **`Ensure Category Table`** → **`get_category_tree`** once per run (`executeOnce`), flatten → **`Sync Category Table`** into **`exo_category_cache`**, then **`Get Categories`** + **`Ready to Process`** (**chooseBranch**, documents only) with **`Limit to 5 Documents`** before **`Process Each Document`**; **`Prepare AI Input`** reads labels from **`Get Categories`** via expression.
6. **Per document** — `get_document_by_id`, LLM structured output, MCP writes in order; category **`category_id`** comes from a Data Table **get** (`Lookup Category By Label`) keyed by exact label; **`add_content_to_category`** receives **`content_id`** as **`/document:`** + **`documentId`**, **`content_type`** **`document`**, and numeric **`category_id`**.
7. **Record & summarize** — upsert tracking; aggregate counts.

## n8n design choices (not a node-by-node list)


| Area             | Choice                                   | Why                                                                                            |
| ---------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Safety           | **Hard cap** on documents per execution  | Prevents runaway LLM + MCP cost on large libraries ([SPEC.functional.md](SPEC.functional.md)). |
| Correctness      | **Structured LLM output** (schema)       | Keeps descriptions short and categories machine-verifiable before MCP writes.                  |
| Idempotency      | **Data Table `exo_processed_documents`** | Same pattern as WF02: **ensure table** on a parallel branch before **read-all** processed rows, then merge—**skip** unchanged docs across days. |
| Failure handling | **Explicit stops** after partial writes  | Documented in technical spec when description succeeds but category assignment fails.          |
| MCP              | **No REST fallback**                     | MCP-first portfolio consistency ([SPEC.technical.md](SPEC.technical.md)).                      |


## MCP eXo interaction model

Tools used (see [SPEC.technical.md](SPEC.technical.md)):

- `search_documents` — enumerate candidates in the space (**`space_id`** as a plain integer in **`List Documents`** MCP **Manual** mapping; **`.env`** **`WF04_SPACE_ID`** via generate/deploy rewrites that value).
- `get_document_by_id` — fetch details for enrichment.
- `get_category_tree` — called **once** per execution; rows are written to **`exo_category_cache`** (one **Code** node flattens nested MCP JSON before upsert). Suggested names are resolved with **`Lookup Category By Label`** (Data Table **get**).
- `update_document_description` — persist summary text.
- `add_content_to_category` — attach resolved categories.

## Operational considerations

- **`WF04_SPACE_ID`** / **`EXO_SPACE_NAME`** — set in root **`.env`** and run **`npm run generate:workflow-json`** and/or deploy so literals match the tenant ([SPEC.functional.md](SPEC.functional.md)).
- **Tenant differences** — category names and ids vary; the graph refreshes **`exo_category_cache`** from **`get_category_tree`** each run—do not hardcode ids except in demos. LLM suggestions must **mirror** tenant labels exactly or assignment is skipped.
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
- Uses **`space_id`** from **List Documents** MCP **Manual** `parameters.value` (literal integer, rewritten from **`.env`** **`WF04_SPACE_ID`** via generate/deploy) and **`spaceName`** from the expression literal rewritten from **`.env`** **`EXO_SPACE_NAME`**.
- eXo MCP for documents and categories (no runtime space listing in-graph).
- `gpt-4o-mini` with structured output for description and categories.
- Data tables `exo_processed_documents` and **`exo_category_cache`** for idempotency and category lookup.

## Demo runbook

See [SPEC.technical.md](SPEC.technical.md) §6 — set space name, manual start, verify eXo fields and tracking rows.