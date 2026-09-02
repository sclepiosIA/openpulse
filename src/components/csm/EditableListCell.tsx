import { useState } from 'react'
import { Plus, X, Check, Pencil, CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export interface ActionItem {
  text: string
  date: string | null
  done?: boolean
}

interface EditableListCellProps {
  items: ActionItem[] | null
  placeholder?: string
  onSave: (items: ActionItem[] | null) => void
}

export function EditableListCell({
  items,
  placeholder = 'Ajouter...',
  onSave,
}: EditableListCellProps) {
  const [newText, setNewText] = useState('')
  const [newDate, setNewDate] = useState<Date | undefined>(undefined)
  const [isAdding, setIsAdding] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [editDate, setEditDate] = useState<Date | undefined>(undefined)

  const currentItems: ActionItem[] = Array.isArray(items) ? items : []
  // Sort: undone first, then done
  const sortedItems = [...currentItems].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0))

  const handleAdd = () => {
    const trimmed = newText.trim()
    if (!trimmed) return
    const updated = [
      ...currentItems,
      { text: trimmed, date: newDate ? format(newDate, 'yyyy-MM-dd') : null, done: false },
    ]
    onSave(updated)
    setNewText('')
    setNewDate(undefined)
    setIsAdding(false)
  }

  const handleRemove = (item: ActionItem) => {
    const idx = currentItems.indexOf(item)
    const updated = currentItems.filter((_, i) => i !== idx)
    onSave(updated.length > 0 ? updated : null)
    if (editingIndex === idx) setEditingIndex(null)
  }

  const handleToggleDone = (item: ActionItem) => {
    const idx = currentItems.indexOf(item)
    const updated = currentItems.map((it, i) => (i === idx ? { ...it, done: !it.done } : it))
    onSave(updated)
  }

  const startEdit = (item: ActionItem) => {
    const idx = currentItems.indexOf(item)
    setEditingIndex(idx)
    setEditText(item.text)
    setEditDate(item.date ? parseISO(item.date) : undefined)
  }

  const handleSaveEdit = () => {
    if (editingIndex === null) return
    const trimmed = editText.trim()
    if (!trimmed) return
    const updated = currentItems.map((item, i) =>
      i === editingIndex
        ? { ...item, text: trimmed, date: editDate ? format(editDate, 'yyyy-MM-dd') : null }
        : item
    )
    onSave(updated)
    setEditingIndex(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent, mode: 'add' | 'edit') => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (mode === 'add') {
        handleAdd()
      } else {
        handleSaveEdit()
      }
    } else if (e.key === 'Escape') {
      if (mode === 'add') {
        setIsAdding(false)
        setNewText('')
        setNewDate(undefined)
      } else {
        setEditingIndex(null)
      }
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    try {
      return format(parseISO(dateStr), 'dd/MM/yy', { locale: fr })
    } catch {
      return dateStr
    }
  }

  const isOverdue = (dateStr: string | null, done?: boolean) => {
    if (!dateStr || done) return false
    try {
      return parseISO(dateStr) < new Date(new Date().toDateString())
    } catch {
      return false
    }
  }

  const DatePicker = ({
    date,
    onChange,
  }: {
    date: Date | undefined
    onChange: (d: Date | undefined) => void
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-6 px-1.5 text-[11px] font-normal shrink-0',
            !date && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="h-3 w-3 mr-1" />
          {date ? format(date, 'dd/MM/yy', { locale: fr }) : 'Date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onChange}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  )

  const realIndex = (item: ActionItem) => currentItems.indexOf(item)

  return (
    <div className="space-y-0.5">
      {sortedItems.map((item) => {
        const idx = realIndex(item)
        return (
          <div key={idx}>
            {editingIndex === idx ? (
              <div className="flex items-center gap-1 py-0.5">
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 'edit')}
                  className="h-6 text-xs flex-1"
                  autoFocus
                />
                <DatePicker date={editDate} onChange={setEditDate} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  onClick={handleSaveEdit}
                  disabled={!editText.trim()}
                  aria-label="Valider"
                >
                  <Check className="h-3 w-3 text-primary" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  onClick={() => setEditingIndex(null)}
                  aria-label="Fermer"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="group flex items-center gap-1.5 py-0.5 rounded hover:bg-muted/40 transition-colors px-0.5 -mx-0.5">
                <Checkbox
                  checked={!!item.done}
                  onCheckedChange={() => handleToggleDone(item)}
                  className="h-3.5 w-3.5 shrink-0"
                />

                <span
                  className={cn(
                    'text-sm flex-1 min-w-0 break-words leading-tight',
                    item.done && 'line-through text-muted-foreground'
                  )}
                >
                  {item.text}
                </span>
                {item.date && (
                  <span
                    className={cn(
                      'text-[10px] shrink-0 tabular-nums',
                      item.done
                        ? 'text-muted-foreground/60'
                        : isOverdue(item.date, item.done)
                          ? 'text-destructive font-semibold'
                          : 'text-muted-foreground'
                    )}
                  >
                    {formatDate(item.date)}
                  </span>
                )}
                <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => startEdit(item)}
                    aria-label="Modifier"
                  >
                    <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => handleRemove(item)}
                    aria-label="Fermer"
                  >
                    <X className="h-2.5 w-2.5 text-destructive" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {currentItems.length === 0 && !isAdding}

      {isAdding ? (
        <div className="flex items-center gap-1 py-0.5">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, 'add')}
            placeholder={placeholder}
            className="h-6 text-xs flex-1"
            autoFocus
          />
          <DatePicker date={newDate} onChange={setNewDate} />
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={handleAdd}
            disabled={!newText.trim()}
            aria-label="Valider"
          >
            <Check className="h-3 w-3 text-primary" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={() => {
              setIsAdding(false)
              setNewText('')
              setNewDate(undefined)
            }}
            aria-label="Fermer"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors py-0.5"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-3 w-3" />
          Ajouter
        </button>
      )}
    </div>
  )
}
