import { useState, useMemo } from "react"
import { CRMTableWrapper } from "@/components/layout/CRMTableWrapper"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Archive,
} from "lucide-react"
import { TaskEditDialog as TaskForm } from '@/components/tasks/TaskEditDialog'
import { BulkActionsBarProjets } from "./BulkActionsBarProjets"
import { TaskMobileCard } from "./TaskMobileCard"
import { useNavigate } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/shared/use-toast"
import { useIsMobile } from "@/hooks/ui/use-mobile"
import { exportTasksToCSV, formatDateFr, isOverdue, getPriorityLabelFr, getStatusLabelFr } from "@/lib/projetsUtils"
import { cn } from "@/lib/utils"
import { supabase } from "@/integrations/supabase/client";

interface TasksTableViewProps {
  taches: any[]
  onStatusChange: (id: string, status: string) => void
  getEtablissementColor: (id: string, nom: string) => string
}

type SortField = 'titre' | 'etablissement' | 'categorie' | 'priorite' | 'echeance' | 'responsable' | 'statut'
type SortDirection = 'asc' | 'desc'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
const STATUS_ORDER = { 'Bloqué': 0, 'A faire': 1, 'En cours': 2, 'Terminé': 3 }

const PRIORITY_DOT_COLORS: Record<string, string> = {
  high: 'bg-destructive',
  medium: 'bg-warning',
  low: 'bg-success'
}

const getStatusIcon = (statut: string) => {
  switch (statut) {
    case 'Terminé':
      return <CheckCircle2 className="w-4 h-4 text-success" />
    case 'En cours':
      return <Clock className="w-4 h-4 text-primary" />
    case 'Bloqué':
      return <XCircle className="w-4 h-4 text-destructive" />
    default:
      return <AlertCircle className="w-4 h-4 text-muted-foreground" />
  }
}

export function TasksTableView({ 
  taches, 
  onStatusChange,
  getEtablissementColor 
}: TasksTableViewProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('priorite')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

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
      toast({ title: "Tâche archivée" })
    }
  })

  // Filtrage
  const filteredTaches = useMemo(() => {
    if (!taches) return []
    return taches.filter(tache => {
      if (!searchTerm) return true
      const term = searchTerm.toLowerCase()
      return (
        tache.titre?.toLowerCase().includes(term) ||
        tache.etablissements?.nom?.toLowerCase().includes(term) ||
        tache.categories_taches?.nom?.toLowerCase().includes(term) ||
        tache.responsable_profile?.nom?.toLowerCase().includes(term)
      )
    })
  }, [taches, searchTerm])

  // Tri
  const sortedTaches = useMemo(() => {
    const sorted = [...filteredTaches]
    sorted.sort((a, b) => {
      let comparison = 0
      
      switch (sortField) {
        case 'titre':
          comparison = (a.titre || '').localeCompare(b.titre || '')
          break
        case 'etablissement':
          comparison = (a.etablissements?.nom || '').localeCompare(b.etablissements?.nom || '')
          break
        case 'categorie':
          comparison = (a.categories_taches?.nom || '').localeCompare(b.categories_taches?.nom || '')
          break
        case 'priorite':
          const aPrio = PRIORITY_ORDER[a.priorite as keyof typeof PRIORITY_ORDER] ?? 3
          const bPrio = PRIORITY_ORDER[b.priorite as keyof typeof PRIORITY_ORDER] ?? 3
          comparison = aPrio - bPrio
          break
        case 'echeance':
          if (!a.echeance && !b.echeance) comparison = 0
          else if (!a.echeance) comparison = 1
          else if (!b.echeance) comparison = -1
          else comparison = new Date(a.echeance).getTime() - new Date(b.echeance).getTime()
          break
        case 'responsable':
          const aName = a.responsable_profile ? `${a.responsable_profile.prenom} ${a.responsable_profile.nom}` : ''
          const bName = b.responsable_profile ? `${b.responsable_profile.prenom} ${b.responsable_profile.nom}` : ''
          comparison = aName.localeCompare(bName)
          break
        case 'statut':
          const aStatus = STATUS_ORDER[a.statut as keyof typeof STATUS_ORDER] ?? 4
          const bStatus = STATUS_ORDER[b.statut as keyof typeof STATUS_ORDER] ?? 4
          comparison = aStatus - bStatus
          break
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })
    return sorted
  }, [filteredTaches, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/50" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3.5 h-3.5 text-primary" />
      : <ArrowDown className="w-3.5 h-3.5 text-primary" />
  }

  const handleSelectionChange = (id: string, selected: boolean) => {
    setSelectedIds(prev => selected ? [...prev, id] : prev.filter(i => i !== id))
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? sortedTaches.map(t => t.id) : [])
  }

  const handleExportAll = () => {
    exportTasksToCSV(sortedTaches, 'taches_tableau')
    toast({ title: `${sortedTaches.length} tâche(s) exportée(s)` })
  }

  const handleRowClick = (tache: any) => {
    if (tache.etablissement_id) {
      navigate(`/etablissements/${tache.etablissement_id}`)
    }
  }

  // Mobile view - cards
  if (isMobile) {
    return (
      <div className="space-y-3">
        {/* Search bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleExportAll} aria-label="Exporter" title="Exporter" className="h-9">
            <Download className="h-4 w-4" />
          </Button>
        </div>

        {/* Task cards */}
        <div className="space-y-2">
          {sortedTaches.map(tache => (
            <TaskMobileCard
              key={tache.id}
              task={tache}
              onStatusChange={onStatusChange}
              getEtablissementColor={getEtablissementColor}
              onClick={() => handleRowClick(tache)}
              onArchive={() => archiveTache.mutate(tache.id)}
            />
          ))}
          
          {sortedTaches.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Aucune tâche trouvée</p>
            </div>
          )}
        </div>

        <BulkActionsBarProjets
          selectedIds={selectedIds}
          tasks={taches}
          onClearSelection={() => setSelectedIds([])}
        />
      </div>
    )
  }

  // Desktop view - table
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">Vue Tableau</h2>
              <span className="text-sm text-muted-foreground">
                {sortedTaches.length} tâche{sortedTaches.length > 1 ? 's' : ''}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportAll}>
              <Download className="h-4 w-4 mr-2" />
              Exporter CSV
            </Button>
          </div>

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-9 max-w-sm"
            />
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <CRMTableWrapper withCard={false} minWidth="900px">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.length === sortedTaches.length && sortedTaches.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('titre')}
                  >
                    <div className="flex items-center gap-1.5">
                      Titre
                      <SortIcon field="titre" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors hidden md:table-cell"
                    onClick={() => handleSort('etablissement')}
                  >
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      Établissement
                      <SortIcon field="etablissement" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors hidden lg:table-cell"
                    onClick={() => handleSort('categorie')}
                  >
                    <div className="flex items-center gap-1.5">
                      Catégorie
                      <SortIcon field="categorie" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors w-24"
                    onClick={() => handleSort('priorite')}
                  >
                    <div className="flex items-center gap-1.5">
                      Priorité
                      <SortIcon field="priorite" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors hidden sm:table-cell"
                    onClick={() => handleSort('echeance')}
                  >
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Échéance
                      <SortIcon field="echeance" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors hidden lg:table-cell"
                    onClick={() => handleSort('responsable')}
                  >
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      Responsable
                      <SortIcon field="responsable" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('statut')}
                  >
                    <div className="flex items-center gap-1.5">
                      Statut
                      <SortIcon field="statut" />
                    </div>
                  </TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTaches.map(tache => {
                  const overdue = isOverdue(tache.echeance, tache.statut)
                  const etablissementColor = getEtablissementColor(tache.etablissement_id, tache.etablissements?.nom || '')
                  const priorityDot = PRIORITY_DOT_COLORS[tache.priorite] || 'bg-muted-foreground'
                  
                  return (
                    <TableRow
                      key={tache.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selectedIds.includes(tache.id) && "bg-primary/5",
                        overdue && "bg-destructive/5"
                      )}
                      onClick={() => handleRowClick(tache)}
                      role="link"
                      tabIndex={0}
                      aria-label={`Ouvrir la tâche ${tache.titre}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleRowClick(tache)
                        }
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(tache.id)}
                          onCheckedChange={(checked) => handleSelectionChange(tache.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px]">
                        <span className="truncate block">{tache.titre}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                          style={{ borderColor: etablissementColor, color: etablissementColor }}
                        >
                          {tache.etablissements?.nom || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {tache.categories_taches && (
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                            style={{ 
                              borderColor: tache.categories_taches.couleur,
                              color: tache.categories_taches.couleur
                            }}
                          >
                            {tache.categories_taches.nom}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2">
                                <span className={cn("w-2 h-2 rounded-full", priorityDot)} />
                                <span className="text-xs">{getPriorityLabelFr(tache.priorite)}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              Priorité {getPriorityLabelFr(tache.priorite).toLowerCase()}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className={cn("text-xs hidden sm:table-cell", overdue && "text-destructive font-medium")}>
                        {tache.echeance ? formatDateFr(tache.echeance) : '-'}
                        {overdue && <span className="ml-1">(retard)</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">
                        {tache.responsable_profile 
                          ? `${tache.responsable_profile.prenom} ${tache.responsable_profile.nom}`
                          : '-'
                        }
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select 
                          value={tache.statut} 
                          onValueChange={(value) => onStatusChange(tache.id, value)}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs border-0 bg-transparent hover:bg-muted">
                            <div className="flex items-center gap-1.5">
                              {getStatusIcon(tache.statut)}
                              <span className="hidden sm:inline">{getStatusLabelFr(tache.statut)}</span>
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A faire">À faire</SelectItem>
                            <SelectItem value="En cours">En cours</SelectItem>
                            <SelectItem value="Bloqué">Bloqué</SelectItem>
                            <SelectItem value="Terminé">Terminé</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <TaskForm mode="edit" tache={tache} />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => archiveTache.mutate(tache.id)} aria-label="Archiver">
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                
                {sortedTaches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <div className="text-muted-foreground">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Aucune tâche trouvée</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CRMTableWrapper>
        </CardContent>
      </Card>

      <BulkActionsBarProjets
        selectedIds={selectedIds}
        tasks={taches}
        onClearSelection={() => setSelectedIds([])}
      />
    </>
  )
}
