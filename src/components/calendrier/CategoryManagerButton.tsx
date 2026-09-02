import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tag, Plus, Trash2, Check, X, Pencil } from 'lucide-react'
import { CALENDAR_COLORS } from '@/types/calendar'
import { cn } from '@/lib/utils'
import {
  useCalendarCategories,
  useCreateCalendarCategory,
  useUpdateCalendarCategory,
  useDeleteCalendarCategory,
  type CalendarCategory,
} from '@/hooks/calendar/useCalendarCategories'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Bouton global "Catégories" pour gérer (créer / renommer / recolorer / supprimer)
 * les catégories d'évènements du calendrier, indépendamment d'un évènement.
 */
export function CategoryManagerButton() {
  const { data: categories = [] } = useCalendarCategories()
  const createCat = useCreateCalendarCategory()
  const updateCat = useUpdateCalendarCategory()
  const deleteCat = useDeleteCalendarCategory()

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(CALENDAR_COLORS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState<string>(CALENDAR_COLORS[0])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    await createCat.mutateAsync({ name, color: newColor })
    setCreating(false)
    setNewName('')
    setNewColor(CALENDAR_COLORS[0])
  }

  const startEdit = (c: CalendarCategory) => {
    setEditingId(c.id)
    setEditName(c.name)
    setEditColor(c.color)
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    const name = editName.trim()
    if (!name) return
    await updateCat.mutateAsync({ id: editingId, name, color: editColor })
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    await deleteCat.mutateAsync(id)
  }

  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1 px-2 rounded-xl bg-card/50 backdrop-blur-sm border-primary/10 hover:bg-card/70 hover:border-primary/20 transition-all"
                aria-label="Gérer les catégories"
              >
                <Tag className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline text-xs">Catégories</span>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Gérer les catégories d'évènements</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent className="w-72 p-3" align="end">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Mes catégories</span>
            {!creating && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1 text-xs"
                onClick={() => setCreating(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Nouvelle
              </Button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1">
            {categories.length === 0 && !creating && (
              <div className="text-xs text-muted-foreground text-center py-3">
                Aucune catégorie. Créez la première.
              </div>
            )}

            {categories.map((c) => (
              <div key={c.id} className="group">
                {editingId === c.id ? (
                  <div className="p-2 rounded-md border bg-muted/30 space-y-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 text-xs"
                      placeholder="Nom"
                      autoFocus
                    />
                    <div className="flex flex-wrap gap-1">
                      {CALENDAR_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setEditColor(color)}
                          className={cn(
                            'w-5 h-5 rounded-full transition-transform',
                            editColor === color && 'ring-2 ring-offset-1 ring-primary scale-110'
                          )}
                          style={{ backgroundColor: color }}
                          aria-label={`Couleur ${color}`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="sm" className="h-7 px-2" onClick={handleSaveEdit}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="text-xs truncate flex-1">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                      aria-label="Modifier"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {creating && (
            <div className="p-2 rounded-md border bg-muted/30 space-y-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-7 text-xs"
                placeholder="Nom de la catégorie"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreate()
                  }
                }}
              />
              <div className="flex flex-wrap gap-1">
                {CALENDAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColor(color)}
                    className={cn(
                      'w-5 h-5 rounded-full transition-transform',
                      newColor === color && 'ring-2 ring-offset-1 ring-primary scale-110'
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Couleur ${color}`}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setCreating(false)
                    setNewName('')
                  }}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleCreate}
                  disabled={!newName.trim() || createCat.isPending}
                >
                  Créer
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
