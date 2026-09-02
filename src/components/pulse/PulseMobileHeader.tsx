import { MessageCircle, Menu, Search, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMobileDrawer } from '@/contexts/MobileDrawerContext'
import { StatusSelectorHeader } from './StatusSelectorHeader'

interface PulseMobileHeaderProps {
  conversationsCount: number
  onlineCount: number
  onSearch: () => void
  onCreate: () => void
  showGlobalNav?: boolean
}

export function PulseMobileHeader({
  conversationsCount,
  onlineCount,
  onSearch,
  onCreate,
  showGlobalNav = true,
}: PulseMobileHeaderProps) {
  const { open: openMobileDrawer } = useMobileDrawer()

  return (
    <header className="relative flex-shrink-0 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-marque-grille" />

      {/* Decorative wave */}
      <div className="absolute bottom-0 left-0 right-0 h-6 opacity-20">
        <svg className="w-full h-full" viewBox="0 0 1440 24" preserveAspectRatio="none">
          <path
            d="M0,12 C320,20 420,4 720,14 C1020,22 1200,6 1440,16 L1440,24 L0,24 Z"
            fill="currentColor"
            className="text-white"
          />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 px-3 py-3 flex items-center justify-between gap-2">
        {/* Left: Hamburger + Title + Stats */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Hamburger menu button - only if showGlobalNav */}
          {showGlobalNav && (
            <button
              onClick={openMobileDrawer}
              className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-card/10 hover:bg-card/20 backdrop-blur-sm border border-white/20 transition-colors"
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5 text-white" />
            </button>
          )}

          {/* Icon + Title */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-card/15 backdrop-blur-sm flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-white truncate">Pulse</h1>
              <p className="text-xs text-white/70 truncate">
                {conversationsCount} conv.{onlineCount > 0 && ` • ${onlineCount} en ligne`}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Status selector */}
          <StatusSelectorHeader />

          {/* Search */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 bg-card/10 hover:bg-card/20 backdrop-blur-sm border border-white/20 text-white"
            onClick={onSearch}
            aria-label="Rechercher"
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* New conversation */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 bg-card/15 hover:bg-card/25 backdrop-blur-sm border border-white/25 text-white"
            onClick={onCreate}
            aria-label="Ajouter"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
