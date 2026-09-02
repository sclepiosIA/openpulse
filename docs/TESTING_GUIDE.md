# Guide de Tests - OpenPulse

> **Dernière mise à jour** : Juillet 2026 | **Version** : 5.0

Ce document décrit les conventions, patterns et inventaire de tests du projet OpenPulse.

> **Chiffres repo mesurés (audit Fable 5 — 2026-07-06)** :
> - **6 624** fichiers de test sous `src/**` (unitaires + composants + a11y)
> - **171** fichiers de tests E2E sous `tests/`
> - **878** migrations SQL sous `supabase/migrations/`
> - Total ≈ **9 897** fichiers de test à travers le repo
>
> Les compteurs détaillés par catégorie ci-dessous sont un instantané indicatif à raffiner ; en cas de divergence, les métriques mesurées ci-dessus font foi.

## Table des Matières

1. [Inventaire des Tests](#inventaire-des-tests)
2. [Configuration](#configuration)
3. [Tests Unitaires de Hooks](#tests-unitaires-de-hooks)
4. [Tests de Composants](#tests-de-composants)
5. [Tests d'Accessibilité](#tests-daccessibilité)
6. [Tests E2E](#tests-e2e)
7. [Tests Edge Functions (Deno)](#tests-edge-functions-deno)
8. [Mocking Supabase](#mocking-supabase)
9. [Patterns Avancés](#patterns-avancés)
10. [Conventions](#conventions)

---

## Inventaire des Tests

### Tests Unitaires (Vitest - `src/`)

| Catégorie | Fichiers | Tests | Localisation |
|-----------|----------|-------|-------------|
| **Hooks Trésorerie** | 2 | ~22 | `src/hooks/__tests__/useTresorerieDepenses.test.tsx`, `useTresorerieRevenus.test.tsx` |
| **Hooks Email** | 3 | ~30 | `src/hooks/__tests__/useEmailThreads.test.tsx`, `useEmailSync.test.tsx`, `useEmailSearch.test.tsx` |
| **Hooks Support** | 1 | ~12 | `src/hooks/__tests__/useSupportTickets.test.tsx` |
| **Hooks Booking** | 1 | ~10 | `src/hooks/__tests__/useBookingPages.test.tsx` |
| **Hooks RH** | 1 | ~8 | `src/hooks/__tests__/useRHAbsences.test.tsx` |
| **Hooks Profile** | 1 | ~5 | `src/hooks/__tests__/useCurrentProfile.test.tsx` |
| **Hooks Contacts** | 1 | ~2 | `src/hooks/__tests__/useContacts.test.tsx` |
| **Hooks Mutations Phase 3** | 4 | 13 | Voir section dédiée ci-dessous |
| **Hooks Jarvis Streaming** | 1 | ~10 | `src/hooks/__tests__/useJarvisStreaming.test.ts` |
| **Composants Email** | 1 | 12 | `src/components/email/__tests__/EmailComposer.test.tsx` |
| **Composants Trésorerie** | 1 | 9 | `src/components/tresorerie/__tests__/TresorerieDashboard.test.tsx` |
| **Composants Jarvis** | 2 | ~20 | `src/components/jarvis/__tests__/JarvisConversation.test.tsx`, `JarvisComponents.test.tsx` |
| **Composants Tutoriel** | 1 | 17 | `src/components/tutoriel/__tests__/TutorielComponents.test.tsx` |
| **Composants UI** | 1 | 10 | `src/components/ui/__tests__/virtualized-grid.test.tsx` |
| **Composants A11y** | 2 | ~12 | `src/components/__tests__/AppSidebar.a11y.test.tsx`, `EtablissementForm.a11y.test.tsx` |
| **Libs utilitaires** | 4 | ~60 | `src/lib/__tests__/emailUtils.test.ts`, `safeStorage.test.ts`, `rapportExportUtils.test.ts`, `analyseGeoUtils.test.ts` |
| **Libs sanitize** | 1 | 21 | `src/lib/sanitize.test.ts` |
| **Jarvis Enhanced** | 1 | ~8 | `src/test/jarvis/useJarvisEnhanced.test.ts` |
| **Jarvis Core** | 1 | ~8 | `src/test/jarvis/useJarvis.test.ts` |
| **Mock Factory** | 1 | — | `src/test-utils/supabaseMockFactory.ts` |

> **Total mesuré (Juillet 2026)** : **6 624** fichiers de test unitaires sous `src/**` (compteur agrégé bas niveau — le total en *cas de test* individuels reste à consolider via `vitest run --reporter=json`).

#### Hooks Mutations Phase 3 (extraits en février 2026)

| Hook | Fichier de test | Tests |
|------|----------------|-------|
| `useCreateEntityMutations` | `src/hooks/__tests__/useCreateEntityMutations.test.tsx` | 4 (structure, create étab/partenaire/groupe) |
| `useQuoteValidationMutation` | `src/hooks/__tests__/useQuoteValidationMutation.test.tsx` | 3 (structure, validation succès, validation statique) |
| `useKanbanTaskMutation` | `src/hooks/__tests__/useKanbanTaskMutation.test.tsx` | 2 (structure, update tâche) |
| `useJarvisFavoritesMutations` | `src/hooks/__tests__/useJarvisFavoritesMutations.test.ts` | 4 (structure, add/increment/remove) |

### Tests d'Accessibilité (Vitest + axe - `tests/a11y/`)

| Fichier | Composant testé |
|---------|----------------|
| `Badge.test.tsx` | Composant Badge |
| `Button.test.tsx` | Composant Button |
| `Card.test.tsx` | Composant Card |
| `Dashboard.test.tsx` | Page Dashboard |
| `Etablissements.test.tsx` | Liste établissements |
| `ThemeToggle.test.tsx` | Basculement thème |

> **Note** : Les tests `AppSidebar` et `EtablissementForm` sont dans `src/components/__tests__/*.a11y.test.tsx` (doublons supprimés de `tests/a11y/`).

### Tests E2E (Playwright - `tests/e2e/`)

| Fichier | Scénarios |
|---------|-----------|
| `auth.spec.ts` | Login, logout, erreurs auth |
| `dashboard-responsive.spec.ts` | Dashboard desktop/mobile |
| `email-flow.spec.ts` | Flux email complet |
| `establishment-search.spec.ts` | Recherche établissements |
| `task-management.spec.ts` | Gestion des tâches |
| `crm-pipeline.spec.ts` | Pipeline CRM |
| `tresorerie.spec.ts` | Module trésorerie |
| `rh-people.spec.ts` | Module RH/People |
| `rd-agile.spec.ts` | Module R&D agile |
| `formations.spec.ts` | Module formations |
| `calendrier.spec.ts` | Calendrier |
| `support.spec.ts` | Tickets support |
| `profil.spec.ts` | Page profil |
| `parametres.spec.ts` | Paramètres |
| `sidebar-collapsed-centering.spec.ts` | Sidebar responsive |

**Helper partagé** : `tests/e2e/helpers/auth.ts` — `loginAsAdmin()`, `navigateAuthenticated()`

### Tests Edge Functions (Deno - `supabase/functions/`)

| Fichier | Edge Function testée |
|---------|---------------------|
| `process-email-with-ai/index_test.ts` | Classification email IA |
| `generate-thread-title/index_test.ts` | Génération titres threads |
| `correct-spelling-email/index_test.ts` | Correction orthographique |
| `reformulate-email/index_test.ts` | Reformulation email |
| `rd-ai-assist/index_test.ts` | Assistance R&D IA |

---

## Configuration

### Vitest

```typescript
// vitest.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
  },
});
```

### Fichier de Setup

```typescript
// src/test-setup.ts
import '@testing-library/jest-dom';

// Polyfills centralisés (ResizeObserver, scrollIntoView, matchMedia)
// Tous les polyfills JSDOM sont dans ce fichier — ne pas les redéclarer dans les tests.
```

---

## Tests Unitaires de Hooks

### Structure Standard

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 1. MOCKS (avant les imports du code testé)
vi.mock('@/integrations/supabase/client', () => ({ ... }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// 2. IMPORT du hook (après les mocks)
import { useMyHook } from '@/hooks/useMyHook';

// 3. WRAPPER React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// 4. TESTS
describe('useMyHook', () => {
  beforeEach(() => vi.clearAllMocks());
  // ...
});
```

---

## Tests de Composants

### Structure Standard

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};
```

### Polyfills jsdom

Les polyfills JSDOM (ResizeObserver, scrollIntoView, matchMedia) sont **centralisés dans `src/test-setup.ts`**.
Il n'est **plus nécessaire** de les déclarer dans chaque fichier de test.

---

## Tests d'Accessibilité

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'vitest-axe';

expect.extend(toHaveNoViolations);

describe('MyComponent Accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(<MyComponent />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

---

## Tests E2E

### Authentification Systématique

Tous les tests E2E utilisent le helper d'auth partagé :

```typescript
// tests/e2e/helpers/auth.ts
export async function loginAsAdmin(page: Page) { ... }
export async function navigateAuthenticated(page: Page, path: string) { ... }
```

### Bonnes Pratiques E2E

- ✅ Assertions strictes avec `expect().toBeVisible()`
- ✅ Sélecteurs CSS/texte réels (pas de `data-testid` fantômes)
- ✅ Vérification de contenu réel (h1, h2, cards), pas juste `<main>`
- ❌ Pas de pattern `if (isVisible)` (fragile)
- ❌ Pas de `data-testid` non existants dans le DOM

---

## Tests Edge Functions (Deno)

```typescript
// supabase/functions/my-function/index_test.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.test("should handle request", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ ... }),
  });
  // ...
});
```

Exécution : `npx supabase functions test my-function`

---

## Mocking Supabase

### Mock Factory Partagé

```typescript
// src/test-utils/supabaseMockFactory.ts
import { createSupabaseMock } from '@/test-utils/supabaseMockFactory';
```

### Pattern Proxy Chainable (requêtes complexes)

Pour les hooks avec des chaînes d'appels dynamiques (`.select().neq().order().limit().eq()...`) :

```typescript
function createChainable(resolvedValue: any) {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (cb: any) => Promise.resolve(resolvedValue).then(cb);
      }
      return vi.fn((..._args: any[]) => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'my_table') return createChainable({ data: mockData, error: null });
      return createChainable({ data: [], error: null });
    }),
  },
}));
```

### Pattern Mock Explicite (chaînes connues)

Pour les hooks avec des chaînes prévisibles :

```typescript
const mockLimit = vi.fn();
const mockOrder = vi.fn(() => ({ limit: mockLimit }));
const mockNeq = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ neq: mockNeq, eq: mockEq, order: mockOrder }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({ select: mockSelect, insert: mockInsert, update: mockUpdate })),
  },
}));
```

---

## Patterns Avancés

### Mock framer-motion

```typescript
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => 
      <div ref={ref} {...props}>{children}</div>),
    button: React.forwardRef(({ children, ...props }: any, ref: any) => 
      <button ref={ref} {...props}>{children}</button>),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));
```

### Mock Recharts

```typescript
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <svg>{children}</svg>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}));
```

### Sélecteurs Résilients

```typescript
// ✅ Par rôle (préféré)
screen.getByRole('textbox')
screen.getByRole('button', { name: /submit/i })

// ✅ Par texte (quand unique)
screen.getByText('Mon titre')

// ✅ getAllByText quand plusieurs éléments correspondent
screen.getAllByText('Valeur').length

// ✅ Par placeholder
screen.getByPlaceholderText(/rechercher/i)

// ❌ Par data-testid fantôme (à éviter)
screen.getByTestId('nonexistent-id')
```

---

## Conventions

### Nommage des Fichiers

| Type | Pattern | Exemple |
|------|---------|---------|
| Hook unit | `src/hooks/__tests__/useHookName.test.tsx` | `useTresorerieDepenses.test.tsx` |
| Component unit | `src/components/<module>/__tests__/Component.test.tsx` | `EmailComposer.test.tsx` |
| Lib unit | `src/lib/__tests__/utilName.test.ts` | `emailUtils.test.ts` |
| E2E | `tests/e2e/feature-name.spec.ts` | `tresorerie.spec.ts` |
| A11y | `tests/a11y/ComponentName.test.tsx` | `Button.test.tsx` |
| Deno | `supabase/functions/<name>/index_test.ts` | `process-email-with-ai/index_test.ts` |

### Bonnes Pratiques

1. **Isoler les tests** : Chaque test doit être indépendant (`vi.clearAllMocks()` dans `beforeEach`)
2. **Mock minimal** : Ne mocker que ce qui est nécessaire
3. **Tests descriptifs** : Les noms doivent décrire le comportement attendu
4. **Éviter les timeouts arbitraires** : Utiliser `waitFor` de Testing Library
5. **Import après mock** : Toujours déclarer `vi.mock()` avant d'importer le module testé
6. **Polyfills centralisés** : `ResizeObserver`, `scrollIntoView`, `matchMedia` sont dans `src/test-setup.ts` — ne pas les redéclarer

### Commandes de Test

Scripts npm définis dans `package.json` (source de vérité) :

```bash
# Tests unitaires + composants
npm run test                    # équivaut à vitest run
npm run test:watch              # mode watch
npm run test:coverage           # avec couverture (heap 6144 Mo)
npm run test:fast               # uniquement les fichiers changés vs HEAD~1
npm run test:shard -- 1/16      # sharding manuel

# Tests d'accessibilité
npm run test:a11y

# Tests Edge Functions (Deno)
npm run test:edge

# Tests E2E
npm run test:e2e                # suite complète (163 specs × 5 navigateurs, nightly)
npm run test:e2e:smoke          # suite smoke (13 specs, chromium, < 15 min, gate PR)

# Tests de mutation (Stryker)
npm run test:mutation

# Tests de charge
npm run test:load
```

En CI (`.github/workflows/ci.yml`), les gates bloquants sont : `lint`, `type-check`,
`any-budget` (global + hooks/lib), `file-size-budget`, `components-supabase-budget`,
`pages-supabase-budget`, `audit-edge-functions-public-service-role`,
`edge-critical-tests-budget`, `lockfile-guard`, `web-vitals-budget`,
`runtime-observability-budget`, la suite unitaire + couverture, l'a11y, le build,
et `test:e2e:smoke` sur `pull_request` (suite complète sur `schedule`/`workflow_dispatch`).

---

## Objectifs de Couverture

| Métrique | Seuil Minimum |
|----------|---------------|
| Lignes | 80% |
| Fonctions | 80% |
| Branches | 80% |
| Statements | 80% |

---

## Ressources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
- [vitest-axe](https://github.com/chaance/vitest-axe)
- [Deno Testing](https://deno.land/manual/basics/testing)

---

*Documentation maintenue par l'équipe OpenPulse — Juillet 2026 | v5.0 (aligné audit Fable 5)*
