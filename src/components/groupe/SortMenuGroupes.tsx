import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface SortMenuGroupesProps {
  variant?: 'default' | 'glassmorphism'
}

export function SortMenuGroupes({ variant = 'glassmorphism' }: SortMenuGroupesProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentSort = searchParams.get('sort') || 'nom-asc'
  const isGlassmorphism = variant === 'glassmorphism'

  const handleSort = (sort: string) => {
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('sort', sort)
    setSearchParams(newSearchParams)
  }

  const sortOptions = [
    { value: 'nom-asc', label: 'Nom (A-Z)', icon: ArrowUp },
    { value: 'nom-desc', label: 'Nom (Z-A)', icon: ArrowDown },
    { value: 'created-desc', label: 'Plus récent', icon: ArrowDown },
    { value: 'created-asc', label: 'Plus ancien', icon: ArrowUp },
    { value: 'etablissements-desc', label: 'Établissements (↓)', icon: ArrowDown },
    { value: 'etablissements-asc', label: 'Établissements (↑)', icon: ArrowUp },
    { value: 'progression-desc', label: 'Progression (↓)', icon: ArrowDown },
    { value: 'progression-asc', label: 'Progression (↑)', icon: ArrowUp },
  ]

  const currentLabel = sortOptions.find((opt) => opt.value === currentSort)?.label || 'Trier par'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-6 px-2 sm:h-7 sm:px-2.5 gap-1 sm:gap-1.5 rounded-lg transition-all',
            isGlassmorphism
              ? 'bg-card/10 backdrop-blur-sm border border-white/20 text-white/80 hover:bg-card/20 hover:text-white'
              : 'border hover:bg-muted'
          )}
        >
          <ArrowUpDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline text-xs">{currentLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-popover">
        <DropdownMenuLabel>Trier par</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sortOptions.map((option) => {
          const Icon = option.icon
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleSort(option.value)}
              className={currentSort === option.value ? 'bg-accent' : ''}
            >
              <Icon className="h-4 w-4 mr-2" />
              {option.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
