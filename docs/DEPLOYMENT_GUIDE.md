# Guide de Déploiement - Modules RH & Trésorerie

> **Version**: 1.9.0 | **Dernière mise à jour**: Mars 2026

## Prérequis

### Environnement
- **Node.js** : v18 ou supérieur
- **Supabase CLI** : v1.150.0 ou supérieur
- **Git** : Pour le versioning
- **Azure CLI** : Pour le déploiement Azure (si applicable)

### Accès requis
- Compte Supabase avec droits admin
- Accès au projet Supabase
- Clés API (anon key, service role key)
- Accès au repository Git

### Variables d'environnement

Créer un fichier `.env.local` à la racine :

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Azure OpenAI (si utilisé)
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5
```

## Phase 1 : Préparation de la base de données

### 1.1 Vérification du schéma

Exécuter le script de validation :

```bash
psql -h your-db-host -U postgres -d postgres -f scripts/validation_donnees.sql
```

Vérifier :
- ✅ Toutes les tables existent
- ✅ Les colonnes ont les bons types
- ✅ Les contraintes FK sont en place
- ✅ Les index sont créés

### 1.2 Correction du schéma profiles

Si la colonne `actif` existe au lieu de `est_actif` :

```sql
-- Option 1 : Renommer la colonne
ALTER TABLE profiles RENAME COLUMN actif TO est_actif;

-- Option 2 : Créer une nouvelle colonne et migrer
ALTER TABLE profiles ADD COLUMN est_actif BOOLEAN DEFAULT TRUE;
UPDATE profiles SET est_actif = actif WHERE actif IS NOT NULL;
ALTER TABLE profiles DROP COLUMN actif;
```

### 1.3 Création des tables manquantes

Si certaines tables manquent, exécuter les migrations :

```bash
supabase db reset
# ou
supabase db push
```

### 1.4 Configuration des RLS Policies

Vérifier et appliquer les policies de sécurité :

```sql
-- Exemple pour tresorerie_recettes_mensuelles
-- ⚠️ Les rôles sont stockés dans la table `user_roles`, PAS dans `profiles`
CREATE POLICY "Admins can view all recettes"
  ON tresorerie_recettes_mensuelles
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can update recettes"
  ON tresorerie_recettes_mensuelles
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
  );
```

## Phase 2 : Déploiement des Edge Functions

### 2.1 Génération des dépenses récurrentes

```bash
# Tester localement
supabase functions serve generate-recurring-expenses

# Déployer
supabase functions deploy generate-recurring-expenses --project-ref your-project-ref

# Tester le déploiement
curl -X POST https://your-project.supabase.co/functions/v1/generate-recurring-expenses \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dateDebut": "2025-01-01",
    "dateFin": "2025-03-31"
  }'
```

**Réponse attendue** :
```json
{
  "success": true,
  "depensesGenerees": 36,
  "periode": {
    "debut": "2025-01-01",
    "fin": "2025-03-31"
  }
}
```

### 2.2 Génération des recettes mensuelles

```bash
# Déployer
supabase functions deploy generate-monthly-receipts --project-ref your-project-ref

# Tester
curl -X POST https://your-project.supabase.co/functions/v1/generate-monthly-receipts \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dateDebut": "2025-01-01",
    "dateFin": "2025-12-31"
  }'
```

### 2.3 Configuration des secrets

```bash
# Définir les secrets pour les Edge Functions
supabase secrets set AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com
supabase secrets set AZURE_OPENAI_API_KEY=your-api-key
supabase secrets set AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5
```

## Phase 3 : Déploiement du frontend

### 3.1 Build de production

```bash
# Installer les dépendances
npm install

# Build
npm run build

# Vérifier le build
ls -la dist/
```

### 3.2 Vérification pré-déploiement

**Checklist** :
- ✅ Toutes les variables d'environnement sont définies
- ✅ Les imports ES6 sont corrects
- ✅ Aucune erreur TypeScript
- ✅ Les tests passent (si configurés)
- ✅ Le build réussit sans warnings critiques

```bash
# Vérifier TypeScript
npm run type-check

# Linter
npm run lint
```

### 3.3 Déploiement

#### Option A : Déploiement via plateforme initiale tierce (recommandé)

1. Ouvrir le projet dans [la plateforme initiale](https://generation.example.org/projects/e5e9a8fc-ea79-4f05-8e1c-1f260eb046fc)
2. Cliquer sur **Share** → **Publish**
3. Configurer le domaine personnalisé si nécessaire

#### Option B : Déploiement Self-Hosted

Voir le guide complet : [SELF_HOSTING_GUIDE.md](./SELF_HOSTING_GUIDE.md) et [QUICK_START_ON_PREMISE.md](./QUICK_START_ON_PREMISE.md)

```bash
# Build de production
npm run build

# Déployer le dossier dist/ sur votre serveur web (Nginx, Apache, etc.)
```

## Phase 4 : Import initial des données

### 4.1 Préparer le fichier Excel

Suivre les étapes ci-dessous :

1. Créer les 4 feuilles obligatoires
2. Remplir les données selon le format
3. Valider les UUID des établissements
4. Vérifier les formats de dates

### 4.2 Import via l'interface

1. Se connecter en tant qu'admin
2. Aller dans Trésorerie → Admin
3. Cliquer sur "Import Excel"
4. Sélectionner le fichier
5. Vérifier le résumé
6. Confirmer l'import

### 4.3 Vérification post-import

```sql
-- Vérifier les recettes importées
SELECT COUNT(*) FROM tresorerie_recettes_mensuelles;

-- Vérifier les catégories
SELECT * FROM tresorerie_categories ORDER BY ordre;

-- Vérifier les dépenses récurrentes
SELECT COUNT(*) FROM tresorerie_depenses_recurrentes WHERE est_actif = true;
```

## Phase 5 : Génération automatique initiale

### 5.1 Générer les dépenses récurrentes

Via l'interface Admin :
1. Trésorerie → Admin
2. Section "Génération automatique"
3. Choisir la période (ex: 12 mois)
4. Cliquer sur "Générer les dépenses récurrentes"

**Ou via API** :

```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-recurring-expenses \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dateDebut": "2025-01-01",
    "dateFin": "2025-12-31"
  }'
```

### 5.2 Générer les recettes prévisionnelles

```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-monthly-receipts \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dateDebut": "2025-01-01",
    "dateFin": "2025-12-31"
  }'
```

### 5.3 Vérification

```sql
-- Vérifier les dépenses générées
SELECT 
  c.nom as categorie,
  COUNT(*) as nombre_mois,
  SUM(montant_prevu) as total_prevu
FROM tresorerie_depenses_mensuelles d
JOIN tresorerie_categories c ON d.categorie_id = c.id
WHERE d.est_automatique = true
GROUP BY c.nom
ORDER BY c.nom;

-- Vérifier les recettes générées
SELECT 
  DATE_TRUNC('month', mois) as mois,
  COUNT(*) as nb_etablissements,
  SUM(montant_prevu) as total_prevu
FROM tresorerie_recettes_mensuelles
WHERE statut = 'prevue'
GROUP BY DATE_TRUNC('month', mois)
ORDER BY mois;
```

## Phase 6 : Configuration des utilisateurs

### 6.1 Créer les rôles

```sql
-- Les rôles utilisent le type app_role et la table user_roles (PAS profiles.role)
-- Type existant : CREATE TYPE app_role AS ENUM ('admin', 'direction', 'chef_projet', 'csm', 'commercial', 'rh', 'user');

-- Assigner un rôle admin
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'admin@example.com';
```

### 6.2 Donner les permissions

```sql
-- Les permissions sont gérées via RLS et la fonction has_role()
-- Exemple : vérifier si l'utilisateur est admin
SELECT public.has_role(auth.uid(), 'admin');

-- Exemple : vérifier si l'utilisateur peut gérer les données RH
SELECT public.can_manage_rh_data();
```

## Phase 7 : Tests post-déploiement

### 7.1 Tests fonctionnels

Effectuer les tests suivants :

**Test 1 : Navigation**
- ✅ Tous les onglets sont accessibles
- ✅ Les raccourcis clavier fonctionnent
- ✅ Le responsive est correct

**Test 2 : Données RH**
- ✅ Le dashboard RH affiche les KPIs
- ✅ Les salaires sont listés correctement
- ✅ Les objectifs CA sont visibles
- ✅ Le planning des absences fonctionne

**Test 3 : Données Trésorerie**
- ✅ Le dashboard Trésorerie affiche les soldes
- ✅ Les recettes sont listées par établissement
- ✅ Les prévisions sont calculées correctement
- ✅ L'export Excel fonctionne

**Test 4 : Edge Functions**
- ✅ Génération des dépenses récurrentes
- ✅ Génération des recettes mensuelles
- ✅ Calcul automatique des charges

### 7.2 Tests de performance

```bash
# Tester la vitesse de chargement
curl -w "@curl-format.txt" -o /dev/null -s https://your-app.com/rh

# Mesurer le temps de génération
time curl -X POST https://your-project.supabase.co/functions/v1/generate-recurring-expenses \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"dateDebut":"2025-01-01","dateFin":"2025-12-31"}'
```

**Benchmarks attendus** :
- Time to First Byte (TTFB) : < 200ms
- First Contentful Paint (FCP) : < 1s
- Largest Contentful Paint (LCP) : < 2.5s
- Génération 12 mois de dépenses : < 5s

### 7.3 Tests de sécurité

```bash
# Vérifier les RLS policies
psql -h your-db-host -U postgres -d postgres -c "
  SELECT schemaname, tablename, policyname
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename LIKE 'tresorerie%'
  OR tablename LIKE 'rh_%';
"

# Tester l'accès non autorisé
curl -X GET https://your-project.supabase.co/rest/v1/tresorerie_recettes_mensuelles \
  -H "apikey: WRONG_KEY"
# Doit retourner 401
```

## Phase 8 : Monitoring et maintenance

### 8.1 Configuration du monitoring

**Sentry (erreurs frontend)** :
```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://your-dsn@sentry.io/project-id",
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
});
```

**Supabase Logs** :
- Dashboard Supabase → Logs
- Filtrer par service (Edge Functions, Database, Auth)
- Configurer des alertes pour les erreurs

### 8.2 Planification des tâches

**Tâches automatiques à configurer** :

1. **Génération mensuelle des dépenses** :
   - Fréquence : 1er jour du mois à 2h
   - Action : Appeler Edge Function
   - Monitoring : Vérifier le nombre de dépenses générées

2. **Génération trimestrielle des recettes** :
   - Fréquence : 1er jour du trimestre
   - Action : Appeler Edge Function
   - Monitoring : Comparer avec les contrats

3. **Archivage des données anciennes** :
   - Fréquence : Annuelle
   - Action : Déplacer données > 2 ans vers table archive
   - Monitoring : Taille de la base

**Configuration avec Supabase Cron** :

```sql
-- Exemple de cron job
SELECT cron.schedule(
  'generate-monthly-expenses',
  '0 2 1 * *', -- 1er du mois à 2h
  $$
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/generate-recurring-expenses',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body:=concat('{"dateDebut":"', date_trunc('month', now())::text, '","dateFin":"', (date_trunc('month', now()) + interval '1 month' - interval '1 day')::text, '"}')::jsonb
  );
  $$
);
```

### 8.3 Sauvegardes

**Base de données** :
```bash
# Backup manuel
pg_dump -h your-db-host -U postgres -d postgres \
  --schema=public \
  --table="tresorerie_*" \
  --table="rh_*" \
  > backup_$(date +%Y%m%d).sql

# Restauration
psql -h your-db-host -U postgres -d postgres < backup_20250115.sql
```

**Configuration des backups automatiques** :
- Supabase Dashboard → Settings → Backups
- Activer les backups quotidiens
- Rétention : 7 jours (gratuit) ou 30 jours (payant)

## Rollback et récupération

### En cas de problème

**1. Problème frontend** :
```bash
# Revenir au déploiement précédent
vercel rollback
# ou
netlify rollback
```

**2. Problème Edge Function** :
```bash
# Redéployer la version précédente
git checkout previous-commit
supabase functions deploy generate-recurring-expenses
```

**3. Problème de données** :
```sql
-- Restaurer depuis backup
BEGIN;
-- Supprimer les données erronées
DELETE FROM tresorerie_depenses_mensuelles 
WHERE created_at > '2025-01-15 10:00:00';
-- Restaurer depuis backup
\i backup_20250115.sql
COMMIT;
```

## Checklist finale

### Avant la mise en production

- [ ] Toutes les migrations DB sont appliquées
- [ ] Les Edge Functions sont déployées et testées
- [ ] Le frontend est build sans erreur
- [ ] Les variables d'environnement sont configurées
- [ ] Les RLS policies sont en place
- [ ] Les données initiales sont importées
- [ ] Les tests fonctionnels passent
- [ ] Les backups automatiques sont configurés
- [ ] Le monitoring est en place
- [ ] La documentation est à jour
- [ ] Les utilisateurs sont formés

### Après la mise en production

- [ ] Vérifier les logs pendant 24h
- [ ] Surveiller les performances
- [ ] Recueillir les retours utilisateurs
- [ ] Planifier les tâches récurrentes
- [ ] Documenter les problèmes rencontrés
- [ ] Mettre à jour le changelog

## Support

En cas de problème :

1. **Consulter les logs** :
   - Frontend : Console navigateur
   - Backend : Supabase Dashboard → Logs
   - Edge Functions : Supabase Dashboard → Edge Functions → Logs

2. **Vérifier la documentation** :
   - Guide utilisateur RH : `docs/RH_USER_GUIDE.md`
   - Guide technique RH : `docs/RH_TECH_GUIDE.md`
   - Guide utilisateur Trésorerie : `docs/TRESORERIE_USER_GUIDE.md`
   - Guide technique Trésorerie : `docs/TRESORERIE_TECH_GUIDE.md`

3. **Contacter l'équipe technique** :
   - Email : tech@company.com
   - Slack : #support-technique
   - Ticket : https://support.company.com

## Annexes

### A. Format curl-format.txt

Créer le fichier pour mesurer les performances :

```
time_namelookup:  %{time_namelookup}s\n
time_connect:  %{time_connect}s\n
time_appconnect:  %{time_appconnect}s\n
time_pretransfer:  %{time_pretransfer}s\n
time_redirect:  %{time_redirect}s\n
time_starttransfer:  %{time_starttransfer}s\n
----------\n
time_total:  %{time_total}s\n
```

### B. Commandes utiles

```bash
# Vérifier la version de Supabase CLI
supabase --version

# Lister les Edge Functions déployées
supabase functions list

# Voir les logs en temps réel
supabase functions logs generate-recurring-expenses --tail

# Tester les RLS policies
supabase test db
```
