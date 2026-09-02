import { useState } from "react"
import { debug } from "@/lib/debug"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Clock,
  AlertTriangle,
  Plus,
  Calendar,
  Search,
  ArrowDown,
} from "lucide-react"
import { useTachesPartenaire, useUpdateTachePartenaire, useArchiveTachePartenaire, type TachePartenaire } from "@/hooks/tasks/useTachesPartenaire"
import { useCategories } from "@/hooks/catalogue/useCategories"
import { useToast } from "@/hooks/shared/use-toast"
import { CreateTachePartenaireDialog } from "./CreateTachePartenaireDialog"
import { PartenaireTacheCard } from "./PartenaireTacheCard"

interface PartenaireTachesProps {
  partenaireId: string
}

export function PartenaireTaches({ partenaireId }: PartenaireTachesProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'status' | 'created'>('created')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  
  const { data: taches } = useTachesPartenaire(partenaireId, showArchived)
  const { data: categories } = useCategories()
  const updateTache = useUpdateTachePartenaire()
  const archiveTache = useArchiveTachePartenaire()
  const { toast } = useToast()

  const updateTaskStatus = async (taskId: string, newStatus: 'A faire' | 'En cours' | 'Bloqué' | 'Terminé') => {
    try {
      const updateData: any = { statut: newStatus }
      
      if (newStatus === 'Terminé') {
        updateData.date_realisation = new Date().toISOString().split('T')[0]
        updateData.archive = true
      }
      
      if (newStatus !== 'Terminé') {
        updateData.date_realisation = null
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
      debug.error('Erreur mise à jour tâche:', error)
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

  const sortTaches = (taches: TachePartenaire[]) => {
    return [...taches].sort((a, b) => {
      if (sortBy === 'created') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortBy === 'priority') {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 }
        return (priorityOrder[b.priorite] || 0) - (priorityOrder[a.priorite] || 0)
      }
      if (sortBy === 'date') {
        if (!a.echeance && !b.echeance) return 0
        if (!a.echeance) return 1
        if (!b.echeance) return -1
        return new Date(a.echeance).getTime() - new Date(b.echeance).getTime()
      }
      if (sortBy === 'status') {
        const statusOrder = { 'Bloqué': 4, 'En cours': 3, 'A faire': 2, 'Terminé': 1 }
        return (statusOrder[b.statut] || 0) - (statusOrder[a.statut] || 0)
      }
      return 0
    })
  }

  const filteredTaches = taches?.filter(tache => {
    if (!showArchived && tache.archive) return false
    
    const matchesSearch = searchTerm === '' || 
      tache.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tache.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = filterCategory === 'all' || 
      tache.categorie_id === filterCategory
    
    return matchesSearch && matchesCategory
  }) || []

  const sortedTaches = sortTaches(filteredTaches)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Tâches du partenaire</h3>
        <CreateTachePartenaireDialog 
          partenaireId={partenaireId}
          triggerButton={
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une tâche
            </Button>
          }
        />
      </div>

      {/* Filtres */}
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
        
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Catégorie..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Trier par..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Plus récent
              </div>
            </SelectItem>
            <SelectItem value="priority">
              <div className="flex items-center gap-2">
                <ArrowDown className="w-4 h-4" />
                Priorité
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
                <AlertTriangle className="w-4 h-4" />
                Statut
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
      </div>

      {/* Liste des tâches */}
      <div className="space-y-4">
        {sortedTaches.map((tache) => (
          <PartenaireTacheCard
            key={tache.id}
            tache={tache}
            onStatusChange={updateTaskStatus}
            onArchive={toggleArchive}
          />
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
