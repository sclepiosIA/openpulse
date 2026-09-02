import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { MapPin, ExternalLink, Plus } from 'lucide-react'
import { useSmartNavigation } from '@/hooks/shared/useSmartNavigation'
import { EntityAvatar } from '@/components/ui/EntityAvatar'
import { VirtualList } from '@/components/ui/virtual-list'
import type { Etablissement } from '@/hooks/crm/useEtablissements'

interface EtablissementsListViewProps {
  etablissements: Etablissement[]
}

export function EtablissementsListView({ etablissements }: EtablissementsListViewProps) {
  const { smartNavigate, navigate } = useSmartNavigation()

  const getStatutBadgeVariant = (statut: string) => {
    switch (statut) {
      case 'Production':
        return 'default'
      case 'Déploiement':
      case 'Formation':
        return 'secondary'
      case 'Go-Live':
        return 'default'
      default:
        return 'outline'
    }
  }

  if (etablissements.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
          <p className="text-sm">Aucun établissement trouvé</p>
          <Button
            size="sm"
            onClick={() => navigate('/etablissements?create=1')}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Créer un établissement
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Use virtualization for large lists (>50 items)
  if (etablissements.length > 50) {
    return (
      <VirtualList
        items={etablissements}
        height={600}
        itemHeight={80}
        renderItem={(etab) => (
          <Card
            key={etab.id}
            className="hover:shadow-md transition-shadow cursor-pointer mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(e) => smartNavigate(e, `/etablissements/${etab.id}`)}
            role="button"
            tabIndex={0}
            aria-label={`Ouvrir la fiche établissement ${etab.nom}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate(`/etablissements/${etab.id}`)
              }
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                  <EntityAvatar name={etab.nom} logoUrl={etab.logo_url || (etab as any).groupe_logo_url} size="sm" className="flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{etab.nom}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      <span className="truncate">{etab.ville} • {etab.region}</span>
                    </div>
                  </div>
                </div>

                <Badge variant={getStatutBadgeVariant(etab.statut)} className="flex-shrink-0">
                  {etab.statut}
                </Badge>

                <div className="hidden md:flex items-center gap-2 w-32 flex-shrink-0">
                  <Progress value={etab.progression || 0} className="h-2 flex-1" aria-label={`Progression: ${etab.progression || 0}%`} />
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {etab.progression || 0}%
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/etablissements/${etab.id}`)
                  }}
                  aria-label={`Voir les détails de ${etab.nom}`}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        className="space-y-2"
      />
    )
  }

  return (
    <div className="space-y-2">
      {etablissements.map((etab) => (
        <Card
          key={etab.id}
          className="hover:shadow-md transition-shadow cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => smartNavigate(e, `/etablissements/${etab.id}`)}
          role="button"
          tabIndex={0}
          aria-label={`Ouvrir la fiche établissement ${etab.nom}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              navigate(`/etablissements/${etab.id}`)
            }
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <EntityAvatar name={etab.nom} logoUrl={etab.logo_url || (etab as any).groupe_logo_url} size="sm" className="flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">{etab.nom}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" aria-hidden="true" />
                    <span className="truncate">{etab.ville} • {etab.region}</span>
                  </div>
                </div>
              </div>

              <Badge variant={getStatutBadgeVariant(etab.statut)} className="flex-shrink-0">
                {etab.statut}
              </Badge>

              <div className="hidden md:flex items-center gap-2 w-32 flex-shrink-0">
                <Progress value={etab.progression || 0} className="h-2 flex-1" aria-label={`Progression: ${etab.progression || 0}%`} />
                <span className="text-xs text-muted-foreground w-10 text-right">
                  {etab.progression || 0}%
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/etablissements/${etab.id}`)
                }}
                aria-label={`Voir les détails de ${etab.nom}`}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
