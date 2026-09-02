import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface EditableCellProps {
  value: string | null | undefined
  onSave: (value: string) => void
  placeholder?: string
  className?: string
  multiline?: boolean
  suffix?: string
}

export function EditableCell({ value, onSave, placeholder = 'Cliquer pour éditer', className, multiline, suffix }: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  // Sync editValue when value prop changes (e.g. after React Query invalidation)
  useEffect(() => {
    if (!editing) {
      setEditValue(value || '')
    }
  }, [value, editing])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleSave = () => {
    setEditing(false)
    if (editValue !== (value || '')) {
      onSave(editValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      handleSave()
    }
    if (e.key === 'Escape') {
      setEditValue(value || '')
      setEditing(false)
    }
  }

  if (editing) {
    const Tag = multiline ? 'textarea' : 'input'
    return (
      <Tag
        ref={inputRef as any}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full px-2 py-1 text-sm border border-primary rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary",
          multiline && "min-h-[60px] resize-y",
          className
        )}
      />
    )
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
      {value ? `${value}${suffix || ''}` : placeholder}
    </div>
  )
}
