import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useTasksBreakdown } from './useTasksBreakdown'

const { ROWS, ERROR, createBuilder, mockFrom, mockChannel, mockRemoveChannel } = vi.hoisted(() => {
  const ROWS = [
    { id: 't1', statut: 'Terminé', archive: false, categorie: { nom: 'Commercial' } },
    { id: 't2', statut: 'En cours', archive: false, categorie: { nom: 'Commercial' } },
    { id: 't3', statut: 'Terminé', archive: false, categorie: { nom: 'Formation' } },
    { id: 't4', statut: 'En cours', archive: false, categorie: { nom: 'Déploiement' } },
    { id: 't5', statut: 'Terminé', archive: false, categorie: { nom: 'Configuration' } },
    { id: 't6', statut: 'Terminé', archive: false, categorie: { nom: 'Support' } },
    { id: 't7', statut: 'En cours', archive: false, categorie: { nom: 'Suivi' } },
    { id: 't8', statut: 'Terminé', archive: false, categorie: { nom: 'Contractuel' } },
    { id: 't9', statut: 'En cours', archive: false, categorie: { nom: 'Conformité' } },
    { id: 't10', statut: 'Terminé', archive: false, categorie: { nom: 'Go-Live' } },
  ]
  const ERROR = { message: 'boom' }

  const createBuilder = (resolver?: () => Promise<{ data: unknown; error: unknown }>) => {
    let resolve = resolver ?? (() => Promise.resolve({ data: ROWS, error: null }))
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => resolve()),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(() => resolve()),
      maybeSingle: vi.fn(() => resolve()),
      then: ((onFulfilled: any, onRejected?: any) => resolve().then(onFulfilled, onRejected)) as any,
      catch: ((onRejected: any) => resolve().catch(onRejected)) as any,
    }
    return builder
  }

  const mockFrom = vi.fn(() => createBuilder())

  const mockChannel = {
    on: vi.fn().mockImplementation(function (this: any) {
      return this
    }),
    subscribe: vi.fn().mockReturnThis(),
  }

  const mockRemoveChannel = vi.fn()

  return { ROWS, ERROR, createBuilder, mockFrom, mockChannel, mockRemoveChannel }
})

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn() }
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
    channel: vi.fn(() => mockChannel),
    removeChannel: mockRemoveChannel
  }
}))

describe('useTasksBreakdown', () => {
  const createWrapper = () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 }
      }
    })
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children as any)
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads -> returns stable breakdown data', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useTasksBreakdown('etab-1'), { wrapper })

    expect(result.current.isLoading).toBeTruthy()

    await waitFor(() => expect(result.current.isSuccess).toBeTruthy())

    expect(result.current.data).toEqual({
      commercial: { total: 2, completed: 1 },
      contractuel: { total: 1, completed: 1 },
      conformite: { total: 1, completed: 0 },
      deploiement: { total: 2, completed: 1 },
      formation: { total: 1, completed: 1 },
      golive: { total: 1, completed: 1 },
      production: { total: 2, completed: 1 }
    })
  })

  it('handles error from supabase -> isError with message', async () => {
    mockFrom.mockImplementationOnce(() => createBuilder(() => Promise.resolve({ data: null, error: ERROR })))

    const wrapper = createWrapper()
    const { result } = renderHook(() => useTasksBreakdown('etab-1'), { wrapper })

    expect(result.current.isLoading).toBeTruthy()

    await waitFor(() => expect(result.current.isError).toBeTruthy())

    expect(result.current.error).toEqual(ERROR)
  })
})