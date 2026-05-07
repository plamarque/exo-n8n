# Workflow 02 - Functional specification

> Technical details (MCP, n8n, webhooks): [SPEC.technical.md](SPEC.technical.md).

## 1) Goal

Define a document validation workflow for *Art de Rue* festival programming with two parallel, equivalent approvals before closure.

## 2) Business context

The eXo project `Programmation Festival` centralises proposed activities (shows, roving acts, performances). Each activity is tracked with a task and a document pack.

The festival enforces a clear rule:

- Artistic direction validates editorial fit.
- Technical direction validates on-site feasibility.

Both carries equal weight; neither replaces the other. Commitment to “go” requires **both** stamps.

## 3) Actors and authority

1. **Document author** — produces/updates the activity file; resubmits after rejection. Target resolution: the document uploader; fallback: `claire` if the uploader id is not usable.
2. **Artistic lead (stamp A)** — validates artistic coherence. Can `APPROVE` or `REJECT` with a reason. Demo user: `nadia`.
3. **Technical lead (stamp B)** — validates operational feasibility (riggers, safety, technical constraints). Can `APPROVE` or `REJECT` with a reason. Demo user: `etienne`.

## 4) Validated object

Document-driven process:

- A file dropped in the target folder starts the process.
- **1 new document in scope → 1 eXo task** created automatically.

Document scope (reference):

- Space: `Festival Art de Rue`
- Watched folder: `/Documents/Festivak_Art2Rue_2026/00_Programmation`
- `parent_folder_id` on **reference tenant**: `ced6e9c539805e114bd65696b26bd073` (legacy tenant id was `b468cb5639805e11480baa56164da90c`; override via root **`.env`** `WF02_PARENT_FOLDER_ID` and **`npm run generate:workflow-json`** / deploy injection if your tree differs)

Expected content on the task:

- Title from the file name
- Link to the source document
- Approval deep links (artistic + technical)

## 5) States and lifecycle

Simplified status vocabulary:

- `To Do` — not submitted
- `Doing` — in validation or rework
- `Done` — both stamps are `APPROVED`

Rules:

1. First submission or resubmission → `Doing`.
2. Until both artistic and technical are `APPROVED`, the task remains `Doing`.
3. `Done` **only** when:
  - Artistic = `APPROVED` **and**
  - Technical = `APPROVED`
4. If at least one stamp is `REJECTED`, the task stays/returns to `Doing`; the author must fix the pack and resubmit (new `cycle_id` in the implementation).

## 6) Collaboration in eXo

1. **Coworkers** on the programming task: author, artistic lead, technical lead.
2. **Comments** record:
  - initial ask to reviewers;
  - every approval/rejection + reason;
  - final outcome of the round.
3. **Description** is normalized with document link and both approval links.
4. **Notifications** are expected from native eXo (task creation, comments, status) — no extra n8n logic to emit them.

## 7) Target workflow (split / join)

1. Document dropped under `00_Programmation` → process starts.
2. The workflow loads metadata, creates a rich eXo task.
3. Two **parallel** validations: artistic, technical.
4. The workflow **waits for both** returns (join).
5. Every approval or rejection is mirrored as a **task comment**.
6. After join:
  - if both `APPROVED` → finalization;
  - else → author rework.

## 8) Outcomes

When both are `APPROVED`:

1. Update task to `Done`.
2. Add a “both stamps received” final comment.
3. Optional: move the document to a “Valid” area (future / demo).

On rejection:

1. Keep the task in `Doing`.
2. Add a short rejection summary (who, why).
3. Ask the author to fix the pack; a new run starts a new cycle.

## 9) Reference demo data

### 9.1 Project

- eXo project on **reference tenant**: `**project_id=2*`* for tasks (eXo `project_name` may show as `Programation`); set `WF02_PROJECT_ID` in n8n if you use another board.
- Document space: `Festival Art de Rue`
- Path: `/Documents/Festivak_Art2Rue_2026/00_Programmation`
- `parent_folder_id` on **reference tenant**: `ced6e9c539805e114bd65696b26bd073` (legacy tenant id was `b468cb5639805e11480baa56164da90c`; override via root **`.env`** `WF02_PARENT_FOLDER_ID` and **`npm run generate:workflow-json`** / deploy injection if your tree differs)

### 9.2 Actors (demo)

- Author: uploader, fallback `claire`
- Artistic: `nadia`
- Technical: `etienne`

### 9.3 Example trigger files

Three sample Word documents are kept under [fixtures/](fixtures/) for **manual integration testing**:

1. `Parade_Nocturne_Place_Centrale.docx`
2. `Deambulation_Jeune_Public_Quartier_Nord.docx`
3. `Performance_Feu_et_Lumiere_Esplanade.docx`

**How to use them:** upload (or copy) these files into the eXo folder `**00_Programmation`** — the path `/Documents/Festivak_Art2Rue_2026/00_Programmation` on **reference tenant**, whose `parent_folder_id` is the default in the committed workflow (`ced6e9c539805e114bd65696b26bd073`, overridable via root **`.env`** `WF02_PARENT_FOLDER_ID` at generate/deploy). Then run WF02 intake (manual trigger or schedule). The workflow’s `search_documents` call targets that folder id (**`limit` 100** per run in the canonical graph; narrowing to work items happens in **`Merge Docs to Process`** against the processed-doc table); an empty folder yields no downstream items (no error).

See [README.md](README.md) (*Testing with sample documents*) for the same pointer in operational form.

### 9.4 Task title examples

- `Parade_...` → `Validation - Parade Nocturne - Place Centrale` (simplified in implementation)

### 9.5 Stamp state examples (logical)

1. OK path: artistic `APPROVED`, technical `APPROVED` → `Done`
2. Reject path: one `REJECTED` (with reason) → `Doing` + rework
3. Incomplete: one still `PENDING` → stay `Doing` (waiting for join)

## 10) Acceptance criteria

1. Dropping a file in the watched folder creates a validation task.
2. The task contains the document and approval deep links.
3. Two **parallel, equivalent** validations.
4. `Done` is reached **only** with two approvals.
5. Rejections return to rework without premature close.
6. Actors (author + two approvers) are visible on the task.
7. Comments show decisions in order.