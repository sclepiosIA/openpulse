import { Button } from "@/components/ui/button"
import { Star } from "lucide-react"
import { useSearchParams } from "react-router-dom"

export function QuickFiltersGroupes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentType = searchParams.get('type')

  const handleTypeFilter = (type: string | null) => {
    const newSearchParams = new URLSearchParams(searchParams)
    if (type === null) {
      newSearchParams.delete('type')
    } else {
      newSearchParams.set('type', type)
    }
    setSearchParams(newSearchParams)
  }

  const types = [
    { value: null, label: 'Tous', icon: Star },
    { value: 'GHT', label: 'GHT' },
    { value: 'Groupe Cliniques', label: 'Groupe Cliniques' },
    { value: 'Consortium', label: 'Consortium' },
    { value: 'Autre', label: 'Autre' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {types.map((type) => {
        const Icon = type.icon
        return (
          <Button
            key={type.value || 'all'}
            variant={currentType === type.value || (!currentType && type.value === null) ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTypeFilter(type.value)}
            className="h-8"
          >
            {Icon && <Icon className="h-3.5 w-3.5 mr-1.5" />}
            {type.label}
          </Button>
        )
      })}
    </div>
  )
}
