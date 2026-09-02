# Guide de Contribution - OpenPulse

## Table des Matières

1. [Configuration de l'Environnement](#configuration-de-lenvironnement)
2. [Structure du Projet](#structure-du-projet)
3. [Conventions de Code](#conventions-de-code)
4. [Tests Unitaires](#tests-unitaires)
5. [Tests E2E](#tests-e2e)
6. [Documentation](#documentation)
7. [Process de Review](#process-de-review)

---

## Configuration de l'Environnement

### Prérequis

- Node.js 18+
- Bun (gestionnaire de paquets)
- Accès au projet Supabase

### Installation

```bash
# Cloner le repo
git clone https://github.com/marque/marque-ia.git
cd marque-ia

# Installer les dépendances
bun install

# Copier le fichier d'environnement
cp .env.example .env

# Démarrer en développement
bun run dev
```

---

## Structure du Projet

```
src/
├── components/     # Composants React (UI)
├── hooks/          # Hooks React Query et logique métier
├── pages/          # Pages principales (routes)
├── lib/            # Utilitaires et helpers
├── types/          # Définitions TypeScript
├── contexts/       # Contextes React (Auth, Filters)
└── integrations/   # Types Supabase générés

supabase/
├── functions/      # Edge Functions Deno
├── migrations/     # Migrations SQL
└── config.toml     # Configuration

docs/               # Documentation technique
tests/              # Tests E2E Playwright
```

---

## Conventions de Code

### Nommage

| Type | Convention | Exemple |
|------|------------|---------|
| Composants | PascalCase | `EmailComposer.tsx` |
| Hooks | camelCase + préfixe `use` | `useEmailThreads.ts` |
| Utilitaires | camelCase | `formatDate.ts` |
| Types/Interfaces | PascalCase | `EtablissementForGeo` |
| Constantes | SCREAMING_SNAKE_CASE | `MAX_PAGE_SIZE` |

### Structure des Hooks

```typescript
// 1. Imports
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryPresets } from "@/lib/queryPresets";

// 2. Types
export interface MyData { ... }

// 3. Hook
export function useMyData() {
  const query = useQuery({
    queryKey: ["my-data"],
    queryFn: async () => { ... },
    ...queryPresets.standard, // Utiliser les presets !
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
  };
}
```

### Règles Importantes

- **Pas de `any`** : Utiliser les types stricts (voir `src/types/`)
- **Pas de `console.log` en production** : Utiliser `debug.log` de `@/lib/debug`
- **Presets React Query** : Toujours utiliser `queryPresets.standard/frequent/reference`
- **Pas de données mockées** : Tout doit venir de la base de données

---

## Tests Unitaires

### Configuration

Les tests utilisent **Vitest** avec `@testing-library/react`.

```bash
# Lancer tous les tests
bun run test

# Lancer un fichier spécifique
bun run test src/hooks/__tests__/useFactures.test.tsx

# Mode watch
bun run test --watch

# Avec couverture
bun run test --coverage
```

### Structure d'un Test de Hook

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 1. Mocks
const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// 2. Import du hook APRÈS les mocks
import { useMyHook } from '@/hooks/useMyHook';

// 3. Wrapper React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// 4. Tests
describe('useMyHook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return expected structure', () => {
    const { result } = renderHook(() => useMyHook(), {
      wrapper: createWrapper(),
    });
    expect(result.current).toHaveProperty('data');
  });

  it('should fetch data successfully', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const { result } = renderHook(() => useMyHook(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});
```

### Mock Supabase Réutilisable

Utiliser `src/test/mocks/supabase.ts` :

```typescript
import { createSupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', () => 
  createSupabaseMock({ defaultData: myMockData })
);
```

### Couverture Cible

| Métrique | Cible |
|----------|-------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |

### Hooks Prioritaires à Tester

1. **Trésorerie** : `useTresorerieRevenus`, `useTresorerieDepenses`
2. **Facturation** : `useFactures`, `useDevis`, `useAvoirs`
3. **RH** : `useRHSalaires`, `useRHAbsences`, `usePlansDeveloppement`
4. **Recrutement** : `useCandidates` mutations
5. **Email** : `useEmailSync`, `useEmailThreads` mutations

---

## Tests E2E

### Configuration Playwright

```bash
# Installer les navigateurs
bunx playwright install

# Lancer les tests
bun run test:e2e

# Mode UI
bunx playwright test --ui

# Générer un rapport
bunx playwright show-report
```

### Structure d'un Test E2E

```typescript
// tests/my-feature.spec.ts
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Login si nécessaire
    await page.goto('/auth');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('should display feature correctly', async ({ page }) => {
    await page.goto('/my-feature');
    await expect(page.locator('h1')).toContainText('My Feature');
  });
});
```

---

## Documentation

### Où Documenter

| Type | Emplacement |
|------|-------------|
| Architecture générale | `docs/architecture/` |
| Guides utilisateur | `docs/guides/` |
| API Edge Functions | `docs/api/` |
| Troubleshooting | `docs/troubleshooting/` |

### Format

- Markdown avec headers clairs
- Exemples de code commentés
- Diagrammes Mermaid si complexe

---

## Process de Review

### Checklist PR

- [ ] Tests unitaires ajoutés/mis à jour
- [ ] Pas de `any` ajoutés
- [ ] Pas de `console.log` en production
- [ ] Types stricts utilisés
- [ ] Documentation mise à jour si API change
- [ ] Tests E2E si nouvelle fonctionnalité majeure

### Branches

- `main` : Production
- `develop` : Développement
- `feature/xxx` : Nouvelles fonctionnalités
- `fix/xxx` : Corrections de bugs

---

## Ressources

- [Documentation React Query](https://tanstack.com/query/latest)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Supabase Documentation](https://supabase.com/docs)
