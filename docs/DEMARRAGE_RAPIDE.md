# Démarrage rapide

Installer une instance OpenPulse sur une machine à vous, avec vos propres
données. Compter une heure sur une machine nue, dont l'essentiel en
téléchargement d'images.

> Ce document remplace une version antérieure qui décrivait un dépôt qui
> n'existe plus : elle annonçait 942 migrations à appliquer une par une, elle
> déconseillait la composition et le schéma d'amorçage, et elle ignorait
> l'installateur. Les trois sont aujourd'hui la voie normale.

## Ce qu'il vous faut

- Docker avec le greffon Compose (`docker compose version`)
- Node.js 20 ou plus récent (`node --version`)
- `openssl`, `curl`, `git`
- 8 Gio de mémoire libre pour la construction du frontend
- Aucun compte chez qui que ce soit

## Installation

```bash
git clone <votre-copie-du-depot> openpulse
cd openpulse
npm ci
scripts/installer.sh --url https://gestion.mon-domaine.fr
```

Sans `--url`, l'instance est installée sur `http://localhost:8080`, ce qui
convient pour l'essayer.

L'URL de l'API est déduite de `--url` (même hôte, port 8000). Si votre
passerelle est ailleurs, indiquez-la : `--api-url https://api.mon-domaine.fr`.

Deux autres options :

- `--sans-frontend` n'installe que la couche de données, pour brancher votre
  propre interface dessus.
- `--verifier-seulement` ne modifie rien et vérifie l'état d'une installation
  existante.

### Ce que l'installateur fait, dans cet ordre

1. Vérifie les prérequis.
2. Engendre les secrets de **cette** instance dans `.env`, en droits 600 :
   secret de signature, mots de passe des rôles de service, clés `anon` et
   `service_role` signées par `scripts/generer-cles.mjs`. Aucune valeur
   d'exemple n'est réutilisée. Si `.env` existe déjà, rien n'est régénéré.
3. Démarre PostgreSQL et **vérifie que la base est vierge** — le schéma
   consolidé n'est pas idempotent, l'appliquer deux fois casserait la base.
4. Applique `supabase/schema-00-bootstrap.sql` : rôles, schémas de service,
   extensions. Rien d'autre — chaque service crée et fait évoluer ses propres
   tables, et les lui prendre le ferait échouer sur ses propres migrations.
5. Donne aux rôles de service leurs mots de passe, puis démarre
   l'authentification et le stockage pour qu'ils migrent leurs schémas.
6. Applique le schéma applicatif, ses compléments, les tables manquantes, le
   déclencheur d'inscription, le durcissement, et les espaces de stockage.
7. Engendre la configuration de la passerelle depuis son modèle.
8. Démarre tous les services.

## Premier compte

L'inscription libre reste fermée. Sur une instance vierge, OpenPulse affiche à
la place un onboarding centré permettant de créer le premier administrateur.
À la fin de l'installation, le terminal affiche un lien d'activation privé :

```text
https://openpulse.example.org/#installation=…
```

Ouvrez ce lien : le jeton est détecté automatiquement et aucun code n'est à
recopier. Sa présence après `#` évite son envoi au serveur web et son apparition
dans les journaux HTTP. Ne publiez pas ce lien et ne l'ajoutez jamais au dépôt.

La revendication est atomique. Dès que le premier administrateur existe, le
formulaire se ferme définitivement et l'écran de connexion normal prend le
relais. `scripts/creer-admin.sh` reste disponible comme procédure de secours
locale pour l'exploitant.

## Première connexion : l'assistant de configuration

Après la création du compte administrateur, l'application n'ouvre pas encore
son écran d'accueil : elle présente un assistant en six étapes — marque,
organisation, mentions légales, courriels sortants, pied de page des documents,
adresse publique.

Ce passage est obligatoire, et c'est délibéré. Une instance fraîchement
installée porte encore les réglages livrés par défaut : rien n'échoue, les
écrans s'affichent, les factures se génèrent et les courriels partent — au nom
de quelqu'un d'autre. Aucun message ne le signale.

Tout ce que vous saisissez est modifiable ensuite depuis les paramètres. Un
utilisateur qui se connecte avant que l'administrateur ait terminé voit un
message d'attente, pas le formulaire : seuls les comptes administrateurs
peuvent écrire cette configuration.

**Ce que l'assistant ne peut pas changer.** Certaines valeurs sont servies
avant tout JavaScript : le navigateur les lit sans jamais exécuter
l'application. Elles se règlent toutes par la même variable de construction,
`VITE_MARQUE_NOM_PRODUIT`, et exigent donc de reconstruire l'image :

| Valeur                                                                   | Où                                                                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Titre de l'onglet, auteur du document, titre d'aperçu des liens partagés | `index.html`                                                                                              |
| Nom de l'application installée sur l'appareil                            | les six manifestes de `public/`, réécrits à la construction par `scripts/appliquer-marque-manifestes.mjs` |

Les icônes elles-mêmes se remplacent en écrasant les fichiers de `public/`,
sans changer leurs noms.

## Vérifier

```bash
scripts/installer.sh --verifier-seulement
```

Une installation saine rend 447 tables, toutes protégées par la sécurité au
niveau ligne, 1 380 règles d'accès, et 21 espaces de stockage.

## Configurer le reste

`.env` ne contient à ce stade que les secrets de la plateforme. Tout le reste —
fournisseur de modèles de langage, envoi de courriel, stockage externe,
identités tierces — est facultatif et documenté variable par variable dans
[CONFIGURATION.md](CONFIGURATION.md), avec pour chacune ce que son absence
provoque. Le modèle commenté est [`.env.example`](../.env.example).

Vérifiez votre configuration avant de démarrer :

```bash
node scripts/check-env.mjs --profil minimal
node scripts/check-env.mjs --profil complet
```

La seconde passe est celle qui compte : elle signale les **dégradations
silencieuses**, ces variables dont l'absence ne fait rien échouer mais rend le
comportement faux — un envoi de courriel qui se déclare réussi sans partir, un
traceur actif sans destination.

## Pièges connus

**La politique de sécurité de contenu se fige à la construction.** Les quatre
variables `VITE_CSP_*` sont substituées dans le HTML au moment du build. Une
variable absente y laisse son marqueur littéral, et le navigateur refuse alors
toutes les requêtes vers l'API : l'application s'affiche et reste vide. Le
Dockerfile fourni y ajoute seul l'origine de l'API et son équivalent WebSocket.
Si vous construisez à la main, définissez-les — même vides — puis vérifiez :

```bash
node tools/openrelease/verifier-csp-construite.mjs dist
```

**Changer une variable `VITE_*` exige de reconstruire.** Ces valeurs sont
inscrites dans le paquet JavaScript, pas lues au démarrage.

**Les fonctions de bord reçoivent tout `.env`.** C'est nécessaire — le
conteneur transmet son environnement à chaque fonction — mais cela signifie
qu'un secret ajouté là est visible de toutes.

**PostgreSQL nu n'a ni `pg_net`, ni `pg_cron`, ni le coffre.** L'amorçage pose
des substituts inertes et l'annonce à l'installation. Les appels sortants depuis
la base et les tâches planifiées demandent alors un ordonnanceur externe.

## Sauvegarder

```bash
docker compose --env-file .env -f docker/docker-compose.openpulse.yml \
  exec -T db pg_dump -U postgres --format=custom postgres > sauvegarde.dump
```

Sauvegardez `.env` séparément, et ailleurs : sans lui, une sauvegarde de base
est inexploitable — les jetons de session et le contenu du coffre sont chiffrés
avec les secrets qu'il contient.
