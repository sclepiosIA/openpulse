# Modules livrés — Récapitulatif global (P1 → P10)

Index synthétique de tous les modules majeurs livrés dans le cadre du plan de modernisation CRM. Pour chaque module : statut, route, rôle requis, RPCs principales, fichiers clés et lien vers la doc dédiée.

---

## Vue d'ensemble

| #   | Module                          | Route                    | Rôle requis        | Statut     | Doc |
|----:|---------------------------------|--------------------------|--------------------|------------|-----|
| P1  | Sales Forecasting               | `/forecasting`           | direction, admin   | ✅ Livré   | `mem://features/forecasting/sales-forecast-module` |
| P2  | Workflow Builder                | `/automatisations`       | direction, admin   | ✅ Livré   | `mem://features/automation/workflow-builder` |
| P3  | Signature électronique          | onglet contrats          | commercial, csm    | ✅ Livré   | `mem://features/contrats/signature-electronique-docuseal` |
| P4  | Catalogue produits              | `/catalogue-produits`    | direction, commercial | ✅ Livré | `mem://features/catalogue/produits-services` |
| P5  | Custom Dashboards / Reporting   | `/rapports-custom`       | tous authenticated | ✅ Livré   | `mem://features/reporting/custom-dashboards` |
| P6  | Scoring comportemental + attribution | `/prospects/scoring` | direction, commercial | ✅ Livré | `mem://features/prospects/behavioral-scoring-and-attribution` |
| P7  | Briefing quotidien Jarvis       | push 8h00                | tous authenticated | ✅ Livré   | `mem://features/ai/jarvis/daily-proactive-briefing` |
| P8  | (réservé)                       | —                        | —                  | —          | — |
| P9  | Activity Feed global            | `/activite`              | tous authenticated | ✅ Livré   | [`docs/activity-feed.md`](./activity-feed.md) |
| P10 | Gamification commerciale        | `/gamification`          | direction, admin   | ✅ Livré   | [`docs/gamification.md`](./gamification.md) |
| P11 | Social Dashboard multi-marques  | `/social`                | direction, commercial, marketing | ✅ Livré (16 mai 2026) | [`docs/SOCIAL_DASHBOARD_USER_GUIDE.md`](./SOCIAL_DASHBOARD_USER_GUIDE.md) |

---

## Détail par module

### P1 — Sales Forecasting
- **RPC principale** : `get_sales_forecast(p_period, p_commercial_id?)`
- **Vues** : trimestre / commercial / phase, pondération par probabilité de statut.
- **Page** : `src/pages/Forecasting.tsx`

### P2 — Workflow Builder
- **Tables** : `workflows`, `workflow_runs`, `workflow_schedules`, `workflow_queue`.
- **Moteur visuel** React Flow « si X alors Y ».
- **Triggers** : DB triggers + cron pour exécutions différées.
- **Page** : `src/pages/Automatisations.tsx`

### P3 — Signature électronique (DocuSeal)
- **Tables** : `signature_requests`, `signature_events`.
- **Sécurité** : hash SHA-256 du contrat, webhook HMAC, archivage Storage.
- **Cron** : relances automatiques J+3.
- **Composants** : `src/components/contrats/SignaturePanel.tsx`

### P4 — Catalogue produits
- **CRUD** direction + commercial.
- **RPC** : `get_catalogue_stats`.
- **Composant réutilisable** : `<ProduitSelector />` dans devis et factures.
- **Import/export** : CSV.
- **Page** : `src/pages/CatalogueProduits.tsx`

### P5 — Custom Dashboards
- **Builder** drag/drop `react-grid-layout`.
- **RPC** : `get_report_data` avec whitelist de 15 sources.
- **Export** : PDF + XLSX.
- **Page** : `src/pages/RapportsCustom.tsx`

### P6 — Scoring comportemental + attribution
- **Tables** : `prospect_behavioral_events`, `attribution_touchpoints`.
- **RPCs** : `compute_behavioral_score` (decay 30 j), `compute_attribution` (modèle time-decay).
- **Score hybride** : 0-100 = statique (0-50, 7 facteurs) + comportemental (0-50, decay exponentiel).
- **Tool Jarvis** : `score_prospects`.
- **Page** : `src/pages/ProspectScoring.tsx`

### P7 — Briefing quotidien Jarvis
- **Cadence** : push notification chaque matin 8h00 Paris.
- **Edge function** : `jarvis-daily-briefing`.
- **Contenu** : RDV du jour, tâches en retard, alertes CSM, deals à signer.

### P9 — Activity Feed global
- **RPC** : `get_global_activity_feed(p_limit, p_cursor, p_filters)`.
- **8 sources actives** (depuis 17/04/2026) : `interactions`, `taches`, `calendar_events`, `email_messages` (inbound), `devis`, `factures`, `signature_requests`, `workflow_runs` (UNION ALL).
- **Hook** : `useGlobalActivityFeed` (infinite scroll cursor-based + realtime debounced 2 s).
- **Widget dashboard** : `RecentActivityWidget` (id `global_activity_feed`).
- **Index dédiés** : `idx_email_messages_received_date`, `idx_devis_created_at`, `idx_factures_created_at`, `idx_signature_requests_completed_at`, `idx_workflow_runs_finished_at`.
- **Doc complète** : [`docs/activity-feed.md`](./activity-feed.md).

### P10 — Gamification commerciale
- **5 tables** : badges, user_badges, challenges, participants, user_stats.
- **4 RPCs** : `get_leaderboard`, `get_user_gamification`, `compute_gamification_points`, `unlock_badges`.
- **Cron actif** : `recompute-gamification-hourly` (HH:15) → edge function `recompute-gamification` → recalcul points + déblocage badges pour chaque profil actif.
- **Seed** : 8 badges + 3 challenges actifs.
- **Widgets dashboard** : `MyGamificationWidget`, `MiniLeaderboardWidget`.
- **Realtime** : `BadgeUnlockToast` global avec confetti tier-coloré.
- **Doc complète** : [`docs/gamification.md`](./gamification.md).

---

## Conventions transverses

- **Auth** : toutes les RPCs vérifient `auth.uid() IS NOT NULL`.
- **Sécurité** : `SECURITY DEFINER` + `SET search_path = public, pg_temp`.
- **Realtime** : `invalidateQueries` debouncé (≥ 2 s) pour éviter les avalanches.
- **Tests** : couverture Vitest sur les hooks critiques (cf. `src/hooks/__tests__/`).
- **Documentation** : chaque module a sa fiche `docs/` et/ou sa mémoire `mem://features/<domaine>/<nom>`.

---

## Onboarding développeur

1. Lire `docs/api-backend.md` pour le panorama RPCs / Edge Functions.
2. Lire `docs/MODULES.md` (ce fichier) pour la cartographie fonctionnelle.
3. Pour chaque module : ouvrir la doc dédiée + le fichier `src/pages/<Module>.tsx` correspondant.
4. Vérifier les mémoires actives via `mem://index.md` avant toute évolution structurelle.
