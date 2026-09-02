# API Backend — RPCs et Edge Functions

> Documentation des fonctions backend Supabase utilisées par le front OpenPulse.

---

## RPCs PostgreSQL

### `get_email_analytics(p_days integer DEFAULT 30)`
- **Description** : Agrège le volume d'emails quotidien, métriques commerciales, qualité IA et threads récents.
- **Rôle requis** : `authenticated`
- **Retour** : JSON avec `daily_volume`, `commercial_metrics`, `ai_quality`, `recent_threads`

### `get_ai_usage_stats(p_days integer DEFAULT 30)`
- **Description** : Agrège KPIs IA, stats par type/modèle, séries quotidiennes, top erreurs, top consumers. Pricing calculé côté serveur.
- **Rôle requis** : `authenticated`
- **Retour** : JSON avec `kpis`, `by_type`, `by_model`, `daily_series`, `top_errors`, `top_consumers`

### `get_global_formation_analytics()`
- **Description** : Analytics de formation globales. Élimine le pattern N+1 (Promise.all par établissement).
- **Rôle requis** : `authenticated`
- **Retour** : JSON avec KPIs par établissement, taux de complétion, scores

### `get_analytics_overview()`
- **Description** : KPIs analytics globaux (établissements, risque churn, alertes, upsell, CA).
- **Rôle requis** : `authenticated`
- **Retour** : JSON `{ total_etablissements, high_risk_count, ..., forecasted_ca }`

### `get_system_stats()`
- **Description** : Statistiques système (total users, active users, tasks, establishments).
- **Rôle requis** : `authenticated`
- **Retour** : JSON `{ total_users, active_users, total_establishments, total_tasks, completed_tasks }`

### `get_db_stats()`
- **Description** : Taille de la base de données.
- **Rôle requis** : `authenticated`
- **Retour** : `[{ storage_size }]`

### `get_dashboard_overview(...)`
- **Description** : Vue dashboard principale avec pipeline, tâches, KPIs.
- **Rôle requis** : `authenticated`
- **Retour** : JSON structuré

### `has_role(user_id uuid, role app_role)`
- **Description** : Vérifie si un utilisateur a un rôle donné. SECURITY DEFINER.
- **Rôle requis** : Interne (utilisé par RLS)
- **⚠️** : Surchargée — ne pas appeler via RPC PostgREST. Utiliser requête directe `user_roles`.

### `has_admin_role_strict(user_id uuid)`
- **Description** : Vérifie admin avec 2FA obligatoire.
- **Rôle requis** : Interne (utilisé par RLS)

---

## Edge Functions principales

| Fonction | Description | Auth | Paramètres GPT-5 |
|----------|-------------|------|-------------------|
| `process-email-with-ai` | Classification et extraction d'emails | JWT | `low`, `low`, 3000 |
| `generate-thread-title` | Titre IA pour conversations email | JWT | `low`, `low`, 100 |
| `correct-spelling-email` | Correction orthographique | JWT | `low`, `low`, 4000 |
| `reformulate-email` | Reformulation professionnelle | JWT | `low`, `medium`, 2000 |
| `suggest-email-content` | Suggestions de contenu | JWT | `low`, `low`, 2000 |
| `translate-email` | Traduction | JWT | `low`, `low`, 3000 |
| `generate-ai-suggestions` | Suggestions CRM | JWT | `low`, `low`, 2000 |
| `analyze-rapports-insights` | Analyse tendances/anomalies | JWT | `medium`, `medium`, 3000 |
| `parse-bulletin-salaire` | Extraction bulletins de paie | JWT | `medium`, `medium`, 3000 |
| `rd-ai-assist` | Assistance R&D agile | JWT | `low`, `low`, 2000 |
| `analyze-medical-economic-study` | Études médico-économiques | JWT | `high`, `high`, 4000 |
| `jarvis-brain` | Orchestrateur Jarvis (outils) | JWT | Variable |
| `jarvis-brain-stream` | Streaming SSE Jarvis | JWT | Variable |
| `hourly-email-sync-and-analysis` | CRON sync emails + analyse IA | Service | Variable |
| `sync-emails` | Synchronisation IMAP | Service | N/A |
| `meeting-notes-process` | Transcription + analyse réunions | JWT | `medium`, `medium` |
| `webdav-server` | Accès WebDAV documents | Basic | N/A |
| `nextcloud-import` | Import arborescence Nextcloud | JWT | N/A |

---

## Tables de configuration gouvernées

| Table | Description | RLS |
|-------|-------------|-----|
| `kb_result_metrics` | Chiffres commerciaux gouvernés (ROI, gains) | SELECT: authenticated + published / ALL: admin |
| `ai_agents_config` | Configuration agents Jarvis | SELECT: authenticated + active / ALL: admin |
| `ai_tools_config` | Définitions outils Jarvis | SELECT: authenticated + active / ALL: admin |
| `app_config` | Configuration applicative (clé-valeur) | Authenticated |
| `reference_data` | Données de référence (statuts, types, phases) | Authenticated |

---

## Conventions

- **Paramètres GPT-5** : `reasoning_effort` au premier niveau (`low`/`medium`/`high`), jamais `minimal`
- **Timeout** : 90s via `AbortController` sur tous les appels Azure
- **Retry** : Simple retry sur 429 avec backoff 1s
- **Extraction** : `choices[0].message.content` uniquement
- **RPC surchargées** : `has_role` ne fonctionne pas via PostgREST RPC — utiliser requête directe
