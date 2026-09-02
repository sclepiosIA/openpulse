import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, User, Archive, ArchiveRestore, CheckCircle2, Clock, AlertTriangle, Circle } from "lucide-react"
import { type TachePartenaire } from "@/hooks/tasks/useTachesPartenaire"

interface PartenaireTacheCardProps {
  tache: TachePartenaire
  onStatusChange: (id: string, status: 'A faire' | 'En cours' | 'Bloqué' | 'Terminé') => void
  onArchive: (id: string, isArchived: boolean) => void
}

const getTaskStatusIcon = (statut: string) => {
  switch (statut) {
    case "Terminé":
      return <CheckCircle2 className="w-4 h-4 text-success" />
    case "En cours":
      return <Clock className="w-4 h-4 text-primary" />
    case "Bloqué":
      return <AlertTriangle className="w-4 h-4 text-destructive" />
    default:
      return <Circle className="w-4 h-4 text-muted-foreground" />
  }
}

const getPriorityBadge = (priorite: string) => {
  switch (priorite) {
    case "high":
      return <Badge variant="destructive">Haute</Badge>
    case "medium":
      return <Badge variant="default">Moyenne</Badge>
    case "low":
      return <Badge variant="secondary">Basse</Badge>
    default:
      return <Badge variant="outline">{priorite}</Badge>
  }
}

export function PartenaireTacheCard({ tache, onStatusChange, onArchive }: PartenaireTacheCardProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {getTaskStatusIcon(tache.statut)}
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{tache.titre}</h4>
                {getPriorityBadge(tache.priorite)}
                {tache.archive && (
                  <Badge variant="outline" className="text-xs bg-muted">
                    <Archive className="w-3 h-3 mr-1" />
                    Archivé
                  </Badge>
                )}
                {tache.categories_taches && (
                  <Badge variant="outline" className="text-xs">
                    {tache.categories_taches.nom}
                  </Badge>
                )}
              </div>
              
              {tache.description && (
                <p className="text-sm text-muted-foreground">{tache.description}</p>
              )}
              
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <Select
                    value={tache.statut}
                    onValueChange={(value) => onStatusChange(tache.id, value as 'A faire' | 'En cours' | 'Bloqué' | 'Terminé')}
                  >
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A faire">À faire</SelectItem>
                      <SelectItem value="En cours">En cours</SelectItem>
                      <SelectItem value="Bloqué">Bloqué</SelectItem>
                      <SelectItem value="Terminé">Terminé</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {tache.echeance && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(tache.echeance).toLocaleDateString('fr-FR')}</span>
                    </div>
                  )}
                  
                  {tache.responsable_profile && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span>{tache.responsable_profile.prenom} {tache.responsable_profile.nom}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onArchive(tache.id, tache.archive)}
                    title={tache.archive ? "Désarchiver" : "Archiver"}
                  >
                    {tache.archive ? (
                      <ArchiveRestore className="w-4 h-4" />
                    ) : (
                      <Archive className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
