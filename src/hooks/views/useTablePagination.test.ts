import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useTablePagination, type PageSizeOption } from './useTablePagination'

type Row = {
  id: string
  label: string
}

const ROWS_120: Row[] = Array.from({ length: 120 }, (_, index) => ({
  id: `row-${index + 1}`,
  label: `Row ${index + 1}`,
}))

const ROWS_30: Row[] = ROWS_120.slice(0, 30)
const ROWS_3: Row[] = ROWS_120.slice(0, 3)

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

function renderPagination(
  rows: Row[] = ROWS_120,
  storageKey = 'table-pagination-test',
  defaultPageSize: PageSizeOption = 50,
) {
  return renderHook(() => useTablePagination<Row>(storageKey, rows, defaultPageSize), {
    wrapper: createWrapper(),
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('useTablePagination', () => {
  it('initialise la pagination avec la taille par défaut et expose la première page', () => {
    const { result } = renderPagination()

    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(50)
    expect(result.current.pageCount).toBe(3)
    expect(result.current.total).toBe(120)
    expect(result.current.from).toBe(1)
    expect(result.current.to).toBe(50)
    expect(result.current.pageRows).toHaveLength(50)
    expect(result.current.pageRows.map((row) => row.id)).toEqual(
      ROWS_120.slice(0, 50).map((row) => row.id),
    )
    expect(result.current.pageSizeOptions).toEqual([25, 50, 100, 200, 'all'])
  })

  it('change de page et calcule correctement les bornes ainsi que les lignes visibles', () => {
    const { result } = renderPagination()

    act(() => {
      result.current.setPage(3)
    })

    expect(result.current.page).toBe(3)
    expect(result.current.pageCount).toBe(3)
    expect(result.current.from).toBe(101)
    expect(result.current.to).toBe(120)
    expect(result.current.pageRows).toHaveLength(20)
    expect(result.current.pageRows.map((row) => row.id)).toEqual(
      ROWS_120.slice(100, 120).map((row) => row.id),
    )
  })

  it('persiste la taille de page sélectionnée et revient à la première page', () => {
    const storageKey = 'table-pagination-size'
    const { result } = renderPagination(ROWS_120, storageKey, 25)

    act(() => {
      result.current.setPage(4)
    })

    expect(result.current.page).toBe(4)
    expect(result.current.from).toBe(76)
    expect(result.current.to).toBe(100)

    act(() => {
      result.current.setPageSize(100)
    })

    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(100)
    expect(result.current.pageCount).toBe(2)
    expect(result.current.from).toBe(1)
    expect(result.current.to).toBe(100)
    expect(result.current.pageRows).toHaveLength(100)
    expect(localStorage.getItem(storageKey)).toBe('100')
  })

  it('relit une taille de page numérique valide depuis localStorage', () => {
    localStorage.setItem('stored-numeric-size', '100')

    const { result } = renderPagination(ROWS_120, 'stored-numeric-size', 25)

    expect(result.current.pageSize).toBe(100)
    expect(result.current.pageCount).toBe(2)
    expect(result.current.pageRows).toHaveLength(100)
    expect(result.current.to).toBe(100)
  })

  it('relit la taille de page "all" depuis localStorage', () => {
    localStorage.setItem('stored-all-size', 'all')

    const { result } = renderPagination(ROWS_3, 'stored-all-size', 25)

    expect(result.current.pageSize).toBe('all')
    expect(result.current.pageCount).toBe(1)
    expect(result.current.total).toBe(3)
    expect(result.current.from).toBe(1)
    expect(result.current.to).toBe(3)
    expect(result.current.pageRows).toEqual(ROWS_3)
  })

  it('ignore une valeur localStorage invalide et utilise la taille par défaut', () => {
    localStorage.setItem('stored-invalid-size', '999')

    const { result } = renderPagination(ROWS_120, 'stored-invalid-size', 25)

    expect(result.current.pageSize).toBe(25)
    expect(result.current.pageCount).toBe(5)
    expect(result.current.pageRows).toHaveLength(25)
    expect(result.current.to).toBe(25)
  })

  it('affiche toutes les lignes quand la taille de page vaut "all" et la persiste', () => {
    const storageKey = 'set-all-size'
    const { result } = renderPagination(ROWS_120, storageKey, 25)

    act(() => {
      result.current.setPage(2)
    })

    act(() => {
      result.current.setPageSize('all')
    })

    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe('all')
    expect(result.current.pageCount).toBe(1)
    expect(result.current.total).toBe(120)
    expect(result.current.from).toBe(1)
    expect(result.current.to).toBe(120)
    expect(result.current.pageRows).toEqual(ROWS_120)
    expect(localStorage.getItem(storageKey)).toBe('all')
  })

  it('garde des bornes cohérentes pour une table vide', () => {
    const { result } = renderPagination([], 'empty-table', 50)

    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(50)
    expect(result.current.pageCount).toBe(1)
    expect(result.current.total).toBe(0)
    expect(result.current.from).toBe(0)
    expect(result.current.to).toBe(0)
    expect(result.current.pageRows).toEqual([])
  })

  it('ramène automatiquement la page à 1 quand les données diminuent sous la fenêtre courante', async () => {
    const { result, rerender } = renderHook(
      ({ rows }: { rows: Row[] }) => useTablePagination<Row>('auto-clamp-page', rows, 25),
      {
        initialProps: { rows: ROWS_120 },
        wrapper: createWrapper(),
      },
    )

    act(() => {
      result.current.setPage(5)
    })

    expect(result.current.page).toBe(5)
    expect(result.current.pageCount).toBe(5)
    expect(result.current.from).toBe(101)
    expect(result.current.to).toBe(120)

    rerender({ rows: ROWS_30 })

    await waitFor(() => {
      expect(result.current.page).toBe(1)
    })

    expect(result.current.total).toBe(30)
    expect(result.current.pageCount).toBe(2)
    expect(result.current.from).toBe(1)
    expect(result.current.to).toBe(25)
    expect(result.current.pageRows.map((row) => row.id)).toEqual(
      ROWS_30.slice(0, 25).map((row) => row.id),
    )
  })

  it('utilise la valeur par défaut quand la lecture localStorage échoue', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage read failed')
    })

    const { result } = renderPagination(ROWS_120, 'broken-read', 25)

    expect(result.current.pageSize).toBe(25)
    expect(result.current.pageCount).toBe(5)
    expect(result.current.pageRows).toHaveLength(25)
  })

  it('met à jour son état même quand la persistance localStorage échoue', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage write failed')
    })

    const { result } = renderPagination(ROWS_120, 'broken-write', 25)

    act(() => {
      result.current.setPage(3)
    })

    act(() => {
      result.current.setPageSize(200)
    })

    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(200)
    expect(result.current.pageCount).toBe(1)
    expect(result.current.from).toBe(1)
    expect(result.current.to).toBe(120)
    expect(result.current.pageRows).toHaveLength(120)
  })
})