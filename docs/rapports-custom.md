# Module Rapports personnalisés — Custom Dashboard Builder

Builder visuel de tableaux de bord (`/rapports-custom`) — distinct du module `/rapports` existant.

## Architecture

- **Tables** : `custom_dashboards` (layout JSONB + widgets JSONB), `custom_dashboard_exports` (planification + envoi auto)
- **RPC** : `get_report_data(source_key, params jsonb)` — registry whitelisté de 15 sources
- **Edge function** : `report-export` (PDF HTML imprimable ou XLSX, upload vers `reports-exports`, signed URL 1h, envoi mail si planifié)
- **Cron** : `process_scheduled_report_exports` toutes les 15 min via `pg_cron`
- **Librairie grille** : `react-grid-layout` (drag/resize natif)

## Routes

- `/rapports-custom` — liste + templates
- `/rapports-custom/:id` — vue lecture + filtres globaux + export + planification + partage
- `/rapports-custom/:id/edit` — builder 3 colonnes (bibliothèque · canvas · config)

## Widgets disponibles

KPI, BarChart, LineChart, Donut, Table, Funnel, Markdown — tous pilotés par la même config (`source` + `dimension` + `measure`). Dans le builder, chaque widget peut être **dupliqué** ou **supprimé** depuis le panneau de configuration (boutons en haut à droite).

### États visuels uniformes

Tous les widgets data partagent les mêmes états (`WidgetEmptyState`) :
- **Source non configurée** : icône `Settings2` + message « Configurer une source… »
- **Chargement** : `Skeleton` plein cadre
- **Erreur** : message rouge concis
- **Aucune donnée** : icône `Inbox` + message « Aucune donnée pour cette période »

## Recherche & filtrage

La page liste `/rapports-custom` propose une **barre de recherche** (nom + description) qui filtre simultanément les modèles pré-livrés et les rapports personnels.

## Planification d'envoi automatique

Composant `ScheduleDialog` (bouton "Planifier" sur la vue lecture) :
- Fréquence : quotidienne / hebdomadaire / mensuelle
- Heure UTC, jour de semaine ou jour du mois
- Liste de destinataires (emails)
- Format : PDF ou XLSX

Le cron `process_scheduled_report_exports` (15 min) appelle `report-export` via `pg_net`, génère le fichier, l'upload, signe l'URL (1h) et l'envoie via `send-email`. Statut tracé dans `custom_dashboard_exports.last_status` / `error_message`.

## Limites

- 50 dashboards / utilisateur (trigger SQL)
- 30 widgets / dashboard (CHECK constraint)
- 50 exports planifiés traités par run de cron

## Sécurité

- RLS dashboards : owner OR `auth.uid() = ANY(shared_with)` OR `is_template`
- RLS exports planifiés : owner du dashboard ou admin
- RPC `get_report_data` : `SECURITY DEFINER`, whitelist stricte, `mrr_evolution` réservé direction
- Export interactif : RLS appliquée (JWT utilisateur)
- Export planifié : service role (le cron a déjà validé l'ownership), URL signée 1h

## Deeplinks

- Page `/forecasting` : bouton "Rapports" qui ouvre `/rapports-custom`
- Dashboard Direction (`/`) : bouton "Rapports" dans la toolbar du hero
- Sidebar section Direction : entrée "Rapports personnalisés"

## Templates pré-livrés (seed SQL idempotent)

4 modèles `is_template = true` sont seedés en migration et visibles par tous les utilisateurs (RLS) :

1. **Pipeline mensuel direction** — KPI pondéré + Bar par phase + Table top deals
2. **Activité commerciale** — Line deals/sem + Funnel conversion + Table par commercial
3. **MRR / ARR évolution** — KPI MRR/ARR + Line 12 mois + Donut par segment
4. **Production & Onboarding** — KPI clients prod + Funnel déploiement + Table comptes bloqués

Bouton "Utiliser" sur chaque carte → duplique le template dans l'espace personnel via `useDuplicateDashboard`.

## Ajout d'une nouvelle source

1. Ajouter le `WHEN '...' THEN` dans la fonction `get_report_data` (migration SQL)
2. Ajouter l'entrée dans `REPORT_SOURCES` (`src/types/report.ts`)
