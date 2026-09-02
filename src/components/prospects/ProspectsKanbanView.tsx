import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { MoreVertical, MapPin, User, TrendingUp } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EntityAvatar } from "@/components/ui/EntityAvatar"
import type { Etablissement } from "@/hooks/crm/useEtablissements"
import { formatCurrency } from "@/lib/formatters"
import { cn } from "@/lib/utils"

interface ProspectsKanbanViewProps {
  prospects: Etablissement[]
  getProgressInfo: (id: string) => { progress: number; totalTasks: number; completedTasks: number; potentialValue?: number }
  onEdit: (prospect: Etablissement) => void
  onDelete: (id: string) => void
}

const KANBAN_COLUMNS = [
  { id: 'Prospect', label: 'Prospects', color: 'bg-slate-500' },
  { id: 'Contacté', label: 'Contactés', color: 'bg-sky-500' },
  { id: 'Attente RDV', label: 'Attente RDV', color: 'bg-blue-500' },
  { id: 'RDV pris', label: 'RDV pris', color: 'bg-cyan-500' },
  { id: 'Attente post RDV', label: 'Attente post RDV', color: 'bg-indigo-500' },
  { id: 'Dans les RDV', label: 'Dans les RDV', color: 'bg-violet-500' },
  { id: 'Etude émise', label: 'Étude émise', color: 'bg-amber-500' },
  { id: 'Dans les RDV post EME', label: 'Post EME', color: 'bg-purple-500' },
  { id: 'Négociation', label: 'Négociation', color: 'bg-emerald-500' },
  { id: 'Contractualisation', label: 'Contractualisation', color: 'bg-green-600' },
]

export function ProspectsKanbanView({
  prospects,
  getProgressInfo,
  onEdit,
  onDelete
}: ProspectsKanbanViewProps) {
  const navigate = useNavigate()

  const getProspectsByStatus = (status: string) => {
    return prospects.filter(p => p.statut === status)
  }

  const getTotalValue = (prospects: Etablissement[]) => {
    return prospects.reduce((sum, p) => sum + (getProgressInfo(p.id).potentialValue || 0), 0)
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {KANBAN_COLUMNS.map((column) => {
          const columnProspects = getProspectsByStatus(column.id)
          const totalValue = getTotalValue(columnProspects)
          
          return (
            <div 
              key={column.id}
              className="w-[300px] flex-shrink-0 flex flex-col"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", column.color)} />
                  <h3 className="font-semibold text-sm">{column.label}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {columnProspects.length}
                  </Badge>
                </div>
                {totalValue > 0 && (
                  <span className="text-xs text-muted-foreground font-medium">
                    {formatCurrency(totalValue)}
                  </span>
                )}
              </div>

              {/* Column Content */}
              <div className="flex-1 space-y-3 bg-muted/30 rounded-lg p-2 min-h-[400px]">
                {columnProspects.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                    Aucun prospect
                  </div>
                ) : (
                  columnProspects.map((prospect, index) => {
                    const progressInfo = getProgressInfo(prospect.id)
                    
                    return (
                      <Card 
                        key={prospect.id}
                        className="cursor-pointer hover:shadow-md transition-all duration-200 animate-in fade-in-50 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{ animationDelay: `${index * 30}ms` }}
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
                        <CardContent className="p-3 space-y-3">
                          {/* Header: Avatar + Name + Menu */}
                          <div className="flex items-start gap-2">
                            <EntityAvatar
                              name={prospect.nom}
                              logoUrl={prospect.logo_url || (prospect as any).groupe_logo_url}
                              size="sm"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                {prospect.nom}
                              </h4>
                              <p className="text-xs text-muted-foreground truncate">
                                {prospect.type}
                              </p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label="Plus d'options"
                                  title="Plus d'options"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(`/etablissements/${prospect.id}`)
                                }}>
                                  Voir la fiche
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
                                  className="text-destructive"
                                >
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Location */}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{prospect.ville}, {prospect.region}</span>
                          </div>

                          {/* Commercial */}
                          {prospect.commercial && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span className="truncate">
                                {prospect.commercial.prenom} {prospect.commercial.nom}
                              </span>
                            </div>
                          )}

                          {/* Progress */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Progression</span>
                              <span className="font-medium tabular-nums">{Math.round(progressInfo.progress)}%</span>
                            </div>
                            <Progress value={progressInfo.progress} className="h-1.5" />
                          </div>

                          {/* Value */}
                          {progressInfo.potentialValue && progressInfo.potentialValue > 0 && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <TrendingUp className="h-3 w-3 text-success" />
                              <span className="font-medium text-success">
                                {formatCurrency(progressInfo.potentialValue)}
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}