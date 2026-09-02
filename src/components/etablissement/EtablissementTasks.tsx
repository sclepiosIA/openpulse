import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Circle,
  Plus,
  Calendar,
  User,
  Search,
  FileText,
  Archive,
  ArchiveRestore,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { useTachesByEtablissement, useUpdateTache, useArchiveTache, type Tache } from "@/hooks/tasks/useTaches"
import { useToast } from "@/hooks/shared/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { TaskEditDialog as TaskForm } from '@/components/tasks/TaskEditDialog'
import { TacheDocuments } from '@/components/tasks/TacheDocuments'
import { SyncTaskModelsButton } from '@/components/etablissement/SyncTaskModelsButton'
import { useCategories } from "@/hooks/catalogue/useCategories"
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog'
import { PHASE_GROUPS, PhaseKey, getPhaseByStatus, getCumulativeCategoriesUpToPhase } from "@/config/phases"
import { useEtablissement } from "@/hooks/crm/useEtablissements"
import * as React from "react"

interface EtablissementTasksProps {
  etablissementId: string
  initialPhaseFilter?: PhaseKey
}

export function EtablissementTasks({ etablissementId, initialPhaseFilter }: EtablissementTasksProps) {
  const [filtreEquipe, setFiltreEquipe] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'status' | 'order'>('order')
  const [selectedPhase, setSelectedPhase] = useState<string>(initialPhaseFilter || "all")
  
  // Update phase filter when prop changes
  React.useEffect(() => {
    if (initialPhaseFilter) {
      setSelectedPhase(initialPhaseFilter)
    }
  }, [initialPhaseFilter])
  const { data: allTaches } = useTachesByEtablissement(etablissementId)
  const { data: etablissement } = useEtablissement(etablissementId)
  const { data: categories } = useCategories()
  const updateTache = useUpdateTache()
  const archiveTache = useArchiveTache()
  const queryClient = useQueryClient()
  
  // Get allowed categories based on establishment phase
  const allowedCategories = React.useMemo(() => {
    if (!etablissement) return null;
    const phase = getPhaseByStatus(etablissement.statut);
    if (!phase) return null;
    return getCumulativeCategoriesUpToPhase(phase);
  }, [etablissement]);
  
  // Filter tasks by phase (already filtered by establishment via useTachesByEtablissement)
  const taches = React.useMemo(() => {
    if (!allTaches) return [];
    
    return allTaches.filter(t => {
      // Filter archived unless showing them
      if (!showArchived && t.archive) return false;
      
      // Filter by allowed phase categories using category lookup
      if (allowedCategories && t.categorie_id) {
        const taskCategory = categories?.find(c => c.id === t.categorie_id);
        if (taskCategory) {
          const normalizedCategory = taskCategory.nom.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const isAllowed = allowedCategories.some(
            cat => cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalizedCategory
          );
          if (!isAllowed) return false;
        }
      }
      
      return true;
    });
  }, [allTaches, showArchived, allowedCategories, categories]);
  const { toast } = useToast()

  const updateTaskStatus = async (taskId: string, newStatus: 'A faire' | 'En cours' | 'Bloqué' | 'Terminé') => {
    try {
      const updateData: { statut: 'A faire' | 'En cours' | 'Bloqué' | 'Terminé'; date_realisation?: string; archive?: boolean } = { statut: newStatus }
      
      // Si on passe à "Terminé", définir la date de réalisation et archiver automatiquement
      if (newStatus === 'Terminé') {
        updateData.date_realisation = new Date().toISOString().split('T')[0]
        updateData.archive = true
      }
      
      // Si on repasse d'un statut "Terminé" à autre chose, enlever la date de réalisation et désarchiver
      if (newStatus !== 'Terminé') {
        updateData.date_realisation = undefined
        updateData.archive = false
      }
      
      await updateTache.mutateAsync({
        id: taskId,
        data: updateData
      })
      
      const message = newStatus === 'Terminé' 
        ? `Tâche terminée et archivée automatiquement`
        : `Statut: ${newStatus}`
      
      toast({ title: "Tâche mise à jour", description: message })
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de mettre à jour", variant: "destructive" })
    }
  }

  const toggleArchive = async (taskId: string, isArchived: boolean) => {
    try {
      await archiveTache.mutateAsync({
        id: taskId,
        archive: !isArchived
      })
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de modifier l'archivage", variant: "destructive" })
    }
  }

  const equipesDisponibles = [
    { id: 'all', label: 'Toutes' },
    { id: 'technique', label: 'Technique', categories: ['Configuration', 'Déploiement', 'Support'] },
    { id: 'administratif', label: 'Administratif', categories: ['Contractuel', 'Conformité'] },
    { id: 'csm', label: 'CSM', categories: ['Déploiement', 'Formation', 'Go-Live', 'Documentation', 'Suivi'] },
    { id: 'médical', label: 'Médical', categories: ['Déploiement', 'Formation', 'Go-Live', 'Documentation'] }
  ]

  // Fonction de tri
  const sortTaches = (taches: Tache[]) => {
    return [...taches].sort((a, b) => {
      if (sortBy === 'order') {
        const orderA = a.ordre ?? 999
        const orderB = b.ordre ?? 999
        return orderA - orderB
      }
      if (sortBy === 'priority') {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 }
        return (priorityOrder[b.priorite as keyof typeof priorityOrder] || 0) - (priorityOrder[a.priorite as keyof typeof priorityOrder] || 0)
      }
      if (sortBy === 'date') {
        if (!a.echeance && !b.echeance) return 0
        if (!a.echeance) return 1
        if (!b.echeance) return -1
        return new Date(a.echeance).getTime() - new Date(b.echeance).getTime()
      }
      if (sortBy === 'status') {
        const statusOrder = { 'Bloqué': 4, 'En cours': 3, 'A faire': 2, 'Terminé': 1 }
        return (statusOrder[b.statut as keyof typeof statusOrder] || 0) - (statusOrder[a.statut as keyof typeof statusOrder] || 0)
      }
      return 0
    })
  }

  const filteredTaches = taches?.filter(tache => {
    // Filtrer les tâches archivées si on ne veut pas les voir
    if (!showArchived && tache.archive) {
      return false
    }
    
    // Filtrage par équipe basé sur les catégories de tâches
    const matchesTeam = filtreEquipe === 'all' || (() => {
      const equipe = equipesDisponibles.find(e => e.id === filtreEquipe)
      if (!equipe?.categories) return true
      const categorieName = categories?.find(cat => cat.id === tache.categorie_id)?.nom
      return equipe.categories.includes(categorieName || '')
    })()
    
    const matchesSearch = searchTerm === '' || 
      tache.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tache.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesPhase = 
      selectedPhase === "all" ||
      PHASE_GROUPS[selectedPhase as PhaseKey]?.categories.some(cat => {
        const categorieName = categories?.find(c => c.id === tache.categorie_id)?.nom.toLowerCase()
        return cat === categorieName
      })
    
    return matchesTeam && matchesSearch && matchesPhase
  }) || []

  const sortedTaches = sortTaches(filteredTaches)

  const getTaskStatusIcon = (statut: string) => {
    switch (statut) {
      case "Terminé":
        return <CheckCircle2 className="w-4 h-4 text-success" />
      case "En cours":
        return <Clock className="w-4 h-4 text-primary" />
      case "Bloqué":
        return <AlertTriangle className="w-4 h-4 text-destructive" />
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getPriorityBadge = (priorite: string) => {
    switch (priorite) {
      case "high":
        return <Badge variant="destructive">Haute</Badge>
      case "medium":
        return <Badge variant="default">Moyenne</Badge>
      case "low":
        return <Badge variant="secondary">Basse</Badge>
      default:
        return <Badge variant="outline">{priorite}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Tâches du projet</h3>
        <div className="flex gap-2">
          <SyncTaskModelsButton 
            etablissementId={etablissementId} 
            onTasksUpdated={() => {
              queryClient.invalidateQueries({ queryKey: ['taches'] })
            }} 
          />
          <CreateTaskDialog 
            etablissementId={etablissementId}
            triggerButton={
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter une tâche
              </Button>
            }
          />
        </div>
      </div>

      {/* Phase Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedPhase === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedPhase("all")}
        >
          Toutes les phases
        </Button>
        {(Object.keys(PHASE_GROUPS) as PhaseKey[]).map((phaseKey) => {
          const phase = PHASE_GROUPS[phaseKey];
          const Icon = phase.icon;
          return (
            <Button
              key={phaseKey}
              variant={selectedPhase === phaseKey ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPhase(phaseKey)}
            >
              <Icon className="h-4 w-4 mr-2" />
              {phase.label}
            </Button>
          );
        })}
      </div>

      {/* Search and filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une tâche..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'priority' | 'date' | 'status' | 'order')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Trier par..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="order">
              <div className="flex items-center gap-2">
                <ArrowUp className="w-4 h-4" />
                Ordre du modèle
              </div>
            </SelectItem>
            <SelectItem value="priority">
              <div className="flex items-center gap-2">
                <ArrowDown className="w-4 h-4" />
                Priorité (Haute → Basse)
              </div>
            </SelectItem>
            <SelectItem value="date">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Date d'échéance
              </div>
            </SelectItem>
            <SelectItem value="status">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Statut (Urgent → Terminé)
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
          <Label htmlFor="show-archived" className="text-sm font-medium">
            Afficher archivées
          </Label>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {equipesDisponibles.map((equipe) => (
            <Button
              key={equipe.id}
              variant={filtreEquipe === equipe.id ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltreEquipe(equipe.id)}
            >
              {equipe.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {sortedTaches.map((tache) => (
          <Card key={tache.id}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {getTaskStatusIcon(tache.statut)}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{tache.titre}</h4>
                      {getPriorityBadge(tache.priorite)}
                      {tache.archive && (
                        <Badge variant="outline" className="text-xs bg-muted">
                          <Archive className="w-3 h-3 mr-1" />
                          Archivé
                        </Badge>
                      )}
                      {tache.categorie_id && (
                        <Badge variant="outline" className="text-xs">
                          {categories?.find(cat => cat.id === tache.categorie_id)?.nom || 'Catégorie inconnue'}
                        </Badge>
                      )}
                    </div>
                    
                    {tache.description && (
                      <p className="text-sm text-muted-foreground">{tache.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <Select
                          value={tache.statut}
                          onValueChange={(value) => updateTaskStatus(tache.id, value as 'A faire' | 'En cours' | 'Bloqué' | 'Terminé')}
                          disabled={updateTache.isPending}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A faire">À faire</SelectItem>
                            <SelectItem value="En cours">En cours</SelectItem>
                            <SelectItem value="Bloqué">Bloqué</SelectItem>
                            <SelectItem value="Terminé">Terminé</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {tache.echeance && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(tache.echeance).toLocaleDateString('fr-FR')}</span>
                          </div>
                        )}
                        
                        {tache.responsable_id && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="w-3 h-3" />
                            <span>Responsable ID: {tache.responsable_id}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <FileText className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle>Documents - {tache.titre}</DialogTitle>
                            </DialogHeader>
                            <div className="max-h-[60vh] overflow-y-auto">
                              <TacheDocuments 
                                tacheId={tache.id} 
                                tacheTitre={tache.titre}
                                etablissementId={etablissementId}
                              />
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => toggleArchive(tache.id, tache.archive)}
                          title={tache.archive ? "Désarchiver" : "Archiver"}
                        >
                          {tache.archive ? (
                            <ArchiveRestore className="w-4 h-4" />
                          ) : (
                            <Archive className="w-4 h-4" />
                          )}
                        </Button>
                        
                        <TaskForm tache={tache as any} mode="edit" />
                        <TaskForm tache={tache as any} mode="assign" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {sortedTaches.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center">
              <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucune tâche trouvée</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ajustez les filtres ou créez de nouvelles tâches
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}