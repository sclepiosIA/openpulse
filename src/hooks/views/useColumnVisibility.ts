import { useCallback, useEffect, useMemo, useState } from 'react'

export interface ColumnConfig {
  key: string
  label: string
  /** Always shown, cannot be hidden (e.g. name column) */
  required?: boolean
  /** Hidden by default */
  hiddenByDefault?: boolean
}

interface StoredState {
  visible: string[]
  order: string[]
}

/**
 * Twenty CRM-inspired column visibility + ordering hook.
 * Persists user preference in localStorage scoped by `storageKey`.
 *
 * Returns:
 *  - `visibleColumns`: ordered list of visible ColumnConfig (use this to render)
 *  - `isVisible(key)`, `toggle(key)`: visibility controls
 *  - `move(key, direction)`: reorder a column by one slot
 *  - `reset()`: restore defaults
 */
export function useColumnVisibility(storageKey: string, columns: ColumnConfig[]) {
  const defaultVisible = useMemo(
    () => columns.filter((c) => !c.hiddenByDefault).map((c) => c.key),
    [columns],
  )
  const defaultOrder = useMemo(() => columns.map((c) => c.key), [columns])

  const [state, setState] = useState<StoredState>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return { visible: defaultVisible, order: defaultOrder }
      const parsed = JSON.parse(raw) as Partial<StoredState>
      const validKeys = new Set(columns.map((c) => c.key))
      const visible = Array.isArray(parsed.visible)
        ? parsed.visible.filter((k) => typeof k === 'string' && validKeys.has(k))
        : defaultVisible
      // Order: keep persisted order then append any new keys
      const persistedOrder = Array.isArray(parsed.order)
        ? parsed.order.filter((k) => typeof k === 'string' && validKeys.has(k))
        : []
      const missing = defaultOrder.filter((k) => !persistedOrder.includes(k))
      return { visible, order: [...persistedOrder, ...missing] }
    } catch {
      return { visible: defaultVisible, order: defaultOrder }
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      /* quota / private mode — silently ignore */
    }
  }, [storageKey, state])

  const isVisible = useCallback(
    (key: string) => {
      const col = columns.find((c) => c.key === key)
      if (col?.required) return true
      return state.visible.includes(key)
    },
    [state.visible, columns],
  )

  const toggle = useCallback(
    (key: string) => {
      const col = columns.find((c) => c.key === key)
      if (col?.required) return
      setState((prev) => ({
        ...prev,
        visible: prev.visible.includes(key)
          ? prev.visible.filter((k) => k !== key)
          : [...prev.visible, key],
      }))
    },
    [columns],
  )

  const move = useCallback((key: string, direction: 'up' | 'down') => {
    setState((prev) => {
      const idx = prev.order.indexOf(key)
      if (idx === -1) return prev
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= prev.order.length) return prev
      const order = [...prev.order]
      ;[order[idx], order[swapIdx]] = [order[swapIdx], order[idx]]
      return { ...prev, order }
    })
  }, [])

  const reset = useCallback(
    () => setState({ visible: defaultVisible, order: defaultOrder }),
    [defaultVisible, defaultOrder],
  )

  /** Columns ordered by user preference (use for render). */
  const orderedColumns = useMemo(() => {
    const byKey = new Map(columns.map((c) => [c.key, c]))
    return state.order
      .map((k) => byKey.get(k))
      .filter((c): c is ColumnConfig => Boolean(c))
  }, [columns, state.order])

  const visibleColumns = useMemo(
    () => orderedColumns.filter((c) => isVisible(c.key)),
    [orderedColumns, isVisible],
  )

  /** Bulk-set the persisted state (used by Saved Views). */
  const setRaw = useCallback(
    (next: { visible: string[]; order: string[] }) => {
      const validKeys = new Set(columns.map((c) => c.key))
      const visible = next.visible.filter((k) => validKeys.has(k))
      const persistedOrder = next.order.filter((k) => validKeys.has(k))
      const missing = defaultOrder.filter((k) => !persistedOrder.includes(k))
      setState({ visible, order: [...persistedOrder, ...missing] })
    },
    [columns, defaultOrder],
  )

  return {
    isVisible,
    toggle,
    move,
    reset,
    setRaw,
    orderedColumns,
    visibleColumns,
    visibleKeys: state.visible,
    order: state.order,
  }
}
