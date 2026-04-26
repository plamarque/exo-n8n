# Workflow 03 - Specification technique detaillee (MCP Exo MIPS)

## 1) Objectif
Documenter le contrat technique reel du serveur `mcp__exo_mips__` pour preparer l'implementation n8n du workflow 03:
- note copil hebdo depuis template
- rapport d'avancement tasks
- suggestions IA de vigilance
- invitation agenda hebdo

Date d'exploration: `2026-04-24` (Europe/Paris).

## 2) Contexte de test observe
Le serveur Exo MIPS etait accessible et fonctionnel pendant toute l'exploration.

Objets utilises/crees pendant les tests:
- espace detecte: `space_id=1` (`Festival Art2Rue`)
- projet cree: `project_id=1` (`[MIPS TEST] Projet COPIL`)
- autres projets presents: `project_id=2` (`Programation`), `project_id=3` (`Festival Art2Rue`)
- template note de test: `note_id=4`
- note enfant de test: `note_id=5`
- event agenda de test: `event_id=1` (puis annule/supprime)
- task personnelle de test: `task_id=1`
- task projet de test: `task_id=2`
- label projet de test: `label_id=1` (`MIPS-ALERTE`)

## 2.1 References metier confirmees (post-restauration dataset)
References observees dans l'espace Festival:
- `space_id=1` (nom courant: `Festival Art2Rue`)
- `project_id=3` (projet de reporting copil)
- `reports_parent_note_id=6` (note racine: `Compte-rendu des reunions`)
- `template_note_id=25` (template copil)
- `agenda_parent_event_id=13` (event `COPIL hebdo`)

Etat des donnees utiles au reporting (au moment des tests):
- `list_tasks(project_id=3)` retourne `count=10`
- statuts utilises sur le projet 3: `ToDo` (`status_id=9`), `InProgress` (`status_id=10`), `Done` (`status_id=12`)
- `get_agenda_events(space_id=1)` peut retourner des evenements existants selon l'etat du bac a sable
- representation recurrence observee:
  - anciens tests: serie `event_id=2` avec occurrences `event_id=0`, `parent_event_id=2`
  - nouvel event de base retenu: `event_id=13`, `parent_event_id=0`

## 2.2 Validation template COPIL (note 25)
Verification effectuee sur `note_id=25`:
- la note est bien rangee sous la racine CR `note_id=6`
- la structure contient les sections attendues:
  - informations reunion
  - ordre du jour
  - ordre du jour suggere IA
  - rapport d'avancement
  - points a discuter / decisions / actions
- la structure est compatible avec le projet de reporting `project_id=3`

Ajustements appliques sur la note 25 pour robustesse workflow:
1. References metier normalisees dans l'entete:
- `space_id=1`
- `project_id=3`
- `reports_parent_note_id=6`
- `template_note_id=25`

2. Variables textuelles simplifiees pour eviter les artefacts HTML:
- `[[MEETING_DATE]]`
- `[[MEETING_OWNER]]`
- `[[NEXT_MEETING_DATE]]`
- `[[MEETING_DATE_PLUS_2]]`

3. Marqueurs d'injection stabilises (recherche/remplacement):
- `[SUGGESTED_AGENDA_START]` ... `[SUGGESTED_AGENDA_END]`
- `[REPORT_AVANCEMENT_START]` ... `[REPORT_AVANCEMENT_END]`

Conclusion compatibilite:
- template `25` compatible et exploitable tel quel pour l'implementation n8n.

## 3) Format de reponse MCP (point critique)
Format le plus frequent:

```json
[
  {
    "type": "text",
    "text": "{...json...}"
  }
]
```

Implication n8n:
1. parser l'enveloppe MCP
2. parser `text` comme JSON si possible
3. gerer les retours non objets: `"Done"`, `"1"`, `[]`, etc.

## 4) Payloads verifies (entree/sortie)

### 4.1 Spaces
#### `get_all_spaces`
Entree:
```json
{ "limit": 20, "offset": 0, "query": "" }
```
Sortie observee:
- tableau d'espaces avec `space_id`, `name`, `registration`, `visibility`, `my_roles`

### 4.2 Notes
#### `get_space_note_tree`
Entree:
```json
{ "space_id": 1 }
```
Sortie observee:
- racine `Home` (`note_id=3`) + `child_notes` imbriques

#### `create_space_note`
Entree:
```json
{
  "space_id": 1,
  "title": "[MIPS TEST] Template COPIL",
  "html_content": "<h1>Template COPIL</h1><p>Bloc rapport</p>",
  "summary": "Template test MIPS"
}
```
Sortie observee:
- note detaillee: `note_id`, `title`, `html_content`, `url`, `author`, `breadcrumb`, dates

#### `create_child_note`
Entree:
```json
{
  "parent_note_id": 3,
  "title": "[MIPS TEST] Compte rendu enfant",
  "html_content": "<p>CR de test</p>",
  "summary": "CR test"
}
```
Sortie observee:
- note detaillee (meme structure que `create_space_note`)

#### `get_note`
Entree:
```json
{ "note_id": 4 }
```
Sortie observee:
- contenu detaille de la note (incluant `html_content`)

#### `update_note`
Entree:
```json
{
  "note_id": 4,
  "title": "[MIPS TEST] Template COPIL v2",
  "html_content": "<h1>Template COPIL v2</h1><p>Rapport + Vigilances</p>"
}
```
Sortie observee:
- note mise a jour (attention: `+` encode en `&#43;` dans html retourne)

#### `move_note`
Entree:
```json
{ "note_id": 5, "target_parent_note_id": 4 }
```
Sortie observee:
```json
"Done"
```

#### `publish_note`
Entree:
```json
{ "note_id": 4 }
```
Sortie observee:
- objet activite sociale (`activity_id`, `content_type`, `space`, `author`, etc.)

#### `search_notes`
Entree:
```json
{
  "query": "MIPS TEST",
  "space_id": 1,
  "limit": 20,
  "offset": 0
}
```
Sortie observee:
- liste de notes detaillees + breadcrumb

### 4.3 Projects
#### `list_projects`
Entree:
```json
{ "limit": 20, "offset": 0 }
```
Sortie observee:
```json
{ "projects": [...], "count": 3, "used_offset": 0, "used_limit": 20 }
```
Observation metier:
- le projet copil cible present est `project_id=3` (`Festival Art2Rue`)

#### `create_project_in_space`
Entree:
```json
{
  "space_id": 1,
  "title": "[MIPS TEST] Projet COPIL",
  "description": "Projet de test pour spec technique"
}
```
Sortie observee:
- `project_id`
- `allowed_status_list`
- parfois `allowed_label_list`

Observation de mapping:
- comme deja observe ailleurs, `description` et `url` peuvent apparaitre inverses dans la reponse du projet.

#### `get_project_by_id`
Entree:
```json
{ "project_id": 1 }
```
Sortie observee:
- detail projet + statuts autorises

#### `list_project_statuses`
Entree:
```json
{ "project_id": 1 }
```
Sortie observee:
- tableau de statuts: `ToDo`, `InProgress`, `WaitingOn`, `Done` avec `status_id`

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

### 4.4 Tasks
#### `create_personal_task`
Entree:
```json
{
  "title": "[MIPS TEST] personal task payload",
  "description": "Test payload create_personal_task",
  "priority": "NORMAL"
}
```
Sortie observee:
- `task_id=1`, `link`, `priority`, dates, meta tools

#### `create_task_in_project`
Entree:
```json
{
  "project_id": 1,
  "title": "[MIPS TEST] Task projet W03",
  "description": "Task test extraction rapport",
  "priority": "HIGH",
  "assignee": "patrice"
}
```
Sortie observee:
- `task_id=2`, `project_id`, `space_id`, `status`, `assignee`, `comments_count`

#### `list_tasks`
Entree:
```json
{
  "project_id": 1,
  "limit": 20,
  "offset": 0,
  "hide_completed_tasks": false,
  "include_change_log": true
}
```
Sortie observee:
- `tasks[]`, `count`, `used_offset`, `used_limit`
- `change_logs[]` present si `include_change_log=true`

#### `get_task_by_id`
Entree:
```json
{ "task_id": 2 }
```
Sortie observee:
- detail task complet

#### `update_task_title`
Entree:
```json
{
  "task_id": 2,
  "title": "[MIPS TEST] Task projet W03 (renommee)"
}
```
Sortie observee:
- task complete mise a jour

#### `update_task_description`
Entree:
```json
{
  "task_id": 2,
  "description": "Description mise a jour pour test payload"
}
```
Sortie observee:
- task complete mise a jour

#### `update_task_status`
Entree:
```json
{ "task_id": 2, "status_id": 2 }
```
Sortie observee:
```json
"Done"
```

#### `assign_task_to_me`
Entree:
```json
{ "task_id": 2 }
```
Sortie observee:
- task complete avec assignee courant

#### `add_task_comment`
Entree:
```json
{
  "task_id": 2,
  "text": "[MIPS TEST] commentaire task projet"
}
```
Sortie observee:
- `task_comment_id`, `task_id`, `author`, `created_date`

#### `list_task_comments_by_id`
Entree:
```json
{
  "task_id": 2,
  "limit": 20,
  "offset": 0
}
```
Sortie observee:
```json
{ "comments": [...], "count": 1, "used_offset": 0, "used_limit": 20 }
```

#### `get_project_id_by_task_id`
Entree:
```json
{ "task_id": 2 }
```
Sortie observee:
```json
1
```

### 4.5 Labels
#### `create_project_label`
Entree:
```json
{ "project_id": 1, "label_name": "MIPS-ALERTE" }
```
Sortie observee:
```json
{ "label_id": 1, "label_name": "MIPS-ALERTE" }
```

#### `list_project_labels`
Entree:
```json
{ "project_id": 1 }
```
Sortie observee:
- liste labels projet

#### `add_project_label_to_task`
Entree:
```json
{ "task_id": 2, "label_id": 1 }
```
Sortie observee:
```json
"Done"
```

#### `remove_project_label_from_task`
Entree:
```json
{ "task_id": 2, "label_id": 1 }
```
Sortie observee:
```json
"Done"
```

### 4.6 Agenda
#### `create_agenda_event`
Entree:
```json
{
  "space_id": 1,
  "summary": "[MIPS TEST] COPIL jeudi 10h",
  "description": "Event test payload",
  "start": "2026-05-07T10:00:00+02:00",
  "end": "2026-05-07T11:00:00+02:00",
  "attendee_usernames": ["root"]
}
```
Sortie observee:
- `event_id`, `summary`, `start`, `end`, `attendees[]`, `creator`, `user_answer`

#### `get_agenda_events`
Entree:
```json
{ "space_id": 1, "limit": 20 }
```
Sortie observee:
```json
{ "events": [...], "used_limit": 20 }
```

#### `get_agenda_event_by_id`
Entree:
```json
{ "event_id": 1 }
```
Sortie observee:
- detail complet event

#### `update_agenda_event`
Entree:
```json
{
  "event_id": 1,
  "summary": "[MIPS TEST] COPIL jeudi 10h (maj)",
  "description": "Event test payload mis a jour"
}
```
Sortie observee:
- event detail mis a jour

#### `invite_users_to_agenda_event`
Entree:
```json
{ "event_id": 1, "attendee_usernames": ["patrice"] }
```
Sortie observee:
- event detail mis a jour (`attendees` enrichi)

#### `invite_space_to_agenda_event`
Entree:
```json
{ "event_id": 1, "space_id": 1 }
```
Sortie observee:
- event detail mis a jour avec attendee de type `space`

#### `accept_agenda_event_invitation`
Entree:
```json
{ "event_id": 1 }
```
Sortie observee:
```json
"Done"
```

#### `decline_agenda_event_invitation`
Entree:
```json
{ "event_id": 1 }
```
Sortie observee:
```json
"Done"
```

#### `cancel_agenda_event`
Entree:
```json
{ "event_id": 1 }
```
Sortie observee:
```json
"Done"
```

#### `delete_agenda_event`
Entree:
```json
{ "event_id": 1 }
```
Sortie observee:
```json
"Done"
```

## 5) Sequence technique recommandee pour workflow 03
1. Charger la configuration statique (node `Set` n8n + env):
- `space_id=1`
- `project_id=3`
- `template_note_id=25`
- `reports_parent_note_id=6`
- `agenda_parent_event_id=13`
- `attendee_usernames=["claire","etienne","louis","nadia","antoine","emma"]`
- `meeting_schedule` (jour/heure cibles de la reunion)

2. Extraire donnees task:
- `list_tasks` (`project_id`, `include_change_log=true` si besoin IA)
- option `list_project_activity_since` pour signaux recents

3. Generer contenu copil:
- table markdown/html de suivi
- sortie IA structuree: `suggested_agenda[]`, `vigilances[]`

4. Creer note hebdo:
- `create_child_note` sous note parent des CR
- ou `create_space_note` puis `move_note`
- `update_note` pour injecter tableau + suggestions IA
- strategy recommandee: `create_child_note(parent_note_id=6)` basee sur template `25`
- remplacement cible via marqueurs:
  - `[SUGGESTED_AGENDA_START]...[SUGGESTED_AGENDA_END]`
  - `[REPORT_AVANCEMENT_START]...[REPORT_AVANCEMENT_END]`

5. Agenda (sans discovery):
- `update_agenda_event(event_id=13)` pour mettre a jour titre/description/lien vers la note hebdo
- conserver la liste participants standard via `invite_users_to_agenda_event(event_id=13, attendee_usernames=[...])` uniquement si necessaire
- fallback controle: `create_agenda_event` seulement si l'event parent configure est indisponible/invalide

## 6) Points de vigilance implementation
1. Parser robuste obligatoire:
- enveloppe MCP + JSON string + retours string bruts (`Done`, `1`)

2. Normalisation de champs:
- certains objets projet renvoient `description`/`url` avec semantics inverses

3. Idempotence:
- eviter doublons note hebdo (verifier titre/date)
- eviter doublons event agenda (verifier plage horaire + summary)
- privilegier la mise a jour de l'evenement de base configure avant toute recreation
- `invite_users_to_agenda_event` ajoute des invites mais ne sert pas a purger proprement les participants existants

4. Performance:
- certains updates peuvent prendre plusieurs secondes
- prevoir timeouts et retries n8n (surtout sur update task/note/agenda)

## 7) Pre-configuration a figer avant workflow n8n final
1. IDs metier definitifs:
- `space_id`
- `project_id` cible du reporting
- `template_note_id`
- `reports_parent_note_id`
- `agenda_parent_event_id`

References deja confirmees sur Exo MIPS:
- `space_id=1`
- `project_id=3`
- `template_note_id=25`
- `reports_parent_note_id=6`
- `agenda_parent_event_id=13` (`COPIL hebdo`)

2. Creneau officiel:
- porte par la configuration `meeting_schedule`
- constat actuel sur `event_id=13`: jeudi 10:00-11:30
- limite MCP: aucun champ de recurrence explicite n'est expose sur `create_agenda_event` / `update_agenda_event`

3. Regles IA:
- schema JSON de sortie stricte pour suggestions/vigilances
- seuils de vigilance fixes:
  - `X=3` jours sans avancement significatif (stagnation)
  - `Y=5` jours pour urgence bloquee/en attente
  - `Z=5` taches ou plus dans la meme colonne/statut

4. Participants:
- usernames cibles: `claire`, `etienne`, `louis`, `nadia`, `antoine`, `emma`
- strategie d'invitation: passage direct et exclusif via `attendee_usernames`
- pas de resolution dynamique en workflow (pas d'UUID a rechercher)

5. Parametres config node recommandes:
- `SPACE_ID=1`
- `PROJECT_ID=3`
- `TEMPLATE_NOTE_ID=25`
- `REPORTS_PARENT_NOTE_ID=6`
- `AGENDA_PARENT_EVENT_ID=13`
- `ATTENDEE_USERNAMES=["claire","etienne","louis","nadia","antoine","emma"]`
- `MEETING_SCHEDULE` (jour + heure cible)

## 8) Conclusion
Le serveur `mcp__exo_mips__` permet de couvrir integralement le besoin technique du workflow 03.
Les payloads ont ete verifies en lecture et ecriture sur les modules critiques:
- notes
- tasks/projects
- agenda

La prochaine etape peut etre la specification technique n8n executable (nodes, mapping, gestion erreurs, idempotence).
