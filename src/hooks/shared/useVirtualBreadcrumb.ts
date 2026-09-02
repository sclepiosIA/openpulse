import { useCallback } from 'react'
import { useNavigationHistory } from './useNavigationHistory'

export function useVirtualBreadcrumb() {
  const { pushVirtualEntry, popVirtualEntry, replaceCurrentLabel } = useNavigationHistory()
  
  const pushEntry = useCallback((
    label: string, 
    onBack: () => void, 
    parentPath?: string,
    entryType?: 'page' | 'tab' | 'subsection' | 'action'
  ) => {
    pushVirtualEntry(label, onBack, parentPath, entryType)
  }, [pushVirtualEntry])
  
  const popEntry = useCallback(() => {
    popVirtualEntry()
  }, [popVirtualEntry])
  
  const updateLabel = useCallback((label: string) => {
    replaceCurrentLabel(label)
  }, [replaceCurrentLabel])
  
  return { pushEntry, popEntry, updateLabel }
}
