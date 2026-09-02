import { Badge } from '@/components/ui/badge'
// Note: on n'utilise PAS Radix Tabs ici. Le "contenu" de chaque filtre
// n'est pas un TabsContent local — c'est la liste des établissements filtrée
// ailleurs dans la page. Utiliser Tabs génèrerait des `aria-controls`
// pointant vers des panels inexistants (violation axe `aria-valid-attr-value`).
// À la place : un `role="radiogroup"` avec des boutons `aria-checked`.
import { Flame, Calendar, Sparkles } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import { cn } from '@/lib/utils'

interface UnifiedFiltersProps {
  etablissements: Etablissement[]
  allCount: number
  /** 'default' renders all, 'tabs-only' renders only tabs, 'smart-only' renders only smart filter badges */
  variant?: 'default' | 'tabs-only' | 'smart-only'
  /** Compact size for mobile */
  compact?: boolean
}

const MAIN_FILTERS = [
  { value: 'all', label: 'Tous', statuts: null },
  { value: 'prospects', label: 'Prospects', statuts: 'Prospect' },
  {
    value: 'deploiement',
    label: 'Déploiement',
    statuts: 'Contractuel,Conformité,Déploiement,Formation,Go-Live',
  },
  { value: 'production', label: 'Production', statuts: 'Production' },
] as const

export function UnifiedFilters({
  etablissements,
  allCount,
  variant = 'default',
  compact = false,
}: UnifiedFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentStatut = searchParams.get('statut')
  const currentSmartFilter = searchParams.get('smart_filter')

  // Calcul des compteurs pour les smart filters
  const urgentsCount = etablissements.filter(
    (e) => e.statut === 'Bloqué' || (e.progression || 0) < 30
  ).length

  const echeancesCount = etablissements.filter((e) => {
    if (!e.date_previsionnelle_signature) return false
    const diff = new Date(e.date_previsionnelle_signature).getTime() - Date.now()
    const days = diff / (1000 * 60 * 60 * 24)
    return days > 0 && days <= 30
  }).length

  const nouveauxCount = etablissements.filter((e) => {
    const diff = Date.now() - new Date(e.created_at).getTime()
    const days = diff / (1000 * 60 * 60 * 24)
    return days <= 7
  }).length

  // Déterminer le filtre actif
  const getCurrentTab = () => {
    if (!currentStatut) return 'all'
    const filter = MAIN_FILTERS.find((f) => f.statuts === currentStatut)
    return filter?.value || 'all'
  }

  const handleTabChange = (value: string) => {
    const newParams = new URLSearchParams(searchParams)
    const filter = MAIN_FILTERS.find((f) => f.value === value)

    if (filter?.statuts) {
      newParams.set('statut', filter.statuts)
    } else {
      newParams.delete('statut')
    }
    // Reset smart filter when changing main tab
    newParams.delete('smart_filter')
    setSearchParams(newParams)
  }

  const handleSmartFilter = (type: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (currentSmartFilter === type) {
      newParams.delete('smart_filter')
    } else {
      newParams.set('smart_filter', type)
    }
    setSearchParams(newParams)
  }

  // Size classes based on compact mode
  const tabsHeight = compact ? 'h-8' : 'h-9'
  const tabHeight = compact ? 'h-6 px-2.5' : 'h-7 px-3.5'
  const badgeHeight = compact ? 'h-7' : 'h-8'
  const badgePadding = compact ? 'px-2' : 'px-3'

  // Render tabs section (radiogroup, cf. commentaire en haut)
  const renderTabs = () => {
    const current = getCurrentTab()
    return (
      <div
        role="radiogroup"
        aria-label="Filtre par statut"
        className={cn(
          'inline-flex items-center gap-0.5 p-0.5 sm:p-1 bg-card/10 backdrop-blur-sm border border-white/20 rounded-lg sm:rounded-xl shadow-lg',
          tabsHeight
        )}
      >
        {MAIN_FILTERS.map((filter) => {
          const active = current === filter.value
          return (
            <button
              key={filter.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handleTabChange(filter.value)}
              className={cn(
                'inline-flex items-center justify-center gap-1 text-xs font-medium rounded-md sm:rounded-lg transition-all duration-200',
                'text-white/70 hover:text-white hover:bg-card/10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                active &&
                  'bg-card text-primary shadow-md ring-1 ring-primary/20 hover:bg-card hover:text-primary',
                tabHeight
              )}
            >
              {filter.label}
              {filter.value === 'all' && (
                <Badge
                  className={cn(
                    'ml-1 h-4 sm:h-5 px-1 sm:px-1.5 text-[9px] sm:text-[10px] font-semibold border-0 transition-colors',
                    active ? 'bg-primary/20 text-primary' : 'bg-card/20 text-white'
                  )}
                >
                  {allCount}
                </Badge>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // Render smart filters section
  const renderSmartFilters = () => (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {urgentsCount > 0 && (
        <Badge
          className={cn(
            'cursor-pointer text-xs gap-1.5 transition-all duration-200 rounded-lg sm:rounded-xl border shadow-md',
            'hover:scale-105 hover:shadow-lg',
            currentSmartFilter === 'urgents'
              ? 'bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground border-destructive/50 ring-2 ring-destructive/30'
              : 'bg-card/10 backdrop-blur-sm text-white/90 border-white/20 hover:bg-card/20',
            badgeHeight,
            badgePadding
          )}
          onClick={() => handleSmartFilter('urgents')}
        >
          <div className="relative">
            <Flame className="h-3.5 w-3.5" />
            {currentSmartFilter === 'urgents' && (
              <div className="absolute inset-0 bg-card/30 rounded-full blur-sm animate-pulse" />
            )}
          </div>
          <span className="font-semibold">{urgentsCount}</span>
        </Badge>
      )}
      {echeancesCount > 0 && (
        <Badge
          className={cn(
            'cursor-pointer text-xs gap-1.5 transition-all duration-200 rounded-lg sm:rounded-xl border shadow-md',
            'hover:scale-105 hover:shadow-lg',
            currentSmartFilter === 'echeances'
              ? 'bg-gradient-to-r from-warning to-warning/80 text-warning-foreground border-warning/50 ring-2 ring-warning/30'
              : 'bg-card/10 backdrop-blur-sm text-white/90 border-white/20 hover:bg-card/20',
            badgeHeight,
            badgePadding
          )}
          onClick={() => handleSmartFilter('echeances')}
        >
          <div className="relative">
            <Calendar className="h-3.5 w-3.5" />
            {currentSmartFilter === 'echeances' && (
              <div className="absolute inset-0 bg-card/30 rounded-full blur-sm animate-pulse" />
            )}
          </div>
          <span className="font-semibold">{echeancesCount}</span>
        </Badge>
      )}
      {nouveauxCount > 0 && (
        <Badge
          className={cn(
            'cursor-pointer text-xs gap-1.5 transition-all duration-200 rounded-lg sm:rounded-xl border shadow-md',
            'hover:scale-105 hover:shadow-lg',
            currentSmartFilter === 'nouveaux'
              ? 'bg-gradient-to-r from-success to-success/80 text-success-foreground border-success/50 ring-2 ring-success/30'
              : 'bg-card/10 backdrop-blur-sm text-white/90 border-white/20 hover:bg-card/20',
            badgeHeight,
            badgePadding
          )}
          onClick={() => handleSmartFilter('nouveaux')}
        >
          <div className="relative">
            <Sparkles className="h-3.5 w-3.5" />
            {currentSmartFilter === 'nouveaux' && (
              <div className="absolute inset-0 bg-card/30 rounded-full blur-sm animate-pulse" />
            )}
          </div>
          <span className="font-semibold">{nouveauxCount}</span>
        </Badge>
      )}
    </div>
  )

  // Render based on variant
  if (variant === 'tabs-only') {
    return renderTabs()
  }

  if (variant === 'smart-only') {
    return renderSmartFilters()
  }

  // Default: render all
  return (
    <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
      {renderTabs()}

      {/* Séparateur glassmorphism avec glow */}
      <div className="hidden sm:block h-6 w-px bg-gradient-to-b from-transparent via-white/30 to-transparent" />

      {renderSmartFilters()}
    </div>
  )
}
