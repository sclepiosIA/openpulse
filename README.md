# OpenPulse

OpenPulse est une plateforme de gestion interne **auto-hébergeable** : suivi commercial, facturation, ressources humaines, trésorerie, documents, communication d'équipe, support, formation, recrutement. Une organisation l'installe sur son infrastructure, avec ses comptes, ses clients et ses données. Pas d'offre hébergée, pas de compte chez un tiers, pas de télémétrie activée par défaut.

Le code provient d'une base de code d'entreprise en exploitation. La distribution en retire les références à l'infrastructure de son auteur d'origine, ainsi que les modules qui relèvent de son métier — base de connaissances commerciale et formation client.

Le chemin d'installation a été exécuté de bout en bout : voir `## Installer`. Ce qui reste à éprouver est nommé dans `## État d'avancement (honnête)`, pas passé sous silence.

Langue du code et de la documentation : français.

## Ce que fait OpenPulse

Inventaire mesuré dans l'arbre, pas repris d'une plaquette.

| Domaine                                                            | Où c'est dans l'arbre                                                                                |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Suivi commercial (comptes clients, contacts, pipeline)             | `src/components/etablissements/`, `contacts/`, `pipeline/`, `prospects/`, `apporteurs/`              |
| Facturation (devis, factures, avoirs, catalogue, export comptable) | `src/components/facturation/`, `catalogue/`, `compta/` ; fonctions `export-fec`, `compta-export-fec` |
| Trésorerie et finances                                             | `src/components/tresorerie/`, `finances/`, `forecasting/`                                            |
| Ressources humaines (dossiers, absences, paie, compétences)        | `src/components/rh/`, `competences/`, `people/` ; fonction `export-paie`                             |
| Contrats et signature électronique                                 | `src/components/contrats/` ; fonctions `docuseal-*`                                                  |
| Documents et espace de fichiers                                    | `src/components/documents/` ; service `services/openpulse-gestion-drive-api/`                        |
| Messagerie (IMAP/SMTP, classification)                             | `src/components/email/` ; service `services/openpulse-email-api/`                                    |
| Communication interne temps réel                                   | `src/components/pulse/` ; service `services/openpulse-pulse-api/`                                    |
| Réunions, visioconférence, comptes rendus                          | `src/components/visio/`, `meeting-notes/` ; service `services/openpulse-meetings-api/`               |
| Support et forum                                                   | `src/components/support/`, `forum/`                                                                  |
| Enquêtes de satisfaction                                            | `src/components/enquetes/`                                                                           |
| Wiki : pages rédigées, recherche plein texte, historique                | `src/components/documents/`, `supabase/schema-08-pages.sql`                                          |
| Recrutement, projets, backlog                                      | `src/components/recrutement/`, `rd/`, `projets/`, `global-gantt/`                                    |
| Rendez-vous publics                                                | `src/components/booking/`                                                                            |
| Registre de traitement, exports, anonymisation                     | `src/components/rgpd/`, `dpo/` ; fonctions `rgpd-export-data`, `rgpd-anonymize`                      |
| Assistant conversationnel outillé                                  | `src/components/jarvis/` ; ~50 fonctions de bord préfixées `jarvis-`                                 |

Volumétrie mesurée au commit d'origine :

| Élément                              | Mesure                                                        | Méthode                                             |
| ------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------- |
| Fichiers sous `src/`                 | 10 012                                                        | `find src -type f`                                  |
| Répertoires de composants            | 120                                                           | `ls -d src/components/*/`                           |
| Composants de page hors tests        | 165                                                           | `find src/pages -name '*.tsx' ! -name '*.test.tsx'` |
| Chemins de route distincts           | 170                                                           | `path="…"` uniques dans `src/routes/`               |
| Hooks hors tests                     | 483                                                           | `find src/hooks`                                    |
| Migrations SQL                       | 1 — le schéma consolidé remplace les 942 migrations d'origine | `ls supabase/migrations`                            |
| Fonctions de bord (Deno)             | 272                                                           | `ls supabase/functions`                             |
| Noms de table créés                  | 363                                                           | `CREATE TABLE` dans les migrations                  |
| Tables avec sécurité au niveau ligne | 355                                                           | `ENABLE ROW LEVEL SECURITY`                         |
| Services HTTP Python (FastAPI)       | 4                                                             | `services/*/app/main.py`                            |
| Compartiments de stockage            | 11                                                            | `INSERT INTO storage.buckets`                       |

## Ce que ne fait pas OpenPulse

- **Pas de multi-organisation.** `tenant_id` apparaît dans 0 migration ; `organization_id` ne désigne qu'un compte bancaire externe (`supabase/migrations/20251120225812_*.sql:8`). Le cloisonnement se fait par instance, pas par ligne.
- **Pas d'inscription libre.** Le fournisseur d'authentification de référence est configuré avec `GOTRUE_DISABLE_SIGNUP: "true"` (`docker/docker-compose.openpulse.yml`).
- **Pas d'IA fournie.** Les fonctions d'assistance appellent un service externe via `AZURE_OPENAI_ENDPOINT` et `AZURE_OPENAI_API_KEY`. Variables vides : aucun appel émis, l'application reste utilisable. Aucun modèle embarqué.
- **Pas de conformité certifiée**, ni agrément, ni avis juridique.
- **Pas de support contractuel.**

## Installer

```bash
git clone <url-du-dépôt> openpulse
cd openpulse
npm ci
scripts/installer.sh
```

L'installateur génère les secrets propres à l'instance, vérifie que la base est
vierge, applique l'amorçage puis le schéma, et crée le premier compte
administrateur. Il n'utilise aucune valeur d'exemple : chaque instance a ses
propres clés.

Ce qu'il faut savoir avant de lancer :

- **Il choisit des ports libres et les conserve.** Si 8080 ou 8000 sont pris, il
  prend les suivants et les écrit dans `.env`, avec l'URL publique. Un port
  changé à la main sans mettre l'URL à jour donnerait une instance qui démarre
  et refuse toutes ses propres requêtes.
- **Il refuse une base déjà peuplée** plutôt que d'y appliquer un schéma qui
  n'est pas idempotent.
- **Il vous donne les identifiants du premier administrateur** en fin
  d'exécution. Ce compte est le seul autorisé à recevoir son rôle sans second
  facteur, et seulement tant qu'aucun autre administrateur n'existe.
- **Il vérifie le temps réel après démarrage** et le dit si les mises à jour en
  direct ne fonctionnent pas — l'application reste utilisable sans elles, les
  écrans se rafraîchissant au chargement.

Pour publier ailleurs que sur `localhost` :

```bash
scripts/installer.sh --url https://openpulse.mon-organisation.example
```

L'URL publique sert aussi à la politique d'origine de la passerelle : la donner
ici évite d'avoir à l'accorder à deux endroits.

## Modèle : une instance par organisation

Une organisation = une base PostgreSQL = un fournisseur d'authentification = un jeu de compartiments = un domaine. Deux organisations ne partagent rien.

Ce n'est pas un choix de présentation : les 355 tables protégées s'appuient sur l'identité de l'utilisateur connecté (`auth.uid()`, présent dans 362 fichiers de migration) et sur des rôles applicatifs, jamais sur un identifiant d'organisation. Faire cohabiter deux organisations dans une instance reviendrait à réécrire ces 355 politiques.

En pratique : une mise à jour se décide instance par instance ; une sauvegarde couvre une organisation entière ; l'export de sortie est un export complet d'instance, ce qui est plus simple qu'un export filtré.

## Prérequis réels

**Machine de construction**

| Ressource                        | Valeur                                     | Preuve                                                                          |
| -------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| Node.js                          | ≥ 20                                       | `package.json:6-9`                                                              |
| npm                              | ≥ 9 (référence `npm@10.9.0`)               | `package.json:9-10`                                                             |
| Mémoire pour le build du frontal | **tas Node de 8 Go**                       | `docker/Dockerfile.frontend:16`, le deploiement de l'editeur, hors distribution |
| Deno                             | tests des fonctions de bord                | `deno.json`                                                                     |
| Python 3                         | les 4 services HTTP                        | `services/*/requirements.txt`                                                   |
| Rust + Tauri                     | **seulement** pour l'application de bureau | `apps/gestion-drive-desktop/src-tauri/`                                         |

Une machine de 4 Go de RAM ne construit pas le frontal. C'est l'erreur la plus coûteuse de la documentation d'origine, qui annonçait 4 Go en minimum.

**Machine d'exécution**

| Composant                    | Référence                                      | Preuve                                |
| ---------------------------- | ---------------------------------------------- | ------------------------------------- |
| PostgreSQL                   | 15 (client 16 pour l'amorçage)                 | `docker/docker-compose.openpulse.yml` |
| Docker + Compose v2          | requis                                         | fichiers `docker-compose*.yml`        |
| Extensions                   | `uuid-ossp`, `pgcrypto`, `pg_trgm`, `unaccent` | `supabase/schema-00-bootstrap.sql`    |
| Stockage objet compatible S3 | requis pour les pièces jointes                 | `docker/docker-compose.openpulse.yml` |
| Certificat TLS               | requis (flux PKCE)                             | `src/lib/supabaseBrowser.ts:50`       |

Espace disque : 627 Mo hors dépendances (`src/` 127 Mo, `supabase/` 13 Mo, documentation 6 Mo), plus les dépendances npm, les images, la base et le stockage.

## État d'avancement (honnête)

Trois états : **vérifié** (exécuté depuis ce dépôt, avec un compte rendu reproductible), **non prouvé** (jamais exécuté depuis ce dépôt), **à produire** (le fichier nécessaire n'existe pas).

| Sujet                                                 | État                             | Détail                                                                                                                                    |
| ----------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Code, migrations, fonctions de bord                   | vérifié                          | présents et cohérents entre eux                                                                                                           |
| Pile de composants d'exécution                        | **vérifié**                      | base, API REST, authentification, stockage, passerelle                                                                                    |
| Composition portable sans dépendance à un fournisseur | **vérifié**                      | `docker/docker-compose.openpulse.yml`, cinq services démarrés                                                                             |
| Politique de sécurité de contenu paramétrable         | **vérifié**                      | neutralisée à l'extraction, plus aucun hôte tiers                                                                                         |
| Installation sur machine vierge                       | **vérifié**                      | `tools/openrelease/schema/verifier-installation.sh` la rejoue de bout en bout                                                             |
| Création du premier administrateur                    | **vérifié**                      | compte créé, déclencheur déclenché, profil renseigné                                                                                      |
| Sauvegarde / restauration                             | contrat vérifié, recette réelle à exercer | rôles, schémas, stockage et empreintes couverts par les scripts canoniques ; dry-run testé, restauration destructive non lancée sur le live |
| Export de sortie                                      | partiel                          | 6 fonctions d'export, aucune ne produit un export complet d'instance                                                                      |
| Application de bureau (Tauri)                         | code vérifié, produit non prouvé | `apps/gestion-drive-desktop/`                                                                                                             |
| Coque mobile (Capacitor)                              | code vérifié, non prouvé         | `capacitor.config.ts`, `android/`, `ios/`                                                                                                 |
| Pile héritée décrite dans `docker/`                   | à ignorer                        | elle référence un service absent ; la composition de référence est `docker/docker-compose.openpulse.yml`                                  |

### Ce que l'installation corrige, et qui manquait

Deux défauts rendaient la création du premier compte impossible sur une
instance neuve, et aucun ne se voyait à la lecture :

1. Le schéma d'amorçage hérité crée `profiles` sans la colonne qui la relie à
   l'authentification. La composition d'OpenPulse ne le monte pas.
2. Le corpus de migrations ne contient **aucun déclencheur** sur `auth.users` :
   il avait été posé hors migration. Sans lui, la création d'un compte réussit
   sans créer de profil — en silence, alors que l'interface interroge les
   profils partout. Il est désormais fourni et vérifié.

Vérifié de bout en bout : compte créé, déclencheur déclenché, profil renseigné
depuis les métadonnées.

## Documentation

| Document                                             | Contenu                                                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [docs/DEMARRAGE_RAPIDE.md](docs/DEMARRAGE_RAPIDE.md) | machine vierge → instance qui répond, avec le signal de réussite de chaque étape et un guide de diagnostic |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)         | l'architecture réellement présente dans l'arbre                                                            |
| [docs/EXPLOITATION.md](docs/EXPLOITATION.md)         | sauvegarde, restauration, mise à jour, journaux, dimensionnement                                           |
| [docs/IMPORT_EXPORT.md](docs/IMPORT_EXPORT.md)       | arriver avec ses données, repartir avec les siennes                                                        |

Les autres documents héritent de l'amont : ils décrivent l'infrastructure de l'auteur d'origine et peuvent contredire les quatre ci-dessus. En cas de désaccord, les quatre ci-dessus font foi, et seule l'inspection de l'arbre tranche vraiment.

## Participer, signaler, licence

| Vous voulez… | Lisez |
|---|---|
| proposer une modification | [CONTRIBUTING.md](CONTRIBUTING.md) — ce dépôt est produit par un pipeline, tout n'y est pas modifiable au même titre |
| signaler une faille | [SECURITY.md](SECURITY.md) — et surtout pas un ticket public |
| savoir ce que vous pouvez en faire | [LICENSE](LICENSE) et [NOTICE](NOTICE) |
| savoir ce qui reste ouvert | [CHANTIER.md](CHANTIER.md) |

## Licence

Licence MIT, voir `LICENSE`. La ligne de droit d'auteur du fichier `LICENSE` nomme le titulaire des droits ; elle n'est pas modifiée par la mise en distribution et ne doit pas l'être.

## Marques

« OpenPulse » désigne cette distribution. Les marques, noms commerciaux et noms de domaine de l'auteur d'origine ne font pas partie de la licence MIT et ne sont pas concédés. Une instance déployée ne doit pas se présenter sous une identité qui n'est pas la sienne.

Toutes les adresses et tous les domaines de la documentation sont des exemples construits sur les domaines réservés (`example.org`, `example.com`, `.test`, `.invalid`). Aucun n'est joignable, aucun ne désigne une organisation réelle.
