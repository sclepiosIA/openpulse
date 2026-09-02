import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import { Constants } from "@/integrations/supabase/types"
import { useProfilesWithRoles } from "@/hooks/profile/useProfilesWithRoles"
import { useRegions } from "@/hooks/system/useReferenceData"
import { FALLBACK_REGIONS } from "@/config/referenceDataDefaults"

interface EtablissementFiltersProps {
  onClose: () => void
}

export function EtablissementFilters({ onClose }: EtablissementFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: profiles } = useProfilesWithRoles()
  const { data: regionsData } = useRegions()
  
  const [filters, setFilters] = useState({
    statut: searchParams.get('statut') || '',
    type: searchParams.get('type') || '',
    dpi: searchParams.get('dpi') || '',
    region: searchParams.get('region') || '',
    commercial: searchParams.get('commercial') || '',
    chef_projet: searchParams.get('chef_projet') || '',
    csm: searchParams.get('csm') || ''
  })

  const regions = regionsData?.length 
    ? regionsData.map(r => r.label) 
    : [...FALLBACK_REGIONS]

  const commerciaux = profiles?.filter(p => p.role === 'commercial') || []
  const chefsProjets = profiles?.filter(p => p.role === 'chef_projet') || []
  const csms = profiles?.filter(p => p.role === 'csm') || []

  const applyFilters = () => {
    const newSearchParams = new URLSearchParams(searchParams)
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        newSearchParams.set(key, value)
      } else {
        newSearchParams.delete(key)
      }
    })
    
    setSearchParams(newSearchParams)
    onClose()
  }

  const clearAllFilters = () => {
    setFilters({
      statut: '',
      type: '',
      dpi: '',
      region: '',
      commercial: '',
      chef_projet: '',
      csm: ''
    })
    setSearchParams(new URLSearchParams())
    onClose()
  }

  const clearFilter = (filterKey: string) => {
    setFilters(prev => ({ ...prev, [filterKey]: '' }))
  }

  const activeFiltersCount = Object.values(filters).filter(Boolean).length

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Filtres des établissements</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer les filtres" title="Fermer">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtres actifs */}
        {activeFiltersCount > 0 && (
          <div className="p-3 bg-muted/30 rounded-lg space-y-2">
            <div className="text-sm font-medium">Filtres actifs ({activeFiltersCount})</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(filters).map(([key, value]) => value && (
                <Badge key={key} variant="secondary" className="flex items-center gap-1">
                  {key}: {value}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 w-4 h-4 hover:bg-transparent"
                    onClick={() => clearFilter(key)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Statut & Type */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Statut & Type</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Statut */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Statut</label>
            <Select 
              value={filters.statut} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, statut: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                {Constants.public.Enums.statut_etablissement.map(statut => (
                  <SelectItem key={statut} value={statut}>{statut}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <Select 
              value={filters.type} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                {Constants.public.Enums.type_etablissement.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* DPI */}
          <div className="space-y-2">
            <label className="text-sm font-medium">DPI</label>
            <Select 
              value={filters.dpi} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, dpi: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tous les DPI" />
              </SelectTrigger>
              <SelectContent>
                {Constants.public.Enums.type_dpi.map(dpi => (
                  <SelectItem key={dpi} value={dpi}>{dpi}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        </div>

        {/* Localisation */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Localisation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Région */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Région</label>
            <Select 
              value={filters.region} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, region: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Toutes les régions" />
              </SelectTrigger>
              <SelectContent>
                {regions.map(region => (
                  <SelectItem key={region} value={region}>{region}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        </div>

        {/* Équipe */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Équipe</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Commercial */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Commercial</label>
            <Select 
              value={filters.commercial} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, commercial: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tous les commerciaux" />
              </SelectTrigger>
              <SelectContent>
                {commerciaux.map(commercial => (
                  <SelectItem key={commercial.id} value={commercial.id}>
                    {commercial.prenom} {commercial.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Chef de projet */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Chef de projet</label>
            <Select 
              value={filters.chef_projet} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, chef_projet: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tous les chefs de projet" />
              </SelectTrigger>
              <SelectContent>
                {chefsProjets.map(chef => (
                  <SelectItem key={chef.id} value={chef.id}>
                    {chef.prenom} {chef.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button onClick={applyFilters} className="flex-1">
            Appliquer les filtres
          </Button>
          <Button variant="outline" onClick={clearAllFilters}>
            Tout effacer
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}