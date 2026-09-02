import { useEffect, useMemo, useState } from 'react'

export type PageSizeOption = 25 | 50 | 100 | 200 | 'all'

const PAGE_SIZE_OPTIONS: PageSizeOption[] = [25, 50, 100, 200, 'all']

function readStored(key: string, fallback: PageSizeOption): PageSizeOption {
  try {
    const v = localStorage.getItem(key)
    if (!v) return fallback
    if (v === 'all') return 'all'
    const n = Number(v)
    return PAGE_SIZE_OPTIONS.includes(n as PageSizeOption) ? (n as PageSizeOption) : fallback
  } catch {
    return fallback
  }
}

/**
 * Client-side pagination hook (Twenty-CRM style).
 * Persists the page size in localStorage, keeps the page in component state,
 * auto-resets to page 1 when the total row count drops below the current window.
 */
export function useTablePagination<T>(
  storageKey: string,
  rows: T[],
  defaultPageSize: PageSizeOption = 50,
) {
  const [pageSize, setPageSizeState] = useState<PageSizeOption>(() =>
    readStored(storageKey, defaultPageSize),
  )
  const [page, setPage] = useState(1)

  const setPageSize = (v: PageSizeOption) => {
    setPageSizeState(v)
    try {
      localStorage.setItem(storageKey, String(v))
    } catch {
      /* ignore */
    }
    setPage(1)
  }

  const total = rows.length
  const effectiveSize = pageSize === 'all' ? Math.max(total, 1) : pageSize
  const pageCount = Math.max(1, Math.ceil(total / effectiveSize))

  // Auto-clamp page when data shrinks (e.g. after filter change)
  useEffect(() => {
    if (page > pageCount) setPage(1)
  }, [page, pageCount])

  const pageRows = useMemo(() => {
    if (pageSize === 'all') return rows
    const start = (page - 1) * effectiveSize
    return rows.slice(start, start + effectiveSize)
  }, [rows, page, pageSize, effectiveSize])

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    total,
    pageRows,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    from: total === 0 ? 0 : (page - 1) * effectiveSize + 1,
    to: pageSize === 'all' ? total : Math.min(page * effectiveSize, total),
  }
}
