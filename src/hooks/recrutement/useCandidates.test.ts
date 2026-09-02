// @vitest-environment jsdom
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  useCandidates,
  useCandidate,
  useCreateCandidate,
  useUpdateCandidate,
  useUpdateCandidateStatus,
  useDeleteCandidate,
  useCandidateHistory,
} from './useCandidates'

const {
  AUTH_STATE,
  CANDIDATES_ROWS,
  SINGLE_CANDIDATE,
  HISTORY_ROWS,
  CREATED_ROW,
  UPDATED_ROW,
  STATUS_UPDATED_ROW,
  mockFrom,
  mockToastSuccess,
  mockToastError,
  mockSanitizeSupabaseError,
  mockSanitizePostgrestValue,
  builderState,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'test@example.com' },
    loading: false,
  },
  CANDIDATES_ROWS: [
    {
      id: 'c1',
      job_offer_id: 'j1',
      prenom: 'Alice',
      nom: 'Martin',
      email: 'alice@example.com',
      telephone: '0102030405',
      statut: 'new',
      source: 'linkedin',
      assignee_id: 'u1',
      date_candidature: '2024-01-10T10:00:00.000Z',
      created_at: '2024-01-10T10:00:00.000Z',
      updated_at: '2024-01-10T10:00:00.000Z',
      job_offer: { id: 'j1', titre: 'Dev Front', type_contrat: 'CDI' },
    },
    {
      id: 'c2',
      job_offer_id: 'j2',
      prenom: 'Bob',
      nom: 'Durand',
      email: 'bob@example.com',
      telephone: '0607080910',
      statut: 'interview',
      source: 'cooptation',
      assignee_id: 'u1',
      date_candidature: '2024-01-09T10:00:00.000Z',
      created_at: '2024-01-09T10:00:00.000Z',
      updated_at: '2024-01-09T10:00:00.000Z',
      job_offer: { id: 'j2', titre: 'Dev Back', type_contrat: 'CDD' },
    },
  ],
  SINGLE_CANDIDATE: {
    id: 'c1',
    job_offer_id: 'j1',
    prenom: 'Alice',
    nom: 'Martin',
    email: 'alice@example.com',
    telephone: '0102030405',
    statut: 'new',
    source: 'linkedin',
    assignee_id: 'u1',
    date_candidature: '2024-01-10T10:00:00.000Z',
    created_at: '2024-01-10T10:00:00.000Z',
    updated_at: '2024-01-10T10:00:00.000Z',
    job_offer: { id: 'j1', titre: 'Dev Front', type_contrat: 'CDI', departement: 'Tech' },
    assignee: { id: 'u1', prenom: 'Test', nom: 'User', avatar_url: null },
  },
  HISTORY_ROWS: [
    {
      id: 'h1',
      candidate_id: 'c1',
      action_type: 'status_change',
      description: 'Statut changé de new à interview',
      old_value: { statut: 'new' },
      new_value: { statut: 'interview' },
      performed_by: 'u1',
      created_at: '2024-01-11T10:00:00.000Z',
      performer: { id: 'u1', prenom: 'Test', nom: 'User', avatar_url: null },
    },
  ],
  CREATED_ROW: {
    id: 'c3',
    job_offer_id: 'j1',
    prenom: 'Chloe',
    nom: 'Bernard',
    email: 'chloe@example.com',
    telephone: '0199001234',
    statut: 'new',
    source: 'linkedin',
    assignee_id: 'u1',
    date_candidature: '2024-01-12T10:00:00.000Z',
    created_at: '2024-01-12T10:00:00.000Z',
    updated_at: '2024-01-12T10:00:00.000Z',
  },
  UPDATED_ROW: {
    id: 'c1',
    job_offer_id: 'j1',
    prenom: 'Alice',
    nom: 'Martin',
    email: 'alice.updated@example.com',
    telephone: '0102030405',
    statut: 'interview',
    source: 'linkedin',
    assignee_id: 'u1',
    note_globale: 4,
    tags: ['senior'],
    date_derniere_action: '2024-01-12T11:00:00.000Z',
    created_at: '2024-01-10T10:00:00.000Z',
    updated_at: '2024-01-12T11:00:00.000Z',
  },
  STATUS_UPDATED_ROW: {
    id: 'c1',
    statut: 'offer_accepted',
    date_derniere_action: '2024-01-12T12:00:00.000Z',
    date_embauche: '2024-01-12T12:00:00.000Z',
    created_at: '2024-01-10T10:00:00.000Z',
    updated_at: '2024-01-12T12:00:00.000Z',
  },
  mockFrom: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockSanitizeSupabaseError: vi.fn((error: Error) => `sanitized:${error.message}`),
  mockSanitizePostgrestValue: vi.fn((value: string) => value.replace(/[%_,]/g, '')),
  builderState: {
    table: '',
    selected: '',
    inserted: undefined as unknown,
    updated: undefined as unknown,
    deleted: false,
    eqCalls: [] as Array<[string, unknown]>,
    inCalls: [] as Array<[string, unknown[]]>,
    orderCalls: [] as Array<[string, { ascending: boolean } | undefined]>,
    limitCalls: [] as number[],
    orCalls: [] as string[],
    singleResult: { data: null as unknown, error: null as unknown },
    maybeSingleResult: { data: null as unknown, error: null as unknown },
    thenResult: { data: null as unknown, error: null as unknown },
  },
}))

function resetBuilder() {
  builderState.table = ''
  builderState.selected = ''
  builderState.inserted = undefined
  builderState.updated = undefined
  builderState.deleted = false
  builderState.eqCalls = []
  builderState.inCalls = []
  builderState.orderCalls = []
  builderState.limitCalls = []
  builderState.orCalls = []
  builderState.singleResult = { data: null, error: null }
  builderState.maybeSingleResult = { data: null, error: null }
  builderState.thenResult = { data: null, error: null }
}

function createBuilder() {
  const builder = {
    select: vi.fn((value: string) => {
      builderState.selected = value
      return builder
    }),
    eq: vi.fn((column: string, value: unknown) => {
      builderState.eqCalls.push([column, value])
      return builder
    }),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn((column: string, value: unknown[]) => {
      builderState.inCalls.push([column, value])
      return builder
    }),
    order: vi.fn((column: string, options?: { ascending: boolean }) => {
      builderState.orderCalls.push([column, options])
      return builder
    }),
    limit: vi.fn((value: number) => {
      builderState.limitCalls.push(value)
      return builder
    }),
    insert: vi.fn((value: unknown) => {
      builderState.inserted = value
      return builder
    }),
    update: vi.fn((value: unknown) => {
      builderState.updated = value
      return builder
    }),
    delete: vi.fn(() => {
      builderState.deleted = true
      return builder
    }),
    or: vi.fn((value: string) => {
      builderState.orCalls.push(value)
      return builder
    }),
    single: vi.fn(() => Promise.resolve(builderState.singleResult)),
    maybeSingle: vi.fn(() => Promise.resolve(builderState.maybeSingleResult)),
    then: (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(builderState.thenResult).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(builderState.thenResult).catch(onRejected),
  }
  return builder
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/lib/sanitize', () => ({
  sanitizePostgrestValue: mockSanitizePostgrestValue,
}))

function createWrapper(client?: QueryClient) {
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return {
    queryClient,
    wrapper,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  resetBuilder()
  mockFrom.mockImplementation((table: string) => {
    builderState.table = table
    return createBuilder()
  })
})

describe('useCandidates', () => {
  it('charge les candidats avec filtres et retourne les données métier', async () => {
    builderState.thenResult = { data: CANDIDATES_ROWS, error: null }

    const { wrapper } = createWrapper()

    const { result } = renderHook(
      () => useCandidates({ jobOfferId: 'j1', status: ['new', 'interview'], search: 'Ali_ce%' }),
      { wrapper }
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('candidates')
    expect(builderState.table).toBe('candidates')
    expect(builderState.limitCalls).toEqual([200])
    expect(builderState.orderCalls).toEqual([['date_candidature', { ascending: false }]])
    expect(builderState.eqCalls).toContainEqual(['job_offer_id', 'j1'])
    expect(builderState.inCalls).toContainEqual(['statut', ['new', 'interview']])
    expect(mockSanitizePostgrestValue).toHaveBeenCalledWith('Ali_ce%')
    expect(builderState.orCalls[0]).toContain('nom.ilike.%Alice%')
    expect(builderState.orCalls[0]).toContain('prenom.ilike.%Alice%')
    expect(builderState.orCalls[0]).toContain('email.ilike.%Alice%')
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0]?.prenom).toBe('Alice')
    expect(result.current.data?.[1]?.statut).toBe('interview')
  })

  it('remonte une erreur de requête', async () => {
    builderState.thenResult = { data: null, error: { message: 'x' } }

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useCandidates(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeTruthy()
  })
})

describe('useCandidate', () => {
  it('charge un candidat par id', async () => {
    builderState.maybeSingleResult = { data: SINGLE_CANDIDATE, error: null }

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useCandidate('c1'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('candidates')
    expect(builderState.eqCalls).toContainEqual(['id', 'c1'])
    expect(result.current.data?.id).toBe('c1')
    expect(result.current.data?.job_offer?.titre).toBe('Dev Front')
    expect(result.current.data?.assignee?.prenom).toBe('Test')
  })

  it('passe en erreur si maybeSingle renvoie une erreur', async () => {
    builderState.maybeSingleResult = { data: null, error: { message: 'x' } }

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useCandidate('c1'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeTruthy()
  })
})

describe('useCreateCandidate', () => {
  it('crée un candidat, invalide les queries et affiche un toast', async () => {
    builderState.singleResult = { data: CREATED_ROW, error: null }

    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateCandidate(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        job_offer_id: 'j1',
        prenom: 'Chloe',
        nom: 'Bernard',
        email: 'chloe@example.com',
        telephone: '0199001234',
        source: 'linkedin',
        assignee_id: 'u1',
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('candidates')
    expect(builderState.inserted).toEqual({
      job_offer_id: 'j1',
      prenom: 'Chloe',
      nom: 'Bernard',
      email: 'chloe@example.com',
      telephone: '0199001234',
      linkedin_url: undefined,
      portfolio_url: undefined,
      statut: 'new',
      source: 'linkedin',
      source_detail: undefined,
      annees_experience: undefined,
      salaire_souhaite: undefined,
      disponibilite: undefined,
      date_disponibilite: undefined,
      competences: undefined,
      notes: undefined,
      tags: undefined,
      assignee_id: 'u1',
      cooptation_par: undefined,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['candidates'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['job-offers-kpis'] })
    expect(mockToastSuccess).toHaveBeenCalledWith('Candidat ajouté')
  })

  it('affiche une erreur sanitizée si la création échoue', async () => {
    builderState.singleResult = { data: null, error: new Error('x') }

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useCreateCandidate(), { wrapper })

    await act(async () => {
      try {
        await result.current.mutateAsync({ job_offer_id: 'j1', prenom: 'Fail' })
      } catch {}
    })

    expect(mockSanitizeSupabaseError).toHaveBeenCalled()
    expect(mockToastError).toHaveBeenCalledWith('sanitized:x')
  })
})

describe('useUpdateCandidate', () => {
  it('met à jour un candidat avec les champs attendus', async () => {
    builderState.singleResult = { data: UPDATED_ROW, error: null }
    const isoSpy = vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-02-01T08:00:00.000Z')

    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateCandidate(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'c1',
        prenom: 'Alice',
        nom: 'Martin',
        email: 'alice.updated@example.com',
        statut: 'interview',
        source: 'linkedin',
        note_globale: 4,
        tags: ['senior'],
        assignee_id: 'u1',
      })
    })

    expect(builderState.updated).toEqual({
      prenom: 'Alice',
      nom: 'Martin',
      email: 'alice.updated@example.com',
      telephone: undefined,
      linkedin_url: undefined,
      portfolio_url: undefined,
      statut: 'interview',
      source: 'linkedin',
      source_detail: undefined,
      annees_experience: undefined,
      salaire_souhaite: undefined,
      disponibilite: undefined,
      date_disponibilite: undefined,
      competences: undefined,
      notes: undefined,
      note_globale: 4,
      tags: ['senior'],
      assignee_id: 'u1',
      date_derniere_action: '2024-02-01T08:00:00.000Z',
    })
    expect(builderState.eqCalls).toContainEqual(['id', 'c1'])
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['candidates'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['candidate', 'c1'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['job-offers-kpis'] })
    expect(mockToastSuccess).toHaveBeenCalledWith('Candidat mis à jour')

    isoSpy.mockRestore()
  })

  it('affiche une erreur sanitizée si la mise à jour échoue', async () => {
    builderState.singleResult = { data: null, error: new Error('x') }

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useUpdateCandidate(), { wrapper })

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 'c1', prenom: 'Alice' })
      } catch {}
    })

    expect(mockToastError).toHaveBeenCalledWith('sanitized:x')
  })
})

describe('useUpdateCandidateStatus', () => {
  it('met à jour le statut, ajoute un historique et invalide les queries', async () => {
    const candidateHistoryBuilders: Array<ReturnType<typeof createBuilder>> = []
    const responses = [
      { data: { statut: 'interview' }, error: null },
      { data: STATUS_UPDATED_ROW, error: null },
    ]
    let singleIndex = 0

    mockFrom.mockImplementation((table: string) => {
      builderState.table = table
      const builder = createBuilder()

      if (table === 'candidates') {
        builder.maybeSingle = vi.fn(() => Promise.resolve(responses[0]))
        builder.single = vi.fn(() => Promise.resolve(responses[++singleIndex]))
      }

      if (table === 'candidate_history') {
        candidateHistoryBuilders.push(builder)
      }

      return builder
    })

    const isoSpy = vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-02-01T09:00:00.000Z')
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateCandidateStatus(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ id: 'c1', status: 'offer_accepted' })
    })

    expect(mockFrom).toHaveBeenCalledWith('candidates')
    expect(mockFrom).toHaveBeenCalledWith('candidate_history')
    expect(builderState.updated).toEqual({
      statut: 'offer_accepted',
      date_derniere_action: '2024-02-01T09:00:00.000Z',
      date_embauche: '2024-02-01T09:00:00.000Z',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['candidates'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['candidate', 'c1'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['candidate-history'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['job-offers-kpis'] })
    expect(candidateHistoryBuilders[0]?.insert).toHaveBeenCalledWith({
      candidate_id: 'c1',
      action_type: 'status_change',
      description: 'Statut changé de interview à offer_accepted',
      old_value: { statut: 'interview' },
      new_value: { statut: 'offer_accepted' },
      performed_by: 'u1',
    })

    isoSpy.mockRestore()
  })

  it('affiche une erreur sanitizée si la mise à jour de statut échoue', async () => {
    mockFrom.mockImplementation((table: string) => {
      builderState.table = table
      const builder = createBuilder()

      if (table === 'candidates') {
        builder.maybeSingle = vi.fn(() => Promise.resolve({ data: { statut: 'new' }, error: null }))
        builder.single = vi.fn(() => Promise.resolve({ data: null, error: new Error('x') }))
      }

      return builder
    })

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useUpdateCandidateStatus(), { wrapper })

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 'c1', status: 'rejected' })
      } catch {}
    })

    expect(mockToastError).toHaveBeenCalledWith('sanitized:x')
  })
})

describe('useDeleteCandidate', () => {
  it('supprime un candidat et invalide les queries', async () => {
    builderState.thenResult = { data: null, error: null }

    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteCandidate(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('c1')
    })

    expect(builderState.deleted).toBe(true)
    expect(builderState.eqCalls).toContainEqual(['id', 'c1'])
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['candidates'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['job-offers-kpis'] })
    expect(mockToastSuccess).toHaveBeenCalledWith('Candidat supprimé')
  })

  it('affiche une erreur sanitizée si la suppression échoue', async () => {
    builderState.thenResult = { data: null, error: new Error('x') }

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDeleteCandidate(), { wrapper })

    await act(async () => {
      try {
        await result.current.mutateAsync('c1')
      } catch {}
    })

    expect(mockToastError).toHaveBeenCalledWith('sanitized:x')
  })
})

describe('useCandidateHistory', () => {
  it('charge l’historique du candidat', async () => {
    builderState.thenResult = { data: HISTORY_ROWS, error: null }

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useCandidateHistory('c1'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('candidate_history')
    expect(builderState.eqCalls).toContainEqual(['candidate_id', 'c1'])
    expect(builderState.limitCalls).toEqual([100])
    expect(builderState.orderCalls).toEqual([['created_at', { ascending: false }]])
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]?.description).toBe('Statut changé de new à interview')
  })

  it('remonte une erreur si la requête historique échoue', async () => {
    builderState.thenResult = { data: null, error: { message: 'x' } }

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useCandidateHistory('c1'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeTruthy()
  })
})