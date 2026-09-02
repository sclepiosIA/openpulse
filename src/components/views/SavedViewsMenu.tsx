import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Bookmark, Check, Plus, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import type { SavedView } from '@/hooks/views/useSavedViews'

interface SavedViewsMenuProps<T> {
  views: SavedView<T>[]
  activeId: string | null
  onApply: (state: T, id: string) => void
  onSave: (name: string) => void
  onUpdate: (id: string) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
}

export function SavedViewsMenu<T>({
  views,
  activeId,
  onApply,
  onSave,
  onUpdate,
  onRename,
  onRemove,
}: SavedViewsMenuProps<T>) {
  const [openSave, setOpenSave] = useState(false)
  const [name, setName] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const active = views.find((v) => v.id === activeId)

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Donnez un nom à la vue')
      return
    }
    onSave(trimmed)
    toast.success(`Vue « ${trimmed} » enregistrée`)
    setName('')
    setOpenSave(false)
  }

  const handleRename = () => {
    if (!renameId) return
    const trimmed = renameValue.trim()
    if (!trimmed) return
    onRename(renameId, trimmed)
    toast.success('Vue renommée')
    setRenameId(null)
    setRenameValue('')
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5">
            <Bookmark className="h-3.5 w-3.5" />
            <span className="text-xs">
              {active ? active.name : 'Vues'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 bg-popover">
          <DropdownMenuLabel>Vues enregistrées</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {views.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              Aucune vue enregistrée
            </div>
          ) : (
            views.map((v) => (
              <DropdownMenuItem
                key={v.id}
                onClick={() => {
                  onApply(v.state, v.id)
                  toast.success(`Vue « ${v.name} » appliquée`)
                }}
                className="flex items-center justify-between gap-2 group"
              >
                <span className="flex items-center gap-2 truncate flex-1">
                  {activeId === v.id ? (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{v.name}</span>
                </span>
                <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-accent"
                    onClick={(e) => {
                      e.stopPropagation()
                      setRenameId(v.id)
                      setRenameValue(v.name)
                    }}
                    aria-label="Renommer"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-destructive/10 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Supprimer la vue « ${v.name} » ?`)) {
                        onRemove(v.id)
                        toast.success('Vue supprimée')
                      }
                    }}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          {active && (
            <DropdownMenuItem
              onClick={() => {
                onUpdate(active.id)
                toast.success(`Vue « ${active.name} » mise à jour`)
              }}
            >
              <Check className="h-3.5 w-3.5 mr-2" />
              Mettre à jour « {active.name} »
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setOpenSave(true)}>
            <Plus className="h-3.5 w-3.5 mr-2" />
            Enregistrer la vue actuelle
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openSave} onOpenChange={setOpenSave}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enregistrer la vue</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Ex. Mes prospects en cours"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenSave(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameId} onOpenChange={(o) => !o && setRenameId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renommer la vue</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename()
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameId(null)}>
              Annuler
            </Button>
            <Button onClick={handleRename}>Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
