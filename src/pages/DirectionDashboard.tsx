import { useEffect } from 'react'
import Dashboard from '@/pages/Dashboard'

/**
 * Vue dédiée Direction — alias /direction.
 *
 * Audit run-1781450868 (juin 2026) :
 *  - BUG high : /direction était accessible aux commerciaux → désormais
 *    protégé par RouteGuard allowedTeams=['direction'] dans AuthenticatedRoutes.
 *  - BUG medium : /direction affichait juste « Tableau de bord » → cette page
 *    fournit un titre + heading explicites « Direction » pour distinguer
 *    visuellement la vue, tout en réutilisant le Dashboard existant qui agrège
 *    déjà les KPIs métier consultés par la direction.
 */
export default function DirectionDashboard() {
  useEffect(() => {
    const previous = document.title
    document.title = 'Direction · OpenPulse'
    return () => {
      document.title = previous
    }
  }, [])

  return (
    <div data-testid="direction-page">
      <div className="px-4 pt-4 md:px-6 md:pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Direction
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue consolidée des indicateurs de pilotage réservée à l'équipe direction.
        </p>
      </div>
      <Dashboard />
    </div>
  )
}
