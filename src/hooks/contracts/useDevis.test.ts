import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useDevis, useDevisDetail } from './useDevis'

const {
  USER,
  DEVIS_ROWS,
  DEVIS_DETAIL,
  CONVERT_SOURCE_DEVIS,
  NEW_DEVIS_ROW,
  UPDATED_DEVIS_ROW,
  NEW_FACTURE_ROW,
  SANITIZED_MESSAGE,
  toastFn,
  sanitizeSupabaseErrorMock,
  useAuthMock,
  mockFrom,
  mockInvalidateQueries,
} = vi.hoisted(() => ({
  USER: {
    id: 'u1',
    email: 'test@example.co',
  },
  DEVIS_ROWS: [
    {
      id: 'd1',
      client_nom: 'Client Alpha',
      statut: 'brouillon',
      etablissement_id: 'e1',
      created_at: '2024-01-02',
    },
    {
      id: 'd2',
      client_nom: 'Client Beta',
      statut: 'envoye',
      etablissement_id: 'e2',
      created_at: '2024-01-01',
    },
  ],
  DEVIS_DETAIL: {
    id: 'd1',
    client_nom: 'Client Alpha',
    statut: 'brouillon',
    etablissement: { id: 'e1', nom: 'Etab 1', ville: 'Paris', adresse: 'Rue A' },
    contact: { id: 'c1', nom: 'Doe', prenom: 'Jane', email: 'jane@example.co', telephone: '0102' },
    commercial: { id: 'u1', prenom: 'Test', nom: 'User' },
    lignes: [
      {
        id: 'dl1',
        designation: 'Prestation A',
        quantite: 2,
        unite: 'heure',
        prix_unitaire_ht: 100,
        taux_tva: 20,
        remise_pourcent: 0,
        produit: { id: 'p1', nom: 'Produit A' },
      },
    ],
  },
  CONVERT_SOURCE_DEVIS: {
    id: 'd1',
    etablissement_id: 'e1',
    groupe_id: 'g1',
    partenaire_id: 'p1',
    contact_id: 'c1',
    client_nom: 'Client Alpha',
    client_adresse: 'Rue A',
    client_email: 'alpha@example.co',
    client_telephone: '010203',
    client_siret: 'siret1',
    conditions_paiement: '30 jours',
    notes_internes: 'note interne',
    notes_client: 'note client',
    commercial_id: 'u2',
    lignes: [
      {
        id: 'dl1',
        produit_id: 'prod1',
        ordre: 0,
        designation: 'Ligne 1',
        description: 'Desc 1',
        quantite: 3,
        unite: 'jour',
        prix_unitaire_ht: 150,
        taux_tva: 20,
        remise_pourcent: 5,
      },
    ],
  },
  NEW_DEVIS_ROW: {
    id: 'd-new',
    client_nom: 'Nouveau Client',
    commercial_id: 'u1',
  },
  UPDATED_DEVIS_ROW: {
    id: 'd1',
    client_nom: 'Client Alpha Modifié',
    statut: 'accepte',
  },
  NEW_FACTURE_ROW: {
    id: 'f1',
    statut: 'brouillon',
  },
  SANITIZED_MESSAGE: 'sanitized-error',
  toastFn: vi.fn(),
  sanitizeSupabaseErrorMock: vi.fn(() => 'sanitized-error'),
  useAuthMock: vi.fn(() => ({
    user: { id: 'u1', email: 'test@example.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  })),
  mockFrom: vi.fn(),
  mockInvalidateQueries: vi.fn(),
}))

type QueueItem = {
  type: 'then' | 'single' | 'maybeSingle'
  value: { data: unknown; error: { message: string } | null }
}

const responseQueue: QueueItem[] = []

function queueThen(data: unknown, error: { message: string } | null = null) {
  responseQueue.push({ type: 'then', value: { data, error } })
}

function queueSingle(data: unknown, error: { message: string } | null = null) {
  responseQueue.push({ type: 'single', value: { data, error } })
}

function queueMaybeSingle(data: unknown, error: { message: string } | null = null) {
  responseQueue.push({ type: 'maybeSingle', value: { data, error } })
}

function shiftExpected(type: QueueItem['type']) {
  const item = responseQueue.shift()
  if (!item) {
    throw new Error(`No queued response for ${type}`)
  }
  if (item.type !== type) {
    throw new Error(`Expected queued response type ${type} but got ${item.type}`)
  }
  return item.value
}

const fromCalls: Array<{
  table: string
  operations: Array<{ method: string; args: unknown[] }>
}> = []

function createBuilder(table: string) {
  const state = {
    table,
    operations: [] as Array<{ method: string; args: unknown[] }>,
  }

  const builder = {
    select: vi.fn((...args: unknown[]) => {
      state.operations.push({ method: 'select', args })
      return builder
    }),
    eq: vi.fn((...args: unknown[]) => {
      state.operations.push({ method: 'eq', args })
      return builder
    }),
    gte: vi.fn((...args: unknown[]) => {
      state.operations.push({ method: 'gte', args })
      return builder
    }),
    lte: vi.fn((...args: unknown[]) => {
      state.operations.push({ method: 'lte', args })
      return builder
    }),
    in: vi.fn((...args: unknown[]) => {
      state.operations.push({ method: 'in', args })
      return builder
    }),
    order: vi.fn((...args: unknown[]) => {
      state.operations.push({ method: 'order', args })
      return builder
    }),
    limit: vi.fn((...args: unknown[]) => {
      state.operations.push({ method: 'limit', args })
      return builder
    }),
    insert: vi.fn((...args: unknown[]) => {
      state.operations.push({ method: 'insert', args })
      return builder
    }),
    update: vi.fn((...args: unknown[]) => {
      state.operations.push({ method: 'update', args })
      return builder
    }),
    delete: vi.fn((...args: unknown[]) => {
      state.operations.push({ method: 'delete', args })
      return builder
    }),
    single: vi.fn(async () => shiftExpected('single')),
    maybeSingle: vi.fn(async () => shiftExpected('maybeSingle')),
    then: (
      onFulfilled?: (value: { data: unknown; error: { message: string } | null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(shiftExpected('then')).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(shiftExpected('then')).catch(onRejected),
  }

  fromCalls.push(state)
  return builder
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: useAuthMock,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: toastFn,
  }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(mockInvalidateQueries)

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return { queryClient, wrapper }
}

beforeEach(() => {
  responseQueue.length = 0
  fromCalls.length = 0
  toastFn.mockClear()
  mockFrom.mockClear()
  mockInvalidateQueries.mockClear()
  sanitizeSupabaseErrorMock.mockClear()
  useAuthMock.mockClear()

  mockFrom.mockImplementation((table: string) => createBuilder(table))
})

describe('useDevis', () => {
  it('charge les devis avec filtres et retourne les valeurs métier attendues', async () => {
    queueThen(DEVIS_ROWS)

    const { wrapper } = createWrapper()

    const { result } = renderHook(
      () => useDevis({ statut: 'brouillon' as never, etablissementId: 'e1' }),
      { wrapper }
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.devis).toEqual([])

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeNull()
    expect(result.current.devis).toEqual(DEVIS_ROWS)
    expect(result.current.devis).toHaveLength(2)
    expect(result.current.devis[0].client_nom).toBe('Client Alpha')
    expect(result.current.devis[1].statut).toBe('envoye')

    expect(mockFrom).toHaveBeenCalledWith('devis')
    const devisCall = fromCalls.find((c) => c.table === 'devis')
    expect(devisCall).toBeDefined()
    expect(devisCall?.operations).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['created_at', { ascending: false }] },
        { method: 'eq', args: ['statut', 'brouillon'] },
        { method: 'eq', args: ['etablissement_id', 'e1'] },
      ])
    )
  })

  it('expose une erreur de query quand Supabase renvoie une erreur', async () => {
    queueThen(null, { message: 'x' })

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDevis(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeTruthy()
    })

    expect(result.current.devis).toEqual([])
    expect(result.current.error?.message).toBe('x')
  })

  it('crée un devis avec ses lignes, invalide le cache et affiche un toast de succès', async () => {
    queueThen(DEVIS_ROWS)
    queueSingle(NEW_DEVIS_ROW)
    queueThen(null)

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDevis(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const payload = {
      client_nom: 'Nouveau Client',
      client_email: 'nouveau@example.co',
      etablissement_id: 'e1',
      lignes: [
        {
          designation: 'Audit',
          quantite: 2,
          prix_unitaire_ht: 120,
        },
        {
          designation: 'Support',
          quantite: 1,
          prix_unitaire_ht: 80,
          ordre: 5,
        },
      ],
    }

    await act(async () => {
      const created = await result.current.createDevis(payload)
      expect(created).toEqual(NEW_DEVIS_ROW)
    })

    expect(mockFrom).toHaveBeenCalledWith('devis')
    expect(mockFrom).toHaveBeenCalledWith('devis_lignes')

    const devisInsertCall = fromCalls.find(
      (c) => c.table === 'devis' && c.operations.some((o) => o.method === 'insert')
    )
    const lignesInsertCall = fromCalls.find(
      (c) => c.table === 'devis_lignes' && c.operations.some((o) => o.method === 'insert')
    )

    expect(devisInsertCall?.operations).toEqual(
      expect.arrayContaining([
        {
          method: 'insert',
          args: [
            expect.objectContaining({
              client_nom: 'Nouveau Client',
              client_email: 'nouveau@example.co',
              etablissement_id: 'e1',
              created_by: USER.id,
              commercial_id: USER.id,
            }),
          ],
        },
      ])
    )

    expect(lignesInsertCall?.operations).toEqual(
      expect.arrayContaining([
        {
          method: 'insert',
          args: [
            [
              expect.objectContaining({
                designation: 'Audit',
                devis_id: 'd-new',
                ordre: 0,
              }),
              expect.objectContaining({
                designation: 'Support',
                devis_id: 'd-new',
                ordre: 5,
              }),
            ],
          ],
        },
      ])
    )

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['devis'] })
    expect(toastFn).toHaveBeenCalledWith({ title: 'Devis créé avec succès' })
  })

  it('gère l’erreur de création avec message sanitizé', async () => {
    queueThen(DEVIS_ROWS)
    queueSingle(null, { message: 'x' })

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDevis(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await expect(
        result.current.createDevis({
          client_nom: 'Erreur Client',
        })
      ).rejects.toMatchObject({ message: 'x' })
    })

    expect(sanitizeSupabaseErrorMock).toHaveBeenCalled()
    expect(toastFn).toHaveBeenCalledWith({
      title: 'Erreur lors de la création du devis',
      description: SANITIZED_MESSAGE,
      variant: 'destructive',
    })
  })

  it('met à jour un devis avec le bon id et les bonnes données', async () => {
    queueThen(DEVIS_ROWS)
    queueSingle(UPDATED_DEVIS_ROW)

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDevis(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      const updated = await result.current.updateDevis({
        id: 'd1',
        client_nom: 'Client Alpha Modifié',
        statut: 'accepte' as never,
      })
      expect(updated).toEqual(UPDATED_DEVIS_ROW)
    })

    const updateCall = fromCalls.find(
      (c) => c.table === 'devis' && c.operations.some((o) => o.method === 'update')
    )

    expect(updateCall?.operations).toEqual(
      expect.arrayContaining([
        {
          method: 'update',
          args: [
            {
              client_nom: 'Client Alpha Modifié',
              statut: 'accepte',
            },
          ],
        },
        {
          method: 'eq',
          args: ['id', 'd1'],
        },
      ])
    )

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['devis'] })
    expect(toastFn).toHaveBeenCalledWith({ title: 'Devis mis à jour' })
  })

  it('supprime un devis avec le bon id', async () => {
    queueThen(DEVIS_ROWS)
    queueThen(null)

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDevis(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.deleteDevis('d2')
    })

    const deleteCall = fromCalls.find(
      (c) => c.table === 'devis' && c.operations.some((o) => o.method === 'delete')
    )

    expect(deleteCall?.operations).toEqual(
      expect.arrayContaining([
        { method: 'delete', args: [] },
        { method: 'eq', args: ['id', 'd2'] },
      ])
    )

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['devis'] })
    expect(toastFn).toHaveBeenCalledWith({ title: 'Devis supprimé' })
  })

  it('convertit un devis en facture, copie les lignes puis met à jour le statut du devis', async () => {
    queueThen(DEVIS_ROWS)
    queueMaybeSingle(CONVERT_SOURCE_DEVIS)
    queueSingle(NEW_FACTURE_ROW)
    queueThen(null)
    queueThen(null)

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDevis(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      const facture = await result.current.convertToFacture('d1')
      expect(facture).toEqual(NEW_FACTURE_ROW)
    })

    const facturesInsertCall = fromCalls.find(
      (c) => c.table === 'factures' && c.operations.some((o) => o.method === 'insert')
    )
    const facturesLignesInsertCall = fromCalls.find(
      (c) => c.table === 'factures_lignes' && c.operations.some((o) => o.method === 'insert')
    )
    const devisUpdateToConvertedCall = fromCalls.find(
      (c) =>
        c.table === 'devis' &&
        c.operations.some(
          (o) =>
            o.method === 'update' &&
            JSON.stringify(o.args[0]) === JSON.stringify({ statut: 'converti', facture_id: 'f1' })
        )
    )

    expect(facturesInsertCall?.operations).toEqual(
      expect.arrayContaining([
        {
          method: 'insert',
          args: [
            expect.objectContaining({
              devis_id: 'd1',
              client_nom: 'Client Alpha',
              created_by: USER.id,
              commercial_id: 'u2',
              statut: 'brouillon',
            }),
          ],
        },
      ])
    )

    expect(facturesLignesInsertCall?.operations).toEqual(
      expect.arrayContaining([
        {
          method: 'insert',
          args: [
            [
              expect.objectContaining({
                facture_id: 'f1',
                devis_ligne_id: 'dl1',
                designation: 'Ligne 1',
                quantite: 3,
                unite: 'jour',
                prix_unitaire_ht: 150,
              }),
            ],
          ],
        },
      ])
    )

    expect(devisUpdateToConvertedCall?.operations).toEqual(
      expect.arrayContaining([
        {
          method: 'update',
          args: [{ statut: 'converti', facture_id: 'f1' }],
        },
        {
          method: 'eq',
          args: ['id', 'd1'],
        },
      ])
    )

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['devis'] })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['factures'] })
    expect(toastFn).toHaveBeenCalledWith({ title: 'Devis converti en facture' })
  })

  it('gère l’erreur de conversion', async () => {
    queueThen(DEVIS_ROWS)
    queueMaybeSingle(null, { message: 'x' })

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDevis(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await expect(result.current.convertToFacture('d404')).rejects.toMatchObject({ message: 'x' })
    })

    expect(sanitizeSupabaseErrorMock).toHaveBeenCalled()
    expect(toastFn).toHaveBeenCalledWith({
      title: 'Erreur lors de la conversion',
      description: SANITIZED_MESSAGE,
      variant: 'destructive',
    })
  })
})

describe('useDevisDetail', () => {
  it('charge le détail d’un devis', async () => {
    queueMaybeSingle(DEVIS_DETAIL)

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDevisDetail('d1'), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(DEVIS_DETAIL)
    expect(result.current.data?.id).toBe('d1')
    expect(result.current.data?.lignes).toHaveLength(1)
    expect(result.current.data?.lignes?.[0].designation).toBe('Prestation A')

    const detailCall = fromCalls.find((c) => c.table === 'devis')
    expect(detailCall?.operations).toEqual(
      expect.arrayContaining([{ method: 'eq', args: ['id', 'd1'] }])
    )
  })

  it('retourne une erreur quand le chargement du détail échoue', async () => {
    queueMaybeSingle(null, { message: 'x' })

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDevisDetail('d1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe('x')
  })

  it('n’exécute pas la query si aucun id n’est fourni', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useDevisDetail(undefined), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
