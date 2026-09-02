import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * useActivityFeed est un hook de composition pure (useMemo/useCallback).
 * Il ne fait pas d'appels Supabase directement — il consomme :
 *   - useEtablissements → tableau d'établissements
 *   - useTaches         → tableau de tâches
 *   - useProfiles       → tableau de profils
 *   - useCurrentProfile → profil connecté
 *
 * On mock ces 4 dépendances avec des données stables (vi.hoisted).
 */

const { mockHooks } = vi.hoisted(() => ({
  mockHooks: {
    useEtablissements: vi.fn(),
    useTaches: vi.fn(),
    useProfiles: vi.fn(),
    useCurrentProfile: vi.fn(),
  },
}))

vi.mock('../crm/useEtablissements', () => ({
  useEtablissements: mockHooks.useEtablissements,
}))

vi.mock('../tasks/useTaches', () => ({
  useTaches: mockHooks.useTaches,
}))

vi.mock('../profile/useProfiles', () => ({
  useProfiles: mockHooks.useProfiles,
  useCurrentProfile: mockHooks.useCurrentProfile,
}))

// Import au niveau module, après les vi.mock (ESM-compatible)
import { useActivityFeed } from './useActivityFeed'

// ── données stables ──────────────────────────────────────────────────────────
function makeFixtures() {
  const now = new Date()
  const fiveDaysAgo = new Date(now.getTime() - 5 * 86400_000).toISOString()
  const tenDaysAgo = new Date(now.getTime() - 10 * 86400_000).toISOString()
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400_000).toISOString()

  return {
    etablissements: [
      {
        id: 'etab-1',
        nom: 'CHU Lille',
        statut: 'Négociation',
        updated_at: fiveDaysAgo,
        created_at: tenDaysAgo,
        updated_by: 'user-1',
      },
      {
        id: 'etab-2',
        nom: 'Clinique du Nord',
        statut: 'Bloqué',
        updated_at: twoDaysAgo,
        created_at: tenDaysAgo,
        updated_by: 'user-2',
      },
      {
        id: 'etab-3',
        nom: 'EHPAD Soleil',
        statut: 'Contractualisation',
        updated_at: tenDaysAgo, // > 7 jours → stale
        created_at: tenDaysAgo,
        updated_by: 'user-2',
      },
    ],
    taches: [
      {
        id: 'task-1',
        titre: 'Relance directeur',
        statut: 'En cours',
        etablissement_id: 'etab-1',
        responsable_id: 'user-1',
        // échéance dans 3 jours → urgente
        echeance: new Date(Date.now() + 3 * 86400_000).toISOString(),
        created_at: twoDaysAgo,
        updated_at: twoDaysAgo,
      },
      {
        id: 'task-2',
        titre: 'Envoi contrat',
        statut: 'Terminé',
        etablissement_id: 'etab-1',
        responsable_id: 'user-1',
        echeance: null,
        created_at: new Date(now.getTime() - 3 * 86400_000).toISOString(),
        updated_at: new Date(now.getTime() - 3 * 86400_000).toISOString(),
      },
    ],
    profiles: [
      { id: 'user-1', user_id: 'user-1', nom: 'Alice Dupont' },
      { id: 'user-2', user_id: 'user-2', nom: 'Bob Martin' },
    ],
    currentProfile: { id: 'user-1', user_id: 'user-1', nom: 'Alice Dupont' },
  }
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useActivityFeed', () => {
  beforeEach(() => {
    const { etablissements, taches, profiles, currentProfile } = makeFixtures()
    mockHooks.useEtablissements.mockReturnValue({ data: etablissements, isLoading: false })
    mockHooks.useTaches.mockReturnValue({ data: taches, isLoading: false })
    mockHooks.useProfiles.mockReturnValue({ data: profiles })
    mockHooks.useCurrentProfile.mockReturnValue({ data: currentProfile })
  })

  it('retourne isLoading=true quand un des hooks source est en chargement', () => {
    mockHooks.useEtablissements.mockReturnValue({ data: undefined, isLoading: true })

    const { result } = renderHook(() => useActivityFeed(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
  })

  it('retourne des tableaux vides si données non disponibles', () => {
    mockHooks.useEtablissements.mockReturnValue({ data: undefined, isLoading: false })
    mockHooks.useTaches.mockReturnValue({ data: undefined, isLoading: false })
    mockHooks.useCurrentProfile.mockReturnValue({ data: undefined })

    const { result } = renderHook(() => useActivityFeed(), { wrapper: createWrapper() })

    expect(result.current.myActivity).toHaveLength(0)
    expect(result.current.requiredActions).toHaveLength(0)
    expect(result.current.teamActivity).toHaveLength(0)
    expect(result.current.isLoading).toBe(false)
  })

  it("myActivity filtre les étabs modifiés par l'utilisateur connecté", () => {
    const { result } = renderHook(() => useActivityFeed(), { wrapper: createWrapper() })

    // Seul etab-1 a updated_by='user-1'
    expect(result.current.myActivity).toHaveLength(1)
    expect(result.current.myActivity[0].etablissementNom).toBe('CHU Lille')
    expect(result.current.myActivity[0].type).toBe('modification')
  })

  it('requiredActions inclut etab-2 (Bloqué) avec priorité critical', () => {
    const { result } = renderHook(() => useActivityFeed(), { wrapper: createWrapper() })

    const blocked = result.current.requiredActions.find(
      (a: { id: string }) => a.id === 'blocked-etab-2'
    )
    expect(blocked).toBeDefined()
    expect(blocked?.priority).toBe('critical')
    expect(blocked?.type).toBe('status_change')
  })

  it('requiredActions inclut etab-1 (tâche urgente) avec priorité critical', () => {
    const { result } = renderHook(() => useActivityFeed(), { wrapper: createWrapper() })

    const urgentAction = result.current.requiredActions.find(
      (a: { id: string }) => a.id === 'urgent-etab-1'
    )
    expect(urgentAction).toBeDefined()
    expect(urgentAction?.priority).toBe('critical')
    expect(urgentAction?.tasksUrgent).toBe(1)
  })

  it('requiredActions inclut etab-3 (Contractualisation stale > 7j) avec priorité high', () => {
    const { result } = renderHook(() => useActivityFeed(), { wrapper: createWrapper() })

    const stale = result.current.requiredActions.find(
      (a: { id: string }) => a.id === 'stale-etab-3'
    )
    expect(stale).toBeDefined()
    expect(stale?.priority).toBe('high')
    expect(stale?.description).toContain('7 jours')
  })

  it('teamActivity contient les tâches récentes < 7 jours avec userName résolu', () => {
    const { result } = renderHook(() => useActivityFeed(), { wrapper: createWrapper() })

    // Les 2 tâches sont < 7 jours et liées à etab-1 (existant dans la map)
    expect(result.current.teamActivity.length).toBeGreaterThan(0)
    const taskActivity = result.current.teamActivity.find(
      (a: { id: string }) => a.id === 'task-task-1'
    )
    expect(taskActivity).toBeDefined()
    expect(taskActivity?.type).toBe('task_added')
    expect(taskActivity?.userName).toBe('Alice Dupont')
    expect(taskActivity?.etablissementNom).toBe('CHU Lille')
  })
})
