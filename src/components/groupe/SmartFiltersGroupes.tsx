import { Button } from "@/components/ui/button"
import { Star, Sparkles, Building2, Users } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { useMemo } from "react"
import { Groupe } from "@/hooks/crm/useGroupes"
import { differenceInDays } from "date-fns"

interface SmartFiltersGroupesProps {
  groupes: Groupe[]
}

export function SmartFiltersGroupes({ groupes }: SmartFiltersGroupesProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentSmartFilter = searchParams.get('smart_filter')

  const handleSmartFilter = (type: string | null) => {
    const newSearchParams = new URLSearchParams(searchParams)
    if (type === null) {
      newSearchParams.delete('smart_filter')
    } else {
      newSearchParams.set('smart_filter', type)
    }
    setSearchParams(newSearchParams)
  }

  // Calculer les compteurs
  const counts = useMemo(() => {
    const now = new Date()
    return {
      tous: groupes.length,
      nouveaux: groupes.filter(g => differenceInDays(now, new Date(g.created_at)) <= 30).length,
      ght: groupes.filter(g => g.type === 'GHT').length,
      grosses: groupes.filter(g => g.nombre_etablissements > 5).length,
    }
  }, [groupes])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={!currentSmartFilter ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleSmartFilter(null)}
        className="h-8"
      >
        <Star className="h-3.5 w-3.5 mr-1.5" />
        Tous
        <span className="ml-1.5 text-xs opacity-70">({counts.tous})</span>
      </Button>

      <Button
        variant={currentSmartFilter === 'favoris' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleSmartFilter('favoris')}
        className="h-8"
      >
        <Star className="h-3.5 w-3.5 mr-1.5 fill-current" />
        Favoris
      </Button>

      <Button
        variant={currentSmartFilter === 'nouveaux' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleSmartFilter('nouveaux')}
        className="h-8"
      >
        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
        Nouveaux
        <span className="ml-1.5 text-xs opacity-70">({counts.nouveaux})</span>
      </Button>

      <Button
        variant={currentSmartFilter === 'ght' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleSmartFilter('ght')}
        className="h-8"
      >
        <Building2 className="h-3.5 w-3.5 mr-1.5" />
        GHT uniquement
        <span className="ml-1.5 text-xs opacity-70">({counts.ght})</span>
      </Button>

      <Button
        variant={currentSmartFilter === 'grosses' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleSmartFilter('grosses')}
        className="h-8"
      >
        <Users className="h-3.5 w-3.5 mr-1.5" />
        Grosses structures
        <span className="ml-1.5 text-xs opacity-70">({counts.grosses})</span>
      </Button>
    </div>
  )
}
