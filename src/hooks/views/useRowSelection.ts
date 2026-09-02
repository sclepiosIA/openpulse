import { useCallback, useMemo, useState } from 'react'

/**
 * Generic row selection state for table views.
 * Tracks a Set of selected IDs and provides toggle/selectAll helpers.
 */
export function useRowSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelectedIds(new Set()), [])

  const allIds = useMemo(() => items.map((i) => i.id), [items])
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
  const someSelected = !allSelected && allIds.some((id) => selectedIds.has(id))

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (allIds.every((id) => prev.has(id))) return new Set()
      return new Set(allIds)
    })
  }, [allIds])

  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds],
  )

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  return {
    selectedIds,
    selectedItems,
    isSelected,
    toggle,
    toggleAll,
    clear,
    allSelected,
    someSelected,
    count: selectedIds.size,
  }
}
