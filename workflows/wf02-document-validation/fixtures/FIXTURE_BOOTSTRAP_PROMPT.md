# WF02 — Fixture bootstrap prompt (document validation)

**Authoritative refs:** [SPEC.technical.md](../SPEC.technical.md), [config.env.example](../config.env.example).

## Goal

Prepare a **watched folder** (documents), **task project**, **workflow column status ids**, and **sample `.docx`** files so intake + approval demo paths work.

## Operator placeholders

| Placeholder | Example | Notes |
|-------------|---------|--------|
| `PROGRAMMING_FOLDER_LABEL` | `00_Programmation` | Human label near functional spec §9—must map to **`WF02_PARENT_FOLDER_ID`**. |
| `WF02_PROJECT_LABEL` | Document validation board | For **`list_projects`** matching. |

## Prerequisites outside MCP

- **`WF02_APPROVAL_BASE_URL`**: **n8n Form URL** (`/form/...`) after WF02 published—**cannot** come from eXo MCP ([SPEC.technical.md](../SPEC.technical.md) §2).
- **Binary uploads**: Three sample files under this folder:

| Path | Purpose |
|------|---------|
| [`Deambulation_Jeune_Public_Quartier_Nord.docx`](Deambulation_Jeune_Public_Quartier_Nord.docx) | Sample intake |
| [`Parade_Nocturne_Place_Centrale.docx`](Parade_Nocturne_Place_Centrale.docx) | Sample intake |
| [`Performance_Feu_et_Lumiere_Esplanade.docx`](Performance_Feu_et_Lumiere_Esplanade.docx) | Sample intake |

Upload via **eXo UI** or MCP upload tool **if** your server documents one.

## Ordered bootstrap steps

1. Confirm **`EXO_MCP_ENDPOINT`** matches n8n + Cursor MCP tenant.
2. **`WF02_PARENT_FOLDER_ID`:**
   - If MCP exposes folder browse/search returning **`parent_folder_id`**, locate **`PROGRAMMING_FOLDER_LABEL`** search-then-capture id.
   - Else: resolve id from **eXo UI** (copy technical id string), record **`WF02_PARENT_FOLDER_ID`**.
3. **`WF02_PROJECT_ID`:** **`list_projects`** → match **`WF02_PROJECT_LABEL`** → capture **`project_id`** (create project in UI if missing).
4. **`WF02_INPROGRESS_STATUS_ID`** / **`WF02_DONE_STATUS_ID`:** **`list_project_statuses`** with **`WF02_PROJECT_ID`** (see SPEC §3 reference payloads).
5. **`WF02_APPROVAL_BASE_URL`:** operator supplies after n8n deploy (placeholder `MISSING` in generated env until known).
6. Upload three `.docx` files into watched folder **same filenames** as repo fixtures when exercising intake.
7. **Merge** keys from `config.env.example` into repository root **`.env`** (meta-skill Part C; conflict → ask overwrite vs keep). Optional scratch: `local/generated-wf02.env`.

## Variables to emit

| Variable | Source |
|----------|--------|
| `EXO_MCP_ENDPOINT` | Verified tenant URL |
| `WF02_PARENT_FOLDER_ID` | MCP search or UI |
| `WF02_PROJECT_ID` | **`list_projects`** |
| `WF02_INPROGRESS_STATUS_ID` | **`list_project_statuses`** |
| `WF02_DONE_STATUS_ID` | **`list_project_statuses`** |
| `WF02_APPROVAL_BASE_URL` | **n8n** Form URL |

## Known gaps

| Gap | Fallback |
|-----|----------|
| Folder discovery API missing | Copy **`parent_folder_id`** from UI |
| `.docx` upload | UI upload |
| Approval URL | Publish WF02 → paste hosted Form URL |
