import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useModelesTaches,
  useAllModelesTaches,
  useUpdateModeleTache,
  useCreateModeleTache,
  useDeleteModeleTache,
} from './useModelesTaches'

const {
  ACTIVE_ROWS,
  ALL_ROWS,
  UPDATED_ROW,
  INSERTED_ROW,
  mockFrom,
  toastMock,
  debugErrorMock,
  setErrorFlags,
  resetMocks,
} = vi.hoisted(() => {
  const ACTIVE_ROWS = [
    {
      id: 'r1',
      titre: 't1',
      description: 'd1',
      categorie_id: 'c1',
      priorite: 'low',
      ordre: 1,
      delai_jours: 2,
      actif: true,
      created_at: '2020-01-01T00:00:00Z',
      categorie: { nom: 'cat1', couleur: '#ffffff' },
    },
  ] as const

  const ALL_ROWS = [
    {
      id: 'r1',
      titre: 't1',
      description: 'd1',
      categorie_id: 'c1',
      priorite: 'low',
      ordre: 1,
      delai_jours: 2,
      actif: true,
      created_at: '2020-01-01T00:00:00Z',
      categorie: { nom: 'cat1', couleur: '#ffffff' },
    },
    {
      id: 'r2',
      titre: 't2',
      description: 'd2',
      categorie_id: 'c2',
      priorite: 'high',
      ordre: 2,
      delai_jours: 3,
      actif: false,
      created_at: '2020-02-01T00:00:00Z',
      categorie: { nom: 'cat2', couleur: '#000000' },
    },
  ] as const

  const UPDATED_ROW = {
    id: 'r1',
    titre: 'updated',
    description: 'updated-desc',
    categorie_id: 'c1',
    priorite: 'medium',
    ordre: 1,
    delai_jours: 5,
    actif: true,
    created_at: '2020-01-01T00:00:00Z',
    categorie: { nom: 'cat1', couleur: '#ffffff' },
  } as const

  const INSERTED_ROW = {
    id: 'new-id',
    titre: 'new',
    description: 'new-desc',
    categorie_id: 'c3',
    priorite: 'low',
    ordre: 3,
    delai_jours: 1,
    actif: true,
    created_at: '2024-01-01T00:00:00Z',
    categorie: { nom: 'cat3', couleur: '#123456' },
  } as const

  const toastMock = vi.fn()
  const debugErrorMock = vi.fn()

  let ERROR_ACTIVE = false
  let ERROR_ALL = false
  let ERROR_UPDATE = false
  let ERROR_INSERT = false
  let ERROR_DELETE = false

  const setErrorFlags = (flags: {
    active?: boolean
    all?: boolean
    update?: boolean
    insert?: boolean
    del?: boolean
  }) => {
    ERROR_ACTIVE = !!flags.active
    ERROR_ALL = !!flags.all
    ERROR_UPDATE = !!flags.update
    ERROR_INSERT = !!flags.insert
    ERROR_DELETE = !!flags.del
  }

  const resetMocks = () => {
    ERROR_ACTIVE = false
    ERROR_ALL = false
    ERROR_UPDATE = false
    ERROR_INSERT = false
    ERROR_DELETE = false
    toastMock.mockClear()
    debugErrorMock.mockClear()
    mockFrom.mockClear()
  }

  const mockFrom = vi.fn((table: string) => {
    const calls: Array<{ op: string; args?: unknown[] }> = []
    const builder: any = {
      _calls: calls,
      select(arg?: unknown) {
        calls.push({ op: 'select', args: arg === undefined ? [] : [arg] })
        return this
      },
      eq(col: string, val: unknown) {
        calls.push({ op: 'eq', args: [col, val] })
        return this
      },
      order(col: string, opts?: unknown) {
        calls.push({ op: 'order', args: [col, opts] })
        return this
      },
      update(data: unknown) {
        calls.push({ op: 'update', args: [data] })
        return this
      },
      insert(data: unknown) {
        calls.push({ op: 'insert', args: [data] })
        return this
      },
      delete() {
        calls.push({ op: 'delete' })
        return this
      },
      single() {
        calls.push({ op: 'single' })
        return this
      },
      maybeSingle() {
        calls.push({ op: 'maybeSingle' })
        return this
      },
      then(resolve: (val?: unknown) => unknown, reject?: (err?: unknown) => unknown) {
        const hasEqActifTrue = calls.some(
          (c) => c.op === 'eq' && c.args && c.args[0] === 'actif' && c.args[1] === true
        )
        const hasInsert = calls.some((c) => c.op === 'insert')
        const hasUpdate = calls.some((c) => c.op === 'update')
        const hasDelete = calls.some((c) => c.op === 'delete')

        if (hasEqActifTrue) {
          if (ERROR_ACTIVE) {
            const resp = { data: null, error: { message: 'simulated active error' } }
            return Promise.resolve(resp).then(resolve, reject)
          }
          const resp = { data: ACTIVE_ROWS, error: null }
          return Promise.resolve(resp).then(resolve, reject)
        }

        if (hasInsert) {
          if (ERROR_INSERT) {
            const resp = { data: null, error: { message: 'simulated insert error' } }
            return Promise.resolve(resp).then(resolve, reject)
          }
          const resp = { data: INSERTED_ROW, error: null }
          return Promise.resolve(resp).then(resolve, reject)
        }

        if (hasUpdate) {
          if (ERROR_UPDATE) {
            const resp = { data: null, error: { message: 'simulated update error' } }
            return Promise.resolve(resp).then(resolve, reject)
          }
          const resp = { data: UPDATED_ROW, error: null }
          return Promise.resolve(resp).then(resolve, reject)
        }

        if (hasDelete) {
          if (ERROR_DELETE) {
            const resp = { data: null, error: { message: 'simulated delete error' } }
            return Promise.resolve(resp).then(resolve, reject)
          }
          const resp = { data: null, error: null }
          return Promise.resolve(resp).then(resolve, reject)
        }

        if (ERROR_ALL) {
          const resp = { data: null, error: { message: 'simulated all error' } }
          return Promise.resolve(resp).then(resolve, reject)
        }

        const resp = { data: ALL_ROWS, error: null }
        return Promise.resolve(resp).then(resolve, reject)
      },
      catch(fn: (err?: unknown) => unknown) {
        return this.then(undefined, fn)
      },
    }
    return builder
  })

  return {
    ACTIVE_ROWS,
    ALL_ROWS,
    UPDATED_ROW,
    INSERTED_ROW,
    mockFrom,
    toastMock,
    debugErrorMock,
    setErrorFlags,
    resetMocks,
  }
})

vi.mock('@/lib/supabaseBrowser', () => ({ supabase: { from: mockFrom } }))
vi.mock('@/hooks/shared/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }))
vi.mock('@/lib/debug', () => ({ debug: { error: debugErrorMock } }))

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper(client: QueryClient) {
  return (props: { children?: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, props.children)
}

beforeEach(() => {
  resetMocks()
})

describe('useModelesTaches', () => {
  it('loads only active modeles and returns them', async () => {
    const qc = createClient()
    const wrapper = createWrapper(qc)
    const { result } = renderHook(() => useModelesTaches(), { wrapper })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBe(ACTIVE_ROWS)
    expect(mockFrom).toHaveBeenCalledWith('modeles_taches')
    expect(toastMock).not.toHaveBeenCalled()
  })

  it('handles error from supabase and shows destructive toast', async () => {
    setErrorFlags({ active: true })
    const qc = createClient()
    const wrapper = createWrapper(qc)
    const { result } = renderHook(() => useModelesTaches(), { wrapper })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erreur',
        description: 'Impossible de charger les modèles de tâches',
        variant: 'destructive',
      })
    )
  })
})

describe('useAllModelesTaches', () => {
  it('loads all modeles (no actif filter) and returns them', async () => {
    const qc = createClient()
    const wrapper = createWrapper(qc)
    const { result } = renderHook(() => useAllModelesTaches(), { wrapper })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBe(ALL_ROWS)
    expect(mockFrom).toHaveBeenCalledWith('modeles_taches')
    expect(toastMock).not.toHaveBeenCalled()
  })

  it('handles error when loading all modeles and shows destructive toast', async () => {
    setErrorFlags({ all: true })
    const qc = createClient()
    const wrapper = createWrapper(qc)
    const { result } = renderHook(() => useAllModelesTaches(), { wrapper })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erreur',
        description: 'Impossible de charger les modèles de tâches',
        variant: 'destructive',
      })
    )
  })
})

describe('mutations (update/create/delete)', () => {
  it('updates a modele tache successfully, invalidates queries and shows success toast', async () => {
    const qc = createClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const wrapper = createWrapper(qc)
    const { result } = renderHook(() => useUpdateModeleTache(), { wrapper })

    await act(async () => {
      const res = await result.current.mutateAsync({ id: 'r1', data: { titre: 'updated' } })
      expect(res).toBe(UPDATED_ROW)
    })

    expect(mockFrom).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['modeles-taches'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['all-modeles-taches'] })
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Succès',
        description: 'Modèle de tâche mis à jour avec succès',
      })
    )
  })

  it('handles update error: throws and calls debug.error and shows destructive toast', async () => {
    setErrorFlags({ update: true })
    const qc = createClient()
    const wrapper = createWrapper(qc)
    const { result } = renderHook(() => useUpdateModeleTache(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'r1', data: {} })).rejects.toBeDefined()
    })

    expect(debugErrorMock).toHaveBeenCalledWith('Error updating modele tache:', expect.anything())
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le modèle de tâche',
        variant: 'destructive',
      })
    )
  })

  it('creates a modele tache successfully, invalidates queries and shows success toast', async () => {
    const qc = createClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const wrapper = createWrapper(qc)
    const { result } = renderHook(() => useCreateModeleTache(), { wrapper })

    await act(async () => {
      const payload = {
        titre: 'new',
        description: 'new-desc',
        categorie_id: 'c3',
        priorite: 'low',
        ordre: 3,
        delai_jours: 1,
        actif: true,
      }
      const res = await result.current.mutateAsync(payload)
      expect(res).toBe(INSERTED_ROW)
    })

    expect(mockFrom).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['modeles-taches'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['all-modeles-taches'] })
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Succès',
        description: 'Modèle de tâche créé avec succès',
      })
    )
  })

  it('handles create error: throws and calls debug.error and shows destructive toast', async () => {
    setErrorFlags({ insert: true })
    const qc = createClient()
    const wrapper = createWrapper(qc)
    const { result } = renderHook(() => useCreateModeleTache(), { wrapper })

    await act(async () => {
      const payload = {
        titre: 'bad',
        description: 'bad-desc',
        categorie_id: 'cX',
        priorite: 'low',
        ordre: 0,
        delai_jours: 0,
        actif: true,
      }
      await expect(result.current.mutateAsync(payload)).rejects.toBeDefined()
    })

    expect(debugErrorMock).toHaveBeenCalledWith('Error creating modele tache:', expect.anything())
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erreur',
        description: 'Impossible de créer le modèle de tâche',
        variant: 'destructive',
      })
    )
  })

  it('deletes a modele tache successfully, invalidates queries and shows success toast', async () => {
    const qc = createClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const wrapper = createWrapper(qc)
    const { result } = renderHook(() => useDeleteModeleTache(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('r1')
    })

    expect(mockFrom).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['modeles-taches'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['all-modeles-taches'] })
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Succès',
        description: 'Modèle de tâche supprimé avec succès',
      })
    )
  })

  it('handles delete error: throws and calls debug.error and shows destructive toast', async () => {
    setErrorFlags({ del: true })
    const qc = createClient()
    const wrapper = createWrapper(qc)
    const { result } = renderHook(() => useDeleteModeleTache(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync('r1')).rejects.toBeDefined()
    })

    expect(debugErrorMock).toHaveBeenCalledWith('Error deleting modele tache:', expect.anything())
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erreur',
        description: 'Impossible de supprimer le modèle de tâche',
        variant: 'destructive',
      })
    )
  })
})