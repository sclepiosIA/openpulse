# Activity Feed global — Module Prio 9

Flux chronologique transversal de toutes les actions CRM et opérationnelles (interactions, tâches, événements calendrier, **emails reçus, devis, factures, signatures électroniques, exécutions de workflows**) sur l'ensemble des établissements et utilisateurs. Permet à la direction et aux équipes d'avoir une vue type "fil d'actualité" Salesforce/HubSpot sans avoir à ouvrir chaque fiche.

---

## 1. Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  /activite (page) ─── <ActivityFeedFilters /> + <Timeline />   │
│        │                                                       │
│        ▼                                                       │
│  useGlobalActivityFeed({ filters, pageSize, realtime })        │
│        │                                                       │
│        ├── React Query infinite (staleTime 30s, gcTime 5min)   │
│        │                                                       │
│        ├── Realtime channel `global-activity-feed`             │
│        │   INSERT sur interactions / taches / calendar_events  │
│        │   debounce 2s → invalidateQueries                     │
│        │                                                       │
│        ▼                                                       │
│  RPC public.get_global_activity_feed(p_limit, p_cursor, p_filters)
│  SECURITY DEFINER  ─  WITH unified AS (UNION ALL — 8 sources)  │
│        ├── interactions       (type='interaction')             │
│        ├── taches             (type='tache')                   │
│        ├── calendar_events    (type='calendar')                │
│        ├── email_messages     (type='email', inbound only)     │
│        ├── devis              (type='devis')                   │
│        ├── factures           (type='facture')                 │
│        ├── signature_requests (type='signature')               │
│        └── workflow_runs      (type='workflow')                │
│  → ORDER BY occurred_at DESC LIMIT p_limit                     │
└────────────────────────────────────────────────────────────────┘
```

> **Sources activées le 17 avril 2026** : les 5 sources email/devis/factures/signature/workflow étaient préparées mais commentées. Elles sont désormais branchées avec leurs index dédiés (`idx_email_messages_received_date`, `idx_devis_created_at`, `idx_factures_created_at`, `idx_signature_requests_completed_at`, `idx_workflow_runs_finished_at`).

---

## 2. RPC `get_global_activity_feed`

### Signature

```sql
public.get_global_activity_feed(
  p_limit   integer DEFAULT 30,
  p_cursor  timestamptz DEFAULT NULL,
  p_filters jsonb DEFAULT '{}'::jsonb
) RETURNS SETOF activity_feed_item
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
```

### Schéma de retour normalisé (12 colonnes)

| Colonne            | Type           | Description                                            |
|--------------------|----------------|--------------------------------------------------------|
| `id`               | `text`         | ID source préfixé (`interaction:<uuid>`, `tache:<uuid>`, …) |
| `type`             | `text`         | `interaction` \| `tache` \| `calendar` \| `email` \| `devis` \| `facture` \| `signature` \| `workflow` |
| `occurred_at`      | `timestamptz`  | Date/heure de l'événement (clé de tri DESC)           |
| `actor_user_id`    | `uuid`         | Utilisateur à l'origine (peut être `null` pour système) |
| `actor_name`       | `text`         | Nom complet ou « Système »                            |
| `etablissement_id` | `uuid`         | Établissement lié (nullable)                          |
| `etablissement_nom`| `text`         | Nom établissement (jointure)                          |
| `title`            | `text`         | Titre court (≤ 80 caractères)                         |
| `description`      | `text`         | Détail libre (nullable)                               |
| `icon`             | `text`         | Nom d'icône lucide (`MessageSquare`, `CheckCircle`, …) |
| `color`            | `text`         | `blue` \| `green` \| `amber` \| `purple` \| `red` \| `gray` |
| `link`             | `text`         | Lien interne (`/etablissements/<id>`, …) nullable     |
| `metadata`         | `jsonb`        | Payload libre (canal, durée, tags…)                   |

### Filtres `p_filters`

```json
{
  "types": ["interaction", "tache"],
  "user_ids": ["<uuid>", "<uuid>"],
  "etablissement_ids": ["<uuid>"],
  "date_from": "2026-01-01T00:00:00Z",
  "date_to":   "2026-04-17T23:59:59Z"
}
```

Tous les champs sont optionnels. Le tableau `types` agit comme un **filtre WHERE IN** appliqué après l'`UNION ALL`.

### Pagination cursor-based

- `p_cursor` = `occurred_at` du dernier item de la page précédente.
- La RPC renvoie `WHERE occurred_at < p_cursor ORDER BY occurred_at DESC LIMIT p_limit`.
- Côté hook : `nextCursor = items.length === pageSize ? lastItem.occurred_at : null`.

### Exemple d'appel — JS

```ts
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase.rpc('get_global_activity_feed', {
  p_limit: 30,
  p_cursor: null,
  p_filters: { types: ['interaction', 'tache'], etablissement_ids: ['xxxx'] },
});
```

### Exemple d'appel — curl

```bash
curl -X POST "https://your-project-ref.supabase.co/rest/v1/rpc/get_global_activity_feed" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"p_limit":30,"p_cursor":null,"p_filters":{"types":["interaction"]}}'
```

---

## 3. Hook `useGlobalActivityFeed`

```ts
const {
  items,              // Item[] aplati de toutes les pages
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
} = useGlobalActivityFeed({
  filters: { types: ['interaction', 'tache'] },
  pageSize: 30,
  realtime: true,
});
```

- `staleTime` : 30 s — évite les refetch agressifs.
- `gcTime` : 5 min — garbage collection mémoire React Query.
- Realtime : channel `global-activity-feed` abonné aux INSERT sur les 3 tables sources, **debounce 2 s** avant `invalidateQueries(['global-activity-feed'])`.

---

## 4. UI — Page `/activite`

### Regroupement temporel (`ActivityFeedTimeline`)

| Label affiché      | Condition                                         |
|--------------------|---------------------------------------------------|
| `Aujourd'hui`      | `isToday(date)`                                   |
| `Hier`             | `isYesterday(date)`                               |
| `Cette semaine`    | `isThisWeek(date, { locale: fr })`                |
| `d MMMM yyyy` (fr) | sinon (date longue française)                     |

### Infinite scroll

`IntersectionObserver` sur un sentinel avec `rootMargin: '200px'` → déclenche `onLoadMore()` si `hasNextPage && !isFetchingNextPage`.

### Filtres (`ActivityFeedFilters`)

- Toggle multi-sélection des `types` (8 valeurs possibles, 3 actives).
- Bouton « Réinitialiser » qui vide tous les filtres.
- Les filtres sont mémorisés dans le state local de la page (pas d'URL state pour l'instant).

### Couleurs sémantiques

`ACTIVITY_COLOR_CLASSES` dans `src/types/activity.ts` mappe les 6 couleurs vers des classes Tailwind tokenisées (`bg-blue-500/10 text-blue-600 dark:text-blue-400`, …).

---

## 5. Widget dashboard `RecentActivityWidget`

- ID : `global_activity_feed` dans `WIDGET_REGISTRY`.
- Catégorie : `overview`.
- Affiche les **10 derniers items**, lien « Voir tout » → `/activite`.
- Sélectionnable via le builder de dashboard, intégré dans `DirectionDashboard.tsx` (case `'global_activity_feed'`).

---

## 6. Sécurité

- `SECURITY DEFINER` + `SET search_path = public, pg_temp`.
- Premier acte de la fonction : `IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;`.
- Lecture seule. La RPC n'expose que des données déjà accessibles à l'utilisateur via les RLS individuelles (jointures `profiles` / `etablissements` ne révèlent que le nom).
- Aucune table de log secondaire — pas de fuite d'audit indirecte.

---

## 7. Ajouter une nouvelle source

Étendre le `WITH unified AS (… UNION ALL …)` de la RPC en respectant **strictement** le schéma normalisé.

Template :

```sql
SELECT
  ('email:' || em.id)                       AS id,
  'email'                                    AS type,
  em.received_at                             AS occurred_at,
  em.from_user_id                            AS actor_user_id,
  COALESCE(p.full_name, 'Système')           AS actor_name,
  em.etablissement_id                        AS etablissement_id,
  e.nom                                      AS etablissement_nom,
  LEFT(em.subject, 80)                       AS title,
  em.preview                                 AS description,
  'Mail'                                     AS icon,
  'purple'                                   AS color,
  ('/emails/' || em.thread_id)               AS link,
  jsonb_build_object('from', em.from_email)  AS metadata
FROM email_messages em
LEFT JOIN profiles p ON p.id = em.from_user_id
LEFT JOIN etablissements e ON e.id = em.etablissement_id
WHERE (p_filters->>'date_from' IS NULL OR em.received_at >= (p_filters->>'date_from')::timestamptz)
  AND (p_filters->>'date_to'   IS NULL OR em.received_at <= (p_filters->>'date_to')::timestamptz)
```

Sources actives dans la RPC (migration `20260419092147`) — 8 au total :
- `customer_activities` → type `interaction`, icône `MessageSquare`, couleur `blue`
- `taches`              → type `tache`,       icône `CheckSquare`,   couleur `green`/`amber`
- `calendar_events`     → type `calendar`,    icône `Calendar`,      couleur `purple`
- `email_messages`      → type `email`,       icône `Mail`,          couleur `sky`
- `devis`               → type `devis`,       icône `FileText`,      couleur dynamique
- `factures`            → type `facture`,     icône `Receipt`,       couleur dynamique
- `signature_requests`  → type `signature`,   icône `PenLine`,       couleur dynamique
- `workflow_runs`       → type `workflow`,    icône `Workflow`,      couleur dynamique

---

## 8. Limitations connues

- Pas encore d'agrégation de `audit_log` (changements d'état, modifications de champs sensibles).
- Pas encore d'agrégation des tables d'audit spécialisées (`document_audit_log`, `pulse_audit_log`, `rgpd_audit_logs`, `workflow_audit_log`) — pas de table `audit_log` centrale, agrégation nécessite arbitrage produit.
- Pas d'export PDF/CSV du flux (à brancher via `/rapports-custom` si demandé).
- Filtres persistés dans l'URL via paramètres `q`, `types`, `users`, `etabs`, `from`, `to` (Session 8, 2026-05-16).

---

## 9. Fichiers clés

| Rôle         | Chemin                                              |
|--------------|-----------------------------------------------------|
| Migration    | `supabase/migrations/<ts>_global_activity_feed.sql` |
| Types        | `src/types/activity.ts`                             |
| Hook         | `src/hooks/useGlobalActivityFeed.ts`                |
| Page         | `src/pages/ActivityFeed.tsx`                        |
| Timeline     | `src/components/activity/ActivityFeedTimeline.tsx`  |
| Item         | `src/components/activity/ActivityFeedItem.tsx`      |
| Filtres      | `src/components/activity/ActivityFeedFilters.tsx`   |
| Skeleton     | `src/components/activity/ActivityFeedSkeleton.tsx`  |
| Widget       | `src/components/dashboard/widgets/RecentActivityWidget.tsx` |
