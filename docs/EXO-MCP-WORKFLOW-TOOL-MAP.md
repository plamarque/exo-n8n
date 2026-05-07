# eXo MCP tools vs portfolio workflows

Derived from **per-workflow technical specs** ([WF01](../workflows/wf01-email-dispatch/SPEC.technical.md), [WF02](../workflows/wf02-document-validation/SPEC.technical.md), [WF03](../workflows/wf03-weekly-steering/SPEC.technical.md), [WF04](../workflows/wf04-metadata-enrichment/SPEC.technical.md)). Reflects tools **referenced by graphs**, not necessarily every tool your MCP server exposes.

**Discovery:** Connect your agent client to **eXo MCP** (see [DEVELOPMENT.md](DEVELOPMENT.md#cursor-and-mcp-recommended)), complete **`mcp_auth`** if required, then introspect live descriptors before calling tools.

## Summary matrix

| MCP tool (per specs) | WF01 | WF02 | WF03 | WF04 |
|---------------------|:----:|:----:|:----:|:----:|
| `list_emails` | ✓ | | | |
| `create_task_in_project` | ✓ | ✓ | | |
| `assign_task` | | ✓ | | |
| `search_documents` | | ✓ | | ✓ |
| `get_document_by_id` | | ✓ | | ✓ |
| `add_task_comment` | | ✓ | | |
| `update_task_status` | | ✓ | | |
| `get_task_by_id` | | ✓ | | |
| `list_tasks` | | ✓ | ✓ | |
| `list_projects` | | ✓ | | |
| `list_project_statuses` | | ✓ | | |
| `list_users_of_space_by_role` | | ✓ | | |
| `get_all_spaces` | | | ✓ | |
| `get_my_spaces` | | | | ✓ |
| `get_note` | | | ✓ | |
| `search_notes` | | | ✓ | |
| `create_child_note` | | | ✓ | |
| `update_note` | | | ✓ | |
| `update_agenda_event` | | | ✓ | |
| `invite_users_to_agenda_event` | | | ✓ | |
| `get_category_tree` | | | | ✓ |
| `update_document_description` | | | | ✓ |
| `add_content_to_category` | | | | ✓ |

## Bootstrap audit — WF01 (email dispatch)

| Requirement | MCP likely? | Notes |
|-------------|:-------------:|-------|
| Resolve **`WF01_PROJECT_ID`** (fallback `3` in graph) | Yes | Use **`list_projects`** (or tenant equivalent); pick/create board matching demo naming in prompt. |
| **`EXO_MCP_ENDPOINT`** | n8n-only | Cursor MCP URL must match the MCP Client `endpointUrl` in JSON pushed to n8n (use **`npm run generate:workflow-json`** from root `.env`, or edit nodes). |
| Assignee usernames (`claire`, `louis`, …) exist | Often **manual/admin** | MCP rarely provisions users; verify or edit workflow mapping per [SPEC.technical.md §6](../workflows/wf01-email-dispatch/SPEC.technical.md). |
| Mailbox visible to **`list_emails`** | Config | OAuth identity must see demo mailbox; **no bootstrap object** besides permission/mail setup. |

**Fixture prompt:** [workflows/wf01-email-dispatch/fixtures/FIXTURE_BOOTSTRAP_PROMPT.md](../workflows/wf01-email-dispatch/fixtures/FIXTURE_BOOTSTRAP_PROMPT.md)

## Bootstrap audit — WF02 (document validation)

| Requirement | MCP likely? | Notes |
|-------------|:-------------:|-------|
| **`WF02_PARENT_FOLDER_ID`** | Partial | **`search_documents`** validates folder once id known; **creating** folder/document container may be UI/admin if MCP has no folder-create tool (confirm on tenant). |
| **`WF02_PROJECT_ID`** | Yes | **`list_projects`** (+ create via UI if missing). |
| **`WF02_INPROGRESS_STATUS_ID`**, **`WF02_DONE_STATUS_ID`** | Yes | **`list_project_statuses`** for chosen project. |
| Sample **`.docx`** in watched folder | Often **manual/upload** | Binaries under [`fixtures/`](../workflows/wf02-document-validation/fixtures/); upload via UI or upload-capable MCP if present. |
| **`WF02_APPROVAL_BASE_URL`** | **n8n-only** | Hosted Form URL after workflow deployed—not from eXo MCP. |

**Fixture prompt:** [workflows/wf02-document-validation/fixtures/FIXTURE_BOOTSTRAP_PROMPT.md](../workflows/wf02-document-validation/fixtures/FIXTURE_BOOTSTRAP_PROMPT.md)

## Bootstrap audit — WF03 (weekly steering)

| Requirement | MCP likely? | Notes |
|-------------|:-------------:|-------|
| **`WF03_SPACE_ID`** | Partial | **`get_all_spaces`** (or equivalent); space creation often **admin/UI**. |
| **`WF03_PROJECT_ID`** | Partial | **`list_projects`**; create project via UI if MCP lacks create. |
| **`WF03_TEMPLATE_NOTE_ID`** | Partial | Locate/create note; **`get_note`** validates id; **`create_child_note`** may seed structure depending on MCP. |
| **`WF03_REPORTS_PARENT_NOTE_ID`** | Partial | Parent note tree often prepared in UI once per tenant. |
| **`WF03_AGENDA_PARENT_EVENT_ID`** | Often **manual** | Recurring calendar anchor; confirm MCP exposes agenda search/create or create in UI. |
| **`WF03_ATTENDEE_USERNAMES`** | **manual/admin** | Users must exist; optional **`list_users_of_space_by_role`** for verification. |
| Threshold / owner strings | No | Operator-editable literals in env. |

**Fixture prompt:** [workflows/wf03-weekly-steering/fixtures/FIXTURE_BOOTSTRAP_PROMPT.md](../workflows/wf03-weekly-steering/fixtures/FIXTURE_BOOTSTRAP_PROMPT.md)

## Bootstrap audit — WF04 (metadata enrichment)

| Requirement | MCP likely? | Notes |
|-------------|:-------------:|-------|
| **`EXO_SPACE_NAME`** must match existing space | Partial | **`get_my_spaces`** resolves by name—**create space in UI** if missing (or MCP if server supports it). |
| **`EXO_MCP_ENDPOINT`** | n8n-only | Align with Cursor MCP tenant via generated JSON literal (not n8n `$vars` when hardcoded). |
| Category tree / document writes | Runtime | **`get_category_tree`**, **`update_document_description`**, **`add_content_to_category`** — categories **discovered at runtime**; no static id file required for categories. |
| **`exo_processed_documents` Data Table** | **n8n auto** | Graph creates table; **no eXo bootstrap**. |
| Optional tuning vars | No | Canonical **`config.env.example`** lists **`EXO_MCP_ENDPOINT`** + **`EXO_SPACE_NAME`** only—additional knobs belong in workflow edits or future vars. |

**Fixture prompt:** [workflows/wf04-metadata-enrichment/fixtures/FIXTURE_BOOTSTRAP_PROMPT.md](../workflows/wf04-metadata-enrichment/fixtures/FIXTURE_BOOTSTRAP_PROMPT.md)

## Cross-cutting gaps

| Topic | Guidance |
|-------|----------|
| Binary uploads | Prefer **UI** unless MCP documents a file-upload tool. |
| User provisioning | **Admin** on eXo; use MCP list tools only to **verify**. |
| OAuth / secrets | **Never** commit; use n8n credentials + local `.cursor/mcp.json`. |

## Related

- [FIXTURE_BOOTSTRAP_PROMPTS.md](FIXTURE_BOOTSTRAP_PROMPTS.md)
- Meta-skill: [`.cursor/skills/exo-fixture-bootstrap/SKILL.md`](../.cursor/skills/exo-fixture-bootstrap/SKILL.md)
