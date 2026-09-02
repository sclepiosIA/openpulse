import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { searchModules } from '@/lib/tutoriel-content'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export function TutorielSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const results = useMemo(() => {
    if (query.length < 2) return []
    return searchModules(query)
  }, [query])

  const handleSelect = (moduleId: string) => {
    navigate(`/tutoriels/${moduleId}`)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans les tutoriels..."
            className="pl-9"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (e.target.value.length >= 2) setOpen(true)
            }}
            onFocus={() => {
              if (query.length >= 2) setOpen(true)
            }}
          />
        </div>
      </PopoverTrigger>
      {query.length >= 2 && (
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandList>
              <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
              <CommandGroup heading="Modules">
                {results.map((module) => (
                  <CommandItem
                    key={module.id}
                    value={module.id}
                    onSelect={() => handleSelect(module.id)}
                    className="cursor-pointer"
                  >
                    <div>
                      <p className="font-medium">{module.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {module.description}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      )}
    </Popover>
  )
}
