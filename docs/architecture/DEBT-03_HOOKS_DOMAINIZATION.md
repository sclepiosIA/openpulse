# DEBT-03 — Domainisation des hooks (`src/hooks/`)

> Statut : **chantier ouvert** (audit 2026-06-02 · §6.7). Démarré : 2026-06-03 (session 58).
> Mise à jour de plan : voir [`docs/audits/AUDIT_2026-06-02_PLAN_REMEDIATION.md`](../audits/AUDIT_2026-06-02_PLAN_REMEDIATION.md).

## Constat

`src/hooks/` regroupe **405 fichiers** à plat (mesuré 2026-06-03). Mélange de domaines (email, social, CRM, RH, trésorerie, Jarvis, formations…) → friction de navigation, risque de collisions de noms, difficulté à isoler par squad/feature.

Seules 2 sous-arborescences existent (`documents/`, `__tests__/`).

## Cible

Une organisation par **feature folder** alignée sur les domaines métier déjà documentés dans la mémoire projet :

```
src/hooks/
  __tests__/
  documents/        (déjà en place)
  email/            (~50 hooks `useEmail*`, `useAttachment*`, `useInboxLayout`, …)
  social/           (`useSocialBrands`, `useSocialAccounts`, `useSocialPosts`, `useSocialComments`, `useSocialConnections`, `useSocialKpis`, `useScheduledPosts`)
  crm/              (`useEtablissement*`, `useProspect*`, `usePartenaire*`, `useContacts*`, `useFollowUp*`)
  csm/              (`useCsm*`, `useChurnPredictions`)
  hr/               (`useRh*`, `useNotesFrais`, `usePeople*`, `useTimeoff*`)
  tresorerie/       (`useTresorerie*`, `useFacturation*`, `useRevenus*`, `useDepenses*`)
  jarvis/           (`useJarvis*`, `useJarvisSmartTriggers`, `useJarvisProactive`, …)
  formations/       (`useFormation*`, `useEmargement*`, `useSatisfaction*`)
  pulse/            (`usePulse*`, `usePulseChannels`, `usePulseMessages`)
  calendar/         (`useCalendar*`, `useICS*`, `useAttendeeSearch`)
  workflows/        (`useWorkflow*`, `useAutomation*`)
  recrutement/      (`useRecrut*`, `useCandidat*`, `useOffre*`)
  portail/          (`useClientPortal*`, `useAllPortalTasksForProjets`)
  monitoring/       (`useAIEndpointsHealth`, `useAIUsageStats`, `useWebVitals*`)
  shared/           (hooks utilitaires : `useAuth`, `useDebounce`, `use-mobile`, `use-toast`, `useAppBadge`, `useAppConfig`, `useApi`, …)
```

## Contraintes

1. **Aucune régression d'import** : tout consommateur existant doit continuer à fonctionner. → On déplace les fichiers, mais on **conserve un shim** (`src/hooks/useXxx.ts` qui ré-exporte depuis le nouveau chemin) jusqu'à migration complète des appelants.
2. **Pas de barrel `index.ts`** dans les dossiers de feature (cf. mémoire `performance-and-loading-optimization` — barrels coûtent en tree-shaking et splitting). Les imports doivent cibler le fichier final : `import { useSocialBrands } from '@/hooks/social/useSocialBrands'`.
3. **Type-check à chaque vague** (`npx tsc --noEmit`).
4. **Budgets CI maintenus** (`any-budget`, `file-size-budget`, `lockfile-guard`).

## Plan d'exécution par vagues

| Vague | Cluster | Volume | Risque imports | Statut |
| --- | --- | --- | --- | --- |
| V1 | `social/` (déjà isolé, peu d'appelants en dehors de `src/pages/Social*`) | 7 | Faible | ☑ session 59 (shims en place) |
| V2 | `csm/` (`useCsm*` + `useChurnPredictions`) | 9 | Faible | ☑ session 60 |
| V3 | `portail/` + `monitoring/` | 5 | Faible | ☑ session 61 |
| V4 | `recrutement/` | 2 | Moyen | ☑ session 62 (périmètre réel — autres hooks déjà répartis) |
| V5 | `formations/` + `pulse/` + `calendar/` | 36 | Moyen | ☑ session 62 |
| V6 | `workflows/` + `jarvis/` | 59 | Élevé (très transverse) | ☑ session 63 |
| V7 | `hr/` + `tresorerie/` | 27 | Élevé | ☑ session 64 |
| V8 | `email/` + `crm/` | 50 | Très élevé (cœur de l'app) | ☑ session 65 |
| V9.1 | `shared/` (utilitaires transverses : `useAuth`, `useDebounce`, `use-toast`, `useAppBadge`, `useAppConfig`, `useApi`, `useTheme`, `useUserRole`, `useUserEmailAccountIds`, `useNavigationHistory`, `usePageTitle`, `useTitleBadge`, `usePublicRoute`, `useSmartNavigation`, `useVirtualBreadcrumb`, `useDynamicManifest`, `useOfflineStatus`, `useIntersectionObserver`, `useLongPress`, `useMediaQuery`, `use-media-query`, `useErrorHandler`, `useDebouncedValue`) | 23 | Faible | ☑ session 66 |
| V9.2 | Rip-replace shims V1→V9.1 (consumers `@/hooks/useX` → `@/hooks/<feature>/useX`) + suppression des shims | ~220 shims | Coordination finale | ☑ session 67 (1298 imports réécrits, 218 shims supprimés, racine 402 → 184) |
| V9.3 | Reste racine (~184 hooks non domainisés) à classer par feature ad-hoc | ~184 | Long terme | ☐ |

Chaque vague :

1. Crée le dossier `src/hooks/<feature>/` (vide).
2. `git mv` (logique : déplacement de fichier) avec **shim de compat** à l'ancien emplacement :
   ```ts
   // src/hooks/useSocialBrands.ts (shim DEBT-03 V1 — supprimer après migration appelants)
   export * from './social/useSocialBrands';
   ```
3. `tsc --noEmit` vert. Lint vert. Tests sentinelle (`vitest run --changed`).
4. Mise à jour `AUDIT_2026-06-02_PLAN_REMEDIATION.md` (entrée session).
5. Une fois tous les appelants migrés (rip-replace `from '@/hooks/useXxx'` → `from '@/hooks/<feature>/useXxx'`), supprimer le shim.

## Garde-fou

À ajouter une fois V9 close : règle ESLint `no-restricted-imports` interdisant `@/hooks/use*` à la racine (impose un dossier). Aujourd'hui désactivé pour ne pas bloquer.
