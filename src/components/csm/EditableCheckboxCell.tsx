import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditableCheckboxCellProps {
  value: boolean
  onSave: (value: boolean) => void
  className?: string
}

export function EditableCheckboxCell({ value, onSave, className }: EditableCheckboxCellProps) {
  return (
    <button
      onClick={() => onSave(!value)}
      className={cn(
        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
        value 
          ? "bg-primary border-primary text-primary-foreground" 
          : "border-muted-foreground/30 hover:border-primary/50",
        className
      )}
    >
      {value && <Check className="w-3 h-3" />}
    </button>
  )
}
