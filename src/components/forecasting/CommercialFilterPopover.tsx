import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Users, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface Option {
  id: string
  label: string
}

interface Props {
  options: Option[]
  selected: string[]
  onChange: (ids: string[]) => void
}

export function CommercialFilterPopover({ options, selected, onChange }: Props) {
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id))
    else onChange([...selected, id])
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-card/10 border-white/20 text-white hover:bg-card/20 hover:text-white"
        >
          <Users className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Commerciaux</span>
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5">
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <div className="p-2 border-b flex items-center justify-between">
          <span className="text-sm font-medium">Filtrer</span>
          {selected.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange([])}
            >
              <X className="h-3 w-3 mr-1" /> Effacer
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-72">
          <div className="p-2 space-y-1">
            {options.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                Aucun commercial
              </p>
            )}
            {options.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
              >
                <Checkbox
                  checked={selected.includes(opt.id)}
                  onCheckedChange={() => toggle(opt.id)}
                />
                <span className="truncate">{opt.label}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
