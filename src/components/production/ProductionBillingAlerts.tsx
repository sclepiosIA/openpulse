import { useMemo } from 'react'
import { AlertTriangle, BarChart3, Receipt, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCsmFacturation } from '@/hooks/csm/useCsmFacturation'
import { useProduction } from '@/hooks/production/useProduction'
import { cn } from '@/lib/utils'

export function ProductionBillingAlerts() {
  const navigate = useNavigate()
  const { data: facturations } = useCsmFacturation()
  const { data: etablissements } = useProduction()

  const etabMap = useMemo(() => {
    const map = new Map<string, string>()
    etablissements?.forEach((e) => map.set(e.id, e.nom))
    return map
  }, [etablissements])

  const alerts = useMemo(() => {
    const now = new Date()
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const result: Array<{
      type: 'kpi' | 'billing'
      etablissementId: string
      nom: string
      daysLeft: number
      tab: string
    }> = []

    for (const f of facturations) {
      if (!f.date_fin_periode) continue
      const endDate = new Date(f.date_fin_periode)
      if (endDate < now || endDate > sevenDays) continue

      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const nom = etabMap.get(f.etablissement_id) || 'Établissement'

      result.push({
        type: 'kpi',
        etablissementId: f.etablissement_id,
        nom,
        daysLeft,
        tab: 'csm-kpis-mensuels',
      })

      if (f.facturation_effectuee !== 'OUI') {
        result.push({
          type: 'billing',
          etablissementId: f.etablissement_id,
          nom,
          daysLeft,
          tab: 'csm-facturation',
        })
      }
    }

    return result.sort((a, b) => a.daysLeft - b.daysLeft)
  }, [facturations, etabMap])

  if (alerts.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/40 p-3 sm:p-4 space-y-2">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <h3 className="text-sm font-semibold">
          {alerts.length} alerte{alerts.length > 1 ? 's' : ''} — Fin de période imminente
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {alerts.map((alert, i) => {
          const isUrgent = alert.daysLeft <= 2
          const Icon = alert.type === 'kpi' ? BarChart3 : Receipt
          return (
            <button
              key={`${alert.type}-${alert.etablissementId}-${i}`}
              onClick={() => navigate(`/etablissements/${alert.etablissementId}?tab=${alert.tab}`)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all group',
                'hover:shadow-sm active:scale-[0.99]',
                isUrgent
                  ? 'bg-red-100/80 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50'
                  : 'bg-card/70 dark:bg-card/5 border border-amber-200/60 dark:border-amber-800/30'
              )}
            >
              <div
                className={cn(
                  'shrink-0 rounded-md p-1.5',
                  isUrgent
                    ? 'bg-red-200/80 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                    : 'bg-amber-200/60 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{alert.nom}</p>
                <p
                  className={cn(
                    'text-[11px]',
                    isUrgent
                      ? 'text-red-600 dark:text-red-400 font-medium'
                      : 'text-muted-foreground'
                  )}
                >
                  {alert.type === 'kpi' ? 'KPIs à compléter' : 'Facturation à effectuer'}
                  {' · '}
                  <span className={cn(isUrgent && 'font-semibold')}>
                    {alert.daysLeft === 0
                      ? "Aujourd'hui"
                      : `${alert.daysLeft}j restant${alert.daysLeft > 1 ? 's' : ''}`}
                  </span>
                </p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
