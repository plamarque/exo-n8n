# Workflow 02 - Spécification fonctionnelle

> Détails techniques (MCP, n8n, webhooks) : [SPEC.technical.md](SPEC.technical.md).

## 1) Objectif
Definir un workflow documentaire de validation parallele pour la programmation du festival Art de Rue, avec deux approbations equivalentes obligatoires avant cloture.

## 2) Contexte metier et storytelling
Le projet eXo `Programmation Festival` centralise les activites proposees (spectacles, deambulations, performances). Chaque activite est suivie par une tache dediee et son dossier documentaire associe.

Le festival impose une regle de gouvernance claire:
- la Direction Artistique doit valider la pertinence editoriale
- la Direction Technique doit valider la faisabilite terrain

Ces deux validations ont la meme autorite. Aucune ne remplace l'autre. L'engagement final n'est possible qu'avec double accord.

## 3) Acteurs et autorites
1. Auteur du dossier
- Produit et met a jour le document de l'activite.
- Resoumet en cas de refus.
- Resolution cible: utilisateur ayant depose le document (identifiant uploader).
- Fallback: utilisateur par defaut `claire` si l'identifiant uploader n'est pas exploitable.

2. Direction Artistique (tampon A)
- Autorite sur la coherence avec la ligne artistique du festival.
- Peut `APPROUVER` ou `REFUSER` avec motif.
- Utilisateur fixe pour la demo: `nadia`.

3. Direction Technique (tampon B)
- Autorite sur la faisabilite operationnelle (regie, securite, contraintes techniques).
- Peut `APPROUVER` ou `REFUSER` avec motif.
- Utilisateur fixe pour la demo: `etienne`.

## 4) Objet valide
Le workflow est document-driven:
- un document depose dans le dossier cible declenche le processus
- 1 document depose = 1 tache eXo creee automatiquement

Perimetre documentaire cible:
- espace: `Festival Art de Rue`
- dossier surveille: `/Documents/Festivak_Art2Rue_2026/00_Programmation`
- parent_folder_id cible: `b468cb5639805e11480baa56164da90c`

Contenu attendu de la tache creee:
- titre derive du titre du document
- resume du contenu du document (ou extrait) pour contexte
- lien vers le document source
- liens d'approbation (tampon Artistique et tampon Technique)

## 5) Etats et regles de cycle de vie
Etats de tache conserves (nomenclature simple):
- `To Do`: dossier non soumis
- `Doing`: dossier en cours de validation ou en reprise
- `Done`: dossier valide avec double tampon

Regles:
1. Soumission initiale ou resoumission => statut `Doing`.
2. Tant que les deux tampons ne sont pas `APPROUVE`, la tache reste `Doing`.
3. Passage en `Done` uniquement si:
- `Tampon Artistique = APPROUVE`
- ET `Tampon Technique = APPROUVE`
4. Si au moins un tampon est `REFUSE`, la tache reste/revient en `Doing` et l'auteur doit corriger puis resoumettre.

## 6) Mode de collaboration dans eXo
Pour chaque tache de programmation:
1. Co-workers obligatoires:
- Auteur
- Valideur Direction Artistique
- Valideur Direction Technique

2. Communication via commentaires automatiques:
- Demande d'action envoyee aux valideurs.
- Journal de chaque decision (approbation/refus + motif).
- Conclusion du cycle (double validation obtenue ou reprise demandee).

3. Description de tache normalisee:
- lien document: permet la lecture complete du dossier
- lien approbation Artistique
- lien approbation Technique

4. Notifications:
- les notifications natives eXo sont attendues automatiquement lors de la creation de tache, des commentaires et des changements de statut
- pas de logique supplementaire specifique a implementer dans le workflow pour emettre ces notifications eXo de base

## 7) Principe de workflow cible (split/join)
1. Depot d'un document dans `/Documents/Festivak_Art2Rue_2026/00_Programmation` => declenchement.
2. Le workflow lit les metadonnees et le contenu du document, puis cree automatiquement la tache eXo (avec acteurs statiques et description enrichie).
3. Le workflow ouvre deux validations en parallele:
- branche A: decision Direction Artistique
- branche B: decision Direction Technique
4. Le workflow attend les deux retours (join).
5. Chaque retour d'approbation/refus ajoute automatiquement un commentaire dans la tache eXo.
6. Apres join:
- si A=APPROUVE et B=APPROUVE => finalisation
- sinon => reprise auteur

Ce modele est volontairement non sequentiel pour demonstrer une gouvernance partagee et un vrai pattern split/join.

## 8) Resultats attendus en sortie de validation
Quand les deux tampons sont `APPROUVE`:
1. Mise a jour de la tache en `Done`.
2. Commentaire automatique de validation finale ("double tampon obtenu").
3. Option metier a demonstrer ensuite:
- deplacement du document vers un espace/folder "Valide"
- et/ou mise a jour complementaire de la tache (metadata, etiquette, notification)

Si refus:
1. Tache maintenue en `Doing`.
2. Commentaire de synthese de refus (qui, pourquoi).
3. Demande explicite de correction et resoumission a l'auteur.
4. Lors de la resoumission, un nouveau cycle split/join est relance.

## 9) Jeu de donnees de reference (demo)
### 9.1 Projet
- Projet eXo: `Programmation Festival`
- Project ID (tasks): `117`
- Espace documentaire: `Festival Art de Rue`
- Dossier surveille: `/Documents/Festivak_Art2Rue_2026/00_Programmation`
- parent_folder_id surveille: `b468cb5639805e11480baa56164da90c`

### 9.2 Acteurs (identifiants demo)
1. Auteur:
- dynamique: identifiant uploader du document
- fallback: `claire`
2. Responsable Artistique: `nadia`
3. Responsable Technique: `etienne`

### 9.3 Exemples de documents de declenchement
1. `Parade_Nocturne_Place_Centrale.docx`
2. `Deambulation_Jeune_Public_Quartier_Nord.docx`
3. `Performance_Feu_et_Lumiere_Esplanade.docx`

### 9.4 Mapping documents -> taches creees automatiquement
1. Document `Parade_Nocturne_Place_Centrale.docx` -> tache `Validation - Parade Nocturne - Place Centrale`
2. Document `Deambulation_Jeune_Public_Quartier_Nord.docx` -> tache `Validation - Deambulation Jeune Public - Quartier Nord`
3. Document `Performance_Feu_et_Lumiere_Esplanade.docx` -> tache `Validation - Performance Feu et Lumiere - Esplanade`

### 9.5 Exemple d'etat des tampons
1. Cas valide:
- Artistique = APPROUVE
- Technique = APPROUVE
- Resultat = `Done`

2. Cas refuse:
- Artistique = APPROUVE
- Technique = REFUSE (motif)
- Resultat = `Doing` + reprise auteur

3. Cas incomplet:
- Artistique = EN_ATTENTE
- Technique = APPROUVE
- Resultat = `Doing` (attente join)

## 10) Criteres d'acceptation fonctionnels
1. Le depot d'un document dans le dossier surveille declenche automatiquement la creation d'une tache de validation.
2. La tache creee contient le lien document et les liens d'approbation necessaires aux valideurs.
3. Le workflow prend en charge deux validations paralleles equivalentes.
4. Le passage en `Done` est strictement conditionne aux deux approbations.
5. Un refus declenche un retour en reprise sans cloture prematuree.
6. Les acteurs sont explicites (auteur + 2 validateurs) dans chaque tache.
7. Les commentaires de tache assurent la tracabilite des decisions en temps reel.

