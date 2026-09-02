# Plan d'amélioration de la suite de tests — 2026-07

> Source de vérité : `.editeur/plan.md` (plan approuvé). Ce document est la version committée pour navigation dans le repo.

## Baseline mesurée (07/07/2026)

| Périmètre | Volume | État |
|---|---|---|
| Tests front (Vitest) | 6 660 fichiers `.test.tsx?` | 74 `.skip/.todo` tracés, ratchet coverage `lines: 28 → 80` |
| Tests Edge (Deno) | 342 fichiers `_test.ts` | Couverture partielle des 255 edge functions, 10 fn critiques budgétées |
| Tests A11y (jest-axe) | 8 suites (Badge, Button, Card, Dashboard, Etablissements, ThemeToggle, Input, Dialog) | À étendre vers pages P0 |
| E2E (Playwright) | 162 specs (`tests/e2e/**`) + 2 template (`e2e/**`) | Smoke config < 15 min (13 specs P0) déjà en place |
| Mutation (Stryker) | Pilotes uniquement | À étendre modules critiques |
| CI workflows | 16 YAML | Résultats non consolidés |

## État d'avancement (S1 clos)

- [x] Plan committé : `docs/tests/PLAN_TESTS_2026-07.md`
- [x] Guide dev : `docs/tests/README.md`
- [x] Snapshot auto : `docs/tests/HEALTH.md` + `scripts/test-health.mjs`
- [x] Hygiène CI : `scripts/check-test-hygiene.mjs` intégré à `.github/workflows/ci.yml` (bloque `.only`)
- [x] Fixture auth E2E pré-mintée : `e2e/fixtures/auth.ts`
- [x] Template E2E : `e2e/dashboard.spec.ts`
- [x] A11y +2 suites : `Input`, `Dialog`
- [x] Stryker C6 étendu : `hooks-pulse`, `lib-pulse`, `components-facturation`, `offline-outbox`, `auth-provider` (via `STRYKER_MODULE=…`)


## Objectifs

1. Couverture front ≥ 90 % lignes / 85 % branches (ratchet mensuel).
2. Edge fn critiques ≥ 80 %.
3. 8 parcours E2E authentifiés (auth, dashboard, /etablissements, /pulse, /emails, /people, /tresorerie, /rd).
4. 0 `.only`, `skip/todo` tracés.
5. Mutation ≥ 60 % sur modules critiques.
6. CI plein ≤ 12 min via sharding.
7. Rapport unique consolidé par PR.

## Chantiers

- **C1** Hygiène : nettoyage `.only/.skip/.todo`, fusion `deep*` redondants, factories partagées.
- **C2** Coverage bloquante : ratchet mensuel, comment PR, HTML publié.
- **C3** Edge fn Deno : cartographie, helpers `_shared/test-utils.ts`, `deno coverage` ≥ 70 %.
- **C4** E2E Playwright : 8 specs P0, auth pré-mintée, desktop + mobile.
- **C5** A11y & responsive : `jest-axe` étendu, viewports 375/768/1280/1920.
- **C6** Mutation étendue : `src/lib/rls/`, `hooks/pulse/`, `offlineOutbox`, `facturation/`, `AuthProvider`.
- **C7** Perf & load : k6 scénarios ciblés, Lighthouse budgets bloquants.
- **C8** RLS matrix : rôles × tables, tests contract SECURITY DEFINER whitelistées.
- **C9** Observabilité : `HEALTH.md` auto-généré, détecteur flakiness, badges README.
- **C10** DX & docs : template, snippets, pre-commit `vitest related`.

## Roadmap

```text
S1  C1 hygiène + C2 seuils coverage
S2  C2 gap-fill + C3 edge coverage + C4 E2E (4 specs)
S3  C4 E2E (4 specs restants) + C5 a11y/responsive + C6 mutation étendu
S4  C7 perf + C8 RLS matrix + C9 observabilité + C10 docs
```

## Livrables

- `docs/tests/PLAN_TESTS_2026-07.md` — ce plan
- `docs/tests/README.md` — guide dev « quel type de test écrire »
- `docs/tests/HEALTH.md` — état auto-généré (script `scripts/test-health.mjs`)
- `scripts/check-test-hygiene.mjs` — détecte `.only`, liste `.skip/.todo`
- `e2e/fixtures/auth.ts` — session Supabase pré-mintée
- 8 specs Playwright P0 dans `e2e/`
- Coverage HTML artefact CI + comment PR

## Hors périmètre

- Réécriture des tests verts.
- Changement de runner.
- Tests visuels type Chromatic/Percy (à évaluer S+5).
