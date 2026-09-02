import { useCallback, useEffect, useState } from 'react'

export interface FavoriteItem {
  id: string
  type: string
  title: string
  subtitle?: string
  url: string
}

const STORAGE_KEY = 'workspace-favorites-v1'
const MAX_FAVORITES = 50

function read(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(items: FavoriteItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_FAVORITES)))
    window.dispatchEvent(new CustomEvent('favorites:changed'))
  } catch {
    /* noop */
  }
}

/**
 * Generic workspace favorites stored in localStorage.
 * Inspired by Twenty CRM's pinned objects.
 */
export function useFavorites() {
  const [items, setItems] = useState<FavoriteItem[]>(() => read())

  useEffect(() => {
    const handler = () => setItems(read())
    window.addEventListener('favorites:changed', handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('favorites:changed', handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  const isFavorite = useCallback(
    (id: string, type: string) => items.some((i) => i.id === id && i.type === type),
    [items],
  )

  const toggle = useCallback((item: FavoriteItem) => {
    const current = read()
    const exists = current.some((i) => i.id === item.id && i.type === item.type)
    const next = exists
      ? current.filter((i) => !(i.id === item.id && i.type === item.type))
      : [item, ...current]
    write(next)
    setItems(next)
    return !exists
  }, [])

  const remove = useCallback((id: string, type: string) => {
    const next = read().filter((i) => !(i.id === id && i.type === type))
    write(next)
    setItems(next)
  }, [])

  const clear = useCallback(() => {
    write([])
    setItems([])
  }, [])

  return { favorites: items, isFavorite, toggle, remove, clear }
}
