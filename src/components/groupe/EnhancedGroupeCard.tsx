import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GroupeBadge } from "@/components/ui/groupe-badge"
import { Groupe } from "@/hooks/crm/useGroupes"
import { Mail, Star, BarChart, TrendingUp, Building2, Activity } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { EntityAvatar } from "@/components/ui/EntityAvatar"
import { differenceInDays } from "date-fns"
import { useUserPreferences } from "@/hooks/profile/useUserPreferences"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GroupeQuickActions } from "./GroupeQuickActions"

interface EnhancedGroupeCardProps {
  groupe: Groupe
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
  showCheckbox?: boolean
  profiles?: Map<string, { email?: string; full_name?: string }>
}

export function EnhancedGroupeCard({ groupe, isSelected, onSelect, showCheckbox, profiles }: EnhancedGroupeCardProps) {
  const navigate = useNavigate()
  const isNew = differenceInDays(new Date(), new Date(groupe.created_at)) <= 30
  const { toggleFavoriteGroupe, isFavoriteGroupe } = useUserPreferences()
  const isFavorite = isFavoriteGroupe(groupe.id)

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await toggleFavoriteGroupe(groupe.id)
  }

  const handleMailClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const emails: string[] = []
    const commercialEmail = groupe.responsable_commercial_id ? profiles?.get(groupe.responsable_commercial_id)?.email : undefined
    const csmEmail = groupe.responsable_csm_id ? profiles?.get(groupe.responsable_csm_id)?.email : undefined
    
    if (commercialEmail) emails.push(commercialEmail)
    if (csmEmail) emails.push(csmEmail)
    
    if (emails.length > 0) {
      const params = new URLSearchParams({ compose: 'true', to: emails.join(',') })
      params.set('toName', `Groupe ${groupe.nom}`)
      navigate(`/emails?${params.toString()}`)
    }
  }

  const handleStatsClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    navigate(`/groupes/${groupe.id}?tab=dashboard`)
  }
  
  const healthColor = groupe.progression_moyenne >= 75 ? 'border-emerald-500' :
                     groupe.progression_moyenne >= 50 ? 'border-orange-500' :
                     'border-red-500'

  const typeColorMap = {
    'GHT': 'border-l-4 border-l-blue-500',
    'Groupe Cliniques': 'border-l-4 border-l-purple-500',
    'Consortium': 'border-l-4 border-l-indigo-500',
    'Autre': 'border-l-4 border-l-gray-500'
  }

  const handleCardClick = () => {
    navigate(`/groupes/${groupe.id}`)
  }

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }

  return (
    <Card
      className={`hover:shadow-lg transition-all cursor-pointer h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${typeColorMap[groupe.type]} ${healthColor} border-2 ${isSelected ? 'ring-2 ring-primary' : ''}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-label={`Ouvrir la fiche groupe ${groupe.nom}`}
      onKeyDown={handleCardKeyDown}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          {showCheckbox && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              onClick={(e) => e.stopPropagation()}
              className="mt-1"
              aria-label={`Sélectionner ${groupe.nom}`}
            />
          )}
          <div className="flex items-start gap-3 flex-1 min-w-0 overflow-hidden">
            <EntityAvatar
              name={groupe.nom}
              logoUrl={groupe.logo_url}
              size="md"
              className="shrink-0"
            />
            <div className="flex-1 min-w-0 w-0">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-xl truncate flex-1 min-w-0">{groupe.nom}</CardTitle>
                {isNew && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    Nouveau
                  </Badge>
                )}
              </div>
              <GroupeBadge type={groupe.type} className="mb-2" />
              <CardDescription className="truncate">
                {groupe.ville_siege && groupe.region 
                  ? `${groupe.ville_siege}, ${groupe.region}`
                  : groupe.region || 'Non spécifié'}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Statistiques principales */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Établissements</p>
              <p className="text-sm font-bold">{groupe.nombre_etablissements}</p>
            </div>
          </div>
          
          {groupe.total_passages_urgences_annuel && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Passages/an</p>
                <p className="text-sm font-bold">{groupe.total_passages_urgences_annuel.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Progression avec mini-graphique */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Progression
            </span>
            <span className="text-sm font-bold">{groupe.progression_moyenne.toFixed(1)}%</span>
          </div>
          <Progress value={groupe.progression_moyenne} className="h-2" />
        </div>

        {/* Modules déployés */}
        {groupe.modules_deployes && groupe.modules_deployes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Modules déployés</p>
            <div className="flex flex-wrap gap-1">
              {groupe.modules_deployes.slice(0, 3).map((module) => (
                <Tooltip key={module}>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs cursor-default">
                      {module}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Module {module} déployé</p>
                  </TooltipContent>
                </Tooltip>
              ))}
              {groupe.modules_deployes.length > 3 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-xs cursor-default">
                      +{groupe.modules_deployes.length - 3}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{groupe.modules_deployes.slice(3).join(', ')}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        )}

        {/* Responsables */}
        {(groupe.responsable_commercial_id || groupe.responsable_csm_id) && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
              {groupe.responsable_commercial_id ? 'C' : 'CSM'}
            </div>
            <span className="text-xs text-muted-foreground">
              {groupe.responsable_commercial_id && groupe.responsable_csm_id ? 'Commercial & CSM assignés' :
               groupe.responsable_commercial_id ? 'Commercial assigné' : 'CSM assigné'}
            </span>
          </div>
        )}

        {/* Actions rapides */}
        <TooltipProvider>
          <div className="flex items-center justify-end gap-1 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
            {/* Quick Actions (Notes, Tasks, Activities) */}
            <GroupeQuickActions 
              groupeId={groupe.id} 
              groupeNom={groupe.nom}
              currentNotes={groupe.notes}
            />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleMailClick}
                  disabled={!groupe.responsable_commercial_id && !groupe.responsable_csm_id}
                  aria-label="Envoyer un email"
                >
                  <Mail className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Envoyer un email</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleToggleFavorite}
                  className={isFavorite ? 'text-yellow-500' : ''}
                  aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleStatsClick}
                  aria-label="Voir les statistiques"
                >
                  <BarChart className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Voir les statistiques</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
