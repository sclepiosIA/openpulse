# k6 Load Tests — CRM Hospitalier

Tests de charge k6 sur OpenPulse Gestion (CRM Hospitalier).
**Inspiré et patterns repris de POINT** (`/3-POINT/11-Repo-GitHub/k6/`), qui a 124 tests + infra mature.

## Structure

```
tests/load/
├── k6-smoke.js          # NEW — sanity 2 VUs / 30s
├── k6-spike.js          # NEW — burst 0→100 VUs en 30s, hold 1m
├── k6-soak.js           # NEW — endurance 10 VUs / 5m
├── k6-stress.js         # NEW — capacity 0→200 VUs / 10m
├── config/
│   ├── scenarios.js     # 8 profils (smoke, standard, stress, spike, soak, morning_peak, emergency_peak, night_shift)
│   └── slo_matrix.js    # SLO par criticité (CRITICAL/HIGH/STANDARD/LOW)
├── helpers/
│   ├── auth.js          # Pool 7 rôles (admin, csm, sales, rh, finance, dev, supervisor)
│   ├── supabase.js      # REST + Edge Functions
│   ├── assertions.js    # Helpers check()
│   ├── chaos.js         # Injection erreur
│   └── metrics.js       # Custom Trends
├── tests/               # tests modules métier détaillés
│   ├── 01_auth_load.js          # Login multi-rôle + profile + refresh
│   ├── 02_contacts_crud.js      # Liste 50 contacts + recherche + fiche détail
│   ├── 03_calendar_load.js      # Events du mois + filter by attendee
│   ├── 04_pulse_messaging.js    # Conversations + messages (Pulse messagerie interne)
│   └── 05_factures_export.js    # Factures + export PDF via Edge Function
└── run-suite.sh
```

## Suite standardisée (4 scénarios)

Les 4 fichiers `k6-*.js` à la racine de `tests/load/` couvrent les 4 profils
standards de l'application :

| Scénario       | Profil                    | Routes testées                          | Thresholds                        |
| -------------- | ------------------------- | --------------------------------------- | --------------------------------- |
| `k6-smoke.js`  | 2 VUs / 30s               | dashboard, pulse, etablissements, tasks | p95<1500ms · err<1% · checks>95%  |
| `k6-spike.js`  | 0→100 VUs en 30s, hold 1m | dashboard, etablissements, tasks        | p95<3000ms · err<10% · checks>85% |
| `k6-soak.js`   | 10 VUs / 5m               | dashboard, pulse, etablissements, tasks | p95<2000ms · err<5% · checks>95%  |
| `k6-stress.js` | 0→200 VUs / 10m           | dashboard, etablissements, tasks        | aucun (observation)               |

### Run rapide

```bash
source $HOME/outils-internes/.env

# Smoke (30s)
k6 run -e SUPABASE_URL=$MARQUE_BASE_URL \
       -e SUPABASE_ANON_KEY=$MARQUE_ANON_KEY \
       tests/load/k6-smoke.js

# Spike (2m)
k6 run -e SUPABASE_URL=$MARQUE_BASE_URL \
       -e SUPABASE_ANON_KEY=$MARQUE_ANON_KEY \
       tests/load/k6-spike.js

# Soak (5m)
k6 run -e SUPABASE_URL=$MARQUE_BASE_URL \
       -e SUPABASE_ANON_KEY=$MARQUE_ANON_KEY \
       tests/load/k6-soak.js

# Stress (10m)
k6 run -e SUPABASE_URL=$MARQUE_BASE_URL \
       -e SUPABASE_ANON_KEY=$MARQUE_ANON_KEY \
       tests/load/k6-stress.js

# Sans creds (sanity uniquement) :
K6_SKIP_AUTH=true k6 run -e SUPABASE_ANON_KEY=$MARQUE_ANON_KEY tests/load/k6-smoke.js
```

## Install

```bash
brew install k6
```

## Run

```bash
SUPABASE_URL="https://gestion.exploitant.example.org" \
SUPABASE_ANON_KEY="eyJ..." \
k6 run tests/load/tests/01_auth_load.js

# Profil stress
K6_SCENARIO=stress k6 run tests/load/tests/05_factures_export.js

# Tous les tests
./tests/load/run-suite.sh all smoke
```

## Comptes de test (7 rôles)

Voir `helpers/auth.js`. Couvre tous les rôles RBAC du CRM :

- `admin@`, `csm@`, `sales@`, `rh@`, `finance@`, `dev@`, `supervisor@`

Le mot de passe partagé n'est **jamais** stocké dans le repo. Fournissez-le au lancement :

```bash
k6 run -e TEST_PASSWORD_SHARED="<mot-de-passe>" tests/load/k6-smoke.js
# ou, sans credentials (mode anonyme) :
k6 run -e K6_SKIP_AUTH=true tests/load/k6-smoke.js
```

En CI, il est injecté via le secret `MARQUE_TEST_PASSWORD`.

## Tests critiques

Les 5 tests couvrent les modules à plus fort trafic :
| Module | Test | SLO p95 |
|---|---|---|
| Auth | 01 | 1.5s |
| Contacts | 02 | 2s |
| Calendar | 03 | 2.5s |
| Pulse | 04 | 2s |
| Factures + PDF | 05 | 5s (export 10s) |

## TODO ajouter

- 06_qonto_sync.js (intégration Qonto)
- 07_docuseal_signing.js (DocuSeal contracts)
- 08_realtime_pulse.js (WS subscription Pulse)

## CI integration

Pattern POINT `.github/workflows/k6-*.yml` à porter dans `.github/workflows/k6.yml` du CRM.
