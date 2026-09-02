import { act, cleanup, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { useSavedViews, type SavedView } from './useSavedViews'

type ViewState = {
  filters: {
    status: string
    tags: string[]
  }
  page: number
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

const storageKey = 'saved-views-test-key'

const existingViews: SavedView<ViewState>[] = [
  {
    id: 'view_existing_1',
    name: 'Prospects prioritaires',
    createdAt: '2024-01-02T03:04:05.000Z',
    state: {
      filters: { status: 'prospect', tags: ['vip', 'north'] },
      page: 2,
    },
  },
  {
    id: 'view_existing_2',
    name: 'Clients actifs',
    createdAt: '2024-02-03T04:05:06.000Z',
    state: {
      filters: { status: 'client', tags: ['active'] },
      page: 5,
    },
  },
]

describe('useSavedViews', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('initialise une liste vide et aucun actif quand le localStorage est vide', () => {
    const { result } = renderHook(() => useSavedViews<ViewState>(storageKey), {
      wrapper: createWrapper(),
    })

    expect(result.current.views).toEqual([])
    expect(result.current.activeId).toBeNull()
    expect(localStorage.getItem(storageKey)).toBe('[]')
    expect(localStorage.getItem(`${storageKey}:active`)).toBeNull()
  })

  it('charge les vues sauvegardées et la vue active depuis le localStorage', () => {
    localStorage.setItem(storageKey, JSON.stringify(existingViews))
    localStorage.setItem(`${storageKey}:active`, 'view_existing_2')

    const { result } = renderHook(() => useSavedViews<ViewState>(storageKey), {
      wrapper: createWrapper(),
    })

    expect(result.current.views).toEqual(existingViews)
    expect(result.current.activeId).toBe('view_existing_2')
    expect(result.current.get('view_existing_1')).toEqual(existingViews[0])
    expect(result.current.get('missing_view')).toBeUndefined()
  })

  it('retombe sur une liste vide si le contenu stocké est invalide ou non tableau', () => {
    localStorage.setItem(storageKey, '{json-invalide')
    localStorage.setItem(`${storageKey}:active`, 'view_orphan')

    const invalidJson = renderHook(() => useSavedViews<ViewState>(storageKey), {
      wrapper: createWrapper(),
    })

    expect(invalidJson.result.current.views).toEqual([])
    expect(invalidJson.result.current.activeId).toBe('view_orphan')

    invalidJson.unmount()
    localStorage.setItem(storageKey, JSON.stringify({ id: 'not-an-array' }))

    const nonArray = renderHook(() => useSavedViews<ViewState>(storageKey), {
      wrapper: createWrapper(),
    })

    expect(nonArray.result.current.views).toEqual([])
  })

  it('ignore les erreurs localStorage à la lecture initiale', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === storageKey || key === `${storageKey}:active`) {
        throw new Error('storage unavailable')
      }
      return null
    })

    const { result } = renderHook(() => useSavedViews<ViewState>(storageKey), {
      wrapper: createWrapper(),
    })

    expect(result.current.views).toEqual([])
    expect(result.current.activeId).toBeNull()
    expect(getItemSpy).toHaveBeenCalledWith(storageKey)
    expect(getItemSpy).toHaveBeenCalledWith(`${storageKey}:active`)
  })

  it('sauvegarde une nouvelle vue avec nom trimé, identifiant déterministe, date ISO et état actif', async () => {
    const fixedDate = new Date('2024-05-06T07:08:09.000Z')
    const randomValue = 0.123456
    const expectedId = `view_${fixedDate.getTime()}_${randomValue.toString(36).slice(2, 7)}`
    vi.useFakeTimers({ now: fixedDate })
    vi.spyOn(Math, 'random').mockReturnValue(randomValue)

    const { result } = renderHook(() => useSavedViews<ViewState>(storageKey), {
      wrapper: createWrapper(),
    })

    const state: ViewState = {
      filters: { status: 'prospect', tags: ['hot'] },
      page: 3,
    }

    let returnedView: SavedView<ViewState> | undefined

    await act(async () => {
      returnedView = result.current.save('  Mes prospects  ', state)
    })

    expect(returnedView).toEqual({
      id: expectedId,
      name: 'Mes prospects',
      createdAt: fixedDate.toISOString(),
      state,
    })
    expect(result.current.views).toEqual([
      {
        id: expectedId,
        name: 'Mes prospects',
        createdAt: fixedDate.toISOString(),
        state,
      },
    ])
    expect(result.current.activeId).toBe(expectedId)

    const storedViews = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as SavedView<ViewState>[]
    expect(storedViews).toEqual(result.current.views)
    expect(localStorage.getItem(`${storageKey}:active`)).toBe(expectedId)
  })

  it('utilise le nom par défaut pour une sauvegarde sans libellé exploitable', async () => {
    const fixedDate = new Date('2024-06-01T00:00:00.000Z')
    vi.useFakeTimers({ now: fixedDate })
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const { result } = renderHook(() => useSavedViews<ViewState>(storageKey), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.save('    ', {
        filters: { status: 'draft', tags: [] },
        page: 1,
      })
    })

    expect(result.current.views).toHaveLength(1)
    const firstView = result.current.views.at(0)
    if (firstView === undefined) {
      throw new Error('Expected a saved view')
    }

    expect(firstView.name).toBe('Vue sans nom')
    expect(firstView.createdAt).toBe(fixedDate.toISOString())
    expect(result.current.activeId).toBe(firstView.id)
  })

  it('met à jour uniquement l’état de la vue ciblée', async () => {
    localStorage.setItem(storageKey, JSON.stringify(existingViews))

    const { result } = renderHook(() => useSavedViews<ViewState>(storageKey), {
      wrapper: createWrapper(),
    })

    const updatedState: ViewState = {
      filters: { status: 'qualified', tags: ['ready', 'west'] },
      page: 9,
    }

    await act(async () => {
      result.current.update('view_existing_1', updatedState)
    })

    expect(result.current.views).toEqual([
      {
        ...existingViews[0],
        state: updatedState,
      },
      existingViews[1],
    ])

    const storedViews = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as SavedView<ViewState>[]
    expect(storedViews).toEqual(result.current.views)
  })

  it('renomme une vue avec trim et conserve le nom existant quand le nouveau nom est vide', async () => {
    localStorage.setItem(storageKey, JSON.stringify(existingViews))

    const { result } = renderHook(() => useSavedViews<ViewState>(storageKey), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.rename('view_existing_1', '  Opportunités chaudes  ')
    })

    expect(result.current.views.at(0)).toEqual({
      ...existingViews[0],
      name: 'Opportunités chaudes',
    })

    await act(async () => {
      result.current.rename('view_existing_2', '     ')
    })

    expect(result.current.views.at(1)).toEqual(existingViews[1])
  })

  it('supprime une vue et efface l’actif uniquement si la vue supprimée était active', async () => {
    localStorage.setItem(storageKey, JSON.stringify(existingViews))
    localStorage.setItem(`${storageKey}:active`, 'view_existing_1')

    const { result } = renderHook(() => useSavedViews<ViewState>(storageKey), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.remove('view_existing_2')
    })

    expect(result.current.views).toEqual([existingViews[0]])
    expect(result.current.activeId).toBe('view_existing_1')
    expect(localStorage.getItem(`${storageKey}:active`)).toBe('view_existing_1')

    await act(async () => {
      result.current.remove('view_existing_1')
    })

    expect(result.current.views).toEqual([])
    expect(result.current.activeId).toBeNull()
    expect(localStorage.getItem(`${storageKey}:active`)).toBeNull()
  })

  it('définit et réinitialise explicitement la vue active', async () => {
    localStorage.setItem(storageKey, JSON.stringify(existingViews))

    const { result } = renderHook(() => useSavedViews<ViewState>(storageKey), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.setActive('view_existing_2')
    })

    expect(result.current.activeId).toBe('view_existing_2')
    expect(localStorage.getItem(`${storageKey}:active`)).toBe('view_existing_2')

    await act(async () => {
      result.current.setActive(null)
    })

    expect(result.current.activeId).toBeNull()
    expect(localStorage.getItem(`${storageKey}:active`)).toBeNull()
  })

  it('ignore les erreurs localStorage pendant la persistance sans empêcher les changements en mémoire', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('remove failed')
    })

    const { result } = renderHook(() => useSavedViews<ViewState>(storageKey), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.save('Vue mémoire', {
        filters: { status: 'local', tags: ['safe'] },
        page: 4,
      })
    })

    const savedView = result.current.views.at(0)
    if (savedView === undefined) {
      throw new Error('Expected an in-memory saved view')
    }

    expect(savedView.name).toBe('Vue mémoire')
    expect(result.current.activeId).toBe(savedView.id)

    await act(async () => {
      result.current.setActive(null)
    })

    expect(result.current.activeId).toBeNull()
    expect(setItemSpy).toHaveBeenCalled()
    expect(removeItemSpy).toHaveBeenCalledWith(`${storageKey}:active`)
  })
})