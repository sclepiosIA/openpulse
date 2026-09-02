// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { useRowSelection } from './useRowSelection'

type Row = { id: string; name: string }

const { ITEMS, NEXT_ITEMS, EMPTY_ITEMS } = vi.hoisted(() => ({
  ITEMS: [
    { id: '1', name: 'Alpha' },
    { id: '2', name: 'Beta' },
    { id: '3', name: 'Gamma' },
  ] as Row[],
  NEXT_ITEMS: [
    { id: '2', name: 'Beta' },
    { id: '4', name: 'Delta' },
  ] as Row[],
  EMPTY_ITEMS: [] as Row[],
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient, children })
  }
}

describe('useRowSelection', () => {
  it('initialise avec aucun élément sélectionné', () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useRowSelection(ITEMS), { wrapper })

    expect(result.current.count).toBe(0)
    expect(Array.from(result.current.selectedIds)).toEqual([])
    expect(result.current.selectedItems).toEqual([])
    expect(result.current.allSelected).toBe(false)
    expect(result.current.someSelected).toBe(false)
    expect(result.current.isSelected('1')).toBe(false)
    expect(result.current.isSelected('2')).toBe(false)
    expect(result.current.isSelected('3')).toBe(false)
  })

  it('toggle sélectionne puis désélectionne une ligne avec les valeurs attendues', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useRowSelection(ITEMS), { wrapper })

    await act(async () => {
      result.current.toggle('2')
    })

    expect(result.current.count).toBe(1)
    expect(Array.from(result.current.selectedIds)).toEqual(['2'])
    expect(result.current.selectedItems).toEqual([{ id: '2', name: 'Beta' }])
    expect(result.current.isSelected('2')).toBe(true)
    expect(result.current.isSelected('1')).toBe(false)
    expect(result.current.allSelected).toBe(false)
    expect(result.current.someSelected).toBe(true)

    await act(async () => {
      result.current.toggle('2')
    })

    expect(result.current.count).toBe(0)
    expect(Array.from(result.current.selectedIds)).toEqual([])
    expect(result.current.selectedItems).toEqual([])
    expect(result.current.isSelected('2')).toBe(false)
    expect(result.current.allSelected).toBe(false)
    expect(result.current.someSelected).toBe(false)
  })

  it('toggleAll sélectionne tout puis vide la sélection', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useRowSelection(ITEMS), { wrapper })

    await act(async () => {
      result.current.toggleAll()
    })

    expect(result.current.count).toBe(3)
    expect(Array.from(result.current.selectedIds)).toEqual(['1', '2', '3'])
    expect(result.current.selectedItems).toEqual([
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
      { id: '3', name: 'Gamma' },
    ])
    expect(result.current.allSelected).toBe(true)
    expect(result.current.someSelected).toBe(false)

    await act(async () => {
      result.current.toggleAll()
    })

    expect(result.current.count).toBe(0)
    expect(Array.from(result.current.selectedIds)).toEqual([])
    expect(result.current.selectedItems).toEqual([])
    expect(result.current.allSelected).toBe(false)
    expect(result.current.someSelected).toBe(false)
  })

  it('clear réinitialise une sélection partielle', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useRowSelection(ITEMS), { wrapper })

    await act(async () => {
      result.current.toggle('1')
      result.current.toggle('3')
    })

    expect(result.current.count).toBe(2)
    expect(Array.from(result.current.selectedIds)).toEqual(['1', '3'])
    expect(result.current.selectedItems).toEqual([
      { id: '1', name: 'Alpha' },
      { id: '3', name: 'Gamma' },
    ])
    expect(result.current.allSelected).toBe(false)
    expect(result.current.someSelected).toBe(true)

    await act(async () => {
      result.current.clear()
    })

    expect(result.current.count).toBe(0)
    expect(Array.from(result.current.selectedIds)).toEqual([])
    expect(result.current.selectedItems).toEqual([])
    expect(result.current.allSelected).toBe(false)
    expect(result.current.someSelected).toBe(false)
  })

  it('met à jour selectedItems et les indicateurs quand la liste items change', async () => {
    const wrapper = createWrapper()

    const { result, rerender } = renderHook(
      ({ items }: { items: Row[] }) => useRowSelection(items),
      {
        initialProps: { items: ITEMS },
        wrapper,
      },
    )

    await act(async () => {
      result.current.toggle('1')
      result.current.toggle('2')
    })

    expect(result.current.count).toBe(2)
    expect(Array.from(result.current.selectedIds)).toEqual(['1', '2'])
    expect(result.current.selectedItems).toEqual([
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
    ])
    expect(result.current.someSelected).toBe(true)
    expect(result.current.allSelected).toBe(false)

    rerender({ items: NEXT_ITEMS })

    expect(result.current.count).toBe(2)
    expect(Array.from(result.current.selectedIds)).toEqual(['1', '2'])
    expect(result.current.selectedItems).toEqual([{ id: '2', name: 'Beta' }])
    expect(result.current.someSelected).toBe(true)
    expect(result.current.allSelected).toBe(false)
    expect(result.current.isSelected('1')).toBe(true)
    expect(result.current.isSelected('4')).toBe(false)

    await act(async () => {
      result.current.toggleAll()
    })

    expect(Array.from(result.current.selectedIds)).toEqual(['2', '4'])
    expect(result.current.selectedItems).toEqual([
      { id: '2', name: 'Beta' },
      { id: '4', name: 'Delta' },
    ])
    expect(result.current.count).toBe(2)
    expect(result.current.allSelected).toBe(true)
    expect(result.current.someSelected).toBe(false)
  })

  it('gère le cas limite d une liste vide sans erreur', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useRowSelection(EMPTY_ITEMS), { wrapper })

    expect(result.current.count).toBe(0)
    expect(Array.from(result.current.selectedIds)).toEqual([])
    expect(result.current.selectedItems).toEqual([])
    expect(result.current.allSelected).toBe(false)
    expect(result.current.someSelected).toBe(false)

    await act(async () => {
      result.current.toggleAll()
    })

    expect(result.current.count).toBe(0)
    expect(Array.from(result.current.selectedIds)).toEqual([])
    expect(result.current.selectedItems).toEqual([])
    expect(result.current.allSelected).toBe(false)
    expect(result.current.someSelected).toBe(false)
  })
})