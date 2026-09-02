/* @vitest-environment jsdom */

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { usePendingContactsByPartenaire } from './usePendingContactsByPartenaire'

const {
  AUTH_STATE,
  PENDING_LIST_ROWS,
  PENDING_CONTACT_ROW,
  PROFILE_ROW,
  EXISTING_CONTACT_ROW,
  mockFrom,
  mockSanitizeSupabaseError,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'user-1', email: 'user@test.local' },
    session: { user: { id: 'user-1' } },
    isLoading: false,
  },
  PENDING_LIST_ROWS: [
    {
      id: 'pc-1',
      partenaire_id: 'part-1',
      etablissement_id: 'etab-1',
      email_thread_id: 'thread-1',
      extracted_data: {
        nom: 'Durand',
        prenom: 'Alice',
        fonction: 'Directrice',
        email: 'alice@test.local',
        telephone: '0102030405',
      },
      confidence: 0.94,
      status: 'pending',
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: '2024-01-02T10:00:00.000Z',
      updated_at: '2024-01-02T10:00:00.000Z',
    },
    {
      id: 'pc-2',
      partenaire_id: 'part-1',
      etablissement_id: 'etab-2',
      email_thread_id: 'thread-2',
      extracted_data: {
        nom: 'Martin',
        prenom: 'Bob',
        fonction: 'RH',
        email: 'bob@test.local',
        telephone: '0607080910',
      },
      confidence: 0.71,
      status: 'pending',
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: '2024-01-01T09:00:00.000Z',
      updated_at: '2024-01-01T09:00:00.000Z',
    },
  ],
  PENDING_CONTACT_ROW: {
    id: 'pc-1',
    partenaire_id: 'part-1',
    etablissement_id: 'etab-1',
    email_thread_id: 'thread-1',
    extracted_data: {
      nom: 'Durand',
      prenom: 'Alice',
      fonction: 'Directrice',
      email: 'alice@test.local',
      telephone: '0102030405',
    },
    confidence: 0.94,
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
  },
  PROFILE_ROW: { id: 'profile-1' },
  EXISTING_CONTACT_ROW: null as { id: string } | null,
  mockFrom: vi.fn(),
  mockSanitizeSupabaseError: vi.fn((error: Error) => `sanitized:${error.message}`),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

type QueryResult = {
  data?: unknown
  error?: { message: string } | null
}

type BuilderState = {
  table: string
  filters: Array<{ method: string; args: unknown[] }>
  action: 'select' | 'insert' | 'update' | 'delete' | null
  payload?: unknown
}

const responses = new Map<string, QueryResult>()
const operations: Array<BuilderState> = []

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalize(item))
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    )
    return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
      if (key === 'approved_at' || key === 'reviewed_at') {
        acc[key] = '__DATE__'
      } else {
        acc[key] = normalize(val)
      }
      return acc
    }, {})
  }
  return value
}

function makeKey(state: BuilderState) {
  return JSON.stringify(normalize(state))
}

function setResponse(state: BuilderState, result: QueryResult) {
  responses.set(makeKey(state), result)
}

function resolveResponse(state: BuilderState): QueryResult {
  operations.push(JSON.parse(JSON.stringify(normalize(state))) as BuilderState)
  return responses.get(makeKey(state)) ?? { data: null, error: null }
}

function createBuilder(table: string) {
  const state: BuilderState = {
    table,
    filters: [],
    action: null,
  }

  const builder = {
    select(selection: string) {
      state.action = 'select'
      state.filters.push({ method: 'select', args: [selection] })
      return builder
    },
    eq(column: string, value: unknown) {
      state.filters.push({ method: 'eq', args: [column, value] })
      return builder
    },
    gte(column: string, value: unknown) {
      state.filters.push({ method: 'gte', args: [column, value] })
      return builder
    },
    lte(column: string, value: unknown) {
      state.filters.push({ method: 'lte', args: [column, value] })
      return builder
    },
    in(column: string, value: unknown[]) {
      state.filters.push({ method: 'in', args: [column, value] })
      return builder
    },
    order(column: string, value?: unknown) {
      state.filters.push({ method: 'order', args: [column, value] })
      return builder
    },
    limit(value: number) {
      state.filters.push({ method: 'limit', args: [value] })
      return builder
    },
    insert(payload: unknown) {
      state.action = 'insert'
      state.payload = payload
      return builder
    },
    update(payload: unknown) {
      state.action = 'update'
      state.payload = payload
      return builder
    },
    delete() {
      state.action = 'delete'
      return builder
    },
    maybeSingle() {
      return Promise.resolve(resolveResponse(state))
    },
    single() {
      return Promise.resolve(resolveResponse(state))
    },
    then(onFulfilled?: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(resolveResponse(state)).then(onFulfilled, onRejected)
    },
    catch(onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(resolveResponse(state)).catch(onRejected)
    },
  }

  return builder
}

function setupMockFrom() {
  mockFrom.mockImplementation((table: string) => createBuilder(table))
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('usePendingContactsByPartenaire', () => {
  beforeEach(() => {
    responses.clear()
    operations.length = 0
    vi.clearAllMocks()
    setupMockFrom()
  })

  it('charge les contacts en attente puis expose les données métier attendues', async () => {
    setResponse(
      {
        table: 'pending_contacts',
        action: 'select',
        filters: [
          {
            method: 'select',
            args: [
              'id, partenaire_id, etablissement_id, email_thread_id, extracted_data, confidence, status, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at',
            ],
          },
          { method: 'eq', args: ['partenaire_id', 'part-1'] },
          { method: 'eq', args: ['status', 'pending'] },
          { method: 'order', args: ['confidence', { ascending: false }] },
          { method: 'order', args: ['created_at', { ascending: false }] },
          { method: 'limit', args: [200] },
        ],
      },
      { data: PENDING_LIST_ROWS, error: null }
    )

    const { result } = renderHook(() => usePendingContactsByPartenaire('part-1'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.pendingContacts).toEqual([])

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.pendingContacts).toHaveLength(2)
    expect(result.current.pendingContacts[0]).toMatchObject({
      id: 'pc-1',
      partenaire_id: 'part-1',
      status: 'pending',
      confidence: 0.94,
      extracted_data: {
        nom: 'Durand',
        prenom: 'Alice',
        fonction: 'Directrice',
        email: 'alice@test.local',
        telephone: '0102030405',
      },
    })
    expect(result.current.pendingContacts[1]).toMatchObject({
      id: 'pc-2',
      extracted_data: {
        nom: 'Martin',
        email: 'bob@test.local',
      },
    })
    expect(mockFrom).toHaveBeenCalledWith('pending_contacts')
  })

  it('approuve un contact et crée un nouveau contact partenaire quand aucun contact existant ne correspond', async () => {
    setResponse(
      {
        table: 'pending_contacts',
        action: 'select',
        filters: [
          {
            method: 'select',
            args: [
              'id, partenaire_id, etablissement_id, email_thread_id, extracted_data, confidence, status, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at',
            ],
          },
          { method: 'eq', args: ['partenaire_id', 'part-1'] },
          { method: 'eq', args: ['status', 'pending'] },
          { method: 'order', args: ['confidence', { ascending: false }] },
          { method: 'order', args: ['created_at', { ascending: false }] },
          { method: 'limit', args: [200] },
        ],
      },
      { data: PENDING_LIST_ROWS, error: null }
    )

    setResponse(
      {
        table: 'pending_contacts',
        action: 'select',
        filters: [
          {
            method: 'select',
            args: [
              'id, partenaire_id, etablissement_id, email_thread_id, extracted_data, confidence, status, reviewed_by, reviewed_at',
            ],
          },
          { method: 'eq', args: ['id', 'pc-1'] },
        ],
      },
      { data: PENDING_CONTACT_ROW, error: null }
    )

    setResponse(
      {
        table: 'profiles',
        action: 'select',
        filters: [
          { method: 'select', args: ['id'] },
          { method: 'eq', args: ['user_id', 'user-1'] },
        ],
      },
      { data: PROFILE_ROW, error: null }
    )

    setResponse(
      {
        table: 'partenaires_contacts',
        action: 'select',
        filters: [
          { method: 'select', args: ['id'] },
          { method: 'eq', args: ['partenaire_id', 'part-1'] },
          { method: 'eq', args: ['email', 'alice@test.local'] },
        ],
      },
      { data: EXISTING_CONTACT_ROW, error: null }
    )

    setResponse(
      {
        table: 'partenaires_contacts',
        action: 'insert',
        payload: {
          partenaire_id: 'part-1',
          nom: 'Durand',
          prenom: 'Alice',
          fonction: 'Directrice',
          email: 'alice@test.local',
          telephone: '0102030405',
          created_source: 'email_ai',
          created_metadata: {
            email_thread_id: 'thread-1',
            confidence: 0.94,
            approved_at: '__DATE__',
            reviewed_by: 'profile-1',
          },
        },
        filters: [],
      },
      { data: null, error: null }
    )

    setResponse(
      {
        table: 'pending_contacts',
        action: 'update',
        payload: {
          status: 'approved',
          reviewed_by: 'profile-1',
          reviewed_at: '__DATE__',
        },
        filters: [{ method: 'eq', args: ['id', 'pc-1'] }],
      },
      { data: null, error: null }
    )

    const { result } = renderHook(() => usePendingContactsByPartenaire('part-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.approvePendingContact('pc-1')
    })

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Contact validé avec succès')
    })

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockFrom).toHaveBeenCalledWith('partenaires_contacts')

    expect(operations).toContainEqual({
      table: 'partenaires_contacts',
      action: 'insert',
      payload: {
        partenaire_id: 'part-1',
        nom: 'Durand',
        prenom: 'Alice',
        fonction: 'Directrice',
        email: 'alice@test.local',
        telephone: '0102030405',
        created_source: 'email_ai',
        created_metadata: {
          email_thread_id: 'thread-1',
          confidence: 0.94,
          approved_at: '__DATE__',
          reviewed_by: 'profile-1',
        },
      },
      filters: [],
    })

    expect(operations).toContainEqual({
      table: 'pending_contacts',
      action: 'update',
      payload: {
        status: 'approved',
        reviewed_by: 'profile-1',
        reviewed_at: '__DATE__',
      },
      filters: [{ method: 'eq', args: ['id', 'pc-1'] }],
    })
  })

  it("passe en erreur de query si la récupération renvoie une erreur supabase", async () => {
    setResponse(
      {
        table: 'pending_contacts',
        action: 'select',
        filters: [
          {
            method: 'select',
            args: [
              'id, partenaire_id, etablissement_id, email_thread_id, extracted_data, confidence, status, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at',
            ],
          },
          { method: 'eq', args: ['partenaire_id', 'part-err'] },
          { method: 'eq', args: ['status', 'pending'] },
          { method: 'order', args: ['confidence', { ascending: false }] },
          { method: 'order', args: ['created_at', { ascending: false }] },
          { method: 'limit', args: [200] },
        ],
      },
      { data: null, error: { message: 'x' } }
    )

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => usePendingContactsByPartenaire('part-err'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      const state = queryClient.getQueryState(['pending-contacts-partenaire', 'part-err'])
      expect(state?.status).toBe('error')
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.pendingContacts).toEqual([])
  })

  it('rejette un contact pending et met à jour son statut avec le profil courant', async () => {
    setResponse(
      {
        table: 'pending_contacts',
        action: 'select',
        filters: [
          {
            method: 'select',
            args: [
              'id, partenaire_id, etablissement_id, email_thread_id, extracted_data, confidence, status, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at',
            ],
          },
          { method: 'eq', args: ['partenaire_id', 'part-1'] },
          { method: 'eq', args: ['status', 'pending'] },
          { method: 'order', args: ['confidence', { ascending: false }] },
          { method: 'order', args: ['created_at', { ascending: false }] },
          { method: 'limit', args: [200] },
        ],
      },
      { data: PENDING_LIST_ROWS, error: null }
    )

    setResponse(
      {
        table: 'profiles',
        action: 'select',
        filters: [
          { method: 'select', args: ['id'] },
          { method: 'eq', args: ['user_id', 'user-1'] },
        ],
      },
      { data: PROFILE_ROW, error: null }
    )

    setResponse(
      {
        table: 'pending_contacts',
        action: 'update',
        payload: {
          status: 'rejected',
          rejection_reason: 'Rejeté manuellement',
          reviewed_by: 'profile-1',
          reviewed_at: '__DATE__',
        },
        filters: [{ method: 'eq', args: ['id', 'pc-2'] }],
      },
      { data: null, error: null }
    )

    const { result } = renderHook(() => usePendingContactsByPartenaire('part-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.rejectPendingContact('pc-2')
    })

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Contact rejeté')
    })

    expect(operations).toContainEqual({
      table: 'pending_contacts',
      action: 'update',
      payload: {
        status: 'rejected',
        rejection_reason: 'Rejeté manuellement',
        reviewed_by: 'profile-1',
        reviewed_at: '__DATE__',
      },
      filters: [{ method: 'eq', args: ['id', 'pc-2'] }],
    })
  })

  it("affiche une erreur toast si l'approbation échoue sur l'insertion du contact partenaire", async () => {
    setResponse(
      {
        table: 'pending_contacts',
        action: 'select',
        filters: [
          {
            method: 'select',
            args: [
              'id, partenaire_id, etablissement_id, email_thread_id, extracted_data, confidence, status, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at',
            ],
          },
          { method: 'eq', args: ['partenaire_id', 'part-1'] },
          { method: 'eq', args: ['status', 'pending'] },
          { method: 'order', args: ['confidence', { ascending: false }] },
          { method: 'order', args: ['created_at', { ascending: false }] },
          { method: 'limit', args: [200] },
        ],
      },
      { data: PENDING_LIST_ROWS, error: null }
    )

    setResponse(
      {
        table: 'pending_contacts',
        action: 'select',
        filters: [
          {
            method: 'select',
            args: [
              'id, partenaire_id, etablissement_id, email_thread_id, extracted_data, confidence, status, reviewed_by, reviewed_at',
            ],
          },
          { method: 'eq', args: ['id', 'pc-1'] },
        ],
      },
      { data: PENDING_CONTACT_ROW, error: null }
    )

    setResponse(
      {
        table: 'profiles',
        action: 'select',
        filters: [
          { method: 'select', args: ['id'] },
          { method: 'eq', args: ['user_id', 'user-1'] },
        ],
      },
      { data: PROFILE_ROW, error: null }
    )

    setResponse(
      {
        table: 'partenaires_contacts',
        action: 'select',
        filters: [
          { method: 'select', args: ['id'] },
          { method: 'eq', args: ['partenaire_id', 'part-1'] },
          { method: 'eq', args: ['email', 'alice@test.local'] },
        ],
      },
      { data: null, error: null }
    )

    setResponse(
      {
        table: 'partenaires_contacts',
        action: 'insert',
        payload: {
          partenaire_id: 'part-1',
          nom: 'Durand',
          prenom: 'Alice',
          fonction: 'Directrice',
          email: 'alice@test.local',
          telephone: '0102030405',
          created_source: 'email_ai',
          created_metadata: {
            email_thread_id: 'thread-1',
            confidence: 0.94,
            approved_at: '__DATE__',
            reviewed_by: 'profile-1',
          },
        },
        filters: [],
      },
      { data: null, error: { message: 'x' } }
    )

    const { result } = renderHook(() => usePendingContactsByPartenaire('part-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.approvePendingContact('pc-1')
    })

    await waitFor(() => {
      expect(mockSanitizeSupabaseError).toHaveBeenCalled()
      expect(toastError).toHaveBeenCalledWith('sanitized:x')
    })
  })
})