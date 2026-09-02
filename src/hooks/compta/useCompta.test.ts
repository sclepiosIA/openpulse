const {
  COMPTES,
  JOURNAUX,
  EXERCICES,
  ECRITURES,
  LIGNES,
  BALANCE,
  GRAND_LIVRE,
  CREATED_ECRITURE,
  COMPTES_RESULT,
  JOURNAUX_RESULT,
  EXERCICES_RESULT,
  ECRITURES_RESULT,
  LIGNES_RESULT,
  BALANCE_RESULT,
  GRAND_LIVRE_RESULT,
  CREATED_ECRITURE_RESULT,
  EMPTY_RESULT,
  ERROR_RESULT,
  mockFrom,
  mockBuilder,
  supabaseState,
  toastSuccess,
  toastError,
} = vi.hoisted(() => {
  type DbError = { message: string }
  type DbResult = { data: unknown; error: DbError | null }

  const COMPTES = [
    {
      id: 'c1',
      numero: '401',
      libelle: 'Fournisseurs',
      classe: 4,
      type: 'passif',
      parent_id: null,
      lettrable: true,
      auxiliaire: true,
      actif: true,
    },
    {
      id: 'c2',
      numero: '512',
      libelle: 'Banque',
      classe: 5,
      type: 'actif',
      parent_id: null,
      lettrable: false,
      auxiliaire: false,
      actif: true,
    },
  ]

  const JOURNAUX = [
    {
      id: 'j1',
      code: 'AC',
      libelle: 'Achats',
      type: 'achat',
      actif: true,
    },
    {
      id: 'j2',
      code: 'BQ',
      libelle: 'Banque',
      type: 'banque',
      actif: true,
    },
  ]

  const EXERCICES = [
    {
      id: 'ex2',
      libelle: 'Exercice 2025',
      date_debut: '2025-01-01',
      date_fin: '2025-12-31',
      statut: 'ouvert',
    },
    {
      id: 'ex1',
      libelle: 'Exercice 2024',
      date_debut: '2024-01-01',
      date_fin: '2024-12-31',
      statut: 'clos',
    },
  ]

  const ECRITURES = [
    {
      id: 'ecr1',
      exercice_id: 'ex2',
      journal_id: 'j1',
      date_ecriture: '2025-02-10',
      numero_piece: 'P1',
      libelle: 'Facture fournisseur',
      reference_externe: null,
      source_type: 'manuel',
      statut: 'brouillon',
      created_at: '2025-02-10T08:00:00Z',
    },
  ]

  const LIGNES = [
    {
      id: 'l1',
      ecriture_id: 'ecr1',
      compte_id: 'c1',
      libelle: 'Achat',
      debit: 120,
      credit: 0,
      lettrage: null,
      tiers_type: 'fournisseur',
      tiers_id: 't1',
      date_echeance: '2025-03-10',
      ordre: 0,
    },
    {
      id: 'l2',
      ecriture_id: 'ecr1',
      compte_id: 'c2',
      libelle: 'Règlement',
      debit: 0,
      credit: 120,
      lettrage: null,
      tiers_type: null,
      tiers_id: null,
      date_echeance: null,
      ordre: 1,
    },
  ]

  const BALANCE = [
    {
      compte_id: 'c1',
      numero: '401',
      libelle: 'Fournisseurs',
      debit: 120,
      credit: 0,
      solde: 120,
      exercice_id: 'ex2',
    },
  ]

  const GRAND_LIVRE = [
    {
      ligne_id: 'l1',
      compte_id: 'c1',
      date_ecriture: '2025-02-10',
      journal_code: 'AC',
      libelle: 'Facture fournisseur',
      debit: 120,
      credit: 0,
    },
  ]

  const CREATED_ECRITURE = {
    id: 'ecr-new',
    exercice_id: 'ex2',
    journal_id: 'j1',
    date_ecriture: '2025-02-11',
    numero_piece: 'P2',
    libelle: 'Nouvelle écriture',
    reference_externe: null,
    source_type: 'manuel',
    statut: 'brouillon',
    created_at: '2025-02-11T08:00:00Z',
  }

  const COMPTES_RESULT: DbResult = { data: COMPTES, error: null }
  const JOURNAUX_RESULT: DbResult = { data: JOURNAUX, error: null }
  const EXERCICES_RESULT: DbResult = { data: EXERCICES, error: null }
  const ECRITURES_RESULT: DbResult = { data: ECRITURES, error: null }
  const LIGNES_RESULT: DbResult = { data: LIGNES, error: null }
  const BALANCE_RESULT: DbResult = { data: BALANCE, error: null }
  const GRAND_LIVRE_RESULT: DbResult = { data: GRAND_LIVRE, error: null }
  const CREATED_ECRITURE_RESULT: DbResult = { data: CREATED_ECRITURE, error: null }
  const EMPTY_RESULT: DbResult = { data: null, error: null }
  const ERROR_RESULT: DbResult = { data: null, error: { message: 'x' } }

  const supabaseState = {
    currentTable: '',
    tableResults: {} as Record<string, DbResult>,
    singleResults: {} as Record<string, DbResult>,
  }

  const readTableResult = () =>
    supabaseState.tableResults[supabaseState.currentTable] ?? EMPTY_RESULT
  const readSingleResult = () =>
    supabaseState.singleResults[supabaseState.currentTable] ?? readTableResult()

  const mockBuilder = {} as {
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
    then: ReturnType<typeof vi.fn>
    catch: ReturnType<typeof vi.fn>
  }

  mockBuilder.select = vi.fn((_columns?: unknown) => mockBuilder)
  mockBuilder.eq = vi.fn((_column: unknown, _value: unknown) => mockBuilder)
  mockBuilder.gte = vi.fn((_column: unknown, _value: unknown) => mockBuilder)
  mockBuilder.lte = vi.fn((_column: unknown, _value: unknown) => mockBuilder)
  mockBuilder.in = vi.fn((_column: unknown, _values: unknown) => mockBuilder)
  mockBuilder.order = vi.fn((_column: unknown, _options?: unknown) => mockBuilder)
  mockBuilder.limit = vi.fn((_count: unknown) => mockBuilder)
  mockBuilder.insert = vi.fn((_payload?: unknown) => mockBuilder)
  mockBuilder.update = vi.fn((_payload?: unknown) => mockBuilder)
  mockBuilder.delete = vi.fn(() => mockBuilder)
  mockBuilder.single = vi.fn(() => Promise.resolve(readSingleResult()))
  mockBuilder.maybeSingle = vi.fn(() => Promise.resolve(readSingleResult()))
  mockBuilder.then = vi.fn(
    (
      onFulfilled?: ((value: DbResult) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null
    ) => Promise.resolve(readTableResult()).then(onFulfilled ?? undefined, onRejected ?? undefined)
  )
  mockBuilder.catch = vi.fn((onRejected?: ((reason: unknown) => unknown) | null) =>
    Promise.resolve(readTableResult()).catch(onRejected ?? undefined)
  )

  const mockFrom = vi.fn((table: unknown) => {
    supabaseState.currentTable = String(table)
    return mockBuilder
  })

  return {
    COMPTES,
    JOURNAUX,
    EXERCICES,
    ECRITURES,
    LIGNES,
    BALANCE,
    GRAND_LIVRE,
    CREATED_ECRITURE,
    COMPTES_RESULT,
    JOURNAUX_RESULT,
    EXERCICES_RESULT,
    ECRITURES_RESULT,
    LIGNES_RESULT,
    BALANCE_RESULT,
    GRAND_LIVRE_RESULT,
    CREATED_ECRITURE_RESULT,
    EMPTY_RESULT,
    ERROR_RESULT,
    mockFrom,
    mockBuilder,
    supabaseState,
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import {
  useBalance,
  useComptaComptes,
  useComptaEcritures,
  useComptaExercices,
  useComptaJournaux,
  useComptaLignes,
  useCreateCompte,
  useCreateEcriture,
  useDeleteEcriture,
  useGrandLivre,
  useValidateEcriture,
} from './useCompta'

function resetSupabaseMock() {
  mockFrom.mockClear()
  mockBuilder.select.mockClear()
  mockBuilder.eq.mockClear()
  mockBuilder.gte.mockClear()
  mockBuilder.lte.mockClear()
  mockBuilder.in.mockClear()
  mockBuilder.order.mockClear()
  mockBuilder.limit.mockClear()
  mockBuilder.insert.mockClear()
  mockBuilder.update.mockClear()
  mockBuilder.delete.mockClear()
  mockBuilder.single.mockClear()
  mockBuilder.maybeSingle.mockClear()
  mockBuilder.then.mockClear()
  mockBuilder.catch.mockClear()
  toastSuccess.mockClear()
  toastError.mockClear()
  supabaseState.currentTable = ''

  for (const key of Object.keys(supabaseState.tableResults)) {
    delete supabaseState.tableResults[key]
  }

  for (const key of Object.keys(supabaseState.singleResults)) {
    delete supabaseState.singleResults[key]
  }

  supabaseState.tableResults.compta_comptes = COMPTES_RESULT
  supabaseState.tableResults.compta_journaux = JOURNAUX_RESULT
  supabaseState.tableResults.compta_exercices = EXERCICES_RESULT
  supabaseState.tableResults.compta_ecritures = ECRITURES_RESULT
  supabaseState.tableResults.compta_lignes = LIGNES_RESULT
  supabaseState.tableResults.v_compta_balance = BALANCE_RESULT
  supabaseState.tableResults.v_compta_grand_livre = GRAND_LIVRE_RESULT
  supabaseState.singleResults.compta_ecritures = CREATED_ECRITURE_RESULT
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)

  return { Wrapper, queryClient }
}

beforeEach(() => {
  resetSupabaseMock()
})

describe('useCompta', () => {
  it('charge puis retourne les comptes actifs ordonnés par numéro', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useComptaComptes(), { wrapper: Wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(COMPTES)
    expect(result.current.data?.[0]).toMatchObject({
      id: 'c1',
      numero: '401',
      libelle: 'Fournisseurs',
      classe: 4,
      lettrable: true,
      auxiliaire: true,
    })
    expect(mockFrom).toHaveBeenCalledWith('compta_comptes')
    expect(mockBuilder.select).toHaveBeenCalledWith('*')
    expect(mockBuilder.eq).toHaveBeenCalledWith('actif', true)
    expect(mockBuilder.order).toHaveBeenCalledWith('numero')
  })

  it('retourne une erreur lorsque la requête des comptes échoue', async () => {
    supabaseState.tableResults.compta_comptes = ERROR_RESULT
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useComptaComptes(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toMatchObject({ message: 'x' })
    expect(mockFrom).toHaveBeenCalledWith('compta_comptes')
    expect(toastError).not.toHaveBeenCalled()
  })

  it('retourne les journaux actifs ordonnés par code', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useComptaJournaux(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(JOURNAUX)
    expect(result.current.data?.[1]).toMatchObject({
      id: 'j2',
      code: 'BQ',
      libelle: 'Banque',
      type: 'banque',
      actif: true,
    })
    expect(mockFrom).toHaveBeenCalledWith('compta_journaux')
    expect(mockBuilder.select).toHaveBeenCalledWith('*')
    expect(mockBuilder.eq).toHaveBeenCalledWith('actif', true)
    expect(mockBuilder.order).toHaveBeenCalledWith('code')
  })

  it('retourne les exercices ordonnés du plus récent au plus ancien', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useComptaExercices(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(EXERCICES)
    expect(result.current.data?.[0]).toMatchObject({
      id: 'ex2',
      libelle: 'Exercice 2025',
      date_debut: '2025-01-01',
      date_fin: '2025-12-31',
      statut: 'ouvert',
    })
    expect(mockFrom).toHaveBeenCalledWith('compta_exercices')
    expect(mockBuilder.select).toHaveBeenCalledWith('*')
    expect(mockBuilder.order).toHaveBeenCalledWith('date_debut', { ascending: false })
  })

  it('retourne une erreur lorsque la requête des exercices échoue', async () => {
    supabaseState.tableResults.compta_exercices = ERROR_RESULT
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useComptaExercices(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toMatchObject({ message: 'x' })
    expect(mockFrom).toHaveBeenCalledWith('compta_exercices')
  })

  it('applique les filtres des écritures comptables', async () => {
    const filters = {
      journalId: 'j1',
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28',
      statut: 'brouillon',
    }
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useComptaEcritures(filters), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(ECRITURES)
    expect(result.current.data?.[0]).toMatchObject({
      id: 'ecr1',
      journal_id: 'j1',
      date_ecriture: '2025-02-10',
      libelle: 'Facture fournisseur',
      statut: 'brouillon',
    })
    expect(mockFrom).toHaveBeenCalledWith('compta_ecritures')
    expect(mockBuilder.select).toHaveBeenCalledWith('*')
    expect(mockBuilder.order).toHaveBeenCalledWith('date_ecriture', { ascending: false })
    expect(mockBuilder.limit).toHaveBeenCalledWith(500)
    expect(mockBuilder.eq).toHaveBeenCalledWith('journal_id', 'j1')
    expect(mockBuilder.eq).toHaveBeenCalledWith('statut', 'brouillon')
    expect(mockBuilder.gte).toHaveBeenCalledWith('date_ecriture', '2025-02-01')
    expect(mockBuilder.lte).toHaveBeenCalledWith('date_ecriture', '2025-02-28')
  })

  it('retourne une erreur lorsque la requête des écritures échoue', async () => {
    supabaseState.tableResults.compta_ecritures = ERROR_RESULT
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useComptaEcritures(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toMatchObject({ message: 'x' })
    expect(mockBuilder.limit).toHaveBeenCalledWith(500)
  })

  it('ne charge pas les lignes sans identifiant d’écriture et les charge avec un identifiant', async () => {
    const { Wrapper } = createWrapper()

    const disabled = renderHook(() => useComptaLignes(null), { wrapper: Wrapper })

    expect(disabled.result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()

    disabled.unmount()

    const enabled = renderHook(() => useComptaLignes('ecr1'), { wrapper: Wrapper })

    await waitFor(() => expect(enabled.result.current.isSuccess).toBe(true))

    expect(enabled.result.current.data).toEqual(LIGNES)
    expect(enabled.result.current.data?.[0]).toMatchObject({
      id: 'l1',
      compte_id: 'c1',
      debit: 120,
      credit: 0,
      ordre: 0,
    })
    expect(mockFrom).toHaveBeenCalledWith('compta_lignes')
    expect(mockBuilder.select).toHaveBeenCalledWith('*')
    expect(mockBuilder.eq).toHaveBeenCalledWith('ecriture_id', 'ecr1')
    expect(mockBuilder.order).toHaveBeenCalledWith('ordre')
  })

  it('retourne la balance filtrée par exercice', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useBalance('ex2'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(BALANCE)
    expect(result.current.data?.[0]).toMatchObject({
      compte_id: 'c1',
      numero: '401',
      libelle: 'Fournisseurs',
      debit: 120,
      solde: 120,
      exercice_id: 'ex2',
    })
    expect(mockFrom).toHaveBeenCalledWith('v_compta_balance')
    expect(mockBuilder.select).toHaveBeenCalledWith('*')
    expect(mockBuilder.order).toHaveBeenCalledWith('numero')
    expect(mockBuilder.eq).toHaveBeenCalledWith('exercice_id', 'ex2')
  })

  it('retourne le grand livre pour un compte donné', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useGrandLivre('c1'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(GRAND_LIVRE)
    expect(result.current.data?.[0]).toMatchObject({
      ligne_id: 'l1',
      compte_id: 'c1',
      journal_code: 'AC',
      debit: 120,
      credit: 0,
    })
    expect(mockFrom).toHaveBeenCalledWith('v_compta_grand_livre')
    expect(mockBuilder.select).toHaveBeenCalledWith('*')
    expect(mockBuilder.eq).toHaveBeenCalledWith('compte_id', 'c1')
    expect(mockBuilder.order).toHaveBeenCalledWith('date_ecriture')
  })

  it('ne charge pas le grand livre sans compte', () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useGrandLivre(null), { wrapper: Wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('crée une écriture équilibrée avec ses lignes puis affiche un succès', async () => {
    const { Wrapper } = createWrapper()
    const payload = {
      journal_id: 'j1',
      date_ecriture: '2025-02-11',
      libelle: 'Nouvelle écriture',
      numero_piece: 'P2',
      exercice_id: 'ex2',
      lignes: [
        {
          compte_id: 'c1',
          libelle: 'Charge',
          debit: 120,
          credit: 0,
          tiers_type: 'fournisseur',
          tiers_id: 't1',
          date_echeance: '2025-03-11',
        },
        {
          compte_id: 'c2',
          debit: 0,
          credit: 120,
        },
      ],
    }
    const { result } = renderHook(() => useCreateEcriture(), { wrapper: Wrapper })

    let mutationResult: unknown
    await act(async () => {
      mutationResult = await result.current.mutateAsync(payload)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('compta_ecritures')
    expect(mockFrom).toHaveBeenCalledWith('compta_lignes')
    expect(mockBuilder.insert).toHaveBeenNthCalledWith(1, {
      journal_id: 'j1',
      date_ecriture: '2025-02-11',
      libelle: 'Nouvelle écriture',
      numero_piece: 'P2',
      exercice_id: 'ex2',
      source_type: 'manuel',
      statut: 'brouillon',
    })
    expect(mockBuilder.select).toHaveBeenCalledWith()
    expect(mockBuilder.single).toHaveBeenCalledTimes(1)
    expect(mockBuilder.insert).toHaveBeenNthCalledWith(2, [
      {
        ecriture_id: 'ecr-new',
        compte_id: 'c1',
        libelle: 'Charge',
        debit: 120,
        credit: 0,
        tiers_type: 'fournisseur',
        tiers_id: 't1',
        date_echeance: '2025-03-11',
        ordre: 0,
      },
      {
        ecriture_id: 'ecr-new',
        compte_id: 'c2',
        libelle: null,
        debit: 0,
        credit: 120,
        tiers_type: null,
        tiers_id: null,
        date_echeance: null,
        ordre: 1,
      },
    ])
    expect(mutationResult).toEqual(CREATED_ECRITURE)
    expect(result.current.data).toEqual(CREATED_ECRITURE)
    expect(toastSuccess).toHaveBeenCalledWith('Écriture créée')
    expect(toastError).not.toHaveBeenCalled()
  })

  it('refuse une écriture non équilibrée et affiche le message d’erreur', async () => {
    const { Wrapper } = createWrapper()
    const payload = {
      journal_id: 'j1',
      date_ecriture: '2025-02-12',
      libelle: 'Écriture déséquilibrée',
      lignes: [
        {
          compte_id: 'c1',
          debit: 100,
          credit: 0,
        },
        {
          compte_id: 'c2',
          debit: 0,
          credit: 80,
        },
      ],
    }
    const { result } = renderHook(() => useCreateEcriture(), { wrapper: Wrapper })

    let caught: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync(payload)
      } catch (error) {
        caught = error
      }
    })

    expect(caught).toBeInstanceOf(Error)
    expect(caught).toMatchObject({
      message: 'Écriture non équilibrée: débit 100 ≠ crédit 80',
    })
    expect(mockFrom).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('Écriture non équilibrée: débit 100 ≠ crédit 80')
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('remonte une erreur Supabase lors de la création de l’écriture', async () => {
    supabaseState.singleResults.compta_ecritures = ERROR_RESULT
    const { Wrapper } = createWrapper()
    const payload = {
      journal_id: 'j1',
      date_ecriture: '2025-02-13',
      libelle: 'Erreur création',
      lignes: [
        { compte_id: 'c1', debit: 50, credit: 0 },
        { compte_id: 'c2', debit: 0, credit: 50 },
      ],
    }
    const { result } = renderHook(() => useCreateEcriture(), { wrapper: Wrapper })

    let caught: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync(payload)
      } catch (error) {
        caught = error
      }
    })

    expect(caught).toMatchObject({ message: 'x' })
    expect(mockFrom).toHaveBeenCalledWith('compta_ecritures')
    expect(mockFrom).not.toHaveBeenCalledWith('compta_lignes')
    expect(toastError).toHaveBeenCalledWith('x')
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('valide une écriture et affiche un succès', async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useValidateEcriture(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.mutateAsync('ecr1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('compta_ecritures')
    expect(mockBuilder.update).toHaveBeenCalledWith({ statut: 'validee' })
    expect(mockBuilder.eq).toHaveBeenCalledWith('id', 'ecr1')
    expect(toastSuccess).toHaveBeenCalledWith('Écriture validée')
    expect(toastError).not.toHaveBeenCalled()
  })

  it('affiche une erreur lorsque la validation échoue', async () => {
    supabaseState.tableResults.compta_ecritures = ERROR_RESULT
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useValidateEcriture(), { wrapper: Wrapper })

    let caught: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync('ecr1')
      } catch (error) {
        caught = error
      }
    })

    expect(caught).toMatchObject({ message: 'x' })
    expect(mockBuilder.update).toHaveBeenCalledWith({ statut: 'validee' })
    expect(mockBuilder.eq).toHaveBeenCalledWith('id', 'ecr1')
    expect(toastError).toHaveBeenCalledWith('x')
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('supprime une écriture et affiche un succès', async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useDeleteEcriture(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.mutateAsync('ecr1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('compta_ecritures')
    expect(mockBuilder.delete).toHaveBeenCalledTimes(1)
    expect(mockBuilder.eq).toHaveBeenCalledWith('id', 'ecr1')
    expect(toastSuccess).toHaveBeenCalledWith('Écriture supprimée')
  })

  it('crée un compte comptable et invalide la liste des comptes', async () => {
    const { Wrapper } = createWrapper()
    const payload = {
      numero: '706',
      libelle: 'Prestations',
      classe: 7,
      type: 'produit',
      lettrable: false,
      auxiliaire: false,
      actif: true,
    }
    const { result } = renderHook(() => useCreateCompte(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('compta_comptes')
    expect(mockBuilder.insert).toHaveBeenCalledWith(payload)
    expect(toastSuccess).toHaveBeenCalledWith('Compte ajouté')
    expect(toastError).not.toHaveBeenCalled()
  })

  it('affiche une erreur lorsque la création du compte échoue', async () => {
    supabaseState.tableResults.compta_comptes = ERROR_RESULT
    const { Wrapper } = createWrapper()
    const payload = {
      numero: '707',
      libelle: 'Marchandises',
      classe: 7,
      type: 'produit',
      actif: true,
    }
    const { result } = renderHook(() => useCreateCompte(), { wrapper: Wrapper })

    let caught: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync(payload)
      } catch (error) {
        caught = error
      }
    })

    expect(caught).toMatchObject({ message: 'x' })
    expect(mockFrom).toHaveBeenCalledWith('compta_comptes')
    expect(mockBuilder.insert).toHaveBeenCalledWith(payload)
    expect(toastError).toHaveBeenCalledWith('x')
    expect(toastSuccess).not.toHaveBeenCalled()
  })
})
