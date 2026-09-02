import { cn } from '@/lib/utils'

interface EditableSelectCellProps {
  value: string | null | undefined
  options: { value: string; label: string }[]
  onSave: (value: string) => void
  placeholder?: string
  className?: string
}

export function EditableSelectCell({ value, options, onSave, placeholder = 'Sélectionner', className }: EditableSelectCellProps) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onSave(e.target.value)}
      className={cn(
        "w-full px-2 py-1 text-sm bg-transparent border-0 cursor-pointer hover:bg-muted/50 rounded focus:outline-none focus:ring-1 focus:ring-primary",
        !value && "text-muted-foreground",
        className
      )}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}
