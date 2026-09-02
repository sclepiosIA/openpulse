# Scoring comportemental & Attribution multi-touch

Module de scoring des prospects basé sur des signaux comportementaux temporels avec décroissance exponentielle, et attribution multi-touch des canaux contributeurs.

## Architecture

### Score total (0-100)
```
score_total = static_score (0-50) + behavioral_score (0-50)
```

- **Static score** : score historique calculé par `prospect-scoring-tools.ts` (7 facteurs : taille établissement, secteur, phase pipeline, ancienneté contact, etc.) → ramené à /50.
- **Behavioral score** : agrégation pondérée des événements comportementaux des 90 derniers jours avec décroissance exponentielle.

### Formule de décroissance
```
score_brut = Σ (weight_event × e^(-Δjours / decay_days))
behavioral_score = min(50, max(0, round(score_brut)))
```

Avec `decay_days = 30` par défaut (configurable via `app_config.prospect_scoring_weights`).

### Vélocité d'engagement
```
velocity = poids_evenements_7j - poids_evenements_(14j..7j)
```
Indique si le prospect monte (`+`) ou descend (`-`) en intensité.

## Tables

| Table | Rôle |
|-------|------|
| `prospect_behavioral_events` | Événements comportementaux unitaires (event_type enum + weight + occurred_at + source) |
| `prospect_score_history` | Snapshots quotidiens (créés par cron `recompute-prospect-scores`) |
| `attribution_touchpoints` | Points de contact par canal (email, RDV, appel, parrainage…) |

Colonnes ajoutées sur `etablissements` : `behavioral_score`, `engagement_velocity`, `last_engagement_at`, `attribution_summary`.

## Événements trackés

| Type | Poids défaut | Source |
|------|--------------|--------|
| `email_opened` | 1 | Tracking pixels (à activer) |
| `email_clicked` | 3 | Tracking liens (à activer) |
| `email_replied` | 5 | Trigger `trg_email_messages_behavioral` |
| `quick_response` | 7 | Réponse < 4h après outbound |
| `meeting_attended` | 10 | Trigger `trg_calendar_events_behavioral` |
| `meeting_no_show` | -5 | Trigger calendar (status `no_show`/`cancelled`) |
| `task_completed` | 2 | Trigger `trg_taches_behavioral` (statut = `Terminé`) |
| `document_viewed` | 2 | À implémenter (GED viewer) |

Poids modifiables via `app_config.prospect_scoring_weights.behavioral`.

## Triggers SQL automatiques

- `trg_email_messages_behavioral` : insertion email inbound → événement `email_replied` (+ `quick_response` si délai < 4h)
- `trg_calendar_events_behavioral` : passage status RDV → `meeting_attended` ou `meeting_no_show`
- `trg_taches_behavioral` : tâche passe à `Terminé` → `task_completed`
- `trg_email_attribution` / `trg_calendar_attribution` : création automatique des touchpoints attribution

Tous les triggers sont **idempotents** via `record_behavioral_event()` qui dédoublonne sur `(source_id, source_type, event_type)`.

## RPCs publiques

### `compute_behavioral_score(etab_id) → jsonb`
```json
{
  "behavioral_score": 32,
  "engagement_velocity": 4.5,
  "last_event_at": "2026-04-15T14:23:00Z",
  "raw_score": 32.18
}
```

### `compute_attribution(etab_id, model) → jsonb`
Modèles supportés : `first_touch`, `last_touch`, `linear`, `time_decay` (par défaut).
```json
{
  "model": "time_decay",
  "by_channel": { "email_outbound": 12.4, "meeting": 8.1, "email_inbound": 5.2 },
  "by_user": { "uuid-commercial-1": 15.3 },
  "first_touch": { "channel": "email_outbound", "occurred_at": "...", "user_id": "..." },
  "last_touch": { "channel": "meeting", "occurred_at": "...", "user_id": "..." }
}
```

## Edge functions

| Function | Rôle | Fréquence |
|----------|------|-----------|
| `recompute-prospect-scores` | Recalcule les scores + insère snapshots quotidiens | Cron `0 2 * * *` (02:00 Paris) |

## UI

- **Page `/prospects/scoring`** (admin/direction/commercial) : KPIs (chauds/tièdes/à travailler/froids), top vélocité, table complète.
- **Composant `<BehavioralScoreCard>`** : décomposition statique vs comportemental (donut), vélocité, dernier signal — à intégrer dans la fiche établissement.
- **Composant `<BehavioralEventsTimeline>`** : timeline chronologique des 20 derniers événements.
- **Composant `<ScoreEvolutionChart>`** : graphique 30/90j depuis `prospect_score_history`.
- **Composant `<AttributionFunnel>`** : barres horizontales par canal + first/last touch.

## Configuration

Stockée dans `app_config` clé `prospect_scoring_weights`, modifiable via `useAppConfig` :
```json
{
  "behavioral": { "email_opened": 1, "email_clicked": 3, "email_replied": 5,
                  "meeting_attended": 10, "meeting_no_show": -5,
                  "quick_response": 7, "task_completed": 2, "document_viewed": 2 },
  "decay_days": 30,
  "attribution_model": "time_decay"
}
```

## Backfill initial

Au déploiement, la migration rejoue les 90 derniers jours :
- Tous les emails inbound → événements `email_replied`
- Toutes les tâches `Terminé` → événements `task_completed`
- Tous les emails (in/out) → touchpoints attribution
- Tous les RDV → touchpoints attribution

Les RDV ne sont pas backfillés en `meeting_attended` (statut historique non fiable).

## Limitations connues

- Pas de tracking d'ouverture email natif (colonne `opened_at` absente). À ajouter quand un système de tracking pixel sera en place.
- Pas encore de tracking de clic sur lien (colonne `clicked_at` à créer).
- Pas de tracking de visualisation de documents GED.

## Intégration UI

- **Onglet "Scoring"** dans la fiche établissement (catégorie Communication) : `<BehavioralScoreCard>` + `<ScoreEvolutionChart>` + `<AttributionFunnel>` + `<BehavioralEventsTimeline>`.
- **`<ProspectScoreBadge>`** enrichi : tooltip détaille score statique + comportemental + vélocité (↗ +X/sem, ↘ -Y/sem, — stable). Flèche dans le badge dès que |velocity| ≥ 0.5.
- **Page `/prospects/scoring`** : KPIs, top mouvements (vélocité), table complète avec lien vers fiche.
- **Cron** : `recompute-prospect-scores` (planifier dans pg_cron à 02:00 Paris) — voir `supabase/functions/recompute-prospect-scores/index.ts`.

## Activation du cron

À exécuter manuellement dans le SQL editor (contient l'anon key) :

```sql
select cron.schedule(
  'recompute-prospect-scores-daily',
  '0 2 * * *',
  $$ select net.http_post(
    url:='https://your-project-ref.supabase.co/functions/v1/recompute-prospect-scores',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
    body:='{}'::jsonb
  ); $$
);
```
