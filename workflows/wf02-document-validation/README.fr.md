# WF02 — Validation documentaire (tutoriel FR)

**En bref** — Surveiller un **dossier programmation** dans eXo, **créer une tâche de validation par document**, recueillir **deux décisions parallèles** (tampon artistique / tampon technique) via des **formulaires n8n**, et **fermer la tâche** seulement lorsque **les deux** côtés **approuvent**. Les **Data Tables** mémorisent ce qui est déjà traité et l’**état du cycle** d’approbation entre exécutions.

**Vidéo (démo) :** [Loom](https://www.loom.com/share/f3b4f53bad3f486b870f171d74ade4d2)

**Spécifications techniques (référence, EN) :** [SPEC.technical.md](SPEC.technical.md) · [SPEC.functional.md](SPEC.functional.md) · [workflow.json](workflow.json)

---

## Contexte

Pour un **festival** ou tout dossier où **l’adéquation artistique** et la **faisabilité technique** sont jugées par **deux référents distincts**, une validation **native linéaire** ne suffit pas toujours. Le graphe montre un **parallélisme** (deux voies équivalentes), une **trace** dans les **commentaires** de tâche, et une **reprise** possible après un **rejet** puis un nouvel accord.

## Prérequis

| Côté | Indispensable |
|------|----------------|
| **eXo** | Dossier documentaire cible (`search_documents` / `parent_folder_id`), **projet de tâches** (`project_id`), **statuts** « en cours » et « terminé », comptes des **deux validateurs** (démo : Nadia / Étienne). |
| **n8n** | **Credentials MCP** eXo ; **URL publique du formulaire** n8n (`WF02_APPROVAL_BASE_URL`, chemin `/form/...`). **Pas** de credential OpenAI pour ce scénario. |
| **Projet** | Variables / `.env` décrits dans [config.env.example](config.env.example) et [README.md](README.md). |

## Vue d’ensemble du graphe

![WF02 — aperçu dans l’éditeur n8n](wf02.png)

**Branche intake** (déclencheur) : liste des documents du dossier **et** table des **déjà traités** → **jointure** → lecture du document → **HTML** de description avec **liens formulaire** → **création de tâche** + **commentaire** + **amorce** de la table d’approbation. **Branche formulaire** : chaque **soumission** alimente commentaires, **statut** de tâche et **ligne d’approbation** jusqu’à ce que la logique **agrège** les deux tampons (en attente / partiellement rejeté / **terminé** si double accord).

## Déroulé (aligné sur la démo)

1. **Déclencheur** — exécution **manuelle** en vidéo (en production : **planificateur** sur le dossier).
2. **Intake parallèle** — MCP **`search_documents`** sur le dossier réceptacle ; en parallèle, **table** « documents déjà vus » (**`GetProcessDocs`** / équivalent) pour **éviter** de retraiter les mêmes fichiers ; **identifiant de cycle** de validation conservé pour les tours suivants.
3. **Filtrage** — **fusion** des deux flux : ne garder que les **documents non encore traités** (comparaison simple liste / état mémorisé).
4. **Contenu** — **`get_document_by_id`** ; construction de la **description HTML** (titre, chemins, **URL** des formulaires avec paramètres — voir doc n8n sur les **liens de formulaire**).
5. **Tâche eXo** — **`create_task_in_project`** avec **assignés** ; **commentaire** initial répétant les liens (historique).
6. **Table d’approbation** — enregistrement du **cycle**, de la **tâche**, du **document** et des champs de décision pour **poursuivre** le flux lors d’exécutions **ultérieures** (délais humains différents).
7. **Branche formulaire** — **nœud Form** : `task_id`, `cycle_id`, **rôle** (artistique / technique), **décision**, texte ; vérification qu’une **ligne de cycle** existe ; **`add_task_comment`** ; **`update_task_status`** (passage en **en cours** dès qu’une décision arrive) ; **mise à jour** de la ligne d’approbation (**upsert** par rôle).
8. **Agrégat** — si les **deux** sont **approuvés** → statut **terminé** + commentaire de clôture ; si **mix** approuvé / rejeté → **rester en cours** + commentaire d’**incomplétude** ; sinon **attendre** d’autres soumissions.

## Choix didactiques à connaître

- **Deux branches principales** : une pour le **balayage** du dossier, une pour les **soumissions de formulaire** — les exécutions n8n se **succèdent** dans le temps ; d’où l’usage des **Data Tables**.
- **Formulaires natifs n8n** plutôt qu’une UI métier sur mesure pour une validation simple.
- **Non séquentiel** : les deux approbateurs ont le **même poids** ; le graphe encode le **join** métier (les deux tampons requis).

## Références

- [README.md](README.md) — tutoriel long (EN), variables et déploiement.
- [SPEC.technical.md](SPEC.technical.md), [SPEC.functional.md](SPEC.functional.md).
- Sous-workflow partagé : [unwrap-mcp-json](../unwrap-mcp-json/).
