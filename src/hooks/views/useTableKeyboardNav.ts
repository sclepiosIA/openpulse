import { useCallback, useEffect, useRef } from 'react'

/**
 * Twenty CRM-inspired keyboard navigation for tables/lists.
 *
 * Bindings (when focus is within the container):
 *  - ArrowDown / j  → focus next row
 *  - ArrowUp   / k  → focus previous row
 *  - Home           → focus first row
 *  - End            → focus last row
 *  - Enter / Space  → handled natively by the row (no-op here)
 *
 * Rows are matched via `[data-row-nav="true"]` and must be focusable
 * (typically `tabIndex={0}`).
 *
 * The hook also auto-focuses the first row once on mount so the user can
 * immediately start navigating with the keyboard.
 */
export function useTableKeyboardNav<T extends HTMLElement = HTMLDivElement>(opts?: {
  autoFocusFirst?: boolean
}) {
  const containerRef = useRef<T | null>(null)
  const didAutoFocus = useRef(false)

  const getRows = useCallback((): HTMLElement[] => {
    const root = containerRef.current
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLElement>('[data-row-nav="true"]'))
  }, [])

  useEffect(() => {
    if (!opts?.autoFocusFirst || didAutoFocus.current) return
    const rows = getRows()
    if (rows.length > 0) {
      didAutoFocus.current = true
    }
  }, [getRows, opts?.autoFocusFirst])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Skip if user is typing in a form control
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return
        }
      }

      const isNext = e.key === 'ArrowDown' || e.key === 'j'
      const isPrev = e.key === 'ArrowUp' || e.key === 'k'
      const isFirst = e.key === 'Home'
      const isLast = e.key === 'End'
      if (!isNext && !isPrev && !isFirst && !isLast) return

      const rows = getRows()
      if (rows.length === 0) return

      const active = document.activeElement as HTMLElement | null
      const idx = active ? rows.indexOf(active) : -1

      let nextIdx = idx
      if (isFirst) nextIdx = 0
      else if (isLast) nextIdx = rows.length - 1
      else if (isNext) nextIdx = idx < 0 ? 0 : Math.min(rows.length - 1, idx + 1)
      else if (isPrev) nextIdx = idx < 0 ? 0 : Math.max(0, idx - 1)

      const target2 = rows[nextIdx]
      if (target2) {
        e.preventDefault()
        target2.focus()
        target2.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    },
    [getRows],
  )

  return { containerRef, onKeyDown }
}
