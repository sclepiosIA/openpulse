import { useState } from 'react'
import { History, Loader2, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/shared/use-toast'
import {
  useWhiteboardVersions,
  useCreateVersion,
  useDeleteVersion,
  fetchVersionScene,
  VERSION_REASON_LABELS,
  type WhiteboardVersion,
} from '@/hooks/whiteboards/useWhiteboardVersions'

interface Props {
  whiteboardId: string | null
  /** Scène courante, utilisée pour créer un point de restauration manuel. */
  getCurrentScene: () => Record<string, unknown>
  onRestore: (scene: WhiteboardVersion['scene']) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Historique des versions : création manuelle, restauration et suppression. */
export function WhiteboardVersionsPanel({ whiteboardId, getCurrentScene, onRestore }: Props) {
  const { toast } = useToast()
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const { data: versions = [], isLoading } = useWhiteboardVersions(whiteboardId)
  const createVersion = useCreateVersion()
  const deleteVersion = useDeleteVersion()

  const handleSnapshot = async () => {
    if (!whiteboardId) return
    try {
      await createVersion.mutateAsync({ whiteboardId, scene: getCurrentScene(), reason: 'manual' })
      toast({ title: 'Point de restauration créé' })
    } catch (e: any) {
      toast({ title: 'Échec de la sauvegarde', description: e?.message, variant: 'destructive' })
    }
  }

  const handleRestore = async (version: WhiteboardVersion) => {
    if (!whiteboardId) return
    setRestoringId(version.id)
    try {
      // On garde une trace de l'état courant avant d'écraser.
      await createVersion.mutateAsync({ whiteboardId, scene: getCurrentScene(), reason: 'restore' })
      const scene = await fetchVersionScene(version.id)
      onRestore(scene)
      toast({ title: 'Version restaurée', description: formatDate(version.created_at) })
    } catch (e: any) {
      toast({ title: 'Restauration impossible', description: e?.message, variant: 'destructive' })
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <Button
        size="sm"
        variant="outline"
        className="h-9 min-h-9 w-full gap-2"
        onClick={handleSnapshot}
        disabled={!whiteboardId || createVersion.isPending}
      >
        {createVersion.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Créer un point de restauration
      </Button>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && versions.length === 0 && (
          <p className="flex flex-col items-center gap-2 px-1 py-8 text-center text-xs text-muted-foreground">
            <History className="h-5 w-5" />
            Aucune version enregistrée pour le moment.
          </p>
        )}
        {versions.map((v) => (
          <div key={v.id} className="rounded-lg border border-border/60 p-2">
            <p className="truncate text-sm font-medium">{formatDate(v.created_at)}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {VERSION_REASON_LABELS[v.reason] ?? v.reason} · {v.element_count} élément
              {v.element_count > 1 ? 's' : ''}
              {v.author_name ? ` · ${v.author_name}` : ''}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="secondary"
                className="h-8 min-h-8 gap-1 px-2 text-xs"
                onClick={() => handleRestore(v)}
                disabled={restoringId === v.id}
              >
                {restoringId === v.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Restaurer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 min-h-8 gap-1 px-2 text-xs text-destructive"
                onClick={() => whiteboardId && deleteVersion.mutate({ id: v.id, whiteboardId })}
              >
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
