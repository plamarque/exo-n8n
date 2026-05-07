# WF02 — Document validation (parallel approvals / split–join)

**TL;DR** — Watch a **programming folder** for new documents, **create one validation task per file**, route **two parallel approvals** (artistic vs technical) through **webhook callbacks**, and **join** results so the task closes **only** when **both** sides approve. Demonstrates a richer pattern than a single-step native GED workflow.

## Video walkthrough

Prefer a short screencast before the long read? Replace the placeholder with your published URL (or embed) when ready.

**Short video:** *TBD*

## n8n canvas (overview)

![WF02 — Document validation workflow in the n8n editor](wf02.png)

Folder sweep → dedup/merge → task with approval **Form** links → **split** for two reviewers → **join** on both decisions → task status and comments. For the exact sequence and wiring, open [`workflow.json`](workflow.json) in n8n or read [SPEC.technical.md](SPEC.technical.md) (sections 11–12).

---

## Problem context

For festival programming (and similar programs), **editorial fit** and **operational feasibility** are **different concerns**, often validated by **different leads**. A single linear approval rarely matches reality; teams need **parallel review**, traceability in **comments**, and **persistent task state** until everyone agrees.

## Automation objective

- Detect **candidate documents** in a configured folder (`search_documents`).
- **Deduplicate / incremental processing** so the same unchanged file does not spawn duplicate tasks without cause (Data Table + merge logic; see technical spec).
- **Create** an eXo task with description containing document link and **approval deep links**.
- Run **two parallel validation branches** (stamp A / stamp B); wait for **both** webhook outcomes (**split / join**).
- Mirror decisions as **task comments** and drive **status** transitions (`update_task_status`) per product rules.
- On success across both branches, move to **Done** and record closure commentary as specified.

## Prerequisites (eXo tenant and n8n)

Create or locate the following **on eXo**, then copy identifiers into n8n **variables** (see [config.env.example](config.env.example) and [SPEC.functional.md](SPEC.functional.md) §9, [SPEC.technical.md](SPEC.technical.md) §11–12).

**eXo**

| Prerequisite | Why |
|--------------|-----|
| **Space** with a **document folder** used as the programming / intake area | Intake calls `search_documents` with a **`parent_folder_id`**. Default in the repo matches the **reference tenant** path under *Festival Art de Rue* / `00_Programmation` — **`WF02_PARENT_FOLDER_ID`** (see [SPEC.functional.md](SPEC.functional.md) §9.1). **Create** the tree or **note** the real folder id from the DMS UI / MCP. |
| **Task project (board)** — numeric **`project_id`** | `create_task_in_project` targets this board; demo default **`2`** on **reference tenant** — set **`WF02_PROJECT_ID`** for your tenant. |
| **Status ids** for *In progress* and *Done* (per project) | Call MCP **`list_project_statuses`** with your `project_id` and set **`WF02_INPROGRESS_STATUS_ID`** and **`WF02_DONE_STATUS_ID`** (defaults in [config.env.example](config.env.example) match project **2** on **reference tenant**). |
| **Actors** — usernames for **artistic** (`nadia`), **technical** (`etienne`), and **author fallback** (`claire`) | Must exist in the space; approval **links** in the first comment target these roles ([SPEC.functional.md](SPEC.functional.md) §3, §9.2). |
| **Sample documents** (optional) | Upload [fixtures/](fixtures/) into the watched folder to exercise intake end-to-end. |

**n8n**

| Prerequisite | Why |
|--------------|-----|
| **MCP Client** + tenant MCP URL (`npm run generate:workflow-json` or edit nodes) | All eXo mutations and reads use MCP. |
| **Public approval / form base URL** — **`WF02_APPROVAL_BASE_URL`** | Must be the hosted **Form** URL (e.g. `.../form/...`), **not** a raw webhook path, so approvers get the n8n Form UI ([config.env.example](config.env.example) comment, [SPEC.technical.md](SPEC.technical.md) if referenced). |
| **Data Tables** `wf02_processed_documents` / `wf02_approvals` | Created on first run by the graph (`createIfNotExists`); **no manual SQL** required. |
| **Unwrap** sub-workflow id for deploy | **`N8N_WORKFLOW_ID_UNWRAP`** + [subworkflow-dependencies.json](subworkflow-dependencies.json). |

## Runtime variables (what they mean, and where to set them)

Set these in **n8n Variables** (or equivalent instance env mapping), because WF02 resolves them at runtime via `$vars.*`.

| Variable | Meaning | Where to set |
|----------|---------|--------------|
| `EXO_MCP_ENDPOINT` | MCP endpoint for document/task/comment/status operations. | Root `.env` → **`npm run generate:workflow-json`**. |
| `WF02_PARENT_FOLDER_ID` | Watched eXo folder id for document intake. | n8n Variables. |
| `WF02_PROJECT_ID` | Target eXo project id where validation tasks are created. | n8n Variables. |
| `WF02_INPROGRESS_STATUS_ID` | Project status id used after create and on non-final outcomes. | n8n Variables. |
| `WF02_DONE_STATUS_ID` | Project status id used when both approvals are `APPROVED`. | n8n Variables. |
| `WF02_APPROVAL_BASE_URL` | Hosted n8n **Form** URL used in task comments for reviewer links. | n8n Variables. |

Use `config.env.example` as a naming/meaning template. Copy values into **n8n Variables** and/or root **`.env`**, then run **`npm run generate:workflow-json`** to hardcode matching expressions ([docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md)).

## High-level flow (conceptual)

1. **Intake** — manual start or scheduled poll of the folder.
2. **List & normalize** — `search_documents` → **Unwrap** → coalesce hit list → **split** to one item per document; **ensure tracking table** then **join** with processed rows to only process **new or changed** files.
3. **Approvals persistence** — **`wf02_approvals`** is ensured **just before** the first seed (intake) or **just before** reading rows (form branch); same idempotent `createIfNotExists` pattern.
4. **Load document** — `get_document_by_id` for context; build **title, author, links, cycle id** for this processing round.
5. **Create task** — `create_task_in_project`, then move to **In progress**; add the first **comment** with instructions and approval URLs for **nadia** / **etienne** (demo actors).
6. **Split** — two branches await HTTP callbacks carrying approve/reject payloads until **both** complete (**merge**).
7. **Join & finalize** — if **both APPROVED**, transition to **Done** and final comment; otherwise stay in progress / rework path with rejection notes.

## n8n design choices (not a node-by-node list)


| Area          | Choice                                                 | Why                                                                                                                                                       |
| ------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intake        | **Schedule + manual**                                  | Realistic “folder sweep” without requiring a push event from the DMS. **Data Table** `createIfNotExists` runs **just before** first use (tracking before the processed-doc read; approvals before seed / before form read), not on the trigger.                                                                                     |
| Parallelism   | **Split + wait for webhooks + merge**                  | Models two **independent** human decisions; **join** encodes the business rule.                                                                           |
| Idempotency   | **Data Table + Merge (SQL-style combine)**             | Same pattern as WF04: **skip** unchanged docs; avoid accidental duplicate tasks when rerunning intake.                                                    |
| MCP envelopes | **Execute Workflow → Unwrap MCP JSON**                 | Consistent parsing of `list` / `get` / `create` responses.                                                                                                |
| Code surface  | **Small Code** (merge input guard, approval row merge) + **HTML node** for task body | Per [SPEC.technical.md](SPEC.technical.md) §7, intake control flow is mostly **native** nodes (unwrap via UTIL, Split Out, Merge SQL). |


## MCP eXo interaction model

Typical tools in this graph (see [SPEC.technical.md](SPEC.technical.md) §3):

- **Read / find** — `search_documents`, `get_document_by_id`
- **Context** — optional `list_projects`, `**list_project_statuses`** (resolve status ids per tenant), `list_users_of_space_by_role`
- **Mutate task** — `create_task_in_project`, `assign_task`, `add_task_comment`, `update_task_status`, `get_task_by_id`, `list_tasks`

Webhook payloads drive approval branches; MCP carries **authoritative task updates** back into eXo.

## Operational considerations

- **Folder & project defaults** are pinned for the **reference tenant** demo; override **`WF02_PARENT_FOLDER_ID`**, **`WF02_PROJECT_ID`**, and **status id** variables per your **list_project_statuses** output (see [SPEC.technical.md](SPEC.technical.md) §2 and §5.3).
- **Empty folder** — `search_documents` returns no rows; the run **stops without error** after the split (expected).
- **Sample files** for manual tests live in [fixtures/](fixtures/) — upload into the watched folder per [SPEC.functional.md](SPEC.functional.md) §9.

## References


| Artifact                                                       | Role                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| [workflow.json](workflow.json)                                 | Canonical n8n export.                                           |
| [SPEC.functional.md](SPEC.functional.md)                       | Actors, lifecycle, parallel approvals, acceptance criteria.     |
| [SPEC.technical.md](SPEC.technical.md)                         | MCP payloads, webhook design, Data Table merge, refactor notes. |
| [config.env.example](config.env.example)                       | Example n8n variables.                                          |
| [subworkflow-dependencies.json](subworkflow-dependencies.json) | Unwrap dependency for deploy.                                   |

---

## Testing with sample documents

The [`fixtures/`](fixtures/) directory holds **three example `.docx` files** with real content. They exist only in git so you can re-seed a tenant; they are **not** read by n8n from the repository.

To exercise the intake branch end-to-end:

1. In eXo (**reference tenant**), open the programming folder **`00_Programmation`** (full path in [`SPEC.functional.md`](SPEC.functional.md) §9.1). This folder is the one whose **`parent_folder_id`** the workflow uses by default (`ced6e9c539805e114bd65696b26bd073`), unless you set n8n variable `WF02_PARENT_FOLDER_ID` to another id.
2. Upload the three files from `fixtures/` into that eXo folder (same filenames as in the repo).
3. Run the workflow in n8n (**Manual Start** or wait for **Schedule Intake (5m)**).

If the folder contains no matching documents, `search_documents` returns an empty list and the graph stops after the split step **without error** — that is expected until at least one file is present.

## REST deploy

From the repository root (unwrap dependency first, then parent): `./tools/deploy.sh wf02` (see [`docs/DEVELOPMENT.md`](../../docs/DEVELOPMENT.md)). Sub-workflow manifest: [`subworkflow-dependencies.json`](subworkflow-dependencies.json).