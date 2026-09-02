import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Pencil } from 'lucide-react'

export type InlineEditType = 'text' | 'number' | 'select'

export interface InlineEditOption {
  value: string
  label: string
}

interface BaseProps {
  value: string | number | null | undefined
  onSave: (newValue: string | number | null) => Promise<void> | void
  type?: InlineEditType
  options?: InlineEditOption[]
  placeholder?: string
  className?: string
  displayClassName?: string
  /** Render-prop for read mode (e.g. Badge). Falls back to plain text. */
  renderDisplay?: (value: string | number | null | undefined) => React.ReactNode
  disabled?: boolean
  ariaLabel?: string
}

/**
 * Twenty CRM-inspired inline edit cell.
 * Click to edit, Enter to save, Escape to cancel, blur saves.
 * Optimistic UI handled by parent's mutation hook.
 */
export function InlineEditCell({
  value,
  onSave,
  type = 'text',
  options,
  placeholder = '—',
  className,
  displayClassName,
  renderDisplay,
  disabled = false,
  ariaLabel,
}: BaseProps) {
  const [editing, setEditing] = useState(false)
  const [localValue, setLocalValue] = useState<string>(value == null ? '' : String(value))
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLocalValue(value == null ? '' : String(value))
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commit = async () => {
    if (saving) return
    const original = value == null ? '' : String(value)
    if (localValue === original) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const parsed: string | number | null =
        type === 'number'
          ? localValue === '' ? null : Number(localValue)
          : localValue === '' ? null : localValue
      await onSave(parsed)
      setEditing(false)
    } catch {
      setLocalValue(original)
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setLocalValue(value == null ? '' : String(value))
    setEditing(false)
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  // Read mode
  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          if (!disabled) setEditing(true)
        }}
        aria-label={ariaLabel ?? 'Modifier'}
        className={cn(
          'group/inline relative inline-flex items-center gap-1 w-full text-left rounded px-1 -mx-1 py-0.5 transition-colors',
          !disabled && 'hover:bg-muted/60 cursor-text',
          disabled && 'cursor-default',
          className,
        )}
      >
        <span className={cn('truncate', displayClassName)}>
          {renderDisplay
            ? renderDisplay(value)
            : value == null || value === ''
              ? <span className="text-muted-foreground">{placeholder}</span>
              : String(value)}
        </span>
        {!disabled && (
          <Pencil className="h-3 w-3 opacity-0 group-hover/inline:opacity-50 transition-opacity shrink-0" />
        )}
      </button>
    )
  }

  // Edit mode — Select
  if (type === 'select' && options) {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <Select
          open
          value={localValue}
          onValueChange={async (v) => {
            setLocalValue(v)
            setSaving(true)
            try {
              await onSave(v)
              setEditing(false)
            } catch {
              setLocalValue(value == null ? '' : String(value))
            } finally {
              setSaving(false)
            }
          }}
          onOpenChange={(open) => {
            if (!open && !saving) setEditing(false)
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  // Edit mode — text/number
  return (
    <Input
      ref={inputRef}
      type={type === 'number' ? 'number' : 'text'}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKey}
      onClick={(e) => e.stopPropagation()}
      disabled={saving}
      className="h-7 text-sm"
      placeholder={placeholder}
    />
  )
}
