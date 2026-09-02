# Guide des tests — OpenPulse

## Quel test écrire ?

```text
Un composant présentation isolé (pas de RPC, pas d'auth)
  → Test unitaire RTL dans `src/**/Component.test.tsx`

Un hook métier (RPC, react-query, cache)
  → Test unitaire avec `renderHook` + mocks Supabase dans `src/**/hook.test.ts`

Une edge function Deno
  → Test Deno dans `supabase/functions/<fn>/_test.ts` (dotenv + `_shared/test-utils`)

Un parcours utilisateur multi-pages (login → action → assertion)
  → E2E Playwright dans `e2e/<parcours>.spec.ts` (auth pré-mintée via fixture)

Une page complète (a11y, contraste, navigation clavier)
  → `tests/a11y/<Page>.test.tsx` avec `jest-axe` (config `vitest-a11y.config.ts`)

Un scénario de charge / P95
  → `tests/load/*.k6.js` + `run-suite.sh`

Un scénario mutation (killer test)
  → Étendre `stryker.config.mjs` sur le module critique
```

## Conventions

- **Fichiers** : `Component.test.tsx` à côté du composant, ou dans `__tests__/`.
- **Factories** : centraliser fixtures dans `src/test/factories/*.ts` (pas de duplication).
- **Mocks Supabase** : utiliser les helpers existants (`src/test-setup.ts`) — ne pas mocker à la main.
- **Interdit en CI** :
  - `.only(` — bloqué par `scripts/check-test-hygiene.mjs`
  - Données mockées dans le code de prod (règle projet)
- **Skip / Todo** : autorisé mais doit être tracé (issue GitHub ou commentaire `// SKIP: raison + ticket`).

## Structure d'un test unitaire

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('affiche le titre', () => {
    render(<MyComponent title="Hello" />);
    expect(screen.getByRole('heading')).toHaveTextContent('Hello');
  });
});
```

## Structure d'un test E2E authentifié

Voir `e2e/fixtures/auth.ts` et `e2e/dashboard.spec.ts` (template).

## Commandes

| Commande | Rôle |
|---|---|
| `bun run test` | Suite Vitest complète |
| `bun run test:fast` | Diff HEAD~1 uniquement |
| `bun run test:coverage` | Coverage v8 (rapport `coverage/`) |
| `bun run test:a11y` | Suite jest-axe |
| `bun run test:edge` | Deno tests edge functions |
| `bun run test:e2e` | Playwright complet |
| `bun run test:e2e:smoke` | Playwright smoke post-deploy |
| `bun run test:load` | k6 |
| `bun run test:mutation` | Stryker (long) |
| `node scripts/check-test-hygiene.mjs` | Détecte `.only`, liste `.skip/.todo` |
| `node scripts/test-health.mjs` | Régénère `docs/tests/HEALTH.md` |

## Ratchet coverage

Le fichier `vitest.config.ts` contient les planchers actuels par module.
**Règle** : on ne redescend jamais un plancher. À chaque PR qui ajoute des tests,
mettre à jour le plancher au niveau atteint (arrondi inférieur).

## Références

- `docs/tests/PLAN_TESTS_2026-07.md` — plan global 4 sprints
- `docs/tests/HEALTH.md` — snapshot auto-généré
- `docs/audits/AUDIT_GLOBAL_2026-07-07.md` — audit global d'origine
