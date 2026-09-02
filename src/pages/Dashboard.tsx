import { Suspense } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry'
import { useRolePermissions } from '@/hooks/auth/useRolePermissions'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageDataState } from '@/components/shared/PageDataState'
import { debug } from '@/lib/debug'
import { useQueryClient } from '@tanstack/react-query'

// Lazy-load des 4 dashboards rôle-spécifiques : seul celui correspondant
// au rôle de l'utilisateur est téléchargé, libérant ~3 chunks de l'eager bundle
// (charts, KPIs, listes…). Cf. Phase 2 — Bundle & TTI.
const DirectionDashboard = lazy(() =>
  import('@/components/dashboard/DirectionDashboard').then((m) => ({
    default: m.DirectionDashboard,
  }))
)
const TechniqueDashboard = lazy(() =>
  import('@/components/dashboard/TechniqueDashboard').then((m) => ({
    default: m.TechniqueDashboard,
  }))
)
const CSMDashboard = lazy(() =>
  import('@/components/dashboard/CSMDashboard').then((m) => ({ default: m.CSMDashboard }))
)
const CommercialDashboard = lazy(() =>
  import('@/components/dashboard/CommercialDashboard').then((m) => ({
    default: m.CommercialDashboard,
  }))
)

function DashboardLoader({ label }: { label: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <PageDataState isLoading loadingLabel={label}>
        {null}
      </PageDataState>
    </div>
  )
}

export default function Dashboard() {
  usePageTitle('Dashboard')
  const permissions = useRolePermissions()
  const queryClient = useQueryClient()

  // Attendre que le rôle/équipe soit résolu pour éviter de monter le mauvais dashboard
  // (cas copil : team='direction' une fois le rôle chargé).
  if (permissions.isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <PageDataState
          isLoading
          loadingLabel="Chargement de votre tableau de bord..."
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['user-role'] })}
        >
          {null}
        </PageDataState>
      </div>
    )
  }

  const pickDashboard = () => {
    // Router en priorité sur le rôle métier (plus précis que l'équipe :
    // direction/admin/copil partagent team='direction' → DirectionDashboard,
    // mais csm/commercial/technique ont leur propre dashboard).
    switch (permissions.role) {
      case 'csm':
        return <CSMDashboard />
      case 'commercial':
        return <CommercialDashboard />
      case 'chef_projet':
        return <TechniqueDashboard />
      case 'direction':
      case 'admin':
      case 'copil':
      case 'rh':
        return <DirectionDashboard />
      default:
        switch (permissions.team) {
          case 'csm':
            return <CSMDashboard />
          case 'commercial':
            return <CommercialDashboard />
          case 'technique':
            return <TechniqueDashboard />
          default:
            return <DirectionDashboard />
        }
    }
  }

  try {
    return (
      <Suspense fallback={<DashboardLoader label="Chargement de votre tableau de bord..." />}>
        {pickDashboard()}
      </Suspense>
    )
  } catch (error) {
    debug.error('Error in Dashboard component:', error)
    return (
      <div className="p-6 flex items-center justify-center">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-destructive mb-4">Une erreur est survenue lors du chargement</div>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard'] })}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
}
