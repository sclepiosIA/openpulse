import { useState, useMemo, useEffect } from "react"
import { debug } from "@/lib/debug"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Search, Clock, Download, ChevronDown, Filter, Flame, User, AlertTriangle, RotateCcw, LayoutList, Rows3 } from "lucide-react"
import { TaskCard } from "./TaskCard"
import { BulkActionsBarProjets } from "./BulkActionsBarProjets"
import { VirtualList } from "@/components/ui/virtual-list"
import { useEtablissements } from "@/hooks/crm/useEtablissements"
import { useCategories } from "@/hooks/catalogue/useCategories"
import { useProfiles, useCurrentProfile } from "@/hooks/profile/useProfiles"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/shared/use-toast"
import { exportTasksToCSV } from "@/lib/projetsUtils"
import { cn } from "@/lib/utils"
import { supabase } from "@/integrations/supabase/client";

interface TasksListViewProps {
  taches: any[]
  onStatusChange: (id: string, status: string) => void
  resetFilters: () => void
  activeFilter: string | null
  getEtablissementColor: (id: string, nom: string) => string
}

const STORAGE_KEY = 'projets-list-filters'

// Quick filter chips
const QUICK_FILTERS = [
  { id: 'urgent', label: 'Urgentes', icon: Flame, color: 'text-destructive' },
  { id: 'my-tasks', label: 'Mes tâches', icon: User, color: 'text-primary' },
  { id: 'overdue', label: 'En retard', icon: AlertTriangle, color: 'text-warning' },
]

export function TasksListView({ 
  taches, 
  onStatusChange, 
  resetFilters, 
  activeFilter,
  getEtablissementColor 
}: TasksListViewProps) {
  // Charger les filtres persistés
  const loadSavedFilters = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch (e) {
      debug.warn('[TasksListView] Failed to load filters:', e);
    }
    return {
      filterEtablissement: 'all',
      filterCategorie: 'all',
      filterResponsable: 'all',
      filterPriorite: 'all',
      filterStatut: 'all',
      sortBy: 'priority'
    }
  }

  const savedFilters = loadSavedFilters()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEtablissement, setFilterEtablissement] = useState(savedFilters.filterEtablissement)
  const [filterCategorie, setFilterCategorie] = useState(savedFilters.filterCategorie)
  const [filterResponsable, setFilterResponsable] = useState(savedFilters.filterResponsable)
  const [filterPriorite, setFilterPriorite] = useState(savedFilters.filterPriorite)
  const [filterStatut, setFilterStatut] = useState(savedFilters.filterStatut)
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'status'>(savedFilters.sortBy)
  const [showArchived, setShowArchived] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [quickFilter, setQuickFilter] = useState<string | null>(null)
  const [compactView, setCompactView] = useState(false)

  const { data: etablissements } = useEtablissements()
  const { data: categories } = useCategories()
  const { data: profiles } = useProfiles()
  const { data: currentProfile } = useCurrentProfile()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Compteur filtres actifs
  const activeFiltersCount = [
    filterEtablissement !== 'all',
    filterCategorie !== 'all',
    filterResponsable !== 'all',
    filterPriorite !== 'all',
    filterStatut !== 'all',
  ].filter(Boolean).length

  // Persister les filtres
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        filterEtablissement,
        filterCategorie,
        filterResponsable,
        filterPriorite,
        filterStatut,
        sortBy
      }))
    } catch (e) {
      debug.warn('[TasksListView] Failed to persist filters:', e);
    }
  }, [filterEtablissement, filterCategorie, filterResponsable, filterPriorite, filterStatut, sortBy])

  const archiveTache = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('taches')
        .update({ archive: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taches'] })
      toast({ title: "Tâche archivée avec succès" })
    }
  })

  // Filtrage combiné
  const filteredTaches = useMemo(() => {
    if (!taches || taches.length === 0) return []
    
    return taches.filter(tache => {
      const matchesSearch = searchTerm === '' || 
        tache.titre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tache.etablissements?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tache.description?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesEtablissement = filterEtablissement === 'all' || 
        tache.etablissement_id === filterEtablissement
      
      const matchesCategorie = filterCategorie === 'all' || 
        tache.categorie_id === filterCategorie
      
      const matchesResponsable = filterResponsable === 'all' || 
        (filterResponsable === 'me' && tache.responsable_id === currentProfile?.id) ||
        tache.responsable_id === filterResponsable
      
      const matchesPriorite = filterPriorite === 'all' || 
        tache.priorite === filterPriorite
      
      const matchesStatut = filterStatut === 'all' ||
        tache.statut === filterStatut
      
      const matchesArchived = showArchived || !tache.archive

      // Quick filters
      let matchesQuickFilter = true
      if (quickFilter === 'urgent') {
        matchesQuickFilter = tache.priorite === 'high' && tache.statut !== 'Terminé'
      } else if (quickFilter === 'my-tasks') {
        matchesQuickFilter = tache.responsable_id === currentProfile?.id && tache.statut !== 'Terminé'
      } else if (quickFilter === 'overdue') {
        const now = new Date()
        matchesQuickFilter = tache.echeance && new Date(tache.echeance) < now && tache.statut !== 'Terminé'
      }

      return matchesSearch && matchesEtablissement && matchesCategorie && 
             matchesResponsable && matchesPriorite && matchesStatut && matchesArchived && matchesQuickFilter
    })
  }, [taches, searchTerm, filterEtablissement, filterCategorie, filterResponsable, filterPriorite, filterStatut, showArchived, currentProfile, quickFilter])

  // Tri
  const sortedTaches = useMemo(() => {
    const sorted = [...filteredTaches]
    
    if (sortBy === 'priority') {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      sorted.sort((a, b) => {
        const aPriority = priorityOrder[a.priorite as keyof typeof priorityOrder] ?? 3
        const bPriority = priorityOrder[b.priorite as keyof typeof priorityOrder] ?? 3
        return aPriority - bPriority
      })
    } else if (sortBy === 'date') {
      sorted.sort((a, b) => {
        if (!a.echeance && !b.echeance) return 0
        if (!a.echeance) return 1
        if (!b.echeance) return -1
        return new Date(a.echeance).getTime() - new Date(b.echeance).getTime()
      })
    } else if (sortBy === 'status') {
      const statusOrder = { 'Bloqué': 0, 'A faire': 1, 'En cours': 2, 'Terminé': 3 }
      sorted.sort((a, b) => {
        const aStatus = statusOrder[a.statut as keyof typeof statusOrder] ?? 4
        const bStatus = statusOrder[b.statut as keyof typeof statusOrder] ?? 4
        return aStatus - bStatus
      })
    }
    
    return sorted
  }, [filteredTaches, sortBy])

  const handleSelectionChange = (id: string, selected: boolean) => {
    setSelectedIds(prev => 
      selected ? [...prev, id] : prev.filter(i => i !== id)
    )
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? sortedTaches.map(t => t.id) : [])
  }

  const handleExportAll = () => {
    exportTasksToCSV(sortedTaches, 'taches')
    toast({ title: `${sortedTaches.length} tâche(s) exportée(s)` })
  }

  const handleResetAllFilters = () => {
    setFilterEtablissement('all')
    setFilterCategorie('all')
    setFilterResponsable('all')
    setFilterPriorite('all')
    setFilterStatut('all')
    setQuickFilter(null)
    setSearchTerm('')
    resetFilters()
  }

  const toggleQuickFilter = (filterId: string) => {
    setQuickFilter(prev => prev === filterId ? null : filterId)
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          {/* Ligne 1 : Titre + Actions globales */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">Liste des Tâches</h2>
              <span className="text-sm text-muted-foreground">
                {sortedTaches.length} tâche{sortedTaches.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Toggle vue compacte */}
              <Button
                variant={compactView ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setCompactView(!compactView)}
                className="h-8"
              >
                {compactView ? <LayoutList className="h-4 w-4" /> : <Rows3 className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportAll} className="h-8">
                <Download className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">CSV</span>
              </Button>
            </div>
          </div>

          {/* Ligne 2 : Recherche + Tri + Toggle archivées */}
          <div className="flex items-center gap-3 mt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="Trier..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Priorité</SelectItem>
                <SelectItem value="date">Échéance</SelectItem>
                <SelectItem value="status">Statut</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} id="show-archived" />
              <Label htmlFor="show-archived" className="text-xs whitespace-nowrap hidden sm:block">Archivées</Label>
            </div>
          </div>

          {/* Ligne 3 : Quick filters chips */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {QUICK_FILTERS.map(filter => {
              const Icon = filter.icon
              const isActive = quickFilter === filter.id
              return (
                <Button
                  key={filter.id}
                  variant={isActive ? "secondary" : "outline"}
                  size="sm"
                  className={cn("h-7 text-xs gap-1.5", isActive && "ring-1 ring-primary")}
                  onClick={() => toggleQuickFilter(filter.id)}
                >
                  <Icon className={cn("h-3 w-3", filter.color)} />
                  {filter.label}
                </Button>
              )
            })}
            
            <div className="h-4 w-px bg-border mx-1" />
            
            {/* Filtres avancés collapsible */}
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                  <Filter className="h-3 w-3" />
                  Filtres avancés
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="h-4 w-4 p-0 text-[10px] justify-center">
                      {activeFiltersCount}
                    </Badge>
                  )}
                  <ChevronDown className={cn("h-3 w-3 transition-transform", filtersOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="w-full">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mt-3 pt-3 border-t">
                  <Select value={filterEtablissement} onValueChange={setFilterEtablissement}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Établissement" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous établissements</SelectItem>
                      {etablissements?.map(etab => (
                        <SelectItem key={etab.id} value={etab.id}>{etab.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterCategorie} onValueChange={setFilterCategorie}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes catégories</SelectItem>
                      {categories?.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterResponsable} onValueChange={setFilterResponsable}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Responsable" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="me">Mes tâches</SelectItem>
                      {profiles?.map(profile => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.prenom} {profile.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterPriorite} onValueChange={setFilterPriorite}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Priorité" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes priorités</SelectItem>
                      <SelectItem value="high">Haute</SelectItem>
                      <SelectItem value="medium">Moyenne</SelectItem>
                      <SelectItem value="low">Basse</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterStatut} onValueChange={setFilterStatut}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous statuts</SelectItem>
                      <SelectItem value="A faire">À faire</SelectItem>
                      <SelectItem value="En cours">En cours</SelectItem>
                      <SelectItem value="Bloqué">Bloqué</SelectItem>
                      <SelectItem value="Terminé">Terminé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs mt-2 text-muted-foreground"
                    onClick={handleResetAllFilters}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Réinitialiser les filtres
                  </Button>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Sélection multiple */}
          {sortedTaches.length > 0 && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.length === sortedTaches.length && sortedTaches.length > 0}
                  onCheckedChange={handleSelectAll}
                  id="select-all"
                />
                <Label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer">
                  {selectedIds.length > 0 
                    ? `${selectedIds.length} / ${sortedTaches.length} sélectionnée${selectedIds.length > 1 ? 's' : ''}`
                    : 'Tout sélectionner'
                  }
                </Label>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          <div className={cn("space-y-1.5", compactView && "space-y-0.5")}>
            {sortedTaches.length > 50 ? (
              <VirtualList
                items={sortedTaches}
                height={600}
                itemHeight={compactView ? 56 : 180}
                dynamicHeight={!compactView}
                renderItem={(tache) => (
                  <TaskCard 
                    key={tache.id}
                    tache={tache}
                    onStatusChange={onStatusChange}
                    etablissementColor={getEtablissementColor(tache.etablissement_id, tache.etablissements?.nom || '')}
                    onArchive={(id) => archiveTache.mutate(id)}
                    isSelected={selectedIds.includes(tache.id)}
                    onSelectionChange={handleSelectionChange}
                    compact={compactView}
                  />
                )}
              />
            ) : (
              sortedTaches.map(tache => (
                <TaskCard 
                  key={tache.id}
                  tache={tache}
                  onStatusChange={onStatusChange}
                  etablissementColor={getEtablissementColor(tache.etablissement_id, tache.etablissements?.nom || '')}
                  onArchive={(id) => archiveTache.mutate(id)}
                  isSelected={selectedIds.includes(tache.id)}
                  onSelectionChange={handleSelectionChange}
                  compact={compactView}
                />
              ))
            )}

            {sortedTaches.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Clock className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">Aucune tâche trouvée</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ajustez les filtres ou créez une nouvelle tâche
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button variant="outline" onClick={handleResetAllFilters}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Réinitialiser
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      <BulkActionsBarProjets
        selectedIds={selectedIds}
        tasks={taches}
        onClearSelection={() => setSelectedIds([])}
      />
    </>
  )
}
