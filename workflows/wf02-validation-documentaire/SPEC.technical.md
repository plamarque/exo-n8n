# Workflow 02 - Spécification technique (exploration QAUI + cible n8n)

> Règles produit : [SPEC.functional.md](SPEC.functional.md).

## 11) Etat d'exploration MCP (QAUI) et niveau de preuve
1. Etat de la session courante (22/04/2026, apres reauth MCP):
- Le connecteur eXo QAUI est accessible et les tools requis sont exposes.
- Appels live executes et valides sur QAUI pour ce workflow.

2. Tools verifies en appel live:
- `get_my_spaces`
- `list_projects`
- `list_project_statuses`
- `list_tasks`
- `search_documents`
- `get_document_by_id`
- `list_users_of_space_by_role`
- `create_task_in_project`
- `assign_task`
- `add_task_comment`
- `update_task_status`
- `get_task_by_id`

3. Resultats structurants observes:
- Projet `Programmation Festival` confirme avec `project_id=117`.
- Statuts projet `117`: `ToDo=474`, `InProgress=475`, `WaitingOn=476`, `Done=477`.
- Utilisateurs confirmes dans l'espace `66`: `nadia`, `etienne`, `claire`.
- Mutation de test validee sur `task_id=398`:
  - create -> assign -> comments -> update status InProgress/Done.

4. Conclusion de faisabilite:
- Faisabilite MCP-first confirmee en execution live sur QAUI.
- Le contrat technique ci-dessous est base sur ces appels reels.

## 12) Specification technique
### 12.1 Tools MCP eXo requis par etape
1. Detection/lecture documentaire:
- `search_documents`
- `get_document_by_id`

2. Preparation contexte organisationnel:
- `list_projects` (fallback de resolution)
- `list_project_statuses`
- `list_users_of_space_by_role` (optionnel pour mapping dynamique)

3. Creation/pilotage de la tache:
- `create_task_in_project`
- `assign_task`
- `add_task_comment`
- `update_task_status`
- `list_tasks` (controle, reprise, audit)

### 12.2 Contrat I/O MCP observe (format reponse)
Regle commune observee dans les workflows existants:
1. Reponse frequente en enveloppe:
```json
[
  {
    "type": "text",
    "text": "{\"...\":\"...\"}"
  }
]
```
2. Le champ `text` contient du JSON serialise (string), a parser en deux etapes.
3. Certains tools peuvent aussi retourner directement un objet JSON non enveloppe.
4. Le workflow doit donc normaliser avec une fonction `parseMaybeEnvelope` avant toute logique metier.

Observations complementaires live:
1. `update_task_status` retourne une confirmation courte de type string (`"Done"`), pas un objet task complet.
2. `create_task_in_project` retourne un objet task detaille avec `task_id`, `status`, `link`, `assignee`, `coworkers`.
3. `add_task_comment` retourne un objet commentaire (`task_comment_id`, `task_id`, `created_date`).

### 12.3 Payloads MCP cibles pour ce workflow
1. Lister documents du dossier de programmation:
```json
{
  "tool": "search_documents",
  "arguments": {
    "query": "",
    "parent_folder_id": "b468cb5639805e11480baa56164da90c",
    "limit": 200,
    "offset": 0
  }
}
```

2. Lire le document detecte:
```json
{
  "tool": "get_document_by_id",
  "arguments": {
    "document_id": "<DOCUMENT_ID>"
  }
}
```

3. Resoudre statuts projet (ID 117):
```json
{
  "tool": "list_project_statuses",
  "arguments": {
    "project_id": 117
  }
}
```

4. Creer la tache de validation:
```json
{
  "tool": "create_task_in_project",
  "arguments": {
    "project_id": 117,
    "title": "Validation - <TITRE_DOCUMENT>",
    "description": "<RESUME_DOC + LIEN_DOC + LIEN_APPRO_ART + LIEN_APPRO_TECH>",
    "assignee": "claire",
    "coworkers": ["nadia", "etienne"],
    "status_id": "<STATUS_INPROGRESS_ID>",
    "priority": "NORMAL"
  }
}
```

5. Assigner (ou reassigner) la tache:
```json
{
  "tool": "assign_task",
  "arguments": {
    "task_id": "<TASK_ID>",
    "username": "nadia"
  }
}
```

6. Commenter une decision:
```json
{
  "tool": "add_task_comment",
  "arguments": {
    "task_id": "<TASK_ID>",
    "text": "Tampon Artistique: APPROUVE. Motif: <...>."
  }
}
```

7. Cloturer en `Done` apres double approbation:
```json
{
  "tool": "update_task_status",
  "arguments": {
    "task_id": "<TASK_ID>",
    "status_id": "<STATUS_DONE_ID>"
  }
}
```

### 12.4 Orchestration n8n cible (split/join)
1. Trigger:
- Polling `search_documents` filtre sur chemin `/Documents/Festivak_Art2Rue_2026/00_Programmation`.
- Dedup sur `document_id + updated_date` pour traiter creation + resoumission.
- Detection validee en live via `parent_folder_id=b468cb5639805e11480baa56164da90c` (doc de test detecte le 22/04/2026).

2. Initialization:
- `get_document_by_id` pour recuperer titre/contenu/auteur.
- Auteur = uploader si present, sinon fallback `claire`.
- Creation tache eXo dans projet `117`, statut `InProgress`.

3. Split:
- Generation de deux liens signes independants:
  - lien approbation Artistique (acteur `nadia`)
  - lien approbation Technique (acteur `etienne`)
- Insertion des deux liens + lien document dans la description de tache.

4. Collecte des decisions:
- Deux endpoints webhook/form n8n (ou un endpoint unique avec `role`).
- Decision requise: `APPROUVE` ou `REFUSE`, + `motif` optionnel/obligatoire si refus.
- Chaque decision poste immediatement un commentaire dans la tache eXo.

5. Join:
- Stockage d'etat par `task_id` et `cycle_id` (Data Store n8n).
- Evaluation quand les 2 decisions existent.

6. Decision finale:
- Si `A=APPROUVE` et `B=APPROUVE`:
  - commentaire final "double tampon obtenu"
  - `update_task_status` vers `Done`
  - action optionnelle: deplacement document vers folder "Valide"
- Sinon:
  - commentaire de synthese de refus
  - maintien en `Doing`
  - attente d'une nouvelle version document (nouveau `cycle_id`)

### 12.5 Modele de donnees technique minimal
```json
{
  "document_id": "string",
  "document_path": "/Documents/Festivak_Art2Rue_2026/00_Programmation/...",
  "task_id": 0,
  "project_id": 117,
  "cycle_id": "docid-updatedDate",
  "author_username": "claire",
  "approvals": {
    "artistique": { "actor": "nadia", "decision": "EN_ATTENTE|APPROUVE|REFUSE", "reason": "", "at": "" },
    "technique": { "actor": "etienne", "decision": "EN_ATTENTE|APPROUVE|REFUSE", "reason": "", "at": "" }
  }
}
```

### 12.6 Strategie des liens d'approbation
1. Chaque lien contient un token signe et un scope strict:
- `task_id`, `cycle_id`, `role`, `actor`, `exp`
2. Token a duree de vie courte (ex: 72h) + invalidation sur nouveau cycle.
3. Le formulaire n8n refuse:
- role incoherent
- acteur non attendu
- token expire
- cycle obsolete

### 12.7 Mapping statuts eXo (a figer implementation)
1. Lire `list_project_statuses` pour le projet `117`.
2. Resoudre dynamiquement:
- `InProgress` (etat en cours)
- `Done` (etat final)
3. Ne pas hardcoder les `status_id` dans le code final.
4. Valeurs observees le 22/04/2026:
- `ToDo=474`
- `InProgress=475`
- `WaitingOn=476`
- `Done=477`

### 12.8 Risques techniques et mitigations
1. Reponses MCP heterogenes (enveloppe/string/objet):
- mitigation: parseur unique `parseMaybeEnvelope`.

2. Doublons de traitement document:
- mitigation: cle d'idempotence `document_id + updated_date`.

3. Double soumission d'un meme tampon:
- mitigation: ignorer si decision deja enregistree pour `role + cycle_id`.

4. Incoherence auteur/uploader:
- mitigation: fallback `claire` + commentaire de trace.

5. Evolution des statuses projet:
- mitigation: resolution dynamique a chaque run (`list_project_statuses`).

### 12.9 Plan de validation avant implementation
1. Connecteur eXo QAUI valide dans cette session.
2. Appels deja rejoues en live:
- `search_documents`, `get_document_by_id`
- `create_task_in_project`, `assign_task`, `add_task_comment`, `update_task_status`
- `list_project_statuses`
3. Restant a completer juste avant build n8n:
- deposer 2-3 documents de test supplementaires dans `00_Programmation` pour valider la volumetrie initiale
4. Capturer pour chaque tool:
- payload d'entree exact
- payload brut de sortie
- champs obligatoires/optionnels
5. Geler ensuite le contrat technique definitif dans cette spec.

## 13) Etude technique n8n (nodes et configuration)
### 13.1 Mapping node par etape
1. Detection des nouveaux documents:
- `Schedule Trigger` (polling)
- `HTTP Request` ou `MCP Client` vers `search_documents`
- `Code` (filtre chemin + dedup `document_id+updated_date`)

2. Lecture document et preparation de la tache:
- `HTTP Request` ou `MCP Client` vers `get_document_by_id`
- `Set` / `Code` (construction titre, resume, auteur, liens)
- `HTTP Request` ou `MCP Client` vers `create_task_in_project`
- `HTTP Request` ou `MCP Client` vers `add_task_comment` (commentaire initial)

3. Collecte des deux tampons (parallele):
- Option A recommandee: `Webhook` + `Respond to Webhook` (un endpoint par role ou endpoint unique avec `role`)
- Option B possible: `n8n Form Trigger` + `n8n Form` (multi-pages)

4. Join des validations:
- `Data Table` (Row Upsert / Row Get) pour stocker l'etat par `task_id+cycle_id`
- `IF` (les deux decisions recues ?)
- `IF` final (double APPROUVE ?)

5. Finalisation eXo:
- `HTTP Request` ou `MCP Client` vers `update_task_status` (`Done=477`)
- `HTTP Request` ou `MCP Client` vers `add_task_comment` (validation finale ou refus)

### 13.2 Choix recommande pour les approbations
Choix recommande: `Webhook + Respond to Webhook`.

Justification:
1. Simple pour liens signes individuels (artistique/technique).
2. Controle fin de la securite (auth webhook, token, expiration, role).
3. Reponse HTTP custom via `Respond to Webhook` (message clair au valideur).
4. Plus naturel pour un split/join asynchrone qu'un formulaire multi-pages unique.

### 13.3 Pattern technique propose (split/join asynchrone)
1. Workflow principal:
- detecte document
- cree tache
- genere `approval_url_artistique` et `approval_url_technique`
- sauvegarde etat initial en `Data Table`

2. Workflow approbation (webhook):
- recoit `task_id`, `cycle_id`, `role`, `decision`, `reason`, `token`
- valide token et role
- ajoute commentaire eXo
- upsert etat validation en `Data Table`
- teste condition join
- si join atteint: applique decision finale (`Done` ou maintien `InProgress`)

### 13.4 Points de config n8n a figer
1. `Webhook`:
- methode `POST`
- path explicite avec route params possible (`/approve/:role`)
- auth webhook activee (basic/header/jwt) en plus du token metier

2. `Respond to Webhook`:
- mode `Respond With` = `JSON` ou `Text`
- code HTTP explicite (`200`, `400`, `401`, `410`)

3. `Merge` (si utilise):
- mode `Append` ou `Combine` selon besoin
- attention: le node attend les inputs connectes

4. `Data Table`:
- operations `Upsert`, `Get`, `If Row Exists` pour gerer l'etat split/join

5. `Wait` (optionnel):
- utile pour timeouts/relances (resume sur delai, webhook, ou form submit)
- peut servir a declencher relance automatique si tampon manquant apres N heures

### 13.5 Decision de design pour ce POC
1. Garder un formulaire minimal:
- `decision` (`APPROUVE`/`REFUSE`)
- `reason` (obligatoire si `REFUSE`)

2. Mettre les liens d'approbation dans la description de tache eXo:
- lien doc
- lien approbation artistique
- lien approbation technique

3. Ne pas bloquer le flux principal avec un `Merge` runtime long:
- persister l'etat dans `Data Table`
- evaluer la condition join a chaque callback webhook

