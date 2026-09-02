# Plan de stabilisation globale — OpenPulse

État consolidé (mise à jour vivante). Version approuvée : `.editeur/plan.md`.

## Chantier 1 — Service Worker (P0)

- [x] `src/sw.ts` archivé → `src/_archive/sw.ts.archived` (source unique = `public/sw.js`).
- [x] `useServiceWorker.ts` : guards preview/iframe/`?sw=off` déjà présents.
- [ ] Test Playwright post-register + subscription push.
- [ ] Table `sw_events` pour observer register/subscribe.

## Chantier 2 — Garde-fous runtime front (P0)

- [x] `queryDefaults` centralisés (`src/lib/queryDefaults.ts`).
- [x] Rapport `<PageDataState>` (`scripts/audit-page-data-state.mjs`, en CI).
- [x] ErrorBoundary sur les 8 groupes de routes (`src/routes/groups/*`).
- [x] Audit numérique + fixes : `safeNum()` sur 27 accès dans 8 fichiers. Score audit 34 → 7 (restants = wrappés `Math.abs/round`, non-crashants).

## Chantier 3 — Realtime & React Query (P1)

- [x] `scripts/audit-realtime-subscriptions.mjs` (0 leak, bloquant en CI).
- [x] Hook `useRealtimeChannel` (`src/hooks/system/useRealtimeChannel.ts`).
- [ ] Migration progressive des canaux existants vers ce hook (non urgent).

## Chantier 4 — Edge Functions (P1)

- [x] Wrappers Azure existants (`_shared/azure-gpt5-template.ts`, `azure-gpt5-mini.ts`, `azure-gpt52.ts`).
- [x] `_shared/error-sanitizer.ts` en place, budgets CI actifs.
- [ ] Métriques `edge_metrics` + panel Monitor.
- [ ] Tests Deno pour les 20 edge critiques.

## Chantier 5 — Build & publish (P1)

- [x] 12 fichiers migrés vers `lazyWithRetry` + `scripts/audit-lazy-imports.mjs` (bloquant en CI).
- [x] Budget bundle `scripts/check-bundle-size.ts` + baseline `.bundle-baseline.json` déjà en place.
- [ ] Smoke Playwright bloquant avant publish.

## Chantier 6 — DB & RLS (P2)

- [ ] `supabase--linter` bloquant en CI.
- [ ] Fixtures RLS positives manquantes.
- [ ] Migration JWT HS256 → RS256 (fenêtre planifiée, cf. `INFRA_ACTIONS_PENDING.md`).

## Livrables mesurables (état)

- Audits stabilité câblés en CI : Realtime (bloquant), lazy (bloquant), numeric (rapport), PageDataState (rapport).
- 0 fuite Realtime détectée aujourd'hui.
- 100 % des lazy imports passent par `lazyWithRetry`.
- 27 hotspots numériques durcis avec `safeNum`.
- ErrorBoundary présent sur chaque route des 8 groupes.

## Restes à faire (P1/P2)

1. Test Playwright de smoke + verif push subscription (Chantier 1 & 5).
2. Table `sw_events` + panel Monitor `edge_metrics` (Chantier 1 & 4).
3. Tests Deno additionnels sur les edge critiques (Chantier 4).
4. `supabase--linter` bloquant + fixtures RLS positives (Chantier 6).
5. Migration JWT RS256 (fenêtre ops, hors code).
