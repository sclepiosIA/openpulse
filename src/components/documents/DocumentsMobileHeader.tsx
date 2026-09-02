import { memo } from 'react'
import {
  Menu,
  FolderOpen,
  Search,
  MoreVertical,
  Upload,
  FolderPlus,
  Building2,
  Clock,
  Share2,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useMobileDrawer } from '@/contexts/MobileDrawerContext'

interface TabConfig {
  id: string
  label: string
  shortLabel: string
  icon: typeof FolderOpen
  count?: number
  variant?: 'default' | 'destructive'
}

interface DocumentsMobileHeaderProps {
  totalDocs: number
  showGlobalNav?: boolean
  activeTab: string
  onTabChange: (tab: string) => void
  tabCounts: {
    etablissements: number
    'mes-documents': number
    recents: number
    partages: number
    corbeille: number
  }
  onUpload?: () => void
  onCreateFolder?: () => void
  onSearch?: () => void
}

const TABS: TabConfig[] = [
  { id: 'etablissements', label: 'Établissements', shortLabel: 'Étab.', icon: Building2 },
  { id: 'mes-documents', label: 'Mes documents', shortLabel: 'Docs', icon: FolderOpen },
  { id: 'recents', label: 'Récents', shortLabel: 'Récents', icon: Clock },
  { id: 'partages', label: 'Partagés', shortLabel: 'Partagés', icon: Share2 },
  {
    id: 'corbeille',
    label: 'Corbeille',
    shortLabel: 'Corbeille',
    icon: Trash2,
    variant: 'destructive',
  },
]

export const DocumentsMobileHeader = memo(function DocumentsMobileHeader({
  totalDocs,
  showGlobalNav = true,
  activeTab,
  onTabChange,
  tabCounts,
  onUpload,
  onCreateFolder,
  onSearch,
}: DocumentsMobileHeaderProps) {
  const { open: openMobileDrawer } = useMobileDrawer()

  return (
    <div className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="bg-marque-grille text-white">
        {/* Floating orbs */}
        <div className="absolute top-2 right-8 w-16 h-16 bg-card/5 rounded-full blur-xl" />
        <div className="absolute bottom-8 left-4 w-12 h-12 bg-card/5 rounded-full blur-lg" />

        {/* Main header row */}
        <div className="relative z-10 px-3 pt-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Hamburger + Title */}
            <div className="flex items-center gap-2 min-w-0">
              {showGlobalNav && (
                <button
                  onClick={openMobileDrawer}
                  className="h-10 w-10 flex items-center justify-center rounded-xl bg-card/10 hover:bg-card/20 backdrop-blur-sm border border-white/10 transition-colors shrink-0"
                  aria-label="Menu principal"
                >
                  <Menu className="h-5 w-5 text-white" />
                </button>
              )}

              <div className="flex items-center gap-2 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-card/10 backdrop-blur-sm flex items-center justify-center shrink-0">
                  <FolderOpen className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-white truncate">Documents</h1>
                  <p className="text-xs text-white/60">{totalDocs} documents</p>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl bg-card/10 hover:bg-card/20 backdrop-blur-sm border border-white/10 text-white"
                onClick={onSearch}
                aria-label="Rechercher"
              >
                <Search className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl bg-card/10 hover:bg-card/20 backdrop-blur-sm border border-white/10 text-white"
                    aria-label="Plus d'options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-popover">
                  <DropdownMenuItem onClick={onUpload} className="gap-2">
                    <Upload className="h-4 w-4" />
                    Importer des fichiers
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onCreateFolder} className="gap-2">
                    <FolderPlus className="h-4 w-4" />
                    Nouveau dossier
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Scrollable tabs row */}
        <div className="relative z-10 px-3 pb-3">
          <div className="overflow-x-auto scrollbar-hide -mx-3 px-3">
            <div className="flex items-center gap-1.5 w-max">
              {TABS.map((tab) => {
                const Icon = tab.icon
                const count = tabCounts[tab.id as keyof typeof tabCounts] ?? 0
                const isActive = activeTab === tab.id
                const isDestructive = tab.variant === 'destructive'

                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                      isActive
                        ? isDestructive
                          ? 'bg-red-500/90 text-white border border-red-400/50 shadow-sm'
                          : 'bg-card text-primary border border-white shadow-sm'
                        : 'bg-card/10 text-white/80 border border-white/10 hover:bg-card/20 hover:text-white'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tab.shortLabel}</span>
                    {count > 0 && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          'h-4 px-1 text-[10px] min-w-[16px] justify-center',
                          isActive && !isDestructive && 'bg-primary/10 text-primary',
                          isActive && isDestructive && 'bg-card/20 text-white',
                          !isActive && 'bg-card/20 text-white/80'
                        )}
                      >
                        {count}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Animated wave SVG */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 1440 60"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-6"
            preserveAspectRatio="none"
          >
            <path
              d="M0 30C240 50 480 10 720 30C960 50 1200 10 1440 30V60H0V30Z"
              fill="hsl(197 64% 97%)"
              className="animate-[wave_8s_ease-in-out_infinite]"
            />
            <path
              d="M0 40C240 55 480 25 720 40C960 55 1200 25 1440 40V60H0V40Z"
              fill="white"
              className="animate-[wave_6s_ease-in-out_infinite_reverse]"
            />
          </svg>
        </div>
      </div>
    </div>
  )
})
