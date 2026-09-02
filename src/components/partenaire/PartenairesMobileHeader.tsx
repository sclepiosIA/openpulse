import { ReactNode } from 'react'
import {
  Handshake,
  Search,
  Plus,
  Menu,
  MoreHorizontal,
  BarChart3,
  RefreshCw,
  Download,
  Filter,
  CheckSquare,
  FileText,
  FileSpreadsheet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMobileDrawer } from '@/contexts/MobileDrawerContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface PartenairesMobileHeaderProps {
  searchValue: string
  onSearchChange: (value: string) => void
  onCreateClick: () => void
  stats: {
    displayed: number
    total: number
    actifs: number
    valeur: string
  }
  /** Toolbar elements (filters, view selector, sort, etc.) */
  toolbar?: ReactNode
  showGlobalNav?: boolean
  showStats: boolean
  onToggleStats: () => void
  onAdvancedSearch: () => void
  onExport: (format: 'csv' | 'excel' | 'pdf') => void
  onRefresh: () => void
  selectionMode: boolean
  onToggleSelectionMode: () => void
}

export function PartenairesMobileHeader({
  searchValue,
  onSearchChange,
  onCreateClick,
  stats,
  toolbar,
  showGlobalNav = true,
  showStats,
  onToggleStats,
  onAdvancedSearch,
  onExport,
  onRefresh,
  selectionMode,
  onToggleSelectionMode,
}: PartenairesMobileHeaderProps) {
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
        {/* Row 1: Hamburger, Title + Stats, Search + Actions */}
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
              <Handshake className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-white truncate">Partenaires</h1>
              <p className="text-[10px] text-white/60 truncate">
                {stats.displayed} affich. • {stats.actifs} actifs • {stats.valeur}
              </p>
            </div>
          </div>

          {/* Search + Stats + More + Create */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative w-24">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/50" />
              <Input
                placeholder="Chercher..."
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-8 pl-7 pr-2 text-xs bg-card/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50 rounded-lg"
              />
            </div>

            {/* Stats toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleStats}
              aria-label={showStats ? 'Masquer les statistiques' : 'Afficher les statistiques'}
              title={showStats ? 'Masquer les statistiques' : 'Afficher les statistiques'}
              aria-pressed={showStats}
              className={cn(
                'h-8 w-8 p-0 rounded-lg backdrop-blur-sm shrink-0',
                showStats
                  ? 'bg-card text-primary'
                  : 'bg-card/10 text-white/80 border border-white/20 hover:bg-card/20'
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </Button>

            {/* More dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Plus d'options"
                  title="Plus d'options"
                  className="h-8 w-8 p-0 bg-card/10 text-white/80 hover:bg-card/20 hover:text-white border border-white/20 backdrop-blur-sm rounded-lg shrink-0"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onAdvancedSearch}>
                  <Filter className="h-4 w-4 mr-2" />
                  Recherche avancée
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Download className="h-4 w-4 mr-2" />
                    Exporter
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => onExport('csv')}>
                      <FileText className="h-4 w-4 mr-2" />
                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExport('excel')}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExport('pdf')}>
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={onToggleSelectionMode}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  {selectionMode ? 'Désactiver sélection' : 'Mode sélection'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualiser
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Create button */}
            <Button
              size="sm"
              onClick={onCreateClick}
              aria-label="Ajouter un partenaire"
              title="Ajouter un partenaire"
              className="h-8 w-8 p-0 rounded-lg shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Row 2: Toolbar (filters, view selector, sort) - single line */}
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
