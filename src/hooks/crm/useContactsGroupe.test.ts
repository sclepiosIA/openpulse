// @vitest-environment jsdom
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act, cleanup } from '@testing-library/react'
import {
  useContactsGroupe,
  useCreateContactGroupe,
  useUpdateContactGroupe,
  useDeleteContactGroupe,
} from './useContactsGroupe'

const {
  CONTACTS,
  CREATED_CONTACT,
  UPDATED_CONTACT,
  toastFn,
  mockFrom,
} = vi.hoisted(() => {
  const CONTACTS = [
    {
      id: 'c1',
      groupe_id: 'g1',
      niveau_contact: 'groupe' as const,
      nom: 'Durand',
      prenom: 'Alice',
      fonction: 'Présidente',
      email: 'alice@example.test',
      telephone: '0102030405',
      est_contact_principal: true,
      type_contact: 'administratif',
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: 'c2',
      groupe_id: 'g1',
      niveau_contact: 'groupe' as const,
      nom: 'Martin',
      prenom: 'Bob',
      fonction: 'Secrétaire',
      email: 'bob@example.test',
      telephone: '0607080910',
      est_contact_principal: false,
      type_contact: 'technique',
      created_at: '2024-01-03',
      updated_at: '2024-01-04',
    },
  ]

  const CREATED_CONTACT = {
    id: 'c3',
    groupe_id: 'g1',
    niveau_contact: 'groupe' as const,
    nom: 'Petit',
    prenom: 'Claire',
    fonction: 'Trésorière',
    email: 'claire@example.test',
    telephone: '0111222333',
    est_contact_principal: false,
    type_contact: 'finance',
    created_at: '2024-02-01',
    updated_at: '2024-02-01',
  }

  const UPDATED_CONTACT = {
    ...CONTACTS[0],
    fonction: 'Directrice',
    updated_at: '2024-03-01',
  }

  return {
    CONTACTS,
    CREATED_CONTACT,
    UPDATED_CONTACT,
    toastFn: vi.fn(),
    mockFrom: vi.fn(),
  }
})

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastFn }),
}))

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    standard: {
      staleTime: 120000,
      gcTime: 1800000,
    },
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

type QueryResult = {
  data: unknown
  error: { message: string } | null
}

type BuilderConfig = {
  data?: unknown
  error?: { message: string } | null
  singleData?: unknown
  singleError?: { message: string } | null
  maybeSingleData?: unknown
  maybeSingleError?: { message: string } | null
}

const WAIT_FOR_OPTIONS = { timeout: 5000 }

const queryClients = new Set<QueryClient>()

function createBuilder(config: BuilderConfig = {}) {
  const result: QueryResult = {
    data: config.data ?? null,
    error: config.error ?? null,
  }

  const singleResult: QueryResult = {
    data: config.singleData ?? config.data ?? null,
    error: config.singleError ?? config.error ?? null,
  }

  const maybeSingleResult: QueryResult = {
    data: config.maybeSingleData ?? config.data ?? null,
    error: config.maybeSingleError ?? config.error ?? null,
  }

  let builder: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    gte: ReturnType<typeof vi.fn>
    lte: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    then: (
      onFulfilled?: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise<unknown>
    catch: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  }

  builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(singleResult)),
    maybeSingle: vi.fn(() => Promise.resolve(maybeSingleResult)),
    then: (
      onFulfilled?: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  }

  return builder
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    },
  })

  queryClients.add(queryClient)

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return { wrapper, queryClient }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
  toastFn.mockClear()
})

afterEach(() => {
  cleanup()

  for (const queryClient of queryClients) {
    queryClient.clear()
  }
  queryClients.clear()

  vi.restoreAllMocks()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals?.()
  vi.unstubAllEnvs?.()
})

describe('useContactsGroupe', () => {
  it('charge les contacts du groupe et retourne les valeurs métier attendues', async () => {
    const builder = createBuilder({ data: CONTACTS })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useContactsGroupe('g1'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    }, WAIT_FOR_OPTIONS)

    expect(mockFrom).toHaveBeenCalledWith('contacts')
    expect(builder.select).toHaveBeenCalledWith(
      'id, groupe_id, niveau_contact, nom, prenom, fonction, email, telephone, est_contact_principal, type_contact, created_at, updated_at'
    )
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'groupe_id', 'g1')
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'niveau_contact', 'groupe')
    expect(builder.order).toHaveBeenNthCalledWith(1, 'est_contact_principal', { ascending: false })
    expect(builder.order).toHaveBeenNthCalledWith(2, 'nom')
    expect(result.current.data).toEqual(CONTACTS)
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].nom).toBe('Durand')
    expect(result.current.data?.[0].est_contact_principal).toBe(true)
    expect(result.current.data?.[1].fonction).toBe('Secrétaire')
  })

  it('retourne une erreur quand le chargement échoue', async () => {
    const builder = createBuilder({ data: null, error: { message: 'x' } })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useContactsGroupe('g1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    }, WAIT_FOR_OPTIONS)

    expect(result.current.error).toBeDefined()
    expect(result.current.error?.message).toBe('x')
  })

  it('ne lance pas la requête sans groupeId', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useContactsGroupe(undefined), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.status).toBe('pending')
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('useCreateContactGroupe', () => {
  it('crée un contact groupe, invalide la query et affiche un toast de succès', async () => {
    const builder = createBuilder({ singleData: CREATED_CONTACT })
    mockFrom.mockReturnValue(builder)

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateContactGroupe(), { wrapper })

    const payload = {
      groupe_id: 'g1',
      nom: 'Petit',
      prenom: 'Claire',
      fonction: 'Trésorière',
      email: 'claire@example.test',
      telephone: '0111222333',
      est_contact_principal: false,
      type_contact: 'finance',
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(mockFrom).toHaveBeenCalledWith('contacts')
    expect(builder.insert).toHaveBeenCalledWith({
      ...payload,
      niveau_contact: 'groupe',
      etablissement_id: null,
    })
    expect(builder.select).toHaveBeenCalled()
    expect(builder.single).toHaveBeenCalled()

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contacts-groupe', 'g1'] })
      expect(toastFn).toHaveBeenCalledWith({
        title: 'Succès',
        description: 'Contact groupe créé avec succès',
      })
    }, WAIT_FOR_OPTIONS)
  })

  it('passe en erreur si la création échoue', async () => {
    const builder = createBuilder({ singleData: null, singleError: { message: 'x' } })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateContactGroupe(), { wrapper })

    const payload = {
      groupe_id: 'g1',
      nom: 'Petit',
      prenom: 'Claire',
      fonction: 'Trésorière',
      email: 'claire@example.test',
      telephone: '0111222333',
      est_contact_principal: false,
      type_contact: 'finance',
    }

    await act(async () => {
      await expect(result.current.mutateAsync(payload)).rejects.toMatchObject({ message: 'x' })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    }, WAIT_FOR_OPTIONS)

    expect(toastFn).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de créer le contact groupe',
      variant: 'destructive',
    })
  })
})

describe('useUpdateContactGroupe', () => {
  it('met à jour un contact groupe, invalide la query et affiche un toast de succès', async () => {
    const builder = createBuilder({ singleData: UPDATED_CONTACT })
    mockFrom.mockReturnValue(builder)

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateContactGroupe(), { wrapper })

    const payload = {
      id: 'c1',
      data: {
        fonction: 'Directrice',
      },
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(mockFrom).toHaveBeenCalledWith('contacts')
    expect(builder.update).toHaveBeenCalledWith({ fonction: 'Directrice' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'c1')
    expect(builder.select).toHaveBeenCalled()
    expect(builder.single).toHaveBeenCalled()

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contacts-groupe', 'g1'] })
      expect(toastFn).toHaveBeenCalledWith({
        title: 'Succès',
        description: 'Contact groupe mis à jour avec succès',
      })
    }, WAIT_FOR_OPTIONS)
  })

  it('passe en erreur si la mise à jour échoue', async () => {
    const builder = createBuilder({ singleData: null, singleError: { message: 'x' } })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useUpdateContactGroupe(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'c1',
          data: { fonction: 'Directrice' },
        })
      ).rejects.toMatchObject({ message: 'x' })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    }, WAIT_FOR_OPTIONS)

    expect(toastFn).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de mettre à jour le contact groupe',
      variant: 'destructive',
    })
  })
})

describe('useDeleteContactGroupe', () => {
  it('supprime un contact groupe, invalide la query et affiche un toast de succès', async () => {
    const builder = createBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteContactGroupe(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ id: 'c1', groupeId: 'g1' })
    })

    expect(mockFrom).toHaveBeenCalledWith('contacts')
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'c1')

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contacts-groupe', 'g1'] })
      expect(toastFn).toHaveBeenCalledWith({
        title: 'Succès',
        description: 'Contact groupe supprimé avec succès',
      })
    }, WAIT_FOR_OPTIONS)
  })

  it('passe en erreur si la suppression échoue', async () => {
    const builder = createBuilder({ data: null, error: { message: 'x' } })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useDeleteContactGroupe(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'c1', groupeId: 'g1' })).rejects.toMatchObject({
        message: 'x',
      })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    }, WAIT_FOR_OPTIONS)

    expect(toastFn).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de supprimer le contact groupe',
      variant: 'destructive',
    })
  })
})