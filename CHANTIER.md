# Chantier d'ouverture

État du travail nécessaire pour qu'une organisation tierce puisse installer et
exploiter cette plateforme sur sa propre infrastructure, avec ses propres
clients et ses propres données.

Ce fichier est la source de vérité de l'avancement. Il se met à jour au même
commit que le travail qu'il décrit.

**Dernière extraction depuis l'amont** : commit `3adb45fe8`, le 2026-08-17.

## La règle apprise à ses dépens

Le même défaut a été rencontré **trois fois**, et il explique à lui seul
l'essentiel du blocage historique : l'amorçage stubait des objets dont un autre
composant est propriétaire.

| Objet stubé       | Conséquence                                                             |
| ----------------- | ----------------------------------------------------------------------- |
| `public.profiles` | la première migration échouait, 552 migrations tombaient par domino     |
| `auth.users`      | le service d'authentification échouait sur sa propre migration initiale |
| `auth.uid()`      | il échouait sur « must be owner of function » et redémarrait en boucle  |

**Règle retenue, inscrite dans le fichier d'amorçage** : n'amorcer que ce que
personne d'autre ne crée, et transférer la propriété de ce qu'un autre composant
doit pouvoir remplacer.

## Mesures constatées

Relevées sur l'arbre extrait, profil `open-core` :

| Mesure                               | Valeur                    |
| ------------------------------------ | ------------------------- |
| Fichiers en amont                    | 15 547                    |
| Fichiers conservés                   | 12 611 (178 Mo)           |
| Fichiers exclus                      | 2 936 (418 Mo)            |
| Fichiers réécrits par le pipeline    | 38                        |
| Lignes de code hors tests (`src/`)   | 532 730                   |
| Fichiers de code hors tests (`src/`) | 2 452                     |
| Fichiers de test (`src/`)            | 7 477, dont 4 560 générés |
| Poids des tests contre le code       | 97 Mo contre 23 Mo        |
| Migrations SQL                       | 942                       |
| Fonctions de bord                    | 272                       |
| Policies de sécurité au niveau ligne | 1 911                     |
| Dépendances de production            | 138                       |

Barrière de publication : **verte, 0 constat**, tous niveaux confondus.

| Étape                                         | Constats            |
| --------------------------------------------- | ------------------- |
| Arbre brut                                    | 181                 |
| Après les règles issues de la cartographie    | 28                  |
| Après traitement des trois familles restantes | 3                   |
| Après correction de l'extracteur              | 0 bloquant, 0 élevé |
| Après tri des policies et bascule du CORS     | **0**               |

Vérifications exécutées, pas seulement décrites :

| Contrôle                                    | Résultat                                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Typage                                      | **0 erreur** (3 auparavant, levées par les corrections de réécriture)                         |
| Construction du frontend                    | verte                                                                                         |
| Bundle                                      | 0 marque, 0 domaine, 0 hôte de l'éditeur                                                      |
| Installation sur base vierge                | vérifiée, 447 tables, 1 380 policies                                                          |
| Tables sans protection                      | **0 sur 447**                                                                                 |
| Parcours d'installation                     | 0 lien mort                                                                                   |
| Tests des zones réécrites                   | **452 fichiers, 4 331 tests, 0 échec**                                                        |
| Amorçage sur PostgreSQL 15 nu               | appliqué sans erreur, trois substituts annoncés                                               |
| Coffre substitut                            | lecture correcte, inaccessible aux trois rôles applicatifs                                    |
| Cohérence des réécritures                   | 0 réécriture partielle (10 constats corrigés)                                                 |
| Schéma complet sur base vierge              | 447 tables, 447 protégées, 1 380 policies, 757 fonctions, 0 erreur                            |
| Lecture, modification, suppression anonymes | **0 policy sans restriction**                                                                 |
| Insertions anonymes                         | 6, toutes sur forum et messagerie publics ; les 2 journaux internes fermés                    |
| Registre d'environnement                    | 157 variables, toutes lues là où elles le déclarent (12 mortes retirées)                      |
| Intégration continue                        | 21 jobs sur exécuteur privé, tous conditionnés ; 1 chaîne publique sans secret                |
| Licences de production                      | 1 151 paquets : 1 135 permissifs, 16 à réciprocité faible, 0 réciprocité forte, 0 à qualifier |
| Stockage                                    | 21 espaces créés, 19 utilisés, 6 publics assumés, 5 règles, 0 sans restriction                 |
| Démarrage sans aucune intégration           | vérifié dans un navigateur : écran de connexion complet, 0 exception                          |
| CSP de la construction                      | 0 marqueur résiduel ; origine d'API et WebSocket déduites                                     |
| Suite complète, arbre figé                  | **2 893 / 2 893 fichiers, 18 579 / 18 579 tests, 0 échec**                                    |

**Deux garde-fous mentaient.** Les huit greffons CORS de la passerelle
n'avaient aucune configuration : Kong applique alors son défaut, qui autorise
toutes les origines — n'importe quel site pouvait appeler l'API depuis le
navigateur d'un utilisateur connecté. Et `verifier-liens.mjs` ignorait le
préfixe `docs/`, pourtant la cible la plus courante des renvois entre
documents : il était vert par construction sur toute cette famille de liens.
Corrigé, il a trouvé aussitôt deux renvois vers des notes d'architecture qui
n'ont jamais existé dans ce dépôt.

**Un renommage déclaré ne s'appliquait jamais.** La règle réécrivait `gsi-` en
`openpulse-` dans le contenu — le préfixe est le sigle de l'éditeur — mais les
cinq répertoires `services/gsi-*` gardaient leur nom : les documents issus de
l'amont renvoyaient donc vers des chemins inexistants, tandis que les documents
de gouvernance, jamais réécrits, renvoyaient vers les vrais. Deux vérités
contradictoires dans le même dépôt. La cause tenait à une barre oblique : un
préfixe de répertoire doit se terminer par `/`, sans quoi seul un chemin
exactement égal serait renommé, ce qui n'arrive jamais. L'extracteur signale
désormais tout renommage déclaré qui reste sans effet.

**Ma propre garde anti-purge refusait après coup.** Elle listait ce qu'elle
venait de supprimer, criait, et au passage suivant ne voyait plus rien : le
fichier était déjà perdu. C'est ainsi que `scripts/creer-admin.sh` a disparu une
seconde fois. Elle vérifie désormais avant de toucher au disque, et son refus
laisse le dépôt intact — éprouvé dans les deux sens.

**Ce qu'une revue adversariale a trouvé sous une barrière verte.** Cinq
relecteurs indépendants, chaque constat soumis à un sceptique chargé de le
réfuter. Trois défauts bloquants ont survécu, tous invisibles à la barrière
d'alors :

1. **Le chemin absolu de la machine de l'auteur, dans sept fichiers suivis.**
   Dix occurrences livrant son nom de compte et l'arborescence privée de la
   holding. Aucune règle ne visait un chemin de _home_ — celle sur
   l'infrastructure privée ne connaissait que des noms de domaine.
2. **Un rapport de pentest consolidé de l'éditeur**, couvrant quatre
   applications dont trois étrangères à cette distribution, avec quinze
   vulnérabilités de gravité haute encore ouvertes. Publier ce fichier, c'était
   publier la carte des faiblesses d'une infrastructure tierce.
3. **La marque gravée dans le schéma SQL publié**, et pas seulement en surface :
   des contraintes `CHECK` figeaient `'sclepios'` comme _valeur métier
   obligatoire_ alors que le code applicatif écrivait déjà `'marque'`. Mesuré
   sur base réelle : `'marque' = ANY (ARRAY['sclepios','etablissement'])` rend
   **false**. Chaque insertion du portail client et de la visioconférence était
   rejetée par la base. La colonne `responsable_sclepios_id` était de même
   introuvable pour les vingt-quatre requêtes du code, qui cherchaient
   `responsable_marque_id`.

**Trois identités réelles, et un client nommé.** Le nom complet du fondateur
était le signataire _par défaut_ de tous les PDF exportés : chez un adoptant,
ses propres factures l'auraient porté. Une praticienne tierce était citée
nommément avec son établissement dans un témoignage, publié sans qu'elle ait
consenti à cette distribution. Le prénom réel survivait ailleurs accolé à un
patronyme fictif — trace d'une réécriture qui n'avait traité que le nom de
famille. Enfin un établissement client réel était nommé dix-sept fois, avec son
volume d'activité et le nom de son chef de service urgences : un poste de chef
de service dans un établissement nommé désigne une personne unique, le nom seul
pouvait passer pour fictif, la fonction le rend identifiant.

**Dix-neuf fichiers portaient la marque dans leur NOM** — logos, tutoriel,
fichiers de test — sans qu'aucun constat ne soit levé : la barrière ne lisait
que des contenus, et sautait les binaires, si bien qu'un chemin n'était jamais
regardé. Elle teste désormais aussi les chemins, y compris ceux des fichiers
qu'elle ne peut pas ouvrir.

**La cause commune, elle, était structurelle.** `plist`, `entitlements`,
`pbxproj`, `java`, `kt`, `swift` n'étaient pas déclarés comme du texte dans
l'extracteur : **tous les fichiers de projet natif échappaient en bloc aux
réécritures**. D'où un identifiant de paquet iOS resté à l'éditeur, des domaines
associés revendiquant `gestion.sclepios-ia.com` — une application tierce aurait
réclamé les liens universels d'un domaine qui ne lui appartient pas — et un
Android qui ne compilait pas, son `applicationId` déjà réécrit désignant une
classe restée dans l'ancien paquet. Vingt-deux extensions ajoutées, 1 144
fichiers réécrits contre 1 130 auparavant.

Deux règles de barrière ont été ajoutées, `chemin-absolu-machine-auteur` et
`marque-editeur-nue` : elles rendaient **25 constats bloquants** sur l'arbre
qui passait pour propre. Les seules mentions de l'éditeur qui subsistent sont
`LICENSE` — une licence MIT doit nommer son titulaire — et l'outillage de
publication, qui porte par construction les motifs qu'il traque.

**Le dernier échec n'était pas une régression.** Sept tests de `useUnifiedTodos`
fabriquaient leurs dates en UTC (`toISOString`) quand le code les compare en
heure locale (`isToday`, `isPast`). Entre minuit et 02h00 en heure d'été
française, les deux ne désignent pas le même jour : mesuré à 00h52, 7 rouges en
CEST et 28/28 verts sous `TZ=UTC`. Le test amont porte exactement le même
calcul — le défaut ne vient donc pas des réécritures, et il ne serait pas parti
avec la distribution. Un dépôt public dont la chaîne rougit deux heures par nuit
perd sa crédibilité avant d'avoir servi. Les constantes sont désormais calculées
en heure locale, comme le code : 28/28 sous CEST, UTC et Pacific/Auckland.
| Versions d'images citées | documentation alignée (14 écarts corrigés) |

**Ce qui n'est PAS vérifié en exécution.** Le registre d'images est inaccessible
depuis la machine où ce travail a été mené — `hello-world` lui-même ne descend
pas. Deux services sont donc déclarés et relus, mais jamais démarrés ici :
`supabase/realtime:v2.34.47` et `supabase/edge-runtime:v1.67.2`. Leur
configuration suit la composition de référence de l'amont Supabase, et leurs
secrets sont engendrés par l'installateur ; rien de tout cela ne remplace un
démarrage réel. C'est le premier contrôle à refaire sur une machine ayant accès
au registre, avant toute annonce de publication.

Le détail des tests exécutés, par zone :

| Zone                                        | Fichiers | Tests |
| ------------------------------------------- | -------- | ----- |
| Bibliothèques et configuration              | 252      | 3 363 |
| Composants touchés par les règles de marque | 122      | 581   |
| Fichiers renommés, services et réglages     | 78       | 387   |

## Ce que vaut la suite de tests, mesuré

La suite n'est pas déterministe, et elle ne l'est pas non plus en amont. Mesure
faite sur les deux, avec la même commande :

|                                    | Fichiers | Tests  | En échec                  |
| ---------------------------------- | -------- | ------ | ------------------------- |
| Amont (avec les tests générés)     | 7 445    | 61 954 | 8 fichiers, **38 tests**  |
| OpenPulse (sans les tests générés) | 2 893    | 18 269 | 56 fichiers, **35 tests** |

Deux observations qui comptent plus que les totaux :

- **l'amont n'est pas vert non plus.** Exiger d'OpenPulse un résultat que le
  projet d'origine n'atteint pas serait un critère inventé pour l'occasion ;
- **les échecs ne se reproduisent pas en isolation.** Les 20 fichiers identifiés
  comme en échec dans la suite complète passent tous — 136 tests verts — quand on
  les rejoue ensemble hors de la suite. Huit d'entre eux passent également dans
  l'amont.

L'écart entre 56 fichiers et 35 tests en échec est lui-même parlant : la plupart
de ces fichiers échouent **sans qu'aucun test n'échoue**, c'est-à-dire à la
collecte ou par expiration de délai. C'est la signature d'une contention de
ressources, pas d'une régression fonctionnelle.

Mesure en exécution **séquentielle**, qui isole la contention :

| Mode       | Fichiers en échec | Tests en échec |
| ---------- | ----------------- | -------------- |
| Parallèle  | 56                | 35             |
| Séquentiel | 41                | **11**         |

Vingt-quatre échecs sur trente-cinq disparaissent en supprimant le parallélisme.

Le projet d'origine a d'ailleurs **déjà diagnostiqué ce phénomène**. Son propre
fichier de configuration de tests porte, depuis juin 2026, une liste de mise en
quarantaine introduite par ce commentaire :

> QUARANTAINE : tests rouges en suite, interférence entre fichiers et saturation
> mémoire en parallèle, irréductibles après deux passes de réparation.

Ce qui reste à faire n'est donc pas « corriger 56 fichiers » mais **rendre la
suite déterministe** : c'est une dette héritée, reconnue en amont, et elle mérite
d'être traitée pour elle-même plutôt que maquillée. Une piste mesurée existe
déjà : l'exécution séquentielle en supprime les deux tiers.

## Lots

### Lot 0 — Périmètre · ⏳ arbitré, réversible

Modèle retenu : **open core**. Le socle générique est ouvert, le contenu métier
et commercial de l'éditeur reste en amont. L'arbitrage est **paramétrable** :
`exclut_categories` dans le manifeste. Passer en « tout ouvrir » = changer de
profil, pas refaire le travail.

Reste à trancher :

- ~~le nom public du projet~~ — **tranché : OpenPulse**. Deux points de vigilance :
  le produit comporte déjà un module de messagerie interne nommé « Pulse », d'où un
  risque de confusion à l'intérieur du code ; et l'antériorité du nom sur les
  registres de marques et les écosystèmes open source n'a pas été vérifiée.
- le sort de l'historique : ce dépôt part d'un commit initial propre, l'historique
  de l'amont n'est pas rejoué. C'est la seule option qui garantit qu'aucun
  contenu retiré ne reste accessible ;
- les 4 560 fichiers de test générés : les publier ou non.

### Lot 1 — Purge des données · ✅ fait

- [x] Pipeline d'extraction avec exclusions catégorisées
- [x] Barrière de publication : secrets, données personnelles réelles, marques,
      infrastructure privée, défauts de sécurité
- [x] Neutralisation de la référence au projet hébergé en amont et des jetons
      publics associés (38 fichiers réécrits)
- [x] Exclusion des jeux de données réelles, archives d'audit, binaires,
      pilotage interne, infrastructure privée
- [x] Jeux de données réelles remplacés par des données fictives de même forme
- [x] Fixtures basculées vers des domaines réservés, et numéros de téléphone
      vers les plages que l'autorité de régulation réserve à la fiction
- [x] Marques retirées de la distribution
- [x] Barrière au vert : **0 constat**, tous niveaux confondus

### Lot 2 — Schéma reproductible · ✅ fait

La cause réelle du non-rejeu n'était pas les objets gérés par la plateforme,
mais le schéma d'amorçage lui-même : il créait une table du schéma applicatif
avec une forme divergente, ce qui faisait échouer la première migration et
tomber 552 migrations par domino.

amorçage historique 284 / 942 migrations appliquées
amorçage corrigé 836 / 942 (+552)

- [x] Amorçage qui n'installe que ce qu'aucun autre composant ne crée
- [x] Migration initiale consolidée, obtenue par exécution et non par relecture
- [x] Substituts conditionnels des extensions non libres
- [x] Régénération scriptée, sans aucun accès à une base de production
- [x] Vérification automatisée du rejeu sur base vierge
- [ ] Séparer données de référence et données de démonstration

**Preuve** : base vierge → amorçage → schéma initial appliqué sans aucune
erreur. 359 tables, 1 380 policies, 351 tables à RLS actif, 757 fonctions,
339 déclencheurs, 41 vues, 1 279 index, 639 clés étrangères.

### Lot 3 — Découplage infrastructure et marque · ✅ fait

- [x] Module de marque unique, alimenté par variables d'environnement
- [x] Identifiants d'infrastructure externalisés ; bundle vérifié sans aucun
      domaine ni hôte de l'éditeur
- [x] 163 variables inventoriées, contrôle au démarrage, référence **générée**
      depuis le registre pour qu'elle ne puisse pas diverger
- [x] Éléments d'identité visuelle remplacés par des emplacements neutres

### Lot 4 — Dépendances externes optionnelles · 🟢 livré, à éprouver

- [x] Interface de fournisseur de modèles avec implémentations interchangeables
- [x] Registre d'interrupteurs, chacun exposant la raison de son état
- [x] Preuve que l'application démarre avec toutes les intégrations coupées :
      construction sans une seule variable d'intégration, paquet servi, chargé
      dans un vrai navigateur — écran de connexion complet, aucune exception au
      chargement, aucune trace de l'éditeur

**Ce que ce chargement réel a révélé, et qu'aucun test ne voyait.** La politique
de sécurité de contenu d'`index.html` reçoit les origines de l'installation par
substitution Vite. Vite ne substitue que ce qui est défini : les quatre
variables `VITE_CSP_*` n'étant ni documentées, ni dans le Dockerfile, ni
dérivées, le HTML produit gardait `connect-src 'self' %VITE_CSP_CONNECT_EXTRA%`
— littéralement. La construction réussissait, l'application s'affichait, et le
navigateur refusait **chaque** appel vers l'API. Quatorze refus au premier
chargement, zéro erreur de build. Le Dockerfile déduit désormais l'origine de
l'API et son équivalent WebSocket depuis `VITE_SUPABASE_URL`, les quatre
variables sont documentées, et `verifier-csp-construite.mjs` refuse toute
construction portant encore un marqueur.

Le premier écran promettait par ailleurs un modèle de langage propriétaire
nommé, alors que le fournisseur est configurable et peut être absent, et gardait
le suffixe du produit interne dans son titre.

### Lot 5 — Installation en une commande · 🟢 fait

**Ce qui manquait encore, trouvé par la revue.** `scripts/creer-admin.sh`
n'existait dans aucun commit alors que l'installateur y renvoyait : une instance
fraîche n'avait **aucun moyen d'ouvrir une session**, l'inscription libre étant
fermée par défaut. Le script existe désormais et attribue le rôle `admin` après
avoir vérifié que le déclencheur d'inscription a bien créé le profil.

`--url https://mon-domaine` sans `--api-url` laissait l'URL d'API à
`http://localhost:8000` : le frontend construit appelait la machine qui l'avait
construit. Elle se déduit maintenant de l'URL publique.

Quatre espaces de stockage manquaient encore après les douze premiers :
`entity-logos` et `user-avatars`, ratés parce que mon relevé ne cherchait que
les apostrophes simples quand ces fichiers écrivent `from("…")` ; puis
`emargements` et `ticket-attachments`, dans des fonctions de bord que le relevé
ne parcourait pas. `verifier-espaces-stockage.mjs` fait désormais la
comparaison, dans les deux sens.

`SUPABASE_DB_URL` transmettait le mot de passe du superutilisateur PostgreSQL à
chacune des 272 fonctions de bord, alors qu'aucune ne la lit : une seule
fonction compromise aurait contourné toute la sécurité au niveau ligne. Retirée.

- [x] Composition : base, API REST dérivée du schéma, authentification,
      stockage, **temps réel**, exécution des fonctions, passerelle
- [x] Génération automatique des secrets d'instance, propres à chaque instance
- [x] Ordre d'installation correct : les services propriétaires de leur schéma
      migrent avant le schéma applicatif
- [x] Création d'un compte et connexion vérifiées de bout en bout
- [x] Frontend : `docker/Dockerfile.openpulse`, construction verte, chargée dans un navigateur
- [x] Espaces de stockage et leurs règles : `supabase/schema-05-stockage.sql`

**Troisième trou comblé.** Le code écrit aujourd'hui dans dix-neuf espaces de
stockage, dont aucun n'était créé par le corpus de migrations — sur la plateforme hébergée, ils
l'avaient été à la main. Le premier envoi de fichier d'une instance fraîche
échouait sur « Bucket not found », et les créer n'aurait pas suffi :
`storage.objects` est protégé, sans règle explicite personne n'y lit ni n'y
écrit. Deux espaces seulement sont publics — photo de profil, image de note.
`ressources-documentaires` et `rh-onboarding-documents` sont volontairement
privés alors que le code y appelle `getPublicUrl()` : ils portent des documents
internes et des pièces d'intégration de salariés. Conséquence assumée et
documentée, ces deux appels renvoient une URL qui répond 403 tant qu'ils ne sont
pas portés sur `createSignedUrl()`. Éprouvé sur base réelle, y compris en second
passage : 21 espaces créés, 19 utilisés, 5 règles, aucune sans restriction de rôle.

- [x] Guide d'installation réécrit depuis ce qui est prouvé : `docs/DEMARRAGE_RAPIDE.md`

**Trou comblé le 2026-08-19** — la composition ne montait pas le service temps
réel. 102 fichiers de l'interface s'y abonnent, dont 91 par `postgres_changes` :
sur une instance auto-hébergée, ces écrans se chargeaient normalement puis ne se
mettaient plus jamais à jour, sans une seule erreur. Le service, sa route de
passerelle, ses trois secrets et les droits de réplication de son rôle sont
désormais dans la composition et dans l'installateur.

**Second trou comblé le même jour** — le schéma consolidé lit
`vault.decrypted_secrets` en quatre endroits ; l'amorçage créait `vault.secrets`
et `vault.create_secret`, mais pas cette vue. Sur un PostgreSQL nu,
l'installation réussissait et les quatre fonctions échouaient à l'usage. La vue
substitut est posée — uniquement quand `supabase_vault` est absent, sans quoi
elle écraserait la vue de déchiffrement réelle — et reste inaccessible aux rôles
applicatifs. Vérifié : lecture correcte par le propriétaire, `false` pour `anon`,
`authenticated` et `service_role`.

**Preuve** : sur une machine où rien ne préexistait — tous les services up,
`sans clé → 401`, `avec clé → 200`, création de compte par la clé de service,
connexion par mot de passe donnant un jeton de rôle `authenticated`, lecture de
6 tables du schéma en authentifié, et `auth.uid()` résolu depuis le jeton comme
le schéma l'exige en 2 280 points.

### Lot 6 — Sécurité avant ouverture · 🟢 largement fait

- [x] Aucune fonction n'ouvre l'API à toutes les origines
- [x] 48 policies permissives triées : la seule sans restriction de rôle est
      corrigée. **447 tables protégées sur 447**
- [x] Valeurs par défaut sûres : inscription fermée, authentification forte,
      vérification des jetons, aucune origine ouverte
- [ ] Politique de divulgation : les délais sont écrits (accusé sous 3 jours
      ouvrés, évaluation sous 10), mais `SECURITY.md:13` porte encore
      « _à renseigner avant l'ouverture du dépôt_ » à la place de l'adresse.
      Un projet public sans adresse de signalement reçoit ses failles sur les
      réseaux sociaux.

### Lot 7 — Dépôt et intégration continue · 🟢 fait

- [x] Dépôt distinct, parti d'un commit initial propre
- [x] Barrière exécutable en local
- [x] Barrière en intégration continue, sur exécuteurs hébergés, sans aucun
      secret : `.github/workflows/barriere-publication.yml`
- [x] Chaîne courte et utilisable par un contributeur externe

**Ce qui bloquait, mesuré.** Douze des quatorze workflows hérités exigeaient
`runs-on: [self-hosted, …]`, et sept se déclenchaient sur `push` ou
`pull_request`. Sur une bifurcation, aucun exécuteur ne porte ce nom : ces jobs
n'échouent pas, ils restent en attente indéfiniment et sans message. Un
contributeur externe aurait vu une demande de fusion qui ne conclut jamais.
Les 21 jobs concernés sont désormais conditionnés à `vars.EXECUTEURS_PRIVES`,
absente partout sauf dans le dépôt d'origine, et `verifier-ci-portable.mjs`
refuse tout nouveau job privé sans garde.

### Lot 8 — Documentation d'adoption · 🟢 largement fait

- [x] Démarrage rapide, exploitation, architecture, import/export
- [x] Référence de configuration **générée** depuis le registre
- [x] Procédure de mise à jour et de sauvegarde
- [x] Parcours d'installation : **0 lien mort**, contrôlé par l'outillage
- [ ] Choix de langue de la documentation et internationalisation de l'interface

### Lot 9 — Juridique · ✅ audit fait, les trois arbitrages sont tranchés

- [x] Licence MIT et clause de marque explicite
- [x] Avertissement d'usage : ni dispositif médical, ni hébergement de données
      de santé
- [x] Audit des licences : outillé, rejouable, **1 151 paquets de production
      mesurés** — `docs/LICENCES_DEPENDANCES.md`. Les chiffres du document et
      ceux de `NOTICE` sont tenus par `verifier-notice-licences.mjs`, qui rejoue
      l'audit : ils avaient déjà dérivé une fois, en annonçant trois jours
      durant une contamination levée entre-temps
- [x] Mécanisme d'attestation d'origine : `DCO` (Developer Certificate of
      Origin), documenté dans `CONTRIBUTING.md`
- [x] **`hyperformula@3.3.0`, en GPL-3.0-only — retiré.** Le moteur de formules
      du tableur est réécrit dans le dépôt, sous la licence du dépôt. Les
      remplaçants permissifs ont été examinés et écartés : `fast-formula-parser`
      tire `jstat`, sans licence déclarée — le problème aurait changé de nom
- [x] **`react-leaflet@4.2.1` et `@react-leaflet/core`, sous Hippocratic-2.1 —
      retirés.** `leaflet` est en BSD-2 : c'était le liant React, et lui seul,
      qui posait problème. L'écran bascule sur `maplibre-gl` (BSD-3), déjà
      présent et déjà employé ailleurs dans le dépôt
- [x] **`@qonto/embed-sdk` — retiré de `package.json`** (aucune licence
      déclarée : tous droits réservés par défaut).
      `@mapbox/jsonlint-lines-primitives` est sorti de l'arbre de production
      avec la chaîne cartographique ; il n'en reste qu'un `override` de version,
      que l'auditeur ne compte pas — un `override` ne fait entrer aucun paquet
- [x] **Ressources graphiques — les deux problèmes sont réglés.**
      202 images sont livrées. Deux familles posent question, et aucune ne se
      règle par une règle de réécriture : 1. ~~Les logos de l'éditeur sont distribués~~ — **fait.** Une identité
      OpenPulse propre les remplace : symbole, verrouillages horizontal et
      vertical, favicons, icônes des cinq applications, bannières Open Graph,
      ressources de la coque mobile. Treize fichiers hérités sont retirés.
      Les sources vectorielles vivent dans `src/assets/identite/`. 2. ~~Quatre logos de sociétés tierces~~ — **fait.** Easily, Hôpital
      Manager, Mediboard et Résurgences sont remplacés par des vignettes
      neutres engendrées depuis le symbole de la charte, dans quatre teintes
      distinctes. Le composant affiche déjà le nom de chaque solution en
      titre à côté de la vignette, et s'en sert comme texte alternatif :
      aucune information n'est perdue. Les fichiers gardent leurs noms, donc
      ni import ni test n'ont bougé, et un exploitant qui obtient l'accord
      des éditeurs concernés n'a qu'à remplacer les quatre fichiers.

### Lot 10 — Publication · 🟠 reste l'adresse de signalement

**Les 36 constats de la revue adversariale sont traités.** Huit contrôles
automatiques encadrent désormais la publication, et chacun a été éprouvé par
régression volontaire — on lui a soumis le défaut qu'il doit voir, puis on a
vérifié qu'il redevient vert une fois le défaut retiré. Un contrôle qu'on n'a
jamais vu échouer ne prouve rien.

| Contrôle                        | Ce qu'il refuse                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `scan.mjs`                      | secrets, données personnelles, marques, infrastructure privée, chemins de machine — dans le contenu **et** dans les noms de fichiers |
| `verifier-coherence.mjs`        | réécritures partielles : un libellé sous un TLD de gabarit et sous un TLD réel                                                       |
| `verifier-liens.mjs`            | renvois du parcours d'installation vers un chemin absent                                                                             |
| `verifier-espaces-stockage.mjs` | espace de stockage utilisé par le code et créé par rien                                                                              |
| `verifier-registre-env.mjs`     | variable déclarée que plus aucun fichier ne lit                                                                                      |
| `verifier-modele-env.mjs`       | variable présente d'un seul côté : `.env.example` ou le registre                                                                     |
| `verifier-versions-images.mjs`  | version d'image citée par la documentation et absente de la composition                                                              |
| `verifier-ci-portable.mjs`      | job d'intégration continue sur exécuteur privé sans condition                                                                        |
| `verifier-csp-construite.mjs`   | construction dont la politique de sécurité garde un marqueur                                                                         |

L'extraction elle-même refuse de purger un fichier suivi par git que l'amont ne
fournit pas, et signale tout renommage déclaré qui reste sans effet.

**Le dernier écart trouvé.** `.env.example` est ce qu'un adoptant copie ;
`docs/CONFIGURATION.md` est engendré depuis le registre. Rien ne reliait les
deux, et ils avaient divergé de dix variables : six mots de passe de rôles de
service que la composition exige mais que la référence ne mentionnait nulle
part, une variable de plateforme déclarée deux fois sous deux noms, et
`OPENPULSE_ORIGINES_AUTORISEES` — celle qui ferme les fonctions de bord —
absente du modèle alors qu'elle est la première à renseigner. L'écart est
silencieux dans les deux sens : une variable absente du modèle ne se renseigne
pas, une variable absente du registre ne se documente pas.

- [x] Barrière verte, schéma installé et mesuré sur base vierge
- [x] Les trois arbitrages de licence du lot 9 sont tranchés : les dépendances
      concernées sont retirées, aucune contrainte n'est transmise à l'adoptant
- [ ] **Bloquant** : l'adresse de signalement de `SECURITY.md` porte encore
      « à renseigner ». Un dépôt public dont la politique de sécurité renvoie
      dans le vide est pire qu'un dépôt sans politique : il laisse croire qu'un
      signalement a été reçu. Pour un partage à un tiers identifié, ce point
      n'est pas bloquant
- [ ] Bascule du dépôt en public
- [ ] Procédure de resynchronisation depuis l'amont, pour éviter la divergence
      entre les versions

## Invariants

1. **L'amont n'est jamais modifié.** Le pipeline lit un snapshot inerte et
   refuse tout répertoire contenant un `.git`.
2. **On ne publie pas sur une barrière rouge.**
3. **Aucune suppression en amont.** Retirer du périmètre public ne retire rien
   de l'amont.
4. **Une exclusion se prouve et se confronte aux imports entrants** avant d'être
   appliquée.
