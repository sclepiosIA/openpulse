import { useMemo, useState } from 'react'
import {
  Plus,
  Search,
  Star,
  StarOff,
  Pencil,
  Copy,
  Archive,
  ArchiveRestore,
  Trash2,
  MoreVertical,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/shared/use-toast'
import { cn } from '@/lib/utils'
import {
  useWhiteboardList,
  useCreateBoard,
  useUpdateBoardMeta,
  useDeleteBoard,
  useDuplicateBoard,
  type BoardScope,
  type BoardSummary,
} from '@/hooks/whiteboards/useWhiteboardList'
import type { TeamKey } from '@/hooks/whiteboards/useSimpleWhiteboards'

interface Props {
  scope: BoardScope
  team: TeamKey | null
  activeId: string | null
  onSelect: (board: BoardSummary) => void
  canManage: boolean
}

function elementCount(board: BoardSummary): number {
  const els = (board.scene as any)?.elements
  return Array.isArray(els) ? els.length : 0
}

/** Panneau de gestion multi-tableaux d'un périmètre (créer, renommer, dupliquer, archiver, supprimer). */
export function WhiteboardBoardList({ scope, team, activeId, onSelect, canManage }: Props) {
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  const [toDelete, setToDelete] = useState<BoardSummary | null>(null)
  const { toast } = useToast()

  const { data: boards = [], isLoading } = useWhiteboardList(scope, team, showArchived)
  const createBoard = useCreateBoard()
  const updateMeta = useUpdateBoardMeta()
  const deleteBoard = useDeleteBoard()
  const duplicateBoard = useDuplicateBoard()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return boards
    return boards.filter((b) => b.title.toLowerCase().includes(q))
  }, [boards, search])

  const handleCreate = async () => {
    try {
      const board = await createBoard.mutateAsync({ scope, team, title: 'Nouveau tableau' })
      onSelect(board)
      setRenaming({ id: board.id, value: board.title })
    } catch (e: any) {
      toast({ title: 'Création impossible', description: e?.message, variant: 'destructive' })
    }
  }

  const commitRename = async () => {
    if (!renaming) return
    const title = renaming.value.trim()
    setRenaming(null)
    if (!title) return
    try {
      await updateMeta.mutateAsync({ id: renaming.id, patch: { title } })
    } catch (e: any) {
      toast({ title: 'Renommage impossible', description: e?.message, variant: 'destructive' })
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un tableau"
            className="h-9 pl-7 text-sm"
            aria-label="Rechercher un tableau"
          />
        </div>
        {canManage && (
          <Button
            size="sm"
            className="h-9 min-h-9 gap-1 px-2"
            onClick={handleCreate}
            disabled={createBoard.isPending}
          >
            {createBoard.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span className="sr-only sm:not-sr-only sm:inline">Nouveau</span>
          </Button>
        )}
      </div>

      <label className="flex items-center gap-2 px-0.5 text-xs text-muted-foreground">
        <Switch
          checked={showArchived}
          onCheckedChange={setShowArchived}
          aria-label="Afficher les tableaux archivés"
        />
        Afficher les archivés
      </label>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">Aucun tableau.</p>
        )}
        {filtered.map((board) => (
          <div
            key={board.id}
            className={cn(
              'group flex items-center gap-1 rounded-lg border px-2 py-1.5 transition-colors',
              board.id === activeId
                ? 'border-primary/40 bg-primary/5'
                : 'border-transparent hover:bg-muted/60'
            )}
          >
            {renaming?.id === board.id ? (
              <Input
                autoFocus
                value={renaming.value}
                onChange={(e) => setRenaming({ id: board.id, value: e.target.value })}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setRenaming(null)
                }}
                className="h-8 text-sm"
                aria-label="Renommer le tableau"
              />
            ) : (
              <button
                type="button"
                onClick={() => onSelect(board)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex items-center gap-1.5">
                  {board.is_pinned && (
                    <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                  )}
                  <span className="truncate text-sm font-medium">{board.title}</span>
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {elementCount(board)} élément{elementCount(board) > 1 ? 's' : ''} ·{' '}
                  {new Date(board.updated_at).toLocaleDateString('fr-FR')}
                  {board.archived_at ? ' · archivé' : ''}
                </span>
              </button>
            )}

            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 p-0"
                    aria-label={`Actions sur ${board.title}`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onSelect={() => setRenaming({ id: board.id, value: board.title })}
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Renommer
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      updateMeta.mutate({ id: board.id, patch: { is_pinned: !board.is_pinned } })
                    }
                  >
                    {board.is_pinned ? (
                      <StarOff className="mr-2 h-4 w-4" />
                    ) : (
                      <Star className="mr-2 h-4 w-4" />
                    )}
                    {board.is_pinned ? 'Retirer des favoris' : 'Épingler'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={async () => {
                      try {
                        const copy = await duplicateBoard.mutateAsync(board)
                        onSelect(copy)
                      } catch (e: any) {
                        toast({
                          title: 'Duplication impossible',
                          description: e?.message,
                          variant: 'destructive',
                        })
                      }
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" /> Dupliquer
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      updateMeta.mutate({
                        id: board.id,
                        patch: { archived_at: board.archived_at ? null : new Date().toISOString() },
                      })
                    }
                  >
                    {board.archived_at ? (
                      <>
                        <ArchiveRestore className="mr-2 h-4 w-4" /> Désarchiver
                      </>
                    ) : (
                      <>
                        <Archive className="mr-2 h-4 w-4" /> Archiver
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onSelect={() => setToDelete(board)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {toDelete?.title} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le tableau et son historique seront définitivement supprimés. Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!toDelete) return
                try {
                  await deleteBoard.mutateAsync(toDelete.id)
                  toast({ title: 'Tableau supprimé' })
                } catch (e: any) {
                  toast({
                    title: 'Suppression impossible',
                    description: e?.message,
                    variant: 'destructive',
                  })
                } finally {
                  setToDelete(null)
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
