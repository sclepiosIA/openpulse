# Test Health — 2026-07-07

## Inventaire

| Suite | Fichiers |
|---|---:|
| Vitest front (`src/**`) | 6660 |
| Deno edge functions | 342 |
| A11y (jest-axe) | 8 |
| E2E Playwright | 162 (racine: 2, tests/e2e: 160) |

## Couverture front

_Aucun `coverage/coverage-summary.json` — lancer `bun run test:coverage`._

## Hygiène

Voir `docs/tests/HYGIENE.md` (généré par `node scripts/check-test-hygiene.mjs --report`).

## Objectifs (voir PLAN_TESTS_2026-07.md)

- Lines ≥ 90 %, Branches ≥ 85 %
- E2E : 8 parcours P0 authentifiés (actuel : 162)
- Edge fn critiques ≥ 80 %
- Mutation ≥ 60 % sur modules critiques
