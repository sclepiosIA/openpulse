import { MapPin, Calendar, MoreVertical } from 'lucide-react'
import { useSmartNavigation } from '@/hooks/shared/useSmartNavigation'
import { EntityAvatar } from '@/components/ui/EntityAvatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeploymentHealthIndicator } from './DeploymentHealthIndicator'
import { DeploymentMobileCard } from './DeploymentMobileCard'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import type { HealthScore } from '@/hooks/production/useDeploymentHealth'

interface DeploymentListViewProps {
  etablissements: Etablissement[]
  healthScores: Map<string, HealthScore>
}

export function DeploymentListView({ etablissements, healthScores }: DeploymentListViewProps) {
  const { smartNavigate, navigate } = useSmartNavigation()
  const isMobile = useIsMobile()

  // Mobile view: render cards instead of table
  if (isMobile) {
    return (
      <div className="flex flex-col gap-2">
        {etablissements.map((etablissement) => (
          <DeploymentMobileCard
            key={etablissement.id}
            etablissement={etablissement}
            health={healthScores.get(etablissement.id)}
          />
        ))}
      </div>
    )
  }

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'Contractuel': return 'bg-primary/10 text-primary border-primary/20'
      case 'Conformité': return 'bg-warning/10 text-warning border-warning/20'
      case 'Déploiement': return 'bg-secondary/10 text-secondary-foreground border-secondary/20'
      case 'Formation': return 'bg-accent/10 text-accent-foreground border-accent/20'
      case 'Go-Live': return 'bg-success/10 text-success border-success/20'
      default: return 'bg-muted text-muted-foreground border-muted/20'
    }
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Établissement</TableHead>
            <TableHead>Localisation</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Santé</TableHead>
            <TableHead>Progression</TableHead>
            <TableHead>Date signature</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {etablissements.map((etablissement) => {
            const health = healthScores.get(etablissement.id)
            
            return (
              <TableRow
                key={etablissement.id}
                className="cursor-pointer hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => smartNavigate(e, `/etablissements/${etablissement.id}`)}
                role="link"
                tabIndex={0}
                aria-label={`Ouvrir la fiche établissement ${etablissement.nom}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/etablissements/${etablissement.id}`)
                  }
                }}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <EntityAvatar name={etablissement.nom} logoUrl={etablissement.logo_url || (etablissement as any).groupe_logo_url} size="sm" />
                    <div className="space-y-0.5">
                      <div className="font-medium">{etablissement.nom}</div>
                      <div className="text-xs text-muted-foreground">{etablissement.type}</div>
                    </div>
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center gap-1 text-sm">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    {etablissement.ville}, {etablissement.region}
                  </div>
                </TableCell>
                
                <TableCell>
                  <Badge className={getStatutColor(etablissement.statut)}>
                    {etablissement.statut}
                  </Badge>
                </TableCell>
                
                <TableCell>
                  {health && (
                    <DeploymentHealthIndicator
                      status={health.status}
                      score={health.score}
                      reasons={health.reasons}
                      size="sm"
                    />
                  )}
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${etablissement.progression || 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {Math.round(etablissement.progression || 0)}%
                    </span>
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {etablissement.date_signature
                      ? new Date(etablissement.date_signature).toLocaleDateString('fr-FR')
                      : 'Non défini'}
                  </div>
                </TableCell>
                
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" aria-label="Plus d'options" title="Plus d'options">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/etablissements/${etablissement.id}`)
                        }}
                      >
                        Voir détails
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/etablissements/${etablissement.id}?tab=taches`)
                        }}
                      >
                        Voir tâches
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/etablissements/${etablissement.id}?tab=kanban`)
                        }}
                      >
                        Voir kanban
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
