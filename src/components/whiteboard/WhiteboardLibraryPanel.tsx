import { useMemo, useState } from 'react'
import { Blocks, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/shared/use-toast'
import { useAuth } from '@/hooks/shared/useAuth'
import {
  useWhiteboardLibrary,
  useSaveLibraryItem,
  useDeleteLibraryItem,
  type LibraryItem,
} from '@/hooks/whiteboards/useWhiteboardLibrary'
import type { TeamKey } from '@/hooks/whiteboards/useSimpleWhiteboards'

interface Props {
  scope: 'personal' | 'team' | 'company'
  team: TeamKey | null
  /** Éléments actuellement sélectionnés sur le canvas. */
  getSelection: () => { elements: unknown[]; files: Record<string, unknown> }
  onInsert: (item: LibraryItem) => void
}

/** Bibliothèque de blocs réutilisables (personnels, équipe, entreprise). */
export function WhiteboardLibraryPanel({ scope, team, getSelection, onInsert }: Props) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const { data: items = [], isLoading } = useWhiteboardLibrary()
  const saveItem = useSaveLibraryItem()
  const deleteItem = useDeleteLibraryItem()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((i) => !q || i.name.toLowerCase().includes(q))
  }, [items, search])

  const handleSave = async () => {
    const selection = getSelection()
    if (!selection.elements.length) {
      toast({
        title: 'Aucune sélection',
        description: 'Sélectionnez des éléments sur le tableau avant de les enregistrer.',
        variant: 'destructive',
      })
      return
    }
    try {
      await saveItem.mutateAsync({
        name: name || 'Bloc sans nom',
        elements: selection.elements,
        files: selection.files,
        scope,
        team,
      })
      setName('')
      toast({ title: 'Bloc enregistré' })
    } catch (e: any) {
      toast({ title: 'Enregistrement impossible', description: e?.message, variant: 'destructive' })
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du bloc à enregistrer"
          className="h-9 text-sm"
          aria-label="Nom du bloc"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-9 min-h-9 shrink-0 gap-1"
          onClick={handleSave}
          disabled={saveItem.isPending}
        >
          {saveItem.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Enregistrer la sélection
        </Button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un bloc"
        className="h-9 text-sm"
        aria-label="Rechercher un bloc"
      />

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="flex flex-col items-center gap-2 px-1 py-8 text-center text-xs text-muted-foreground">
            <Blocks className="h-5 w-5" />
            Sélectionnez des éléments puis enregistrez-les pour les réutiliser.
          </p>
        )}
        {filtered.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 rounded-lg border border-border/60 p-2"
          >
            {item.preview_data ? (
              <img
                src={item.preview_data}
                alt=""
                className="h-9 w-9 shrink-0 rounded border border-border/60 object-contain"
                loading="lazy"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border/60">
                <Blocks className="h-4 w-4 text-muted-foreground" />
              </span>
            )}
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => onInsert(item)}
            >
              <span className="block truncate text-sm font-medium">{item.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {(item.elements as unknown[])?.length ?? 0} élément(s) ·{' '}
                {item.scope === 'personal'
                  ? 'perso'
                  : item.scope === 'team'
                    ? 'équipe'
                    : 'entreprise'}
              </span>
            </button>
            {item.user_id === user?.id && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 shrink-0 p-0 text-destructive"
                aria-label={`Supprimer ${item.name}`}
                onClick={() => deleteItem.mutate(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
