import { ReactNode } from 'react'
import { Factory, Menu, Search, BarChart3, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMobileDrawer } from '@/contexts/MobileDrawerContext'
import { cn } from '@/lib/utils'

interface ProductionMobileHeaderProps {
  stats: {
    totalClients: number
    mrr: string
    healthScore: string
  }
  showKPIs: boolean
  onToggleKPIs: () => void
  onSearchClick: () => void
  /** Toolbar elements (view selector, filters) */
  toolbar?: ReactNode
  /** Additional header actions */
  headerActions?: ReactNode
  showGlobalNav?: boolean
}

export function ProductionMobileHeader({
  stats,
  showKPIs,
  onToggleKPIs,
  onSearchClick,
  toolbar,
  headerActions,
  showGlobalNav = true,
}: ProductionMobileHeaderProps) {
  const { open } = useMobileDrawer()

  return (
    <div className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-marque-grille" />

      {/* Decorative elements */}
      <div className="absolute top-4 right-8 w-20 h-20 bg-card/5 rounded-full blur-xl" />
      <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />

      {/* Content */}
      <div className="relative z-10 px-3 pt-3 pb-4 space-y-3">
        {/* Row 1: Hamburger, Title + Stats, Actions */}
        <div className="flex items-center gap-2">
          {/* Hamburger */}
          {showGlobalNav && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => open()}
              aria-label="Menu"
              title="Menu"
              className="h-9 w-9 p-0 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white rounded-xl shrink-0"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}

          {/* Title + Stats */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-card/10 flex items-center justify-center shrink-0">
              <Factory className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-white truncate">Production</h1>
              <p className="text-[10px] text-white/60 truncate">
                {stats.totalClients} clients • {stats.mrr} MRR • {stats.healthScore}% santé
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onSearchClick}
              aria-label="Rechercher"
              title="Rechercher"
              className="h-8 w-8 p-0 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white rounded-lg"
            >
              <Search className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleKPIs}
              aria-label={showKPIs ? 'Masquer les KPIs' : 'Afficher les KPIs'}
              title={showKPIs ? 'Masquer les KPIs' : 'Afficher les KPIs'}
              aria-pressed={showKPIs}
              className={cn(
                'h-8 px-2 gap-1 rounded-lg backdrop-blur-sm transition-all',
                showKPIs
                  ? 'bg-card text-primary shadow-md'
                  : 'bg-card/10 text-white hover:bg-card/20 border-white/20'
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <ChevronDown
                className={cn('h-3 w-3 transition-transform', showKPIs && 'rotate-180')}
              />
            </Button>
            {headerActions}
          </div>
        </div>

        {/* Row 2: Toolbar (view selector, filters) */}
        {toolbar && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 flex-nowrap">
            {toolbar}
          </div>
        )}
      </div>

      {/* Animated wave decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-4 overflow-hidden">
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="absolute bottom-0 w-full h-8"
        >
          <path
            d="M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z"
            className="fill-marque-papier animate-wave-slow"
          />
        </svg>
      </div>
    </div>
  )
}
