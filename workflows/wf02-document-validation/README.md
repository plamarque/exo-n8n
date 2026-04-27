# WF02 — Document validation (split / join)

Canonical workflow: [`workflow.json`](workflow.json). Product rules: [`SPEC.functional.md`](SPEC.functional.md). MCP and n8n details: [`SPEC.technical.md`](SPEC.technical.md). Environment placeholders: [`config.env.example`](config.env.example).

REST deploy (unwrap dependency first, then parent): `./deploy.sh wf02` from the repository root (see [`docs/DEVELOPMENT.md`](../../docs/DEVELOPMENT.md)). Sub-workflow manifest: [`subworkflow-dependencies.json`](subworkflow-dependencies.json).

## Testing with sample documents

The [`fixtures/`](fixtures/) directory holds **three example `.docx` files** with real content. They exist only in git so you can re-seed a tenant; they are **not** read by n8n from the repository.

To exercise the intake branch end-to-end:

1. In eXo (**exo-mips-ft**), open the programming folder **`00_Programmation`** (full path in [`SPEC.functional.md`](SPEC.functional.md) §9.1). This folder is the one whose **`parent_folder_id`** the workflow uses by default (`ced6e9c539805e114bd65696b26bd073`), unless you set n8n variable `WF02_PARENT_FOLDER_ID` to another id.
2. Upload the three files from `fixtures/` into that eXo folder (same filenames as in the repo).
3. Run the workflow in n8n (**Manual Start** or wait for **Schedule Intake (5m)**).

If the folder contains no matching documents, `search_documents` returns an empty list and the graph stops after the split step **without error** — that is expected until at least one file is present.
