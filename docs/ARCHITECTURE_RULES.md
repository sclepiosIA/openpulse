# 📐 Règles d'Architecture — OpenPulse

> Document de référence pour les conventions techniques du projet.
> Dernière mise à jour : Mars 2026

---

## 1. Stack & Structure

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui (Radix) |
| Backend | Supabase (PostgreSQL, Edge Functions Deno, Auth, Storage) |
| IA | Azure OpenAI GPT-5 |
| State | TanStack React Query |
| Routing | React Router v7 |

### Arborescence clé

```
src/
├── components/       # Composants React organisés par module
│   └── ui/           # shadcn/ui — NE PAS modifier manuellement
├── pages/            # 1 fichier = 1 route (lazy-loaded)
├── hooks/            # Logique métier réutilisable
├── contexts/         # Contextes React globaux
├── lib/              # Utilitaires purs (pas de state React)
├── types/            # Définitions TypeScript
└── integrations/     # Types Supabase générés (read-only)

supabase/
├── functions/        # Edge Functions Deno
│   └── _shared/      # Config partagée (Azure GPT-5)
└── migrations/       # Migrations SQL (read-only après apply)
```

---

## 2. Conventions de Nommage

| Élément | Convention | Exemple |
|---------|-----------|---------|
| Composant | PascalCase | `EmailListItem.tsx` |
| Hook | camelCase + `use` | `useEmailThreads.ts` |
| Page | PascalCase | `Etablissements.tsx` |
| Edge Function | kebab-case | `process-email-with-ai` |
| Table SQL | snake_case | `email_threads` |
| Type/Interface | PascalCase | `EmailThread` |
| Fichier utilitaire | camelCase | `dateUtils.ts` |

---

## 3. Design System

### Tokens sémantiques obligatoires

```css
/* ✅ Toujours utiliser les tokens CSS */
bg-background, text-foreground, bg-primary, text-primary-foreground,
bg-secondary, bg-muted, bg-accent, text-muted-foreground

/* ❌ JAMAIS de couleurs en dur dans les composants */
bg-white, text-black, bg-blue-500, text-gray-700
```

### Couleurs HSL uniquement

Toutes les valeurs dans `index.css` et `tailwind.config.ts` en HSL.

---

## 4. Gestion des Données

### Configuration centralisée

| Donnée | Source | Hook |
|--------|--------|------|
| Config technique (URLs, infra) | `app_config` table | `useAppConfig()` |
| Données de référence (statuts, régions) | `reference_data` table | `useReferenceData()` |
| Constantes métier stables (simulateur) | `simulator-config.ts` | Import direct |

### Règles PostgREST / Supabase

- **Lectures directes** (`supabase.from().select()`) : OK côté client si RLS protège
- **Écritures sensibles** : Via Edge Functions avec `service_role`
- **Agrégations complexes** : Via RPCs PostgreSQL
- **Fonctions surchargées** : Interdites (PostgREST ne les résout pas → query directe)

### Propriétés calculées

Les champs calculés côté frontend (`computed_*`) doivent être **exclus** avant tout `upsert/insert` via destructuring.

---

## 5. Sécurité

### Rôles

```sql
-- Table dédiée user_roles (JAMAIS dans profiles)
create type public.app_role as enum ('admin','manager','chef_projet','csm','commercial','rh','user');
```

### RLS

- **Toutes les tables** ont RLS activé
- Vérification via `has_role()` en `SECURITY DEFINER`
- `search_path = public, pg_temp` sur toutes les fonctions SQL

### Edge Functions — Auth

```typescript
// Validation JWT in-code (pas via config.toml verify_jwt)
const { data: { user } } = await supabaseClient.auth.getUser();
```

### 2FA

Obligatoire pour les admins. Secrets dans `profiles_secrets`.

---

## 6. Azure OpenAI GPT-5

### Pattern obligatoire

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 90000);

const response = await fetch(AZURE_OPENAI_ENDPOINT!, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "api-key": AZURE_OPENAI_API_KEY!,
  },
  body: JSON.stringify({
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    max_completion_tokens: 3000,
    reasoning_effort: "minimal",   // "minimal"|"low"|"medium"|"high"
    verbosity: "low",              // "low"|"medium"|"high"
    response_format: { type: "json_object" },  // si JSON attendu
  }),
  signal: controller.signal,
});
clearTimeout(timeoutId);
```

### Interdictions GPT-5

- ❌ Paramètres imbriqués (`reasoning: { effort }`)
- ❌ `max_tokens` (utiliser `max_completion_tokens`)
- ❌ Omettre le timeout AbortController
- ❌ Wrapper de fonction complexe

---

## 7. Performance

| Règle | Valeur |
|-------|--------|
| Debounce autocomplete | 300ms |
| Batch size threads | 100 max |
| Chunk IN clause | 50 max |
| React Query staleTime | 5 min |
| React Query gcTime | 30 min |
| Pages lazy-loaded | Oui (React.lazy + Suspense) |

---

## 8. Modules Fusionnés (Phase 4)

| Ancien fichier | Nouveau fichier | Statut |
|---------------|----------------|--------|
| `dateHelpers.ts` | `dateUtils.ts` | Re-export `@deprecated` |
| `formatterHelpers.ts` | `formatters.ts` | Re-export `@deprecated` |
| `strict-mode-overrides.ts` | Supprimé | — |
| `supabase.local.example.ts` | Supprimé | — |

Les anciens fichiers restent en re-exports pour éviter toute casse d'imports existants.

---

## 9. Règles de Sécurité Données (v2 — Mars 2026)

### `select('*')` interdit en production
Toutes les requêtes Supabase doivent utiliser des sélections explicites de colonnes.
`select('*')` expose la structure complète des tables dans le réseau.

### Chiffres commerciaux gouvernés
Les métriques de résultats (ROI, gains, pourcentages) sont stockées dans la table `kb_result_metrics`
avec source, date de validité et statut de publication. Le composant `KBResultsSection` consomme
ces données via le hook `useKBMetrics()` avec fallback sur les données statiques.

### Configuration agents IA en table Supabase
Les agents Jarvis sont configurés dans `ai_agents_config` et les outils dans `ai_tools_config`.
Le hook `useJarvisAgentsConfig()` remplace progressivement l'import statique `jarvis-agents-config.ts`.
Les prompts système sensibles restent côté Edge Function, jamais dans le bundle client.

### Mutations directes protégées par RLS
Les mutations client (`insert/update/delete`) sont autorisées si couvertes par RLS robuste.
Les 5 tables sensibles (contacts, établissements, taches, user_groups, user_group_members)
ont été auditées — toutes disposent de policies INSERT/UPDATE/DELETE par rôle.

### Policies RLS : rôle `authenticated` obligatoire (Mars 2026)
Toutes les policies RLS doivent cibler le rôle `authenticated`, jamais `public`.
Les tables financières (avoirs, contrats, factures) et les données sensibles (health metrics,
churn predictions, upsell recommendations) ont été migrées de `{public}` vers `{authenticated}`.
La table `contrats` utilise un filtrage par établissement assigné (commercial/chef_projet/csm).
Les vues Security Definer ont été migrées vers Security Invoker (ex: `etablissements_emargement_public`).

### Performance DB
- La fonction `has_role()` est `STABLE SECURITY DEFINER SET search_path = public` (cache intra-transaction).
- La table `user_roles` a un index composite `(user_id, role)`.
- La fonction `cleanup_old_logs()` purge automatiquement les logs + monitore la taille des tables critiques.
- Les tables vides avec beaucoup de seq_scans (categories_taches, personal_todos) ont reçu des index.

---

## 10. Checklist Avant Commit

- [ ] Pas de données mockées
- [ ] Pas de liens morts
- [ ] Responsivité testée (mobile + desktop)
- [ ] Pas de chevauchement de texte
- [ ] Types TypeScript corrects (pas de `any`)
- [ ] Couleurs via tokens sémantiques uniquement
- [ ] Edge Functions GPT-5 : timeout + paramètres au 1er niveau
- [ ] RLS activé sur toute nouvelle table
- [ ] Pas de `select('*')` en production
- [ ] Chiffres commerciaux via `kb_result_metrics`, pas en dur
