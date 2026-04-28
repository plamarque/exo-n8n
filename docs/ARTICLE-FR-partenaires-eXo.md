# Automatiser la collaboration eXo avec n8n et le serveur MCP

*Document de synthèse à destination des équipes eXo et des partenaires intégrateurs. Le dépôt de référence (README, spécifications, exports n8n) est principalement rédigé en anglais pour faciliter la maintenance et le partage international.*

---

## Le constat

Les organisations qui s’appuient sur eXo y concentrent déjà tâches, documents, espaces et calendrier. Le manque se situe souvent dans le **liant** : enchaîner manuellement e-mail, dépôt de fichiers, comptes-rendus et pilotage crée de la friction, des oublis et des doublons. L’enjeu n’est pas de remplacer la plateforme, mais d’**accélérer** le travail *dans* eXo, en automatisant ce qui est répétitif et en gardant la main sur les règles métier.

## L’approche : orchestration low-code + opérations eXo via MCP

**n8n** apporte un moteur d’orchestration **low-code** : des enchaînements visuels, testables et versionnables, branchés sur l’IA structurée, des planificateurs, le web, etc.

Le **serveur MCP eXo** expose des **actions métier** cohérentes (lister des documents, créer des tâches, mettre à jour des statuts, enrichir des contenus, etc.) que n8n invoque comme toute autre intégration. L’association des deux permet de **monter des scénarios de bout en bout** — des signaux externes jusqu’aux mises à jour dans l’espace de travail — sans enfermer la logique dans un script obscur.

## Prérequis : eXo, n8n, MCP et identifiants

### Ce qu’il faut côté infrastructure

- Un **tenant eXo** (cloud géré ou déploiement on-premise) sur lequel les scénarios ont un sens (espaces, tâches, documents, calendrier, etc.).
- Un **serveur n8n** joignable : moteur d’exécution des graphes, file d’exécution, et interface pour **configurer les identifiants** (credentials) et les **variables** d’environnement des workflows.
- **Ces démonstrations ont été mises au point et testées sur n8n Cloud** (instance hébergée). Elles **devraient** se comporter de la même manière sur un **n8n en self-hosting** dès lors que la **version** de n8n et les **nœuds** requis (MCP Client, nœuds d’IA, etc.) sont alignés sur ce que le dépôt suppose — l’ergonomie de l’interface peut différer légèrement (libellés de menus, emplacements des écrans d’identifiants).

### Activer le MCP côté eXo

L’exposition du **serveur MCP eXo** (URL, authentification, périmètre des outils) relève de la **configuration plateforme** : c’est en général l’**administrateur** ou l’**hébergeur** qui active la fonctionnalité et la publie vers les intégrations conformément à la **documentation eXo / Meeds** de votre version. À retenir pour la suite :

- L’**URL de base du serveur MCP** (souvent de la forme `https://<hôte>/mcp-server/mcp` sur les déploiements courants — **à caler sur votre environnement**).
- Le **modèle d’authentification** attendu (souvent **OAuth2** côté client, avec identifiants d’application / client id & secret selon ce que votre fournisseur a documenté).
- Les comptes ou espaces eXo autorisés à consommer les outils MCP (politique de sécurité de votre organisation).

### Enregistrer les identifiants dans n8n

Après import d’un `workflow.json` (ou déploiement via l’API), chaque nœud qui appelle eXo ou l’IA doit **pointer** vers des **identifiants n8n** valides.

1. **MCP eXo (nœuds « MCP Client » ou équivalent dans l’export)**
  Dans n8n : **Settings** (ou menu des **Credentials** / **Identifiants**), **ajouter** un identifiant du type attendu par le nœud — en pratique, un type **OAuth2** orienté **MCP** (dans ce dépôt, les spécifications techniques citent souvent le type `mcpOAuth2Api` côté n8n, **sous réserve** d’évolution des noms d’API). Renseigner l’**URL du serveur MCP** (alignée sur celle d’eXo), le **client id / secret** (ou le flux OAuth) fourni par votre admin, et les champs de **token** / **scope** demandés par l’instance. Attacher **le même** identifiant à tous les nœuds qui parlent à eXo pour un tenant donné, sauf besoin explicite de séparer les comptes.
2. **OpenAI ou fournisseur compatible (nœuds de type LLM / chat / sortie structurée)**
  Créer un identifiant **OpenAI** (ou le type proposé par n8n pour votre fournisseur) et l’associer aux nœuds d’IA des démonstrations. Les scénarios s’appuient sur des appels de modèles pour classer, structurer ou générer du contenu : **sans** clé API (ou **sans** crédit côté hébergeur), ces nœuds échoueront à l’exécution.
3. **n8n Cloud : essai et crédits intégrés**
  **n8n Cloud** propose en pratique une **période d’essai** (détail et durée selon l’offre en vigueur) qui inclut souvent un **petit volume de crédits d’exécution** sur des modèles proposés par l’hébergeur — pratique pour **dérouler les tutos** et valider les enchaînements **avant** de raccorder une clé OpenAI facturée à part. Vérifiez le parcours d’inscription et la consommation restante dans l’interface n8n de votre locataire.

### Poursuivre côté documentation produit

Le dépôt anglophone [DEVELOPMENT.md](https://github.com/plamarque/exo-n8n/blob/main/docs/DEVELOPMENT.md) détaille le **déploiement REST**, le fichier `**.env` local** (outils de script) et, pour les contributeurs, l’**MCP n8n** dans l’IDE. Ce n’est **pas** un prérequis pour lire les chapitres pédagogiques, mais c’est la référence pour **industrialiser** (CI, second poste, parité JSON / instance).

## Quatre cas d’usage de démonstration

Un portfolio de **quatre workflows n8n** illustre un parcours pédagogique progressif :

1. **Signal extérieur (e-mail)** — Un courrier n’entraîne une tâche eXo **que** s’il est clairement actionnable : filtrage par règles et analyse structurée, puis création et assignation de tâche dans un projet ciblé.
2. **Validation documentaire avancée** — Pour des processus qui exigent **deux approbations indépendantes** (équivalent poids, reprise de rejet, traçabilité), le graphe modélise un **parallélisme** (séparation / jonction) et l’audit par **commentaires** de tâche, au-delà d’un simple scénario de DMS natif.
3. **Rituels de collaboration récurrents** — Exemple de **préparation d’une réunion de pilotage** : note type, tableau d’avancement issu des tâches, suggestions d’ordre du jour et de points de vigilance, lien cohérent avec l’**agenda** hebdomadaire.
4. **Tâches de fond** — **Enrichissement** des métadonnées de documents (description courte, catégories) avec suivi d’exécution **incrémental** et idempotent, pour ne retraiter que l’utile.

Ces scénarios ne couvrent pas exhaustivement les possibilités de la plateforme : ils servent de **démonstrateurs** pour cadrer des ateliers clients et des intégrations sur mesure.

## Dépôt public et contenu

L’ensemble des livrables (exports `workflow.json` **canoniques**, chapitres didactiques par workflow, spécifications fonctionnelles et techniques, scripts de déploiement et consignes de validation) est publié sur GitHub :

**[https://github.com/plamarque/exo-n8n](https://github.com/plamarque/exo-n8n)**

- Le point d’entrée **narratif** en anglais se trouve dans le [README](https://github.com/plamarque/exo-n8n/blob/main/README.md) à la racine du dépôt.
- Chaque workflow possède son propre **tutoriel** (`README` dans le dossier `workflows/...`) et des fichiers `SPEC.*.md` pour le détail des règles et de l’implémentation.
- La documentation de **mise en place** (environnement, déploiement REST, dépendances entre sous-workflows) est regroupée dans `docs/`, notamment `DEVELOPMENT.md` et `WORKFLOW.md`.

En pratique, **cet article** donne le fil conducteur en français ; le **dépôt** reste la **source de vérité** pour reproduire, adapter et industrialiser les scénarios sur un tenant eXo et une instance n8n.

## Poursuivre l’échange

Les intégrateurs et les équipes produit peuvent s’appuyer sur ce dépôt pour accélérer la **preuve de concept** (déploiement, paramétrage, gouvernance documentaire) et pour discuter des **extensions** : règles métiers spécifiques, idempotence renforcée, interfaçage avec d’autres systèmes, ou scénarios de production au-delà de la démonstration festival / Art2Rue utilisée dans les spécifications d’exemple.

---

*Pour toute question d’alignement avec la feuille de route eXo ou le modèle MCP, privilégier le dépôt et les canaux habituels d’échange avec l’éditeur et les partenaires.*