# Sales Forecasting (pipeline pondéré)

Module de prévision des ventes basé sur la pondération automatique de la valeur du pipeline par la probabilité de closing de chaque statut, avec comparaison aux objectifs commerciaux.

## Accès

- Route : `/forecasting`
- Sidebar : section **Direction** → **Forecasting** (icône `TrendingUp`)
- Permissions : rôles `admin`, `direction`, `commercial` (`RouteGuard` + contrôle SQL dans la RPC)

## Source de données

- **Valeurs des deals** : calculées par la même formule que `get_pipeline_breakdown` (cohérence avec le pipeline existant) :
  - `modele_statique_succes` si défini, sinon
  - `nombre_passages_urgences_annuel × multiplicateur(pallier_vise)` (Pallier 1 = 2.5 → Pallier 4 = 4.0), sinon
  - `nombre_passages_urgences_annuel × 1.5` par défaut.
- **Date de closing** : `date_previsionnelle_signature` → fallback `date_signature` → fallback `updated_at`.
- **Probabilité par statut** : stockée dans `reference_data.metadata.probability` pour le type `statut_etablissement`.
- **Objectifs** : agrégés depuis `objectifs_commerciaux` (cible_ca par trimestre, sommée tous commerciaux confondus). Seules les lignes au niveau trimestre (`trimestre IS NOT NULL AND mois IS NULL`) sont prises en compte.

### Probabilités par statut (par défaut)

| Statut | Probabilité |
|---|---|
| `prospect` | 10% |
| `contacte` | 15% |
| `attente_rdv` | 20% |
| `rdv_pris` | 30% |
| `dans_les_rdv` | 35% |
| `attente_post_rdv` | 40% |
| `etude_emise` | 50% |
| `negociation` | 65% |
| `contractualisation` | 85% |
| `contractuel` | 95% |
| `vendu` / `conformite` / `deploiement` / `formation` / `go_live` / `production` | 100% (gagné) |
| `reporte` | 25% |
| `bloque` / `suspendu` / `refus` | 0% |

> Pour ajuster :
> `UPDATE reference_data SET metadata = metadata || jsonb_build_object('probability', X) WHERE type='statut_etablissement' AND code='...';`

## RPC `get_sales_forecast(p_start date, p_end date)`

`SECURITY DEFINER`, lève `Forbidden` si l'appelant n'a pas un des rôles `admin`/`direction`/`commercial`.

Retourne un objet JSON :

```json
{
  "range": { "start": "2026-01-01", "end": "2026-12-31" },
  "kpis": {
    "pipeline_raw": 0,
    "pipeline_weighted": 0,
    "current_quarter": 0,
    "next_quarter": 0,
    "won_total": 0,
    "target_total": 0,
    "current_quarter_target": 0
  },
  "by_quarter":   [{ "quarter": "2026-Q2", "raw": 0, "weighted": 0, "won": 0, "target": 0, "count": 0 }],
  "by_commercial":[{ "user_id": "uuid", "display_name": "...", "raw": 0, "weighted": 0, "won": 0, "deals_count": 0 }],
  "by_phase":     [{ "statut": "negociation", "probability": 65, "raw": 0, "weighted": 0, "count": 0 }],
  "top_deals":    [{ "id": "uuid", "nom": "...", "statut": "negociation", "probability": 65,
                    "deal_value": 0, "weighted_value": 0, "closing_date": "2026-06-30" }]
}
```

Les deals à 100% (gagnés) sont **exclus** du pipeline pondéré et des breakdowns by_phase / by_commercial (raw/weighted), mais comptabilisés dans `kpis.won_total`, `by_quarter[].won` et `by_commercial[].won`.

`top_deals` retourne les 10 deals avec la plus forte valeur pondérée (probabilité strictement entre 0 et 100, valeur > 0).

## Frontend

| Fichier | Rôle |
|---|---|
| `src/hooks/useSalesForecast.ts` | Hook React Query (staleTime 5 min). Ranges : `current_quarter`, `next_quarter`, `year`, `rolling_12`. Format dates en local pour éviter les bugs UTC. |
| `src/pages/Forecasting.tsx` | Page (header immersif, sélecteur range, 4 KPIs, 4 onglets, export CSV UTF-8 BOM). |
| `src/components/forecasting/ForecastKPIs.tsx` | Cartes KPI avec barre de progression vs objectif trimestre. |
| `src/components/forecasting/ForecastByQuarter.tsx` | ComposedChart Recharts : barres brut/pondéré/gagné + courbe objectif. |
| `src/components/forecasting/ForecastByCommercial.tsx` | Tableau responsive trié par pondéré décroissant (colonnes adaptatives). |
| `src/components/forecasting/ForecastByPhase.tsx` | Funnel par statut avec badge probabilité et progress bar. |
| `src/components/forecasting/ForecastTopDeals.tsx` | Top 10 deals cliquables vers la fiche établissement. |

## Conformité ADR-001

L'intégralité des calculs (pondération, agrégations par trimestre/commercial/phase, KPIs, attente d'objectif) est exécutée côté serveur dans la RPC PostgreSQL `get_sales_forecast`. Le frontend ne fait que la mise en forme et le formatage monétaire/date.

## Export CSV

Bouton « Export CSV » dans le header : génère localement un fichier `forecast-<range>-<date>.csv` avec BOM UTF-8 (compatibilité Excel) regroupant les 4 sections (trimestres, commerciaux, phases, top deals).

## Responsivité

- Header : actions empilées verticalement < sm via le composant `ImmersivePageHeader`.
- KPIs : 1 / 2 / 4 colonnes (mobile / tablet / desktop).
- Tableaux : colonnes secondaires masquées sous `sm` / `md` / `lg` selon utilité, avec `overflow-x-auto` en fallback.
- Bouton export : icône seule en mobile, libellé complet en desktop.
