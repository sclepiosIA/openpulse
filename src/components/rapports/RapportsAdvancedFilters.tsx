import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Filter, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { useAllEtablissements } from '@/hooks/crm/useProspects'
import { useProfiles } from '@/hooks/profile/useProfiles'
import { formatNumber } from '@/lib/utils'

interface RapportsAdvancedFiltersProps {
  selectedEtablissements: string[]
  onSelectedEtablissementsChange: (ids: string[]) => void
  selectedResponsables: string[]
  onSelectedResponsablesChange: (ids: string[]) => void
  selectedStatuts: string[]
  onSelectedStatutsChange: (statuts: string[]) => void
  selectedTypesOffre: string[]
  onSelectedTypesOffreChange: (types: string[]) => void
  selectedPalliers: string[]
  onSelectedPalliersChange: (palliers: string[]) => void
  minValue: number
  maxValue: number
  onValueRangeChange: (min: number, max: number) => void
  minPassages: number
  maxPassages: number
  onPassagesRangeChange: (min: number, max: number) => void
  includeProspects: boolean
  onIncludeProspectsChange: (include: boolean) => void
  productionOnly: boolean
  onProductionOnlyChange: (only: boolean) => void
  compareWithPrevious: boolean
  onCompareWithPreviousChange: (compare: boolean) => void
  onResetFilters: () => void
}

import {
  FALLBACK_FUNNEL_STATUTS,
  FALLBACK_TYPES_OFFRE,
  FALLBACK_PALLIERS,
} from '@/config/referenceDataDefaults'
import {
  useStatutsEtablissement,
  useTypesOffre,
  usePalliers,
} from '@/hooks/system/useReferenceData'

export function RapportsAdvancedFilters(props: RapportsAdvancedFiltersProps) {
  const { data: etablissements } = useAllEtablissements()
  const { data: profiles } = useProfiles()
  const { data: statutsRef } = useStatutsEtablissement()
  const { data: typesOffreRef } = useTypesOffre()
  const { data: palliersRef } = usePalliers()

  const STATUTS =
    statutsRef.length > 0 ? statutsRef.map((s) => s.label) : [...FALLBACK_FUNNEL_STATUTS]
  const TYPES_OFFRE =
    typesOffreRef.length > 0 ? typesOffreRef.map((s) => s.label) : [...FALLBACK_TYPES_OFFRE]
  const PALLIERS = palliersRef.length > 0 ? palliersRef.map((s) => s.label) : [...FALLBACK_PALLIERS]

  const activeFiltersCount = [
    props.selectedEtablissements.length > 0,
    props.selectedResponsables.length > 0,
    props.selectedStatuts.length > 0,
    props.selectedTypesOffre.length > 0,
    props.selectedPalliers.length > 0,
    props.minValue > 0 || props.maxValue < 1000000,
    props.minPassages > 0 || props.maxPassages < 200000,
    !props.includeProspects,
    props.productionOnly,
  ].filter(Boolean).length

  const toggleStatut = (statut: string) => {
    if (props.selectedStatuts.includes(statut)) {
      props.onSelectedStatutsChange(props.selectedStatuts.filter((s) => s !== statut))
    } else {
      props.onSelectedStatutsChange([...props.selectedStatuts, statut])
    }
  }

  const toggleTypeOffre = (type: string) => {
    if (props.selectedTypesOffre.includes(type)) {
      props.onSelectedTypesOffreChange(props.selectedTypesOffre.filter((t) => t !== type))
    } else {
      props.onSelectedTypesOffreChange([...props.selectedTypesOffre, type])
    }
  }

  const togglePallier = (pallier: string) => {
    if (props.selectedPalliers.includes(pallier)) {
      props.onSelectedPalliersChange(props.selectedPalliers.filter((p) => p !== pallier))
    } else {
      props.onSelectedPalliersChange([...props.selectedPalliers, pallier])
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2.5 rounded-lg bg-card/10 backdrop-blur-sm border border-white/20 text-white/70 hover:text-white hover:bg-card/20 transition-all"
        >
          <Filter className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-xs">Filtres</span>
          {activeFiltersCount > 0 && (
            <Badge className="ml-0.5 px-1.5 py-0 text-[10px] h-4 bg-card text-primary border-0">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Filtres avancés</SheetTitle>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={props.onResetFilters} className="gap-2">
                <X className="w-4 h-4" />
                Réinitialiser
              </Button>
            )}
          </div>
          <SheetDescription>Affinez vos résultats avec des filtres avancés</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Comparaison temporelle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="compare">Comparer avec période précédente</Label>
              <Switch
                id="compare"
                checked={props.compareWithPrevious}
                onCheckedChange={props.onCompareWithPreviousChange}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Afficher les variations par rapport à la période précédente
            </p>
          </div>

          {/* Statuts */}
          <div className="space-y-2">
            <Label>Statuts</Label>
            <div className="flex flex-wrap gap-2">
              {STATUTS.map((statut) => (
                <Badge
                  key={statut}
                  variant={props.selectedStatuts.includes(statut) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleStatut(statut)}
                >
                  {statut}
                </Badge>
              ))}
            </div>
          </div>

          {/* Types d'offre */}
          <div className="space-y-2">
            <Label>Types d'offre</Label>
            <div className="flex flex-wrap gap-2">
              {TYPES_OFFRE.map((type) => (
                <Badge
                  key={type}
                  variant={props.selectedTypesOffre.includes(type) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleTypeOffre(type)}
                >
                  {type}
                </Badge>
              ))}
            </div>
          </div>

          {/* Palliers */}
          <div className="space-y-2">
            <Label>Palliers visés</Label>
            <div className="flex flex-wrap gap-2">
              {PALLIERS.map((pallier) => (
                <Badge
                  key={pallier}
                  variant={props.selectedPalliers.includes(pallier) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => togglePallier(pallier)}
                >
                  {pallier}
                </Badge>
              ))}
            </div>
          </div>

          {/* Valeur partenariat */}
          <div className="space-y-2">
            <Label>Valeur partenariat (€)</Label>
            <div className="px-2">
              <Slider
                value={[props.minValue, props.maxValue]}
                min={0}
                max={1000000}
                step={10000}
                onValueChange={([min, max]) => props.onValueRangeChange(min, max)}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatNumber(props.minValue)} €</span>
              <span>{formatNumber(props.maxValue)} €</span>
            </div>
          </div>

          {/* Passages urgences */}
          <div className="space-y-2">
            <Label>Passages urgences annuels</Label>
            <div className="px-2">
              <Slider
                value={[props.minPassages, props.maxPassages]}
                min={0}
                max={200000}
                step={5000}
                onValueChange={([min, max]) => props.onPassagesRangeChange(min, max)}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatNumber(props.minPassages)}</span>
              <span>{formatNumber(props.maxPassages)}</span>
            </div>
          </div>

          {/* Options rapides */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label htmlFor="include-prospects">Inclure les prospects</Label>
              <Switch
                id="include-prospects"
                checked={props.includeProspects}
                onCheckedChange={props.onIncludeProspectsChange}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="production-only">Production uniquement</Label>
              <Switch
                id="production-only"
                checked={props.productionOnly}
                onCheckedChange={props.onProductionOnlyChange}
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
