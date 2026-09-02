import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Generic side-peek state, synced to URL via `?peek=<id>`.
 * Inspired by Twenty CRM's signature row-preview UX.
 *
 * Multiple peek scopes can coexist on a page by passing a distinct `paramKey`
 * (e.g. 'peek', 'peek-prospect'). Default is 'peek'.
 */
export function useSidePeek(paramKey: string = 'peek') {
  const [searchParams, setSearchParams] = useSearchParams()
  const openId = searchParams.get(paramKey)

  const open = useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(paramKey, id)
          return next
        },
        { replace: false },
      )
    },
    [paramKey, setSearchParams],
  )

  const close = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(paramKey)
        return next
      },
      { replace: true },
    )
  }, [paramKey, setSearchParams])

  // ESC closes the peek even when focus is outside the sheet
  useEffect(() => {
    if (!openId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId, close])

  return { openId, isOpen: !!openId, open, close }
}
