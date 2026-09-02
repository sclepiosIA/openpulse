import { memo } from 'react'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  FileImage,
  FileText,
  Loader2,
  Plus,
  Flame,
  AlertTriangle,
  CheckCircle2,
  Construction,
  BarChart3,
  Download,
  HelpCircle,
  Briefcase,
  Rocket,
  Settings,
} from 'lucide-react'
import { ZoomLevel } from './hooks/useGanttZoom'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface GanttControlsProps {
  zoomLevel: ZoomLevel
  onZoomChange: (level: ZoomLevel) => void
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
  onToggleFilters: () => void
  onExportPNG?: () => void
  onExportPDF?: () => void
  isExporting?: boolean
  hasActiveFilters?: boolean
  quickFilters?: {
    highPriorityOnly: boolean
    overdueOnly: boolean
    hideCompleted: boolean
    blockedOnly: boolean
    commercialOnly: boolean
    deploiementOnly: boolean
    productionOnly: boolean
  }
  onToggleQuickFilter?: (key: string) => void
  visiblePeriod?: { start: Date; end: Date }
  onToggleHeatmap?: () => void
  heatmapEnabled?: boolean
  onCreateTask?: () => void
}

const zoomLevels: { value: ZoomLevel; label: string }[] = [
  { value: 'day', label: 'J' },
  { value: 'week', label: 'S' },
  { value: 'month', label: 'M' },
  { value: 'quarter', label: 'T' },
  { value: 'year', label: 'A' },
]

export const GanttControls = memo(
  ({
    zoomLevel,
    onZoomChange,
    onPrevious,
    onNext,
    onToday,
    onToggleFilters,
    onExportPNG,
    onExportPDF,
    isExporting = false,
    hasActiveFilters,
    quickFilters,
    onToggleQuickFilter,
    visiblePeriod,
    onToggleHeatmap,
    heatmapEnabled = false,
    onCreateTask,
  }: GanttControlsProps) => {
    const activeQuickFiltersCount = quickFilters
      ? Object.values(quickFilters).filter(Boolean).length + (heatmapEnabled ? 1 : 0)
      : 0

    return (
      <div className="flex items-center justify-between gap-2 p-2.5 bg-marque-papier backdrop-blur-sm border-b border-primary/10 flex-wrap">
        {/* Gauche: Navigation + Zoom */}
        <div className="flex items-center gap-1.5">
          {/* Navigation temporelle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevious}
            className="h-8 w-8 bg-card/60 hover:bg-card/80 backdrop-blur-sm border border-primary/10 rounded-lg shadow-sm"
            aria-label="Précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            className="h-8 px-3 text-xs bg-card/60 hover:bg-card/80 backdrop-blur-sm border-primary/10 rounded-lg shadow-sm"
          >
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Aujourd'hui</span>
            <span className="sm:hidden">Auj.</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            className="h-8 w-8 bg-card/60 hover:bg-card/80 backdrop-blur-sm border border-primary/10 rounded-lg shadow-sm"
            aria-label="Suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1.5 bg-primary/10" />

          {/* Zoom - ToggleGroup avec underline style */}
          <div className="flex items-center bg-card/70 backdrop-blur-sm border border-primary/10 rounded-xl p-0.5 shadow-sm">
            <ToggleGroup
              type="single"
              value={zoomLevel}
              onValueChange={(value) => value && onZoomChange(value as ZoomLevel)}
              className="bg-transparent gap-0.5"
            >
              {zoomLevels.map(({ value, label }) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  className="h-7 px-3 text-xs rounded-lg bg-transparent data-[state=on]:bg-card data-[state=on]:shadow-md data-[state=on]:border-b-2 data-[state=on]:border-primary transition-all"
                >
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Période visible - desktop only */}
          {visiblePeriod && (
            <span className="text-xs text-muted-foreground ml-2 hidden lg:inline px-2 py-1 bg-card/50 rounded-md">
              {format(visiblePeriod.start, 'd MMM', { locale: fr })} -{' '}
              {format(visiblePeriod.end, 'd MMM', { locale: fr })}
            </span>
          )}
        </div>

        {/* Droite: Actions */}
        <div className="flex items-center gap-1.5">
          {/* Bouton nouvelle tâche */}
          {onCreateTask && (
            <Button
              size="sm"
              onClick={onCreateTask}
              className="h-8 gap-1.5 px-3 bg-primary hover:bg-primary/90 rounded-lg"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Nouvelle</span>
            </Button>
          )}

          {/* Dropdown Filtres unifié */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 gap-1.5 px-3 relative bg-card/60 hover:bg-card/80 backdrop-blur-sm border-primary/10 rounded-lg shadow-sm',
                  (hasActiveFilters || activeQuickFiltersCount > 0) && 'border-primary bg-primary/5'
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs">Filtres</span>
                {(hasActiveFilters || activeQuickFiltersCount > 0) && (
                  <Badge
                    variant="default"
                    className="absolute -top-1.5 -right-1.5 h-4 min-w-4 p-0 flex items-center justify-center text-[10px]"
                  >
                    {activeQuickFiltersCount || '!'}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">Filtres rapides</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {quickFilters && onToggleQuickFilter && (
                <>
                  <DropdownMenuCheckboxItem
                    checked={quickFilters.highPriorityOnly}
                    onCheckedChange={() => onToggleQuickFilter('highPriorityOnly')}
                    className="text-xs"
                  >
                    <Flame className="h-3.5 w-3.5 mr-2 text-destructive" />
                    Haute priorité
                  </DropdownMenuCheckboxItem>

                  <DropdownMenuCheckboxItem
                    checked={quickFilters.overdueOnly}
                    onCheckedChange={() => onToggleQuickFilter('overdueOnly')}
                    className="text-xs"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mr-2 text-warning" />
                    En retard
                  </DropdownMenuCheckboxItem>

                  <DropdownMenuCheckboxItem
                    checked={quickFilters.hideCompleted}
                    onCheckedChange={() => onToggleQuickFilter('hideCompleted')}
                    className="text-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-success" />
                    Masquer terminées
                  </DropdownMenuCheckboxItem>

                  <DropdownMenuCheckboxItem
                    checked={quickFilters.blockedOnly}
                    onCheckedChange={() => onToggleQuickFilter('blockedOnly')}
                    className="text-xs"
                  >
                    <Construction className="h-3.5 w-3.5 mr-2" />
                    Bloquées uniquement
                  </DropdownMenuCheckboxItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Par phase
                  </DropdownMenuLabel>

                  <DropdownMenuCheckboxItem
                    checked={quickFilters.commercialOnly}
                    onCheckedChange={() => onToggleQuickFilter('commercialOnly')}
                    className="text-xs"
                  >
                    <Briefcase className="h-3.5 w-3.5 mr-2 text-chart-1" />
                    Prospect / Commercial
                  </DropdownMenuCheckboxItem>

                  <DropdownMenuCheckboxItem
                    checked={quickFilters.deploiementOnly}
                    onCheckedChange={() => onToggleQuickFilter('deploiementOnly')}
                    className="text-xs"
                  >
                    <Rocket className="h-3.5 w-3.5 mr-2 text-chart-3" />
                    Déploiement
                  </DropdownMenuCheckboxItem>

                  <DropdownMenuCheckboxItem
                    checked={quickFilters.productionOnly}
                    onCheckedChange={() => onToggleQuickFilter('productionOnly')}
                    className="text-xs"
                  >
                    <Settings className="h-3.5 w-3.5 mr-2 text-chart-2" />
                    Production
                  </DropdownMenuCheckboxItem>

                  {onToggleHeatmap && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={heatmapEnabled}
                        onCheckedChange={onToggleHeatmap}
                        className="text-xs"
                      >
                        <BarChart3 className="h-3.5 w-3.5 mr-2" />
                        Afficher heatmap
                      </DropdownMenuCheckboxItem>
                    </>
                  )}
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onToggleFilters} className="text-xs">
                <Filter className="h-3.5 w-3.5 mr-2" />
                Filtres avancés...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Dropdown Export */}
          {(onExportPNG || onExportPDF) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={isExporting}
                  className="h-8 w-8 bg-card/60 hover:bg-card/80 backdrop-blur-sm border-primary/10 rounded-lg shadow-sm"
                  aria-label="Chargement"
                >
                  {isExporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-card/95 backdrop-blur-md border-primary/10"
              >
                {onExportPNG && (
                  <DropdownMenuItem onClick={onExportPNG} className="text-xs">
                    <FileImage className="h-3.5 w-3.5 mr-2" />
                    Export PNG
                  </DropdownMenuItem>
                )}
                {onExportPDF && (
                  <DropdownMenuItem onClick={onExportPDF} className="text-xs">
                    <FileText className="h-3.5 w-3.5 mr-2" />
                    Export PDF
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Légende popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-card/60 hover:bg-card/80 backdrop-blur-sm border border-primary/10 rounded-lg shadow-sm"
                aria-label="Aide"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Légende</h4>

                {/* Statuts */}
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">Statuts</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
                      <span>À faire</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                      <span>En cours</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
                      <span>Bloqué</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-success" />
                      <span>Terminé</span>
                    </div>
                  </div>
                </div>

                {/* Priorités */}
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">
                    Priorités (bordure gauche)
                  </p>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-4 rounded bg-destructive" />
                      <span>Haute</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-4 rounded bg-warning" />
                      <span>Moyenne</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-4 rounded bg-muted-foreground/40" />
                      <span>Basse</span>
                    </div>
                  </div>
                </div>

                {/* Indicateurs */}
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">Indicateurs</p>
                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                        -3j
                      </Badge>
                      <span>Jours de retard</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-0.5 h-4 bg-primary" />
                      <span>Aujourd'hui</span>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    )
  }
)

GanttControls.displayName = 'GanttControls'
