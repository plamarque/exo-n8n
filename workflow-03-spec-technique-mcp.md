# Workflow 03 - Specification technique MCP eXo QAUI (phase exploration)

## 1) Perimetre de cette spec
Ce document couvre la phase 1 technique demandee:
- exploration des tools MCP eXo QAUI
- verification des payloads d'entree/sortie
- identification des contraintes reelles cote connecteur

Ce document ne decrit pas encore le JSON final du workflow n8n (phase 2).

Date d'observation: `2026-04-23` (Europe/Paris).

## 2) Contexte de test et objets crees
Le dataset eXo avait ete reset. Un jeu de test minimal a ete reconstruit via MCP.

Objets de test crees:
- `space_id=1` (`MCP Test Workflow03`)
- `project_id=1` (`[MCP TEST] Projet COPIL`)
- `note_id=4` (template note de test)
- `note_id=5` (note enfant de test)
- `event_id=1` (agenda de test)
- `task_id=2` (tache de projet de test)
- `task_id=1` (tache personnelle de test)

## 3) Observation cle de contrat MCP
La plupart des tools repondent avec une enveloppe:

```json
[
  {
    "type": "text",
    "text": "{...json serialise...}"
  }
]
```

Regle technique obligatoire:
1. parser le tableau MCP
2. lire `text`
3. parser `text` comme JSON quand possible
4. gerer les cas `text` non JSON (`"Done"`, `"null"`, messages d'erreur)

## 4) Tools verifies + payloads (entree/sortie)

### 4.1 Spaces
#### `get_my_spaces`
Entree:
```json
{ "limit": 10, "offset": 0, "query": "" }
```
Sortie observee:
- liste d'espaces avec `space_id`, `name`, `visibility`, `registration`, `my_roles`, URLs avatar/banner

#### `list_space_templates`
Entree:
```json
{}
```
Sortie observee:
- liste de templates avec `space_template_id`, `name`, `space_default_visibility`, `space_default_registration`

#### `create_space`
Entree:
```json
{
  "space_template_id": 4,
  "name": "MCP Test Workflow03",
  "description": "Espace de test pour valider payloads MCP workflow 03",
  "registration": "INVITE_ONLY",
  "visibility": "UNLISTED"
}
```
Sortie observee:
- objet espace cree avec `space_id`, `url`, `my_roles`, `members_count`, etc.

#### `get_space_by_id`
Entree:
```json
{ "space_id": 1 }
```
Sortie observee:
- details espace (meme structure que `create_space`)

### 4.2 Notes
#### `get_space_note_tree`
Entree:
```json
{ "space_id": 1 }
```
Sortie observee:
- racine `Home` avec `note_id`, `space_id`
- `child_notes` presents quand des notes existent

#### `create_space_note`
Entree:
```json
{
  "space_id": 1,
  "title": "[MCP TEST] Template COPIL",
  "html_content": "<h1>Template COPIL</h1><p>Section rapport</p>",
  "summary": "Template test"
}
```
Sortie observee:
- `note_id`, `title`, `html_content`, `url`, `created_date`, `updated_date`, `breadcrumb`, `author`

#### `create_child_note`
Entree:
```json
{
  "parent_note_id": 4,
  "title": "[MCP TEST] CR enfant",
  "html_content": "<p>Compte rendu enfant</p>",
  "summary": "CR enfant test"
}
```
Sortie observee:
- meme structure detaillee que `create_space_note`

#### `move_note`
Entree:
```json
{ "note_id": 5, "target_parent_note_id": 3 }
```
Sortie observee:
```json
"Done"
```

#### `delete_note`
Entree:
```json
{ "note_id": 5 }
```
Sortie observee en session instable:
- `401 Reauthentication required`

### 4.3 Projects & Tasks
#### `create_project_in_space`
Entree:
```json
{
  "space_id": 1,
  "title": "[MCP TEST] Projet COPIL",
  "description": "Projet test pour spec workflow 03"
}
```
Sortie observee:
- `project_id`
- `allowed_status_list` avec colonnes kanban (`ToDo`, `InProgress`, `WaitingOn`, `Done`)

Note importante:
- mapping `description`/`url` semble inverse dans la sortie observee:
  - `description` contient une URL
  - `url` contient le texte descriptif

#### `list_projects`
Entree:
```json
{ "space_id": 1, "limit": 10, "offset": 0 }
```
Sortie observee:
```json
{ "projects": [...], "count": 1, "used_offset": 0, "used_limit": 10 }
```

#### `get_project_by_id`
Entree:
```json
{ "project_id": 1 }
```
Sortie observee:
- detail projet + `allowed_status_list`

#### `create_task_in_project`
Entree:
```json
{
  "project_id": 1,
  "title": "[MCP TEST] Tache projet W03",
  "description": "Creation de tache de test dans projet",
  "priority": "HIGH",
  "assignee": "root"
}
```
Sortie observee:
- `task_id`, `status`, `priority`, `project_id`, `space_id`, `comments_count`, `assignee`, `link`

#### `list_tasks`
Entree:
```json
{
  "project_id": 1,
  "limit": 10,
  "offset": 0,
  "hide_completed_tasks": false,
  "include_change_log": true
}
```
Sortie observee:
- `tasks[]`, `count`, `used_offset`, `used_limit`
- chaque task peut inclure `change_logs[]` si `include_change_log=true`

#### `list_project_activity_since`
Entree:
```json
{ "project_id": 1, "days": 7 }
```
Sortie observee:
```json
{
  "last_updated_tasks": [...],
  "other_uncompleted_tasks": [...]
}
```

#### `create_personal_task`
Entree:
```json
{
  "title": "[MCP TEST] Workflow03 payload check",
  "description": "Task de test pour valider payloads MCP",
  "priority": "NORMAL"
}
```
Sortie observee:
- task complete avec `task_id`, `link`, `priority`, dates, tools utilitaires references

#### `add_task_comment`
Entree:
```json
{
  "task_id": 2,
  "text": "[MCP TEST] commentaire sur tache projet"
}
```
Sortie observee:
- `task_comment_id`, `task_id`, `created_date`, `author`, `url`

#### `list_task_comments_by_id`
Entree:
```json
{
  "task_id": 2,
  "limit": 10,
  "offset": 0
}
```
Sortie observee:
```json
{ "comments": [...], "count": 1, "used_offset": 0, "used_limit": 10 }
```

#### `get_project_id_by_task_id`
Entree testee:
```json
{ "task_id": 1 }
```
Sortie observee:
- erreur `INVALID_ARGUMENT` (tool a surveiller; comportement non fiable pendant l'exploration)

### 4.4 Agenda
#### `create_agenda_event`
Entree:
```json
{
  "space_id": 1,
  "summary": "[MCP TEST] COPIL Hebdo",
  "description": "Reunion de test payload MCP",
  "start": "2026-04-30T10:00:00+02:00",
  "end": "2026-04-30T11:00:00+02:00",
  "attendee_usernames": ["root"]
}
```
Sortie observee:
- `event_id`, `summary`, `start`, `end`, `url`, `attendees[]`, `creator`, `parent_event_id`

#### `get_agenda_events`
Entree:
```json
{ "space_id": 1, "limit": 10 }
```
Sortie observee:
```json
{ "events": [...], "used_limit": 10 }
```

#### `get_agenda_event_by_id`
Entree:
```json
{ "event_id": 1 }
```
Sortie observee:
- detail evenement complet (meme structure que `create_agenda_event`)

#### `invite_users_to_agenda_event`
Entree:
```json
{ "event_id": 1, "attendee_usernames": ["root"] }
```
Sortie observee:
- evenement mis a jour (meme structure detaillee)

#### `invite_space_to_agenda_event`
Entree:
```json
{ "event_id": 1, "space_id": 1 }
```
Sortie observee:
- evenement mis a jour, attendees incluant l'espace avec `response:"NEEDS_ACTION"`

#### `cancel_agenda_event`
Entree:
```json
{ "event_id": 1 }
```
Sortie observee:
```json
"Done"
```

### 4.5 Documents
#### `search_documents`
Entree:
```json
{ "query": "", "limit": 10, "offset": 0 }
```
Sortie observee:
- tableau de documents (`document_id`, `parent_folder_id`, `mime_type`, `url`, dates)

#### `get_document_by_id`
Entree:
```json
{ "document_id": "b7df49de39805e11329a1e966cc5edd2" }
```
Sortie observee:
- metadata document

#### `get_document_content_by_id`
Entree:
```json
{ "document_id": "b7df49de39805e11329a1e966cc5edd2" }
```
Sortie observee:
```json
null
```

## 5) Contrat technique cible pour le workflow 03

### 5.1 Sequence MCP cible (preparation copil)
1. `get_my_spaces` (resoudre `space_id`)
2. `get_space_note_tree` (resoudre `note_id` template + note parent)
3. `list_projects` / `get_project_by_id` (resoudre `project_id=3` final)
4. `list_tasks` (+ option `include_change_log=true` si necessaire)
5. Analyse IA:
- transformation tasks -> tableau
- extraction vigilances -> ordre du jour suggere
6. `create_child_note` ou `create_space_note` selon strategie
7. `move_note` si besoin de ranger sous la note parent
8. `get_agenda_events` (detecter evenement hebdo existant jeudi 10:00)
9. `create_agenda_event` si absent
10. `invite_users_to_agenda_event` (claire, etienne, louis, nadia, antoine, emma)

### 5.2 Objet intermediaire recommande (dans n8n)
```json
{
  "context": {
    "space_id": 0,
    "project_id": 0,
    "template_note_id": 0,
    "reports_parent_note_id": 0,
    "meeting_start": "2026-05-07T10:00:00+02:00",
    "meeting_end": "2026-05-07T11:00:00+02:00"
  },
  "tasks_raw": [],
  "report_table_markdown": "",
  "ai_vigilances": [],
  "ai_suggested_agenda": [],
  "note_payload": {
    "title": "",
    "html_content": ""
  },
  "agenda_payload": {
    "summary": "",
    "description": "",
    "start": "",
    "end": "",
    "attendee_usernames": []
  }
}
```

## 6) Gestion d'erreurs et resilience
Points observes pendant exploration:
- reponse `401 Reauthentication required` possible en milieu de session
- apres turbulence auth, certains appels ont retourne `Unknown tool: exo qaui_*`
- certains tools peuvent retourner `"Done"` (string) et non objet JSON
- certains retours incluent des mappings inattendus (`description`/`url` sur `create_project_in_space`)

Recommandations techniques:
1. ajouter un parseur tolerant (`array envelope` + `text JSON` + fallback string)
2. gerer explicitement `401` (stop + relance auth)
3. journaliser les payloads bruts MCP pour debug
4. valider les champs critiques avant suite (`space_id`, `project_id`, `note_id`, `event_id`)
5. eviter de deduire des semantics fortes sur champs ambigus (`description`/`url`) sans verification complementaire

## 7) Points a figer avant phase 2 (workflow n8n)
1. re-injection des IDs metier definitifs apres restauration dataset:
- `space_id` Festival Art2Rue
- `project_id=3` (confirme post-reset)
- `template_note_id`
- `reports_parent_note_id`

2. duree officielle de l'evenement copil (ex: 60 min confirme)

3. regles de selection des taches dans le rapport:
- scope statuts
- fenetre temporelle
- limite de lignes

4. schema de sortie IA impose (pour robustesse n8n), par exemple:
```json
{
  "suggested_agenda": ["..."],
  "vigilances": [
    { "title": "...", "reason": "...", "severity": "low|medium|high", "related_task_ids": [1,2] }
  ]
}
```

## 8) Conclusion
La faisabilite MCP pour le workflow 03 est confirmee sur les briques critiques:
- spaces
- notes (creation enfant + deplacement)
- projects/tasks (lecture + creation + commentaires)
- agenda (creation + lecture + invitation)

La suite peut passer a la phase 2: design et implementation du workflow n8n, une fois les IDs metier definitifs re-fournis.
