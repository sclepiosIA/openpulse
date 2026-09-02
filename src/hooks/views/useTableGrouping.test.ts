/* @vitest-environment jsdom */

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTableGrouping, type GroupableField } from './useTableGrouping'

type Row = {
  id: string
  status: string | null
  owner: string | null
}

const { ROWS, FIELDS } = vi.hoisted(() => {
  const rows: Row[] = [
    { id: '1', status: 'Prospect', owner: 'Alice' },
    { id: '2', status: 'Client', owner: 'Bob' },
    { id: '3', status: 'Prospect', owner: null },
    { id: '4', status: '', owner: 'Alice' },
    { id: '5', status: null, owner: 'Zoé' },
  ]

  const fields: GroupableField<Row>[] = [
    {
      key: 'status',
      label: 'Statut',
      getValue: (row) => row.status,
    },
    {
      key: 'owner',
      label: 'Propriétaire',
      getValue: (row) => row.owner,
    },
  ]

  return { ROWS: rows, FIELDS: fields }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      props.children,
    )
  }
}

describe('useTableGrouping', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('returns no grouping by default and persists __none__', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(
      () => useTableGrouping<Row>('table-grouping-empty', ROWS, FIELDS),
      { wrapper },
    )

    expect(result.current.groupBy).toBeNull()
    expect(result.current.activeField).toBeNull()
    expect(result.current.groups).toBeNull()
    expect(result.current.fields).toBe(FIELDS)
    expect(Array.from(result.current.collapsed)).toEqual([])

    await waitFor(() => {
      expect(localStorage.getItem('table-grouping-empty')).toBe('__none__')
    })
  })

  it('hydrates the stored field and builds sorted groups with fallback dash label', async () => {
    localStorage.setItem('table-grouping-status', 'status')
    const wrapper = createWrapper()

    const { result } = renderHook(
      () => useTableGrouping<Row>('table-grouping-status', ROWS, FIELDS),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.groupBy).toBe('status')
    })

    expect(result.current.activeField).toBe(FIELDS[0])

    const groups = result.current.groups
    expect(groups).not.toBeNull()
    expect(groups?.map((group) => group.label)).toEqual(['—', 'Client', 'Prospect'])
    expect(groups?.map((group) => group.count)).toEqual([2, 1, 2])
    expect(groups?.[0].rows.map((row) => row.id)).toEqual(['4', '5'])
    expect(groups?.[1].rows.map((row) => row.id)).toEqual(['2'])
    expect(groups?.[2].rows.map((row) => row.id)).toEqual(['1', '3'])
  })

  it('ignores an invalid stored key and saves disabled grouping', async () => {
    localStorage.setItem('table-grouping-invalid', 'missing')
    const wrapper = createWrapper()

    const { result } = renderHook(
      () => useTableGrouping<Row>('table-grouping-invalid', ROWS, FIELDS),
      { wrapper },
    )

    expect(result.current.groupBy).toBeNull()
    expect(result.current.activeField).toBeNull()
    expect(result.current.groups).toBeNull()

    await waitFor(() => {
      expect(localStorage.getItem('table-grouping-invalid')).toBe('__none__')
    })
  })

  it('treats stored __none__ as disabled grouping', async () => {
    localStorage.setItem('table-grouping-none', '__none__')
    const wrapper = createWrapper()

    const { result } = renderHook(
      () => useTableGrouping<Row>('table-grouping-none', ROWS, FIELDS),
      { wrapper },
    )

    expect(result.current.groupBy).toBeNull()
    expect(result.current.activeField).toBeNull()
    expect(result.current.groups).toBeNull()

    await waitFor(() => {
      expect(localStorage.getItem('table-grouping-none')).toBe('__none__')
    })
  })

  it('changes active grouping, computes owner groups, then disables grouping again', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(
      () => useTableGrouping<Row>('table-grouping-switch', ROWS, FIELDS),
      { wrapper },
    )

    await act(async () => {
      result.current.setGroupBy('owner')
    })

    await waitFor(() => {
      expect(result.current.groupBy).toBe('owner')
    })

    expect(result.current.activeField).toBe(FIELDS[1])
    expect(result.current.groups?.map((group) => group.label)).toEqual([
      '—',
      'Alice',
      'Bob',
      'Zoé',
    ])
    expect(result.current.groups?.map((group) => group.count)).toEqual([1, 2, 1, 1])
    expect(result.current.groups?.[0].rows.map((row) => row.id)).toEqual(['3'])
    expect(result.current.groups?.[1].rows.map((row) => row.id)).toEqual(['1', '4'])
    expect(localStorage.getItem('table-grouping-switch')).toBe('owner')

    await act(async () => {
      result.current.setGroupBy(null)
    })

    await waitFor(() => {
      expect(result.current.groupBy).toBeNull()
    })

    expect(result.current.activeField).toBeNull()
    expect(result.current.groups).toBeNull()
    expect(localStorage.getItem('table-grouping-switch')).toBe('__none__')
  })

  it('toggles collapsed keys using a new Set state', async () => {
    localStorage.setItem('table-grouping-collapse', 'status')
    const wrapper = createWrapper()

    const { result } = renderHook(
      () => useTableGrouping<Row>('table-grouping-collapse', ROWS, FIELDS),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.groups?.length).toBe(3)
    })

    const initialSet = result.current.collapsed
    expect(Array.from(initialSet)).toEqual([])

    await act(async () => {
      result.current.toggleCollapsed('Prospect')
    })

    const afterFirstToggle = result.current.collapsed
    expect(afterFirstToggle).not.toBe(initialSet)
    expect(Array.from(afterFirstToggle)).toEqual(['Prospect'])

    await act(async () => {
      result.current.toggleCollapsed('Client')
    })

    const afterSecondToggle = result.current.collapsed
    expect(afterSecondToggle).not.toBe(afterFirstToggle)
    expect(Array.from(afterSecondToggle).sort()).toEqual(['Client', 'Prospect'])

    await act(async () => {
      result.current.toggleCollapsed('Prospect')
    })

    expect(Array.from(result.current.collapsed)).toEqual(['Client'])
  })

  it('handles localStorage read and write errors without crashing', async () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('read failed')
      })

    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('write failed')
      })

    const wrapper = createWrapper()

    const { result } = renderHook(
      () => useTableGrouping<Row>('table-grouping-error', ROWS, FIELDS),
      { wrapper },
    )

    expect(result.current.groupBy).toBeNull()
    expect(result.current.activeField).toBeNull()
    expect(result.current.groups).toBeNull()

    await act(async () => {
      result.current.setGroupBy('status')
    })

    expect(result.current.groupBy).toBe('status')
    expect(result.current.activeField).toBe(FIELDS[0])
    expect(result.current.groups?.map((group) => group.label)).toEqual(['—', 'Client', 'Prospect'])
    expect(getItemSpy).toHaveBeenCalledWith('table-grouping-error')
    expect(setItemSpy).toHaveBeenCalledWith('table-grouping-error', '__none__')
    expect(setItemSpy).toHaveBeenCalledWith('table-grouping-error', 'status')
  })
})