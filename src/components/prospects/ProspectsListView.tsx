import { useNavigate } from "react-router-dom"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { MoreVertical, MapPin, User, Calendar, TrendingUp } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EntityAvatar } from "@/components/ui/EntityAvatar"
import type { Etablissement } from "@/hooks/crm/useEtablissements"
import { formatCurrency } from "@/lib/formatters"

interface ProspectsListViewProps {
  prospects: Etablissement[]
  selectedIds: Set<string>
  onSelect: (id: string) => void
  getProgressInfo: (id: string) => { progress: number; totalTasks: number; completedTasks: number; potentialValue?: number }
  onEdit: (prospect: Etablissement) => void
  onDelete: (id: string) => void
}

export function ProspectsListView({
  prospects,
  selectedIds,
  onSelect,
  getProgressInfo,
  onEdit,
  onDelete
}: ProspectsListViewProps) {
  const navigate = useNavigate()

  return (
    <div className="space-y-2">
      {prospects.map((prospect) => {
        const progressInfo = getProgressInfo(prospect.id)
        
        return (
          <div
            key={prospect.id}
            className="flex items-center gap-4 p-4 border rounded-lg bg-card hover:shadow-md transition-shadow cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            {/* Checkbox */}
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selectedIds.has(prospect.id)}
                onCheckedChange={() => onSelect(prospect.id)}
              />
            </div>

            {/* Avatar */}
            <EntityAvatar
              name={prospect.nom}
              logoUrl={prospect.logo_url || (prospect as any).groupe_logo_url}
              size="sm"
            />

            {/* Main content */}
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Column 1: Name + Type */}
              <div className="min-w-0">
                <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                  {prospect.nom}
                </h3>
                <div className="text-sm text-muted-foreground truncate">
                  {prospect.type}
                </div>
              </div>

              {/* Column 2: Location + Commercial */}
              <div className="hidden sm:block min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{prospect.ville}, {prospect.region}</span>
                </div>
                {prospect.commercial && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{prospect.commercial.prenom} {prospect.commercial.nom}</span>
                  </div>
                )}
              </div>

              {/* Column 3: Progress */}
              <div className="hidden lg:block">
                <div className="flex items-center gap-2 mb-1">
                  <Progress value={progressInfo.progress} className="h-2 flex-1" />
                  <span className="text-sm font-medium w-12 text-right">
                    {Math.round(progressInfo.progress)}%
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {progressInfo.completedTasks}/{progressInfo.totalTasks} tâches
                </div>
              </div>

              {/* Column 4: Value + Status */}
              <div className="hidden lg:flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <TrendingUp className="h-3 w-3 text-success" />
                    {progressInfo.potentialValue 
                      ? formatCurrency(progressInfo.potentialValue)
                      : '-'
                    }
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(prospect.created_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <Badge variant="outline">{prospect.statut}</Badge>
              </div>
            </div>

            {/* Actions */}
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="Plus d'options" title="Plus d'options" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(`/etablissements/${prospect.id}`)}>
                    Voir la fiche
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/etablissements/${prospect.id}?tab=taches`)}>
                    Voir les tâches
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(prospect)}>
                    Modifier
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete(prospect.id)}
                    className="text-destructive"
                  >
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )
      })}
    </div>
  )
}
