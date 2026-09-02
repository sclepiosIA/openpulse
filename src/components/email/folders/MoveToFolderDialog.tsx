import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, FolderOpen } from 'lucide-react'
import { useEmailFolders } from '@/hooks/email/useEmailFolders'
import { useThreadFolders, useThreadFolderMutations } from '@/hooks/email/useThreadFolders'
import { EmailFolderDialog, getFolderColorClass, getFolderIconComponent } from './EmailFolderDialog'
import { cn } from '@/lib/utils'

interface MoveToFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Un ou plusieurs threads à ranger */
  threadIds: string[]
}

/**
 * Dialog pour ranger un (ou plusieurs) thread(s) dans des dossiers.
 * - Mono-thread : cases pré-cochées reflétant l'état actuel, on peut ajouter/retirer.
 * - Multi-threads : ajout uniquement (cocher un dossier => ajouter à tous les threads sélectionnés).
 */
export function MoveToFolderDialog({ open, onOpenChange, threadIds }: MoveToFolderDialogProps) {
  const { folders, isLoading } = useEmailFolders()
  const singleThreadId = threadIds.length === 1 ? threadIds[0] : null
  const { data: currentFolderIds = [] } = useThreadFolders(singleThreadId)
  const { setThreadFolders, addThreadsToFolder } = useThreadFolderMutations()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setSelected(singleThreadId ? new Set(currentFolderIds) : new Set())
      setSearch('')
    }
  }, [open, singleThreadId, currentFolderIds])

  const filteredFolders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return folders
    return folders.filter((f) => f.name.toLowerCase().includes(q))
  }, [folders, search])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isMulti = threadIds.length > 1
  const isSubmitting = setThreadFolders.isPending || addThreadsToFolder.isPending

  const handleConfirm = async () => {
    if (threadIds.length === 0) return
    if (isMulti) {
      // Ajout à tous les threads sélectionnés pour chaque dossier coché
      for (const folderId of selected) {
        await addThreadsToFolder.mutateAsync({ threadIds, folderId })
      }
    } else if (singleThreadId) {
      await setThreadFolders.mutateAsync({
        threadId: singleThreadId,
        folderIds: Array.from(selected),
      })
    }
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isMulti
                ? `Ranger ${threadIds.length} fils dans un dossier`
                : 'Ranger dans un dossier'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Rechercher un dossier…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(true)}
                className="flex-shrink-0"
              >
                <Plus className="h-4 w-4 mr-1" />
                Nouveau
              </Button>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Chargement…</p>
            ) : folders.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Vous n'avez pas encore de dossier.</p>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Créer mon premier dossier
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-64 rounded-md border">
                <div className="p-1">
                  {filteredFolders.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Aucun dossier ne correspond
                    </p>
                  ) : (
                    filteredFolders.map((f) => {
                      const Icon = getFolderIconComponent(f.icon)
                      const isChecked = selected.has(f.id)
                      return (
                        <label
                          key={f.id}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-muted/50',
                            isChecked && 'bg-muted/70'
                          )}
                        >
                          <Checkbox checked={isChecked} onCheckedChange={() => toggle(f.id)} />
                          <span
                            className={cn(
                              'h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0',
                              getFolderColorClass(f.color)
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-sm truncate">{f.name}</span>
                        </label>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            )}

            {isMulti && (
              <p className="text-xs text-muted-foreground">
                Les dossiers cochés seront ajoutés aux fils sélectionnés (les dossiers existants ne
                sont pas retirés).
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isSubmitting || (isMulti && selected.size === 0)}
            >
              {isMulti ? 'Ranger' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmailFolderDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
