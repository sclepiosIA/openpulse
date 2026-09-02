import { useCallback, useEffect, useState } from 'react'

export interface SavedView<T> {
  id: string
  name: string
  createdAt: string
  state: T
}

/**
 * Twenty CRM-inspired Saved Views.
 * Persists a list of named snapshots of an arbitrary serializable state in localStorage.
 *
 * Usage:
 *   const views = useSavedViews<MyState>('etablissements-saved-views')
 *   views.save('Mes prospects', currentState)
 *   views.apply(viewId) // returns the snapshot to apply manually
 */
export function useSavedViews<T>(storageKey: string) {
  const [views, setViews] = useState<SavedView<T>[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as SavedView<T>[]) : []
    } catch {
      return []
    }
  })
  const [activeId, setActiveId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`${storageKey}:active`)
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(views))
    } catch {
      /* ignore quota */
    }
  }, [storageKey, views])

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(`${storageKey}:active`, activeId)
      else localStorage.removeItem(`${storageKey}:active`)
    } catch {
      /* ignore */
    }
  }, [storageKey, activeId])

  const save = useCallback((name: string, state: T): SavedView<T> => {
    const view: SavedView<T> = {
      id: `view_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || 'Vue sans nom',
      createdAt: new Date().toISOString(),
      state,
    }
    setViews((prev) => [...prev, view])
    setActiveId(view.id)
    return view
  }, [])

  const update = useCallback((id: string, state: T) => {
    setViews((prev) => prev.map((v) => (v.id === id ? { ...v, state } : v)))
  }, [])

  const rename = useCallback((id: string, name: string) => {
    setViews((prev) =>
      prev.map((v) => (v.id === id ? { ...v, name: name.trim() || v.name } : v)),
    )
  }, [])

  const remove = useCallback(
    (id: string) => {
      setViews((prev) => prev.filter((v) => v.id !== id))
      setActiveId((prev) => (prev === id ? null : prev))
    },
    [],
  )

  const get = useCallback(
    (id: string): SavedView<T> | undefined => views.find((v) => v.id === id),
    [views],
  )

  const setActive = useCallback((id: string | null) => setActiveId(id), [])

  return { views, activeId, save, update, rename, remove, get, setActive }
}
