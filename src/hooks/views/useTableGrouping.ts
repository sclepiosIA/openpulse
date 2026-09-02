import { useMemo, useState, useEffect } from 'react'

export interface GroupableField<T> {
  key: string
  label: string
  getValue: (row: T) => string | null | undefined
}

export interface RowGroup<T> {
  key: string
  label: string
  rows: T[]
  count: number
}

/**
 * Twenty CRM-inspired row grouping for tables.
 * Persists the active group field in localStorage so the user gets
 * back to their preferred view.
 *
 * Pass `null` (or the special key `__none__`) to disable grouping.
 */
export function useTableGrouping<T>(
  storageKey: string,
  rows: T[],
  fields: GroupableField<T>[],
) {
  const [groupBy, setGroupBy] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw || raw === '__none__') return null
      return fields.some((f) => f.key === raw) ? raw : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, groupBy ?? '__none__')
    } catch {
      /* ignore quota */
    }
  }, [storageKey, groupBy])

  const activeField = useMemo(
    () => fields.find((f) => f.key === groupBy) ?? null,
    [fields, groupBy],
  )

  const groups: RowGroup<T>[] | null = useMemo(() => {
    if (!activeField) return null
    const map = new Map<string, T[]>()
    for (const row of rows) {
      const raw = activeField.getValue(row)
      const key = raw == null || raw === '' ? '—' : String(raw)
      const list = map.get(key)
      if (list) list.push(row)
      else map.set(key, [row])
    }
    return Array.from(map.entries())
      .map(([key, rows]) => ({ key, label: key, rows, count: rows.length }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [rows, activeField])

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggleCollapsed = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return {
    groupBy,
    setGroupBy,
    activeField,
    groups,
    fields,
    collapsed,
    toggleCollapsed,
  }
}
