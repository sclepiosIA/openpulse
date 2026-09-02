import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { format, parseISO, isValid } from 'date-fns'
import { fr } from 'date-fns/locale'

interface EditableDateCellProps {
  value: string | null | undefined
  onSave: (value: string) => void
  placeholder?: string
  className?: string
  displayFormat?: string
}

export function EditableDateCell({
  value,
  onSave,
  placeholder = 'Sélectionner...',
  className,
  displayFormat = 'dd/MM/yyyy',
}: EditableDateCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      try { inputRef.current.showPicker?.() } catch { /* cross-origin iframe */ }
    }
  }, [editing])

  const handleSave = () => {
    setEditing(false)
    if (editValue !== (value || '')) {
      onSave(editValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') {
      setEditValue(value || '')
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full px-2 py-1 text-sm border border-primary rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary",
          className
        )}
      />
    )
  }

  let displayValue = ''
  if (value) {
    try {
      const parsed = parseISO(value)
      displayValue = isValid(parsed) ? format(parsed, displayFormat, { locale: fr }) : value
    } catch {
      displayValue = value
    }
  }

  return (
    <div
      onClick={() => { setEditValue(value || ''); setEditing(true) }}
      className={cn(
        "px-2 py-1 text-sm cursor-pointer hover:bg-muted/50 rounded min-h-[28px] transition-colors",
        !value && "text-muted-foreground italic",
        className
      )}
    >
      {displayValue || placeholder}
    </div>
  )
}
