import { ReactNode } from 'react'
import { Users, Menu, Search, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMobileDrawer } from '@/contexts/MobileDrawerContext'

interface PeopleMobileHeaderProps {
  stats: {
    membres: number
  }
  roleLabel?: string
  onSearchClick?: () => void
  onAddUser?: () => void
  toolbar?: ReactNode
  headerActions?: ReactNode
  showGlobalNav?: boolean
}

export function PeopleMobileHeader({
  stats,
  roleLabel,
  onSearchClick,
  onAddUser,
  toolbar,
  headerActions,
  showGlobalNav = true,
}: PeopleMobileHeaderProps) {
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
              <Users className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-white truncate">Ressources</h1>
              <p className="text-[10px] text-white/60 truncate">
                {stats.membres} membres
                {roleLabel && <span> • {roleLabel}</span>}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onSearchClick && (
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
            )}

            {onAddUser && (
              <Button
                size="sm"
                onClick={onAddUser}
                aria-label="Ajouter un utilisateur"
                title="Ajouter un utilisateur"
                className="h-8 w-8 p-0 rounded-lg shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}

            {headerActions}
          </div>
        </div>

        {/* Row 2: Toolbar (tabs) */}
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
