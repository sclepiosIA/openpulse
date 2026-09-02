# Auto-hébergement d'OpenPulse

## Installer

```bash
git clone <url-du-dépôt> openpulse
cd openpulse
npm ci
scripts/installer.sh
```

`scripts/installer.sh` génère les secrets propres à l'instance, vérifie que la
base est vierge, applique l'amorçage puis le schéma, lance le service
d'authentification et crée le premier compte administrateur, dont il affiche
les identifiants en fin d'exécution. Aucune valeur d'exemple n'est réutilisée
d'une instance à l'autre.

Pour publier ailleurs que sur `localhost` :

```bash
scripts/installer.sh --url https://openpulse.mon-organisation.example
```

Le détail des étapes, avec le signal de réussite de chacune, est dans
[docs/DEMARRAGE_RAPIDE.md](docs/DEMARRAGE_RAPIDE.md). Les prérequis réels
(mémoire, versions, extensions PostgreSQL) sont dans le [README](README.md).

| Document | Contenu |
|---|---|
| [docs/DEMARRAGE_RAPIDE.md](docs/DEMARRAGE_RAPIDE.md) | machine vierge → instance qui répond, étape par étape, avec guide de diagnostic |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | l'architecture réellement présente dans l'arbre |
| [docs/EXPLOITATION.md](docs/EXPLOITATION.md) | sauvegarde, restauration, mise à jour, journaux, dimensionnement |
| [docs/IMPORT_EXPORT.md](docs/IMPORT_EXPORT.md) | arriver avec ses données, repartir avec les siennes |

## Adapter le produit à votre activité

OpenPulse est un outil de relation client. Il ne présuppose plus de métier :
les listes proposées à l'installation sont neutres, et se règlent par
variables d'environnement. Rien de tout cela n'exige de modifier le code.

**Le vocabulaire.** `VITE_LEXIQUE_ENTITE` et `VITE_LEXIQUE_ENTITES` nomment
l'objet que vous suivez — « Organisation » par défaut, mais « Client »,
« Établissement », « Chantier », « Dossier » selon votre métier.
`VITE_LEXIQUE_GROUPE` / `VITE_LEXIQUE_GROUPES` nomment leur regroupement, et
`VITE_LEXIQUE_SYSTEME_EN_PLACE` la solution déjà en place chez eux.

**Les référentiels.** Chaque liste se remplace par une énumération séparée par
des virgules :

| Variable | Contenu |
|---|---|
| `VITE_REFERENTIEL_TYPES_ENTITE` | catégories d'entité (`Grand compte, PME, …`) |
| `VITE_REFERENTIEL_SYSTEMES_EN_PLACE` | solutions concurrentes ou existantes |
| `VITE_REFERENTIEL_ZONES` | découpage géographique de vos filtres |
| `VITE_REFERENTIEL_PALIERS` | paliers commerciaux |
| `VITE_REFERENTIEL_STATUTS_IMPORT` | états acceptés à l'import d'un tableur |

**Les préréglages.** `VITE_SECTEUR_METIER` charge un jeu complet de listes en
une fois : `generique` (défaut) ou `sante-fr` (établissements de santé
français). Une surcharge individuelle prime toujours sur le préréglage, et une
clé inconnue retombe sur le générique sans empêcher le démarrage. Les
préréglages sont déclarés dans `src/config/secteurs.ts` ; en ajouter un est une
contribution bienvenue.

Ces listes sont des **valeurs de repli** : dès que la table `reference_data`
est renseignée, c'est elle qui fait foi. Les variables servent au premier
démarrage et aux contextes sans base.

## Adapter l'identité

Le nom, le logo, la favicon, les couleurs, l'entité légale, l'hébergeur et les
contacts (support, sécurité, protection des données) se règlent par les
variables `VITE_MARQUE_*`, décrites dans `src/config/branding.ts`. Le nom du
produit vaut « OpenPulse » par défaut ; les champs légaux sont vides tant que
vous ne les renseignez pas, et l'interface le signale plutôt que d'inventer.

## Connecter une messagerie

N'importe quelle boîte IMAP/SMTP convient. Serveur, port et mode de chiffrement
(SSL/TLS direct, ou STARTTLS) sont saisis à l'écran, dans **Profil** comme dans
**Emails**, et enregistrés par compte. Il n'y a ni fournisseur imposé ni liste
blanche.

Deux points d'exploitation :

- `EMAIL_ENCRYPTION_KEY` est **obligatoire** côté serveur : sans elle, les mots
  de passe ne peuvent pas être chiffrés et la connexion est refusée.
- Les serveurs sur réseau privé sont refusés par défaut, pour ne pas faire du
  produit un relais de requêtes internes. Si votre serveur de messagerie est sur
  le même réseau que votre instance, posez `EMAIL_AUTORISER_RESEAU_PRIVE=true`.

## Deux avertissements

1. **Ne pas utiliser la pile décrite dans `docker/`.** `docker/Dockerfile.backend:22,28`
   copie un répertoire `server/` qui n'existe pas dans l'arbre, et
   `docker/scripts/deploy.sh:46` construit ce service, donc échoue
   immédiatement. La composition de référence est
   `docker/docker-compose.openpulse.yml`, celle que l'installateur emploie.
2. **`supabase/schema-00-bootstrap.sql` ne se suffit pas à lui-même.** Il pose
   les rôles, les schémas de service et les extensions, mais sa table des
   profils n'a pas la colonne qui la relie à l'authentification. Il doit donc
   toujours être suivi de `supabase/migrations/`, qui est la source de vérité du
   schéma. C'est exactement ce que fait `scripts/installer.sh` : l'amorçage
   d'abord, les migrations ensuite. L'appliquer seul laisserait une instance
   sans authentification ni sécurité au niveau ligne.

## Ce qui est vérifié, et ce qui ne l'est pas

`tools/openrelease/schema/verifier-installation.sh` rejoue l'installation de
bout en bout sur une base vierge, service d'authentification compris, et
échoue si le schéma ne s'applique qu'à moitié. Le tableau d'avancement du
[README](README.md) distingue ce qui a été exécuté depuis ce dépôt de ce qui
ne l'a jamais été — notamment la sauvegarde/restauration, l'export de sortie,
l'application de bureau et la coque mobile. Lisez-le avant de vous engager sur
une mise en production.
