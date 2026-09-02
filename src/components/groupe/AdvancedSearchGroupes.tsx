import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdvancedSearchGroupesProps {
  onSearch: (filters: AdvancedFilters) => void
  variant?: 'default' | 'glassmorphism'
}

export interface AdvancedFilters {
  nom?: string
  region?: string[]
  type?: string[]
  etablissementsMin?: number
  etablissementsMax?: number
  progressionMin?: number
  progressionMax?: number
  modules?: string[]
  passagesUrgencesMin?: number
  passagesUrgencesMax?: number
  dateCreationDebut?: string
  dateCreationFin?: string
  searchInNotes?: string
}

import { FALLBACK_REGIONS } from '@/config/referenceDataDefaults'
import { useRegions } from '@/hooks/system/useReferenceData'

const TYPES = ['GHT', 'Groupe Cliniques', 'Consortium', 'Autre']

const MODULES = [
  'DPI',
  'Pharmacie',
  'Imagerie',
  'Biologie',
  'RH',
  'Finances',
  'Facturation',
  'Bloc opératoire',
  'Urgences',
  'Planning',
  'GED',
  'Identité',
]

export function AdvancedSearchGroupes({
  onSearch,
  variant = 'glassmorphism',
}: AdvancedSearchGroupesProps) {
  const { data: regionsRef } = useRegions()
  const REGIONS = regionsRef.length > 0 ? regionsRef.map((r) => r.label) : [...FALLBACK_REGIONS]
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<AdvancedFilters>({
    region: [],
    type: [],
    modules: [],
  })
  const isGlassmorphism = variant === 'glassmorphism'

  const handleSearch = () => {
    onSearch(filters)
    setOpen(false)
  }

  const handleReset = () => {
    const emptyFilters: AdvancedFilters = {
      region: [],
      type: [],
      modules: [],
    }
    setFilters(emptyFilters)
    onSearch(emptyFilters)
  }

  const toggleArrayValue = (field: 'region' | 'type' | 'modules', value: string) => {
    setFilters((prev) => {
      const current = prev[field] || []
      const newValue = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { ...prev, [field]: newValue }
    })
  }

  const hasActiveFilters = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== undefined && v !== ''
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-6 px-2 sm:h-7 sm:px-2.5 gap-1 sm:gap-1.5 rounded-lg transition-all',
            isGlassmorphism
              ? 'bg-card/10 backdrop-blur-sm border border-white/20 text-white/80 hover:bg-card/20 hover:text-white'
              : 'border hover:bg-muted'
          )}
        >
          <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline text-xs">Recherche avancée</span>
          {hasActiveFilters && (
            <Badge
              className={cn(
                'ml-0.5 sm:ml-1 h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full p-0 flex items-center justify-center text-[9px] sm:text-[10px]',
                isGlassmorphism ? 'bg-card text-primary' : 'bg-primary text-primary-foreground'
              )}
            >
              !
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recherche avancée</DialogTitle>
          <DialogDescription>Affinez votre recherche avec des critères multiples</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Nom */}
          <div className="space-y-2">
            <Label htmlFor="nom">Nom du groupe</Label>
            <Input
              id="nom"
              placeholder="Rechercher dans le nom..."
              value={filters.nom || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, nom: e.target.value }))}
            />
          </div>

          {/* Dates de création */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateDebut">Date création (début)</Label>
              <Input
                id="dateDebut"
                type="date"
                value={filters.dateCreationDebut || ''}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, dateCreationDebut: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateFin">Date création (fin)</Label>
              <Input
                id="dateFin"
                type="date"
                value={filters.dateCreationFin || ''}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, dateCreationFin: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Type de groupe */}
          <div className="space-y-2">
            <Label>Type de groupe</Label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((type) => (
                <Badge
                  key={type}
                  variant={filters.type?.includes(type) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleArrayValue('type', type)}
                >
                  {type}
                  {filters.type?.includes(type) && <X className="ml-1 h-3 w-3" />}
                </Badge>
              ))}
            </div>
          </div>

          {/* Régions */}
          <div className="space-y-2">
            <Label>Régions</Label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg">
              {REGIONS.map((region) => (
                <Badge
                  key={region}
                  variant={filters.region?.includes(region) ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleArrayValue('region', region)}
                >
                  {region}
                  {filters.region?.includes(region) && <X className="ml-1 h-3 w-3" />}
                </Badge>
              ))}
            </div>
          </div>

          {/* Nombre d'établissements */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="etablMin">Établissements min</Label>
              <Input
                id="etablMin"
                type="number"
                min="0"
                placeholder="Min"
                value={filters.etablissementsMin || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    etablissementsMin: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="etablMax">Établissements max</Label>
              <Input
                id="etablMax"
                type="number"
                min="0"
                placeholder="Max"
                value={filters.etablissementsMax || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    etablissementsMax: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </div>
          </div>

          {/* Progression */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="progMin">Progression min (%)</Label>
              <Input
                id="progMin"
                type="number"
                min="0"
                max="100"
                placeholder="Min %"
                value={filters.progressionMin || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    progressionMin: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="progMax">Progression max (%)</Label>
              <Input
                id="progMax"
                type="number"
                min="0"
                max="100"
                placeholder="Max %"
                value={filters.progressionMax || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    progressionMax: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </div>
          </div>

          {/* Modules */}
          <div className="space-y-2">
            <Label>Modules déployés</Label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg">
              {MODULES.map((module) => (
                <Badge
                  key={module}
                  variant={filters.modules?.includes(module) ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleArrayValue('modules', module)}
                >
                  {module}
                  {filters.modules?.includes(module) && <X className="ml-1 h-3 w-3" />}
                </Badge>
              ))}
            </div>
          </div>

          {/* Passages urgences */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="urgMin">Passages urgences min</Label>
              <Input
                id="urgMin"
                type="number"
                min="0"
                placeholder="Min"
                value={filters.passagesUrgencesMin || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    passagesUrgencesMin: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="urgMax">Passages urgences max</Label>
              <Input
                id="urgMax"
                type="number"
                min="0"
                placeholder="Max"
                value={filters.passagesUrgencesMax || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    passagesUrgencesMax: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </div>
          </div>

          {/* Recherche dans notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Recherche dans notes/description</Label>
            <Input
              id="notes"
              placeholder="Mots-clés dans les notes..."
              value={filters.searchInNotes || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, searchInNotes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            Réinitialiser
          </Button>
          <Button onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            Rechercher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
