# Plan de découplage Supabase (audit 2026-06-06 — P2.7)

712 fichiers `src/**` importent directement `@/integrations/supabase/client` :
- **403 hooks** (`src/hooks/**`)
- **207 composants** (`src/components/**`)
- **55 pages** (`src/pages/**`)
- 47 services / contexts / lib

## Trajectoire cible

```
Composant/Page  →  Hook de domaine  →  Service métier  →  Supabase / RPC
```

Les composants ne doivent connaître que des hooks. Les hooks ne doivent connaître
que des services. Les services centralisent toute la connaissance du schéma DB
et des RPC.

## Ratchet

`scripts/components-supabase-budget.mjs` impose un plafond. La règle :
- À chaque sprint, **baisser le budget de 10**.
- Pour passer en-dessous, créer le hook/service correspondant dans
  `src/services/<domain>/` (cf. `src/services/email/` comme modèle).

## Priorité de refactor par domaine

| Domaine | Composants directs | Pages directes | Sprint cible |
|---------|-------------------:|---------------:|--------------|
| email | ~35 | 5 | S+1 (modèle déjà en place) |
| crm/etablissements | ~28 | 8 | S+2 |
| tresorerie | ~18 | 4 | S+3 |
| rh / people | ~22 | 6 | S+4 |
| formations | ~15 | 5 | S+5 |
| jarvis | ~25 | 4 | S+6 |
| autres | reste | reste | continu |

## Pattern de service

```ts
// src/services/<domain>/<entity>Service.ts
import { supabase } from '@/integrations/supabase/client';
export const fetchFoo = async (id: string) => {
  const { data, error } = await supabase.from('foo').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
};
```

Le hook se contente d'appeler le service via `useQuery`/`useMutation`.

## Référence

- Memo `architecture/front-end-boundaries-adr-001`
- Script budget : `scripts/components-supabase-budget.mjs`
