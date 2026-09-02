import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { useAddressSearch, type AddressSuggestion } from '@/hooks/search/useAddressSearch'
import { Loader2, MapPin, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LocationValue {
  address: string
  coords: { lat: number; lng: number } | null
}

interface LocationAutocompleteProps {
  value: LocationValue
  onChange: (value: LocationValue) => void
  placeholder?: string
  className?: string
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'Ajouter un lieu',
  className,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value.address)
  const [open, setOpen] = useState(false)
  const [searchEnabled, setSearchEnabled] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync external changes
  useEffect(() => {
    setQuery(value.address)
  }, [value.address])

  const { suggestions, loading } = useAddressSearch(query, searchEnabled)

  const handleSelect = (s: AddressSuggestion) => {
    const lat = parseFloat(s.lat)
    const lng = parseFloat(s.lon)
    setQuery(s.display_name)
    setSearchEnabled(false)
    setOpen(false)
    onChange({ address: s.display_name, coords: { lat, lng } })
  }

  const handleInput = (newValue: string) => {
    setQuery(newValue)
    setSearchEnabled(true)
    setOpen(true)
    if (newValue !== value.address) {
      onChange({ address: newValue, coords: null })
    }
  }

  const showDropdown =
    open && (loading || suggestions.length > 0 || (query.trim().length >= 3 && !loading))

  useEffect(() => {
    if (!showDropdown) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDropdown])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        value={query}
        placeholder={placeholder}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => query.trim().length >= 3 && setOpen(true)}
        className="h-9 pl-8 pr-8"
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover text-popover-foreground rounded-md border shadow-md max-h-[280px] overflow-y-auto">
          {loading && suggestions.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Recherche d'adresses…
            </div>
          )}
          {!loading && suggestions.length === 0 && query.trim().length >= 3 && (
            <div className="px-3 py-4 text-xs text-muted-foreground">
              Aucune adresse trouvée. Vous pouvez saisir un lieu libre.
            </div>
          )}
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              type="button"
              onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-start gap-2 border-b border-border/40 last:border-0"
            >
              <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <span className="text-xs leading-snug">{s.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
