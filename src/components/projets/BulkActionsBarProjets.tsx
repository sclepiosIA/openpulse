import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { X, Download, UserPlus, CheckCircle, Loader2, Archive, CheckCheck } from 'lucide-react'
import { useProfiles } from '@/hooks/profile/useProfiles'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { useQueryClient } from '@tanstack/react-query'
import { exportTasksToCSV, TASK_STATUSES, getStatusLabelFr } from '@/lib/projetsUtils'
import { cn } from '@/lib/utils'
import {
  bulkAssignTaches,
  bulkUpdateTacheStatus,
  bulkArchiveTaches,
} from '@/services/taches/tachesBulk';

interface BulkActionsBarProjetsProps {
  selectedIds: string[]
  tasks: any[]
  onClearSelection: () => void
}

export function BulkActionsBarProjets({
  selectedIds,
  tasks,
  onClearSelection,
}: BulkActionsBarProjetsProps) {
  const { data: profiles } = useProfiles()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  const selectedTasks = tasks.filter((t) => selectedIds.includes(t.id))

  const handleAssignResponsable = async (responsableId: string) => {
    setLoading(true)
    try {
      await bulkAssignTaches(selectedIds, responsableId)

      toast({ title: `${selectedIds.length} tâche(s) assignée(s)` })
      queryClient.invalidateQueries({ queryKey: ['taches'] })
      onClearSelection()
    } catch (error: unknown) {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleChangeStatus = async (status: string) => {
    setLoading(true)
    try {
      const extra: Record<string, unknown> = {}
      if (status === 'Terminé') {
        extra.date_realisation = new Date().toISOString().split('T')[0]
      }

      await bulkUpdateTacheStatus(selectedIds, status, extra)

      toast({ title: `${selectedIds.length} tâche(s) mise(s) à jour` })
      queryClient.invalidateQueries({ queryKey: ['taches'] })
      onClearSelection()
    } catch (error: unknown) {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleMarkComplete = async () => {
    await handleChangeStatus('Terminé')
  }

  const handleArchive = async () => {
    setLoading(true)
    try {
      await bulkArchiveTaches(selectedIds)

      toast({ title: `${selectedIds.length} tâche(s) archivée(s)` })
      queryClient.invalidateQueries({ queryKey: ['taches'] })
      onClearSelection()
    } catch (error: unknown) {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleExportSelection = () => {
    exportTasksToCSV(selectedTasks, 'taches_selection')
    toast({ title: `${selectedTasks.length} tâche(s) exportée(s)` })
  }

  if (selectedIds.length === 0) return null

  return (
    <div 
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "bg-background/95 backdrop-blur-sm border rounded-xl shadow-lg",
        "p-3 flex items-center gap-2 sm:gap-3",
        "animate-fade-in"
      )}
    >
      {/* Compteur + Fermer */}
      <div className="flex items-center gap-2 pr-2 border-r">
        <span className="text-sm font-medium whitespace-nowrap">
          {selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClearSelection} aria-label="Fermer">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Action rapide : Terminer */}
      <Button
        variant="default"
        size="sm"
        className="h-8 gap-1.5"
        onClick={handleMarkComplete}
        disabled={loading}
      >
        <CheckCheck className="h-4 w-4" />
        <span className="hidden sm:inline">Terminer</span>
      </Button>

      {/* Assigner responsable */}
      <Select onValueChange={handleAssignResponsable} disabled={loading}>
        <SelectTrigger className="w-32 sm:w-40 h-8 text-xs">
          <UserPlus className="h-3.5 w-3.5 mr-1.5 shrink-0" />
          <span className="truncate">Assigner</span>
        </SelectTrigger>
        <SelectContent>
          {profiles?.map((profile) => (
            <SelectItem key={profile.id} value={profile.id}>
              {profile.prenom} {profile.nom}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Changer statut */}
      <Select onValueChange={handleChangeStatus} disabled={loading}>
        <SelectTrigger className="w-28 sm:w-36 h-8 text-xs">
          <CheckCircle className="h-3.5 w-3.5 mr-1.5 shrink-0" />
          <span className="truncate">Statut</span>
        </SelectTrigger>
        <SelectContent>
          {TASK_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {getStatusLabelFr(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Archiver */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={handleArchive}
        disabled={loading}
      >
        <Archive className="h-4 w-4" />
        <span className="hidden md:inline">Archiver</span>
      </Button>

      {/* Export */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={handleExportSelection}
        disabled={loading}
      >
        <Download className="h-4 w-4" />
        <span className="hidden md:inline">CSV</span>
      </Button>

      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  )
}
