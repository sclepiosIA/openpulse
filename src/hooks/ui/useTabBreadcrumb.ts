import { useEffect, useCallback } from 'react'
import { useVirtualBreadcrumb } from '../shared/useVirtualBreadcrumb'

interface TabConfig {
  pageLabel: string
  parentPath: string
  tabLabels: Record<string, string>
  onTabChange?: (tabId: string) => void
}

/**
 * Hook pour intégrer les onglets dans le fil d'Ariane
 * Crée automatiquement des entrées virtuelles quand l'onglet change
 */
export function useTabBreadcrumb(
  config: TabConfig,
  currentTab: string,
  subLabel?: string
) {
  const { pushEntry, popEntry, updateLabel } = useVirtualBreadcrumb()

  // Construire le label complet
  const tabLabel = config.tabLabels[currentTab] || currentTab
  const fullLabel = subLabel ? `${tabLabel} > ${subLabel}` : tabLabel

  // Mettre à jour le fil d'Ariane quand l'onglet change
  useEffect(() => {
    // Créer une entrée virtuelle pour l'onglet avec type 'tab'
    pushEntry(fullLabel, () => {
      // Quand on clique sur cette entrée, on peut optionnellement appeler onTabChange
      if (config.onTabChange) {
        config.onTabChange(currentTab)
      }
    }, config.parentPath, 'tab') // Type 'tab' pour l'icône

    // Nettoyer quand on change d'onglet ou quitte la page
    return () => {
      popEntry()
    }
  }, [currentTab, fullLabel, config.parentPath])

  /**
   * Wrapper pour les fonctions de changement d'onglet
   * Ajoute automatiquement la gestion du fil d'Ariane
   */
  const wrapTabChange = useCallback((handler: (tab: string) => void) => {
    return (tab: string) => {
      handler(tab)
    }
  }, [])

  return {
    wrapTabChange,
    updateSubLabel: (label: string) => {
      updateLabel(`${tabLabel} > ${label}`)
    }
  }
}
