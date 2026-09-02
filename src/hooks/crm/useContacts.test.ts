import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockFrom, mockToast, mockSanitize, ROWS, HISTORY_ROW, makeBuilder } = vi.hoisted(() => {
  type Result = { data: unknown; error: unknown }

  const ROWS = [
    {
      id: 'c1',
      etablissement_id: '12345678-1234-4123-8123-123456789abc',
      nom: 'Martin',
      prenom: 'Paul',
      email: 'paul.martin@example.fr',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-05T00:00:00Z',
    },
    {
      id: 'c2',
      etablissement_id: '12345678-1234-4123-8123-123456789abc',
      nom: 'Durand',
      prenom: 'Sophie',
      email: 'sophie.durand@example.fr',
      created_at: '2024-02-01T00:00:00Z',
      updated_at: '2024-02-05T00:00:00Z',
    },
  ]

  const HISTORY_ROW = {
    change_source: 'import',
    changed_at: '2024-03-01T00:00:00Z',
    changed_fields: ['email'],
  }

  const makeBuilder = (
    awaited: Result,
    singleResult?: Result,
    maybeSingleResult?: Result
  ) => {
    const b: Record<string, unknown> = {}
    const chainMethods = [
      'select',
      'eq',
      'neq',
      'gte',
      'lte',
      'in',
      'order',
      'limit',
      'insert',
      'update',
      'delete',
      'upsert',
    ]
    for (const m of chainMethods) {
      b[m] = vi.fn(() => b)
    }
    b.single = vi.fn(() => Promise.resolve(singleResult ?? awaited))
    b.maybeSingle = vi.fn(() => Promise.resolve(maybeSingleResult ?? awaited))
    b.then = (
      onFulfilled?: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown
    ) => Promise.resolve(awaited).then(onFulfilled, onRejected)
    b.catch = (onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(awaited).catch(onRejected)
    return b
  }

  return {
    mockFrom: vi.fn(),
    mockToast: vi.fn(),
    mockSanitize: vi.fn((e: unknown) =>
      e && typeof e === 'object' && 'message' in (e as Record<string, unknown>)
        ? String((e as { message: unknown }).message)
        : 'erreur'
    ),
    ROWS,
    HISTORY_ROW,
    makeBuilder,
  }
})

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitize,
}))

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: { standard: { retryDelay: 0, staleTime: 0 } },
}))

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}))

import { useContacts } from './useContacts'

const VALID_ID = '12345678-1234-4123-8123-123456789abc'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return Wrapper
}

describe('useContacts', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockToast.mockClear()
    mockSanitize.mockClear()
  })

  it('ne fait aucune requête et retourne un tableau vide si etablissementId est invalide', () => {
    const { result } = renderHook(() => useContacts('not-a-uuid'), {
      wrapper: createWrapper(),
    })

    expect(result.current.contacts).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })

  it('charge les contacts avec leur historique et les trie par date de création décroissante', async () => {
    const contactsBuilder = makeBuilder({ data: ROWS, error: null })
    const historyBuilder = makeBuilder({ data: HISTORY_ROW, error: null }, undefined, {
      data: HISTORY_ROW,
      error: null,
    })
    mockFrom.mockImplementation((table: string) =>
      table === 'contacts_history' ? historyBuilder : contactsBuilder
    )

    const { result } = renderHook(() => useContacts(VALID_ID), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.contacts).toHaveLength(2)
    })

    // Tri décroissant sur created_at : c2 (février) avant c1 (janvier)
    expect(result.current.contacts[0].id).toBe('c2')
    expect(result.current.contacts[0].nom).toBe('Durand')
    expect(result.current.contacts[1].id).toBe('c1')
    expect(result.current.contacts[1].prenom).toBe('Paul')

    // Enrichissement via l'historique
    expect(result.current.contacts[0].latest_source).toBe('import')
    expect(result.current.contacts[0].latest_update).toBe('2024-03-01T00:00:00Z')

    expect(mockFrom).toHaveBeenCalledWith('contacts')
    expect(mockFrom).toHaveBeenCalledWith('contacts_history')
    expect(contactsBuilder.eq).toHaveBeenCalledWith('etablissement_id', VALID_ID)
    expect(result.current.isLoading).toBe(false)
  })

  it("passe en erreur et affiche un toast destructif si la requête échoue", async () => {
    const contactsBuilder = makeBuilder({ data: null, error: { message: 'x' } })
    mockFrom.mockImplementation(() => contactsBuilder)

    const { result } = renderHook(() => useContacts(VALID_ID), {
      wrapper: createWrapper(),
    })

    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy()
      },
      { timeout: 4000 }
    )

    expect(result.current.contacts).toEqual([])
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erreur',
        description: 'Impossible de charger les contacts',
        variant: 'destructive',
      })
    )
  })

  it("addContact insère le contact avec l'etablissement_id et affiche un toast de succès", async () => {
    const newContact = { id: 'c3', nom: 'Petit', prenom: 'Luc' }
    const contactsBuilder = makeBuilder(
      { data: [], error: null },
      { data: newContact, error: null },
      { data: null, error: null }
    )
    const historyBuilder = makeBuilder({ data: null, error: null }, undefined, {
      data: null,
      error: null,
    })
    mockFrom.mockImplementation((table: string) =>
      table === 'contacts_history' ? historyBuilder : contactsBuilder
    )

    const { result } = renderHook(() => useContacts(VALID_ID), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.addContact({
        nom: 'Petit',
        prenom: 'Luc',
      } as Parameters<typeof result.current.addContact>[0])
    })

    expect(contactsBuilder.insert).toHaveBeenCalledWith({
      nom: 'Petit',
      prenom: 'Luc',
      etablissement_id: VALID_ID,
    })
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Contact ajouté',
        description: 'Le contact a été ajouté avec succès',
      })
    )
  })

  it('deleteContact supprime le contact ciblé et affiche un toast de succès', async () => {
    const contactsBuilder = makeBuilder({ data: [], error: null })
    const historyBuilder = makeBuilder({ data: null, error: null }, undefined, {
      data: null,
      error: null,
    })
    mockFrom.mockImplementation((table: string) =>
      table === 'contacts_history' ? historyBuilder : contactsBuilder
    )

    const { result } = renderHook(() => useContacts(VALID_ID), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.deleteContact('c1')
    })

    expect(contactsBuilder.delete).toHaveBeenCalled()
    expect(contactsBuilder.eq).toHaveBeenCalledWith('id', 'c1')
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Contact supprimé',
        description: 'Le contact a été supprimé avec succès',
      })
    )
  })

  it("updateContactRole met à jour type_contact et affiche un toast de confirmation", async () => {
    const contactsBuilder = makeBuilder({ data: [], error: null })
    const historyBuilder = makeBuilder({ data: null, error: null }, undefined, {
      data: null,
      error: null,
    })
    mockFrom.mockImplementation((table: string) =>
      table === 'contacts_history' ? historyBuilder : contactsBuilder
    )

    const { result } = renderHook(() => useContacts(VALID_ID), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.updateContactRole('c2', 'direction')
    })

    expect(contactsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ type_contact: 'direction' })
    )
    expect(contactsBuilder.eq).toHaveBeenCalledWith('id', 'c2')
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Rôle mis à jour' })
    )
  })
})