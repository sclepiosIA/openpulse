import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { useFavorites, type FavoriteItem } from './useFavorites'

const { FAVORITE_A, FAVORITE_B, FAVORITE_C, STORAGE_KEY } = vi.hoisted(() => ({
  STORAGE_KEY: 'workspace-favorites-v1',
  FAVORITE_A: {
    id: 'c1',
    type: 'company',
    title: 'Acme',
    subtitle: 'Customer',
    url: '/companies/c1',
  },
  FAVORITE_B: {
    id: 'p1',
    type: 'person',
    title: 'Jane Doe',
    subtitle: 'CEO',
    url: '/people/p1',
  },
  FAVORITE_C: {
    id: 'd1',
    type: 'deal',
    title: 'Expansion',
    url: '/deals/d1',
  },
}))

function createWrapper() {
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

function readStoredFavorites(): FavoriteItem[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) return []

  const parsed: unknown = JSON.parse(raw)
  return Array.isArray(parsed) ? (parsed as FavoriteItem[]) : []
}

describe('useFavorites', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('starts with an empty favorites list when localStorage has no saved value', () => {
    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    })

    expect(result.current.favorites).toEqual([])
    expect(result.current.isFavorite(FAVORITE_A.id, FAVORITE_A.type)).toBe(false)
  })

  it('loads existing favorites from localStorage on first render', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([FAVORITE_A, FAVORITE_B]))

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    })

    expect(result.current.favorites).toEqual([FAVORITE_A, FAVORITE_B])
    expect(result.current.favorites).toHaveLength(2)
    expect(result.current.isFavorite(FAVORITE_A.id, FAVORITE_A.type)).toBe(true)
    expect(result.current.isFavorite(FAVORITE_B.id, FAVORITE_B.type)).toBe(true)
    expect(result.current.isFavorite(FAVORITE_A.id, 'person')).toBe(false)
  })

  it('falls back to an empty list when localStorage contains invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{invalid-json')

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    })

    expect(result.current.favorites).toEqual([])
    expect(result.current.isFavorite(FAVORITE_A.id, FAVORITE_A.type)).toBe(false)
  })

  it('falls back to an empty list when localStorage contains a non-array value', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: FAVORITE_A.id }))

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    })

    expect(result.current.favorites).toEqual([])
    expect(result.current.isFavorite(FAVORITE_A.id, FAVORITE_A.type)).toBe(false)
  })

  it('adds a favorite at the beginning, persists it and returns true', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([FAVORITE_B]))

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    })

    let toggleResult = false
    await act(async () => {
      toggleResult = result.current.toggle(FAVORITE_A)
    })

    expect(toggleResult).toBe(true)
    expect(result.current.favorites).toEqual([FAVORITE_A, FAVORITE_B])
    expect(result.current.isFavorite(FAVORITE_A.id, FAVORITE_A.type)).toBe(true)
    expect(readStoredFavorites()).toEqual([FAVORITE_A, FAVORITE_B])
  })

  it('removes an existing favorite with toggle and returns false', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([FAVORITE_A, FAVORITE_B]))

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    })

    let toggleResult = true
    await act(async () => {
      toggleResult = result.current.toggle(FAVORITE_A)
    })

    expect(toggleResult).toBe(false)
    expect(result.current.favorites).toEqual([FAVORITE_B])
    expect(result.current.isFavorite(FAVORITE_A.id, FAVORITE_A.type)).toBe(false)
    expect(readStoredFavorites()).toEqual([FAVORITE_B])
  })

  it('matches favorites by both id and type', async () => {
    const sameIdDifferentType: FavoriteItem = {
      id: FAVORITE_A.id,
      type: 'person',
      title: 'Acme Contact',
      url: '/people/c1',
    }

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.toggle(FAVORITE_A)
      result.current.toggle(sameIdDifferentType)
    })

    expect(result.current.favorites).toEqual([sameIdDifferentType, FAVORITE_A])
    expect(result.current.isFavorite(FAVORITE_A.id, FAVORITE_A.type)).toBe(true)
    expect(result.current.isFavorite(FAVORITE_A.id, sameIdDifferentType.type)).toBe(true)

    await act(async () => {
      result.current.remove(FAVORITE_A.id, FAVORITE_A.type)
    })

    expect(result.current.favorites).toEqual([sameIdDifferentType])
    expect(result.current.isFavorite(FAVORITE_A.id, FAVORITE_A.type)).toBe(false)
    expect(result.current.isFavorite(FAVORITE_A.id, sameIdDifferentType.type)).toBe(true)
  })

  it('removes a favorite explicitly and persists the remaining items', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([FAVORITE_A, FAVORITE_B, FAVORITE_C]))

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.remove(FAVORITE_B.id, FAVORITE_B.type)
    })

    expect(result.current.favorites).toEqual([FAVORITE_A, FAVORITE_C])
    expect(result.current.isFavorite(FAVORITE_B.id, FAVORITE_B.type)).toBe(false)
    expect(readStoredFavorites()).toEqual([FAVORITE_A, FAVORITE_C])
  })

  it('clears all favorites and persists an empty array', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([FAVORITE_A, FAVORITE_B]))

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.clear()
    })

    expect(result.current.favorites).toEqual([])
    expect(result.current.isFavorite(FAVORITE_A.id, FAVORITE_A.type)).toBe(false)
    expect(readStoredFavorites()).toEqual([])
  })

  it('keeps at most 50 favorites in localStorage when writing', async () => {
    const existingFavorites: FavoriteItem[] = Array.from({ length: 50 }, (_, index) => ({
      id: `item-${index}`,
      type: 'record',
      title: `Record ${index}`,
      url: `/records/${index}`,
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingFavorites))

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.toggle(FAVORITE_A)
    })

    const stored = readStoredFavorites()
    expect(result.current.favorites).toHaveLength(51)
    expect(stored).toHaveLength(50)
    expect(stored[0]).toEqual(FAVORITE_A)
    expect(stored[49]).toEqual(existingFavorites[48])
  })

  it('updates another hook instance when favorites:changed is dispatched', async () => {
    const first = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    })
    const second = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      first.result.current.toggle(FAVORITE_A)
    })

    expect(second.result.current.favorites).toEqual([FAVORITE_A])
    expect(second.result.current.isFavorite(FAVORITE_A.id, FAVORITE_A.type)).toBe(true)
  })

  it('reloads favorites from localStorage on storage events', async () => {
    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    })

    localStorage.setItem(STORAGE_KEY, JSON.stringify([FAVORITE_C]))

    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    })

    expect(result.current.favorites).toEqual([FAVORITE_C])
    expect(result.current.isFavorite(FAVORITE_C.id, FAVORITE_C.type)).toBe(true)
  })

  it('does not throw when localStorage.setItem fails during toggle', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      expect(result.current.toggle(FAVORITE_A)).toBe(true)
    })

    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify([FAVORITE_A]))
    expect(result.current.favorites).toEqual([FAVORITE_A])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})