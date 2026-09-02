import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getRouteLabel } from '@/config/routeLabels'

export interface NavigationEntry {
  path: string
  label: string
  timestamp: number
  isVirtual?: boolean
  onNavigate?: () => void
  parentPath?: string
  entryType?: 'page' | 'tab' | 'subsection' | 'action' // Type d'entrée pour l'affichage
}

interface NavigationHistoryContextType {
  history: NavigationEntry[]
  goTo: (index: number) => void
  goBack: () => void
  clearHistory: () => void
  canGoBack: boolean
  pushVirtualEntry: (label: string, onNavigate: () => void, parentPath?: string, entryType?: 'page' | 'tab' | 'subsection' | 'action') => void
  popVirtualEntry: () => void
  replaceCurrentLabel: (label: string) => void
}

export const NavigationHistoryContext = createContext<NavigationHistoryContextType | undefined>(undefined)

interface NavigationHistoryProviderProps {
  children: ReactNode
}

const MAX_HISTORY_SIZE = 15

export function NavigationHistoryProvider({ children }: NavigationHistoryProviderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [history, setHistory] = useState<NavigationEntry[]>([])

  useEffect(() => {
    const currentPath = location.pathname
    const label = getRouteLabel(currentPath)
    
    setHistory(prev => {
      // Éviter les doublons consécutifs
      if (prev.length > 0 && prev[prev.length - 1].path === currentPath) {
        return prev
      }

      const newEntry: NavigationEntry = {
        path: currentPath,
        label,
        timestamp: Date.now()
      }

      const newHistory = [...prev, newEntry]
      
      // Limiter la taille de l'historique
      if (newHistory.length > MAX_HISTORY_SIZE) {
        return newHistory.slice(-MAX_HISTORY_SIZE)
      }
      
      return newHistory
    })
  }, [location.pathname])

  const goTo = useCallback((index: number) => {
    if (index >= 0 && index < history.length) {
      const targetEntry = history[index]
      
      // Exécuter les callbacks des entrées virtuelles qui vont être supprimées
      // En ordre inverse (de la plus récente à la plus ancienne)
      for (let i = history.length - 1; i > index; i--) {
        const entry = history[i]
        if (entry.isVirtual && entry.onNavigate) {
          entry.onNavigate()
        }
      }
      
      // Supprimer les entrées après l'index cible
      setHistory(prev => prev.slice(0, index + 1))
      
      // Si l'entrée cible est virtuelle, appeler son callback aussi
      if (targetEntry.isVirtual && targetEntry.onNavigate) {
        targetEntry.onNavigate()
      } else {
        navigate(targetEntry.path)
      }
    }
  }, [history, navigate])

  const goBack = useCallback(() => {
    if (history.length > 1) {
      const previousIndex = history.length - 2
      goTo(previousIndex)
    }
  }, [history, goTo])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  const pushVirtualEntry = useCallback((label: string, onNavigate: () => void, parentPath?: string, entryType?: 'page' | 'tab' | 'subsection' | 'action') => {
    const currentPath = location.pathname
    const newEntry: NavigationEntry = {
      path: currentPath,
      label,
      timestamp: Date.now(),
      isVirtual: true,
      onNavigate,
      parentPath: parentPath || currentPath,
      entryType: entryType || 'action'
    }
    
    setHistory(prev => {
      const newHistory = [...prev, newEntry]
      if (newHistory.length > MAX_HISTORY_SIZE) {
        return newHistory.slice(-MAX_HISTORY_SIZE)
      }
      return newHistory
    })
  }, [location.pathname])

  const popVirtualEntry = useCallback(() => {
    setHistory(prev => {
      // Retirer la dernière entrée si elle est virtuelle
      if (prev.length > 0 && prev[prev.length - 1].isVirtual) {
        return prev.slice(0, -1)
      }
      return prev
    })
  }, [])

  const replaceCurrentLabel = useCallback((label: string) => {
    setHistory(prev => {
      if (prev.length === 0) return prev
      const newHistory = [...prev]
      newHistory[newHistory.length - 1] = {
        ...newHistory[newHistory.length - 1],
        label
      }
      return newHistory
    })
  }, [])

  const canGoBack = history.length > 1

  return (
    <NavigationHistoryContext.Provider
      value={{
        history,
        goTo,
        goBack,
        clearHistory,
        canGoBack,
        pushVirtualEntry,
        popVirtualEntry,
        replaceCurrentLabel
      }}
    >
      {children}
    </NavigationHistoryContext.Provider>
  )
}
