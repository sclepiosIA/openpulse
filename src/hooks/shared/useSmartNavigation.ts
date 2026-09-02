import { useNavigate } from 'react-router-dom'
import { useCallback, MouseEvent } from 'react'

/**
 * Hook pour navigation intelligente avec support Cmd/Ctrl+Clic
 * - Clic normal: navigation interne
 * - Cmd+Clic (Mac) ou Ctrl+Clic (Windows): nouvel onglet
 */
export function useSmartNavigation() {
  const navigate = useNavigate()

  const smartNavigate = useCallback((
    e: MouseEvent,
    to: string
  ) => {
    // Cmd+Clic (Mac) ou Ctrl+Clic (Windows/Linux) -> nouvel onglet
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault()
      window.open(to, '_blank')
    } else {
      navigate(to)
    }
  }, [navigate])

  return { smartNavigate, navigate }
}

/**
 * Fonction utilitaire pour créer des props de lien cliquable
 * Compatible avec l'ouverture dans un nouvel onglet
 */
export function getClickableRowProps(
  navigate: (to: string) => void,
  to: string
) {
  return {
    onClick: (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault()
        window.open(to, '_blank')
      } else {
        navigate(to)
      }
    },
    // Pour l'accessibilité et le comportement natif
    role: 'link' as const,
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        navigate(to)
      }
    }
  }
}
