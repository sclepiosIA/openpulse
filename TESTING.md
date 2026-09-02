# Guide de test — OpenPulse CRM

Ce document décrit comment écrire et exécuter les tests du CRM, et les conventions
à respecter pour garder une suite **fiable, rapide et industrialisable**.
Voir l'état/plan global dans [`AUDIT_TESTS_2026-06-02.md`](./AUDIT_TESTS_2026-06-02.md).

## 1. Pyramide & outillage

| Niveau                       | Outil                            | Emplacement                               | Commande                 |
| ---------------------------- | -------------------------------- | ----------------------------------------- | ------------------------ |
| Unitaire / composant         | Vitest + Testing Library (jsdom) | `src/**/*.test.ts(x)`                     | `npm test`               |
| Couverture                   | Vitest + v8                      | idem                                      | `npm run test:coverage`  |
| Accessibilité (RGAA/WCAG)    | vitest-axe                       | `tests/a11y/**`, `src/**/*.a11y.test.tsx` | `npm run test:a11y`      |
| E2E                          | Playwright                       | `tests/e2e/**`                            | `npm run test:e2e`       |
| Edge Functions               | Deno test                        | `supabase/functions/**/*.test.ts`         | `npm run test:edge`      |
| Charge                       | k6                               | `tests/load/**`                           | `npm run test:load`      |
| Mutation (qualité des tests) | StrykerJS                        | `src/lib/**` (scope initial)              | `npm run test:mutation`  |
| Mobile                       | Maestro                          | `.maestro/**`                             | `maestro test .maestro/` |
| Tout (lint+types+unit+a11y)  | —                                | —                                         | `npm run test:all`       |

## 2. Conventions obligatoires

### 2.1 Mocks de hooks de données → références STABLES

**Piège majeur** (a déjà bloqué toute la suite, cf. T8 de l'audit). Un mock qui
recrée l'objet de données à chaque appel rend la référence instable. Combiné à un
`useEffect([data], …)` qui appelle `setState`, cela crée une **boucle de re-render
infinie** (CPU à 100 %, suite qui ne se termine jamais — le timeout vitest ne peut
pas s'enclencher car le thread est saturé).

```ts
// ❌ MAUVAIS : `{ data: [] }` recréé à chaque rendu → réf instable
vi.mock('@/hooks/useEventReminders', () => ({
  useEventReminders: () => ({ data: [] }),
}))

// ✅ BON : référence stable via vi.hoisted (les factories vi.mock sont hoistées)
const { EMPTY } = vi.hoisted(() => ({ EMPTY: [] as never[] }))
vi.mock('@/hooks/useEventReminders', () => ({
  useEventReminders: () => ({ data: EMPTY }),
}))
```

En production, react-query renvoie une référence stable : le bug n'existe qu'en test.

### 2.2 Interactions → `@testing-library/user-event` (pas `fireEvent`)

`userEvent` simule le comportement réel (focus/blur, events composés). Réserver
`fireEvent` aux cas où `userEvent` ne couvre pas l'API.

### 2.3 Assertions spécifiques, pas tautologiques

```ts
// ❌ tautologie : ne protège de rien
expect(container.firstChild).toBeInTheDocument()
// ✅ cible un élément métier stable
expect(screen.getByRole('heading', { name: /Nouvel événement/i })).toBeInTheDocument()
```

Pour un formulaire : remplir → soumettre → `expect(mutateAsync).toHaveBeenCalledWith(...)`,
et tester le **chemin d'erreur** (`{ data: null, error: {...} }` ⇒ `isError`).

### 2.4 Chemin des mocks relatifs

`vi.mock('…')` résout le chemin **relativement au fichier de test**. Pour mocker un
module importé par le composant (`./Foo`), depuis `__tests__/` écrire `'../Foo'`.

### 2.5 Pas de `.skip`/`.todo` sans ticket

Un test désactivé doit référencer un ticket en commentaire. Pas de test « mort »
(corps sans `expect`).

## 3. Helpers fournis

- `src/test-utils/renderWithProviders.tsx` — rend un composant avec Router + QueryClient (+ Auth mockée).
- `src/test-utils/supabaseMockFactory.ts` — mock chaînable de `@/integrations/supabase/client`.

## 4. Couverture & qualité

- Seuils Vitest : **80 %** lignes/fonctions/branches/statements (`vitest.config.ts`).
- La couverture de lignes ne mesure que l'exécution : le **mutation testing** (`npm run test:mutation`)
  mesure la vraie capacité des tests à détecter un bug. Scope initial `src/lib/**`, seuil de rupture 50 %.

## 5. Dépannage

- **`JS heap out of memory`** : la suite est lourde (~1050 fichiers). La config utilise
  `pool: 'forks'`, `maxForks: 5` et un heap élargi. Si besoin sur petite machine,
  réduire `maxForks` ou shardée : `npx vitest run --shard=1/4` (puis 2/4…).
- **Charge système qui explose / workers orphelins** : lancer Vitest plusieurs fois en parallèle (ex. plusieurs agents, ou sharding mal borné) peut laisser des process worker orphelins (`node ... vitest` à 0 % CPU) qui s'accumulent et font grimper le `load average` → risque de kill par l'OS. Nettoyage : `pkill -9 -f vitest`. Éviter d'enchaîner des runs concurrents non bornés.
- **La suite ne se termine pas (hang)** : chercher un mock à référence instable (§2.1).
  Pour isoler le fichier coupable : lancer les fichiers par lots et repérer celui qui
  ne rend jamais la main (CPU à 100 %).
- **Tests Deno** : nécessitent `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`
  (instance joignable). En CI : workflow `edge-tests.yml`.
- **k6** : fournir `-e TEST_PASSWORD_SHARED=…` ou `-e K6_SKIP_AUTH=true`. Jamais de
  secret en clair dans le repo.
