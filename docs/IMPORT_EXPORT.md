# Entrer avec ses données, repartir avec les siennes

Un logiciel dont on ne peut pas sortir n'est pas librement utilisable. Ce document décrit les deux trajets avec ce qui existe réellement dans l'arbre et ce qui reste à faire à la main.

Principe posé d'emblée : **votre base PostgreSQL et votre stockage objet sont votre porte de sortie.** Toutes les données d'une instance y sont, dans des formats ouverts. Aucun format propriétaire, aucun chiffrement applicatif qui vous empêcherait de lire vos propres données, à une exception près, signalée en 2.2.

## Partie 1 — Arriver avec ses données existantes

### 1.1 Ce que le dépôt sait importer tout seul

| Fonction | Entrée | Ce qu'elle alimente |
|---|---|---|
| `import-commercial-data` | documents PDF de matrices commerciales | données commerciales |
| `import-deck-json` | export JSON d'un outil de tableaux de tâches | projets et tâches |
| `import-ics-events` | fichier iCalendar | événements d'agenda |
| `nextcloud-import` | arborescence d'un serveur de fichiers | gestion documentaire |

C'est tout. **Aucun importateur générique** : ni CSV vers les comptes clients, ni CSV vers les contacts, ni reprise depuis un autre outil de gestion. La reprise de données est un travail SQL, à faire une fois, table par table.

### 1.2 Ordre de reprise

L'ordre est imposé par les clés étrangères. Insérer les données métier avant les comptes ne marche pas : de nombreuses tables référencent `profiles(id)`, et `profiles` référence `auth.users(id)`.

1. **Comptes.** Créer chaque utilisateur via l'interface d'administration du fournisseur d'authentification (`docs/DEMARRAGE_RAPIDE.md`, étape 7). Le déclencheur `on_auth_user_created` crée la ligne de profil.
2. **Rôles.** Renseigner `public.user_roles`. Valeurs du type énuméré `app_role` : `admin`, `direction`, `chef_projet`, `csm`, `commercial`, `rh`, `user`.
3. **Référentiels.** Comptes clients (`etablissements`) et contacts. Les colonnes `commercial_id`, `chef_projet_id`, `csm_id` référencent `profiles(id)` (`supabase/migrations/20250705085623-*.sql:48-50`) : ces affectations exigent que l'étape 1 soit terminée.
4. **Historique.** Tâches, échanges, documents, factures.
5. **Fichiers.** Dépôt dans les compartiments, puis insertion des métadonnées.

### 1.3 Reprendre des fichiers

Deux stockages distincts coexistent : les **21 compartiments** déclarés par
`supabase/schema-05-stockage.sql`, dont les métadonnées vivent dans le schéma
`storage` ; et le **service de fichiers autonome**
(`services/openpulse-gestion-drive-api/`), avec ses propres conteneurs d'objets
et ses propres tables. Le contrôle
`node tools/openrelease/verifier-espaces-stockage.mjs .` mesure
actuellement 19 compartiments utilisés par le code et 21 créés ; les deux autres
sont conservés comme réserves explicites, pas comme dépendances cachées.

Déposer un objet sans créer sa ligne de métadonnées le rend invisible ; créer la ligne sans déposer l'objet produit un lien mort. Les deux opérations vont ensemble.

### 1.4 Vérifier une reprise

```sql
-- 1. Chaque profil est relié à un compte réel  → doit renvoyer 0
SELECT count(*) FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.user_id WHERE u.id IS NULL;

-- 2. Chaque profil a bien un rôle
SELECT count(*) FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id);

-- 3. Répartition des métadonnées de fichiers
SELECT bucket_id, count(*) FROM storage.objects GROUP BY 1 ORDER BY 1;
```

4. **Le contrôle qui compte :** se connecter avec un compte non administrateur et vérifier qu'il voit ce qu'il doit voir, et rien de plus. Une reprise techniquement réussie mais dont le cloisonnement est faux est un incident de confidentialité. Ne faites jamais ce test avec un compte administrateur.

### 1.5 Ce qui manque

⚠ non outillé : aucun importateur générique, aucun schéma d'échange documenté, aucun jeu de données d'exemple pour répéter une reprise à blanc. `scripts/seed-e2e-users.ts` et `scripts/seed-e2e-crm-data.ts` alimentent des jeux de test, pas une reprise de production.

## Partie 2 — Repartir avec ses données

### 2.1 La sortie complète

Chemin principal, indépendant de toute fonctionnalité de l'application.

```bash
# Structure et données, format texte, lisible et rejouable partout
pg_dump -d "$DATABASE_URL" --format=plain --no-owner \
        --schema=public --schema=auth --schema=storage \
        --file=openpulse-export.sql

# Une table en CSV, pour un usage bureautique
psql -d "$DATABASE_URL" -c "\copy (SELECT * FROM public.etablissements) TO 'comptes.csv' WITH CSV HEADER"

# Les objets
<client-s3> mirror local-objets/openpulse ./objets/
```

Ce que vous obtenez : du SQL standard, du CSV, et des fichiers dans leur format d'origine. Rien qui exige de réinstaller OpenPulse pour être relu.

Point d'attention réel : la structure est large — 363 noms de table distincts créés par les migrations. Un export complet est facile ; une reprise sélective dans un autre outil demande un travail de correspondance, qui est le vôtre, mais que rien n'empêche.

### 2.2 L'exception : les données chiffrées côté application

Une clé de chiffrement applicative existe pour les identifiants des comptes de messagerie stockés en base (`ENCRYPTION_KEY`, documentée `.env.example:52-54`). Sans elle, les colonnes concernées sont illisibles, y compris pour vous. **Exportez toujours vos secrets avec vos données**, et conservez-les séparément. Une sauvegarde de base sans les secrets n'est pas un export complet.

### 2.3 Les exports fournis par l'application

Six fonctions, aucune ne produit un export complet d'instance : ce sont des exports métier.

| Fonction | Ce qu'elle produit | Contrôle d'accès |
|---|---|---|
| `export-fec`, `compta-export-fec` | fichier des écritures comptables | jeton requis (`supabase/config.toml`) |
| `export-paie` | données de paie | rôle RH ou administrateur |
| `report-export` | rapports configurés | jeton requis |
| `rgpd-export-data` | données d'une personne physique identifiée | rôle administrateur, vérifié dans le code |
| `rgpd-anonymize` | anonymisation en place | rôle administrateur |

Sur `rgpd-export-data` : la fonction exige un jeton valide **et** le rôle d'administration, journalise les tentatives non autorisées dans `rgpd_audit_logs`, puis collecte les données de la personne dans six sources seulement — contacts, contacts par nom, rendez-vous, conversations de dialogue en ligne avec leurs messages, tickets de support, signatures de présence en formation. Ce n'est pas un export exhaustif de toutes les traces d'une personne. Elle remplace en outre la donnée de signature par un marqueur au lieu de la restituer : ce choix protège la donnée biométrique mais rend l'export incomplet au regard d'une demande d'accès. Traitez-la comme un point de départ, pas comme une réponse complète.

### 2.4 Partir vers une autre instance OpenPulse

Cas le plus simple, le schéma étant identique : suivre `docs/EXPLOITATION.md`, section 2. Deux précautions : les deux instances doivent être **à la même version de migrations**, sinon le rejeu échoue ou, pire, réussit partiellement ; et le frontal de la nouvelle instance doit être **reconstruit** avec son propre domaine, l'origine du serveur d'API étant figée à la compilation (`src/lib/supabaseBrowser.ts:8-15`).

### 2.5 Partir vers un autre logiciel

Aucune passerelle n'existe. Ce que vous avez : du SQL standard, du CSV par table, vos fichiers. Ce que vous n'avez pas : une correspondance vers le format d'échange d'un autre outil. Ce travail est à votre charge, et rien dans la licence ni dans le format des données ne s'y oppose.

### 2.6 Effacer une instance

```bash
# 1. Arrêter tous les services
dropdb openpulse                             # 2. supprimer la base
<client-s3> rb --force local-objets/openpulse # 3. supprimer les objets
docker compose down --volumes                 # 4. supprimer les volumes
# 5. détruire les secrets, y compris hors de la machine
```

L'étape 5 est celle qu'on oublie. Un `JWT_SECRET` ou une `ENCRYPTION_KEY` qui survit dans un gestionnaire de secrets, un `.env` de sauvegarde ou un journal de terminal reste une donnée sensible longtemps après la destruction de l'instance.

## Résumé

| Question | Réponse |
|---|---|
| Puis-je entrer avec mes données ? | Oui, par SQL. Aucun importateur générique n'est fourni. |
| Puis-je sortir avec mes données ? | Oui, entièrement : `pg_dump`, CSV, copie des objets. |
| Ai-je besoin d'OpenPulse pour relire mon export ? | Non. Formats standard. |
| Des données que je ne pourrais pas relire ? | Une exception : les identifiants de messagerie, chiffrés avec `ENCRYPTION_KEY`. Sauvegardez cette clé. |
| Les exports intégrés suffisent-ils à une demande d'accès ? | Non. Ils couvrent six sources. |
