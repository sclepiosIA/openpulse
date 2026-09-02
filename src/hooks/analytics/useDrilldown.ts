import { useContext } from 'react'
import { RapportsDrilldownContext } from '@/contexts/RapportsDrilldownContext'

export function useDrilldown() {
  const context = useContext(RapportsDrilldownContext)
  
  if (!context) {
    throw new Error('useDrilldown must be used within RapportsDrilldownProvider')
  }

  return context
}
