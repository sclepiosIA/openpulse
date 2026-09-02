import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { MoreVertical, MapPin, User, Calendar, CheckCircle2, Clock, TrendingUp, AlertTriangle } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { EntityAvatar } from "@/components/ui/EntityAvatar"
import type { Etablissement } from "@/hooks/crm/useEtablissements"
import { formatCurrency } from "@/lib/formatters"

interface ProspectsGridViewProps {
  prospects: Etablissement[]
  selectedIds: Set<string>
  onSelect: (id: string) => void
  getProgressInfo: (id: string) => { progress: number; totalTasks: number; completedTasks: number; potentialValue?: number }
  onEdit: (prospect: Etablissement) => void
  onDelete: (id: string) => void
}

function getProgressBadge(progress: number) {
  if (progress === 100) {
    return <Badge className="bg-success text-success-foreground"><CheckCircle2 className="w-3 h-3 mr-1" />Prêt</Badge>
  } else if (progress > 50) {
    return <Badge className="bg-warning text-warning-foreground"><Clock className="w-3 h-3 mr-1" />En cours</Badge>
  } else if (progress > 0) {
    return <Badge className="bg-primary text-primary-foreground"><TrendingUp className="w-3 h-3 mr-1" />Démarré</Badge>
  } else {
    return <Badge variant="outline"><AlertTriangle className="w-3 h-3 mr-1" />À démarrer</Badge>
  }
}

export function ProspectsGridView({
  prospects,
  selectedIds,
  onSelect,
  getProgressInfo,
  onEdit,
  onDelete
}: ProspectsGridViewProps) {
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {prospects.map((prospect, index) => {
        const progressInfo = getProgressInfo(prospect.id)
        const isSelected = selectedIds.has(prospect.id)
        
        return (
          <Card
            key={prospect.id}
            className={`group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full flex flex-col animate-fade-in hover-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              isSelected ? 'ring-2 ring-primary' : ''
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => navigate(`/etablissements/${prospect.id}`)}
            role="button"
            tabIndex={0}
            aria-label={`Ouvrir la fiche prospect ${prospect.nom}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate(`/etablissements/${prospect.id}`)
              }
            }}
          >
            <CardHeader className="pb-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div onClick={(e) => e.stopPropagation()} className="pt-1">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onSelect(prospect.id)}
                    />
                  </div>
                  <EntityAvatar
                    name={prospect.nom}
                    logoUrl={prospect.logo_url || ('groupe_logo_url' in prospect ? (prospect as { groupe_logo_url?: string }).groupe_logo_url : undefined)}
                    size="md"
                  />
                  <div className="space-y-2 min-w-0 flex-1">
                    <CardTitle className="text-lg leading-tight break-words group-hover:text-primary transition-colors">
                      {prospect.nom}
                    </CardTitle>
                    <div className="text-sm text-muted-foreground truncate">
                      {prospect.type}
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" aria-label="Plus d'options" title="Plus d'options" className="shrink-0 h-8 w-8 p-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-48 max-w-[calc(100vw-2rem)] z-50 bg-background border shadow-lg"
                  >
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/etablissements/${prospect.id}?tab=taches`)
                    }}>
                      Voir les tâches
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/etablissements/${prospect.id}?tab=kanban`)
                    }}>
                      Voir le kanban
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      onEdit(prospect)
                    }}>
                      Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(prospect.id)
                      }}
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
              {/* Localisation */}
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate">{prospect.ville}, {prospect.region}</span>
              </div>

              {/* Commercial assigné */}
              {prospect.commercial && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{prospect.commercial.prenom} {prospect.commercial.nom}</span>
                </div>
              )}

              {/* CA potentiel */}
              {progressInfo.potentialValue && progressInfo.potentialValue > 0 && (
                <div className="flex items-center gap-3 text-sm">
                  <TrendingUp className="w-4 h-4 text-success shrink-0" />
                  <span className="font-medium">{formatCurrency(progressInfo.potentialValue)}</span>
                </div>
              )}

              {/* Progression du pipeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Progression commerciale</span>
                  <span className="font-semibold tabular-nums">{Math.round(progressInfo.progress)}%</span>
                </div>
                <Progress value={progressInfo.progress} className="h-2" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground tabular-nums">
                    {progressInfo.completedTasks}/{progressInfo.totalTasks} tâches
                  </span>
                  {getProgressBadge(progressInfo.progress)}
                </div>
              </div>

              {/* Date de création */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t">
                <Calendar className="w-3 h-3 shrink-0" />
                <span>Ajouté le {new Date(prospect.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
