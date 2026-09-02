import { CalendarCheck, Search, Plus, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMobileDrawer } from '@/contexts/MobileDrawerContext'

interface BookingMobileHeaderProps {
  stats: {
    pending: number
    confirmed: number
    thisWeek: number
  }
  onSearchClick: () => void
  onCreatePage: () => void
  showGlobalNav?: boolean
}

export function BookingMobileHeader({
  stats,
  onSearchClick,
  onCreatePage,
  showGlobalNav = true,
}: BookingMobileHeaderProps) {
  const { open: openMobileDrawer } = useMobileDrawer()

  return (
    <div className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-marque-grille" />

      {/* Decorative elements */}
      <div className="absolute top-4 right-8 w-20 h-20 bg-card/5 rounded-full blur-xl" />
      <div className="absolute bottom-6 left-12 w-16 h-16 bg-primary/10 rounded-full blur-lg" />

      {/* Content */}
      <div className="relative z-10 px-4 pt-4 pb-6">
        {/* Top row: hamburger, title, stats, actions */}
        <div className="flex items-center gap-3">
          {/* Hamburger menu */}
          {showGlobalNav && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl bg-card/10 backdrop-blur-sm border border-white/20 text-white hover:bg-card/20"
              onClick={openMobileDrawer}
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          {/* Icon + Title */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-card/20 backdrop-blur-sm flex items-center justify-center">
              <CalendarCheck className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-white truncate">Prise de RDV</h1>
          </div>

          {/* Inline stats */}
          <div className="hidden xs:flex items-center gap-2 text-xs text-white/80">
            <span className="px-2 py-0.5 bg-amber-500/30 rounded-full">{stats.pending} att.</span>
            <span className="px-2 py-0.5 bg-emerald-500/30 rounded-full">
              {stats.confirmed} conf.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl bg-card/10 backdrop-blur-sm border border-white/20 text-white hover:bg-card/20"
              onClick={onSearchClick}
              aria-label="Rechercher"
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-9 w-9 rounded-xl bg-card text-primary hover:bg-card/90 shadow-lg"
              onClick={onCreatePage}
              aria-label="Ajouter"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile stats row (visible on very small screens) */}
        <div className="flex xs:hidden items-center gap-2 mt-3 text-xs text-white/80">
          <span className="px-2 py-0.5 bg-amber-500/30 rounded-full">
            {stats.pending} en attente
          </span>
          <span className="px-2 py-0.5 bg-emerald-500/30 rounded-full">
            {stats.confirmed} confirmés
          </span>
          <span className="px-2 py-0.5 bg-blue-500/30 rounded-full">{stats.thisWeek} sem.</span>
        </div>
      </div>

      {/* Animated wave */}
      <svg
        className="absolute bottom-0 left-0 w-full h-6"
        viewBox="0 0 1200 30"
        preserveAspectRatio="none"
      >
        <path
          d="M0,15 C300,30 600,0 900,15 C1050,22 1150,8 1200,15 L1200,30 L0,30 Z"
          className="fill-marque-papier"
        >
          <animate
            attributeName="d"
            dur="8s"
            repeatCount="indefinite"
            values="
              M0,15 C300,30 600,0 900,15 C1050,22 1150,8 1200,15 L1200,30 L0,30 Z;
              M0,20 C300,5 600,25 900,10 C1050,5 1150,20 1200,12 L1200,30 L0,30 Z;
              M0,15 C300,30 600,0 900,15 C1050,22 1150,8 1200,15 L1200,30 L0,30 Z
            "
          />
        </path>
      </svg>
    </div>
  )
}
