import { motion } from 'framer-motion'
import { Building2, Euro, TrendingUp, Zap, ArrowUp, ArrowDown, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { useMobileDrawer } from '@/contexts/MobileDrawerContext'
import { useShouldAnimate } from '@/hooks/ui/useShouldAnimate'

interface DashboardHeroProps {
  totalEtablissements: number
  totalValeur: number
  conversionRate: number
  prospects: number
  production: number
  contractuels: number
  toolbarActions?: React.ReactNode
}

export function DashboardHero({
  totalEtablissements,
  totalValeur,
  conversionRate,
  prospects,
  production,
  contractuels,
  toolbarActions,
}: DashboardHeroProps) {
  const navigate = useNavigate()
  const { open: openMobileDrawer } = useMobileDrawer()
  const shouldAnimate = useShouldAnimate()

  const metrics = [
    {
      label: 'CA Potentiel',
      value: `${((totalValeur ?? 0) / 1000000).toFixed(1)}M€`,
      subtext: 'Pipeline total',
      icon: Euro,
      trend: '+12%',
      trendUp: true,
      onClick: () => navigate('/etablissements'),
    },
    {
      label: 'Établissements',
      value: String(totalEtablissements ?? 0),
      subtext: `${prospects ?? 0} prospects • ${contractuels ?? 0} contrats`,
      icon: Building2,
      trend: '+5',
      trendUp: true,
      onClick: () => navigate('/etablissements'),
    },
    {
      label: 'Taux de Conversion',
      value: `${conversionRate ?? 0}%`,
      subtext: 'Prospect → Client',
      icon: TrendingUp,
      trend: '+2.3%',
      trendUp: true,
      onClick: () => navigate('/etablissements'),
    },
    {
      label: 'En Production',
      value: String(production ?? 0),
      subtext: 'Établissements actifs',
      icon: Zap,
      trend: '+3',
      trendUp: true,
      onClick: () => navigate('/production'),
    },
  ]

  return (
    <section className="relative overflow-hidden bg-[hsl(var(--surface-immersive))] text-white">
      {/* Toolbar intégrée en haut */}
      <div className="relative z-20 px-4 sm:px-6 lg:px-8 py-3">
        <div className="container mx-auto max-w-[100vw] flex items-center justify-between">
          {/* Gauche: Menu hamburger (mobile only) */}
          <div className="flex items-center gap-2">
            {/* Mobile hamburger menu */}
            <button
              onClick={openMobileDrawer}
              className="md:hidden flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-card/10 hover:bg-card/20 backdrop-blur-sm border border-white/20 transition-colors"
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Droite: Actions */}
          <div className="flex items-center gap-2">
            {toolbarActions}
            <GlobalSearchDialog triggerClassName="text-white/80 hover:text-white hover:bg-card/20 border-white/20" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto max-w-[100vw] px-4 sm:px-6 lg:px-8 pb-12">
        <motion.div
          className="text-center mb-10"
          initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 tracking-tight">
            Tableau de bord
          </h1>
          <p className="text-white/70 text-base sm:text-lg">Vue d'ensemble de votre activité</p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
          {metrics.map((metric, index) => {
            const Icon = metric.icon
            return (
              <motion.button
                type="button"
                key={metric.label}
                initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                onClick={metric.onClick}
                aria-label={`${metric.label} : ${metric.value}. ${metric.subtext}`}
                className={cn(
                  'group relative overflow-hidden rounded-xl border border-white/20 bg-card/10 p-3 text-left',
                  'sm:p-5 lg:p-7 hover:bg-card/15 hover:border-white/40',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2',
                  'focus-visible:ring-offset-[hsl(var(--surface-immersive))] transition-colors duration-200'
                )}
              >
                <div>
                  <div className="flex items-center gap-1.5 sm:gap-3 mb-2 sm:mb-4">
                    <div className="p-1.5 sm:p-2.5 rounded-xl bg-card/20 group-hover:bg-card/30 transition-colors duration-300 shrink-0">
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                    </div>
                    <span className="text-[10px] sm:text-xs font-semibold text-white/80 uppercase tracking-wide sm:tracking-wider line-clamp-1">
                      {metric.label}
                    </span>
                  </div>

                  <div className="text-xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-white mb-1 sm:mb-2 tracking-tight">
                    {metric.value}
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[10px] sm:text-sm text-white/60 truncate flex-1 min-w-0">
                      {metric.subtext}
                    </p>
                    <span
                      className={cn(
                        'flex items-center gap-0.5 text-[10px] sm:text-xs font-medium shrink-0',
                        metric.trendUp ? 'text-success' : 'text-destructive'
                      )}
                    >
                      {metric.trendUp ? (
                        <ArrowUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      ) : (
                        <ArrowDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      )}
                      {metric.trend}
                    </span>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
