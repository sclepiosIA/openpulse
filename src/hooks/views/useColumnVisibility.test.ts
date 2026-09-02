import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useColumnVisibility, type ColumnConfig } from './useColumnVisibility'

interface StoredState {
  visible: string[]
  order: string[]
}

const { BASE_COLUMNS, EXT_COLUMNS } = vi.hoisted(() => ({
  BASE_COLUMNS: [
    { key: 'name', label: 'Name', required: true },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone', hiddenByDefault: true },
    { key: 'status', label: 'Status' },
  ] satisfies ColumnConfig[],
  EXT_COLUMNS: [
    { key: 'name', label: 'Name', required: true },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone', hiddenByDefault: true },
    { key: 'status', label: 'Status' },
    { key: 'owner', label: 'Owner' },
  ] satisfies ColumnConfig[],
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

function renderVisibility(storageKey = 'cols', columns: ColumnConfig[] = BASE_COLUMNS) {
  return renderHook(() => useColumnVisibility(storageKey, columns), {
    wrapper: createWrapper(),
  })
}

function keysOf(columns: ColumnConfig[]) {
  return columns.map((column) => column.key)
}

function readStored(storageKey = 'cols') {
  const raw = localStorage.getItem(storageKey)
  if (raw === null) return null
  return JSON.parse(raw) as StoredState
}

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('useColumnVisibility', () => {
  it('initialise les colonnes visibles, l’ordre par défaut et persiste l’état', async () => {
    const { result } = renderVisibility()

    expect(result.current.visibleKeys).toEqual(['name', 'email', 'status'])
    expect(result.current.order).toEqual(['name', 'email', 'phone', 'status'])
    expect(keysOf(result.current.orderedColumns)).toEqual(['name', 'email', 'phone', 'status'])
    expect(keysOf(result.current.visibleColumns)).toEqual(['name', 'email', 'status'])
    expect(result.current.visibleColumns.map((column) => column.label)).toEqual(['Name', 'Email', 'Status'])
    expect(result.current.isVisible('phone')).toBe(false)
    expect(result.current.isVisible('name')).toBe(true)

    await waitFor(() => {
      expect(readStored()).toEqual({
        visible: ['name', 'email', 'status'],
        order: ['name', 'email', 'phone', 'status'],
      })
    })
  })

  it('restaure un état persisté, filtre les clés invalides et ajoute les nouvelles colonnes manquantes', async () => {
    localStorage.setItem(
      'cols',
      JSON.stringify({
        visible: ['status', 'ghost', 4],
        order: ['status', 'ghost', 'email'],
      }),
    )

    const { result } = renderVisibility()

    expect(result.current.visibleKeys).toEqual(['status'])
    expect(result.current.order).toEqual(['status', 'email', 'name', 'phone'])
    expect(keysOf(result.current.orderedColumns)).toEqual(['status', 'email', 'name', 'phone'])
    expect(keysOf(result.current.visibleColumns)).toEqual(['status', 'name'])
    expect(result.current.isVisible('email')).toBe(false)
    expect(result.current.isVisible('name')).toBe(true)

    await waitFor(() => {
      expect(readStored()).toEqual({
        visible: ['status'],
        order: ['status', 'email', 'name', 'phone'],
      })
    })
  })

  it('ajoute les colonnes apparues après une sauvegarde plus ancienne', () => {
    localStorage.setItem(
      'cols',
      JSON.stringify({
        visible: ['name', 'email'],
        order: ['email', 'name'],
      }),
    )

    const { result } = renderVisibility('cols', EXT_COLUMNS)

    expect(result.current.visibleKeys).toEqual(['name', 'email'])
    expect(result.current.order).toEqual(['email', 'name', 'phone', 'status', 'owner'])
    expect(keysOf(result.current.visibleColumns)).toEqual(['email', 'name'])
    expect(keysOf(result.current.orderedColumns)).toEqual(['email', 'name', 'phone', 'status', 'owner'])
  })

  it('bascule la visibilité des colonnes optionnelles sans masquer une colonne requise', async () => {
    const { result } = renderVisibility()

    await act(async () => {
      result.current.toggle('name')
    })

    expect(result.current.visibleKeys).toEqual(['name', 'email', 'status'])
    expect(keysOf(result.current.visibleColumns)).toEqual(['name', 'email', 'status'])

    await act(async () => {
      result.current.toggle('email')
    })

    expect(result.current.visibleKeys).toEqual(['name', 'status'])
    expect(result.current.isVisible('email')).toBe(false)
    expect(keysOf(result.current.visibleColumns)).toEqual(['name', 'status'])

    await act(async () => {
      result.current.toggle('phone')
    })

    expect(result.current.visibleKeys).toEqual(['name', 'status', 'phone'])
    expect(result.current.isVisible('phone')).toBe(true)
    expect(keysOf(result.current.visibleColumns)).toEqual(['name', 'phone', 'status'])

    await waitFor(() => {
      expect(readStored()).toEqual({
        visible: ['name', 'status', 'phone'],
        order: ['name', 'email', 'phone', 'status'],
      })
    })
  })

  it('déplace une colonne d’un cran et ignore les déplacements hors limites', async () => {
    const { result } = renderVisibility()

    await act(async () => {
      result.current.move('name', 'up')
    })

    expect(result.current.order).toEqual(['name', 'email', 'phone', 'status'])

    await act(async () => {
      result.current.move('status', 'up')
    })

    expect(result.current.order).toEqual(['name', 'email', 'status', 'phone'])
    expect(keysOf(result.current.visibleColumns)).toEqual(['name', 'email', 'status'])

    await act(async () => {
      result.current.move('status', 'up')
    })

    expect(result.current.order).toEqual(['name', 'status', 'email', 'phone'])
    expect(keysOf(result.current.visibleColumns)).toEqual(['name', 'status', 'email'])

    await act(async () => {
      result.current.move('phone', 'down')
    })

    expect(result.current.order).toEqual(['name', 'status', 'email', 'phone'])

    await act(async () => {
      result.current.move('missing', 'down')
    })

    expect(result.current.order).toEqual(['name', 'status', 'email', 'phone'])
  })

  it('réinitialise la visibilité et l’ordre aux valeurs par défaut', async () => {
    const { result } = renderVisibility()

    await act(async () => {
      result.current.toggle('email')
      result.current.toggle('phone')
      result.current.move('status', 'up')
      result.current.move('status', 'up')
    })

    expect(result.current.visibleKeys).toEqual(['name', 'status', 'phone'])
    expect(result.current.order).toEqual(['name', 'status', 'email', 'phone'])

    await act(async () => {
      result.current.reset()
    })

    expect(result.current.visibleKeys).toEqual(['name', 'email', 'status'])
    expect(result.current.order).toEqual(['name', 'email', 'phone', 'status'])
    expect(keysOf(result.current.visibleColumns)).toEqual(['name', 'email', 'status'])

    await waitFor(() => {
      expect(readStored()).toEqual({
        visible: ['name', 'email', 'status'],
        order: ['name', 'email', 'phone', 'status'],
      })
    })
  })

  it('setRaw applique un état externe filtré et complète l’ordre manquant', async () => {
    const { result } = renderVisibility()

    await act(async () => {
      result.current.setRaw({
        visible: ['phone', 'ghost', 'name'],
        order: ['phone', 'ghost', 'email'],
      })
    })

    expect(result.current.visibleKeys).toEqual(['phone', 'name'])
    expect(result.current.order).toEqual(['phone', 'email', 'name', 'status'])
    expect(keysOf(result.current.orderedColumns)).toEqual(['phone', 'email', 'name', 'status'])
    expect(keysOf(result.current.visibleColumns)).toEqual(['phone', 'name'])
    expect(result.current.isVisible('status')).toBe(false)

    await waitFor(() => {
      expect(readStored()).toEqual({
        visible: ['phone', 'name'],
        order: ['phone', 'email', 'name', 'status'],
      })
    })
  })

  it('retombe sur les valeurs par défaut quand le localStorage contient un JSON invalide', async () => {
    localStorage.setItem('cols', '{bad')

    const { result } = renderVisibility()

    expect(result.current.visibleKeys).toEqual(['name', 'email', 'status'])
    expect(result.current.order).toEqual(['name', 'email', 'phone', 'status'])
    expect(keysOf(result.current.visibleColumns)).toEqual(['name', 'email', 'status'])

    await waitFor(() => {
      expect(readStored()).toEqual({
        visible: ['name', 'email', 'status'],
        order: ['name', 'email', 'phone', 'status'],
      })
    })
  })

  it('ignore les erreurs d’écriture localStorage sans bloquer les mises à jour du hook', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('x')
    })

    const { result } = renderVisibility()

    expect(result.current.visibleKeys).toEqual(['name', 'email', 'status'])

    await act(async () => {
      result.current.toggle('email')
    })

    expect(result.current.visibleKeys).toEqual(['name', 'status'])
    expect(keysOf(result.current.visibleColumns)).toEqual(['name', 'status'])
    expect(setItemSpy).toHaveBeenCalled()
  })
})