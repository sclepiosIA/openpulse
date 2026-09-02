import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Mail, Star, Phone, MapPin, Calendar, AlertCircle, Sparkles } from 'lucide-react'
import { Partenaire } from '@/hooks/crm/usePartenaires'
import { PartenaireBadge } from '@/components/ui/partenaire-badge'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { PartenaireQuickActions } from './PartenaireQuickActions'

interface EnhancedPartenaireCardProps {
  partenaire: Partenaire
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  onSelect?: (id: string) => void
  isSelected?: boolean
  pendingContactsCount?: number
  showCheckbox?: boolean
}

export function EnhancedPartenaireCard({
  partenaire,
  isFavorite,
  onToggleFavorite,
  onSelect,
  isSelected,
  pendingContactsCount = 0,
  showCheckbox = false,
}: EnhancedPartenaireCardProps) {
  const navigate = useNavigate()

  const getHealthStatus = () => {
    const now = new Date()
    const dernier = partenaire.dernier_contact ? new Date(partenaire.dernier_contact) : null
    const prochaine = partenaire.prochaine_action ? new Date(partenaire.prochaine_action) : null

    const daysSinceContact = dernier
      ? (now.getTime() - dernier.getTime()) / (1000 * 60 * 60 * 24)
      : null
    const actionPassed = prochaine ? prochaine < now : false

    if (actionPassed || (daysSinceContact && daysSinceContact > 60)) {
      return { color: 'border-red-500', status: 'Attention requise' }
    }
    if (daysSinceContact && daysSinceContact > 30) {
      return { color: 'border-orange-500', status: 'À surveiller' }
    }
    return { color: 'border-green-500', status: 'Santé bonne' }
  }

  const health = getHealthStatus()

  const isNew = () => {
    const created = new Date(partenaire.created_at)
    const now = new Date()
    const daysSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceCreation < 30
  }

  const getAccentBorderColor = () => {
    switch (partenaire.statut_relation) {
      case 'actif':
        return 'border-t-emerald-500'
      case 'prospect':
        return 'border-t-blue-500'
      case 'inactif':
        return 'border-t-gray-400'
      case 'termine':
        return 'border-t-red-500'
      default:
        return 'border-t-primary/20'
    }
  }

  const handleCardClick = () => {
    if (!showCheckbox) {
      navigate(`/partenaires/${partenaire.id}`)
    }
  }

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (showCheckbox) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }

  const handleMailClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (partenaire.email) {
      const params = new URLSearchParams({ compose: 'true', to: partenaire.email })
      params.set('toName', partenaire.nom)
      navigate(`/emails?${params.toString()}`)
    }
  }

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (partenaire.telephone) {
      window.location.href = `tel:${partenaire.telephone}`
    }
  }

  return (
    <Card
      className={cn(
        'relative cursor-pointer overflow-hidden group',
        'bg-card/80 backdrop-blur-sm',
        'border border-primary/10 border-t-4',
        'shadow-sm hover:shadow-md',
        'transition-all duration-300 hover:translate-y-[-2px]',
        'animate-fade-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        getAccentBorderColor(),
        isSelected && 'ring-2 ring-primary bg-primary/5'
      )}
      onClick={handleCardClick}
      role={showCheckbox ? undefined : 'button'}
      tabIndex={showCheckbox ? undefined : 0}
      aria-label={showCheckbox ? undefined : `Ouvrir la fiche partenaire ${partenaire.nom}`}
      onKeyDown={handleCardKeyDown}
    >
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        {pendingContactsCount > 0 && (
          <Badge className="bg-primary/10 text-primary flex items-center gap-1" variant="secondary">
            <Sparkles className="h-3 w-3" />
            {pendingContactsCount}
          </Badge>
        )}
        {isNew() && <Badge variant="secondary">Nouveau</Badge>}
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{partenaire.nom}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-2 flex-wrap">
              <PartenaireBadge
                type={partenaire.type_partenaire}
                nom=""
                partenaireId={partenaire.id}
                size="sm"
                showLink={false}
              />
              <Badge
                variant={
                  partenaire.statut_relation === 'actif'
                    ? 'default'
                    : partenaire.statut_relation === 'prospect'
                      ? 'secondary'
                      : partenaire.statut_relation === 'termine'
                        ? 'destructive'
                        : 'outline'
                }
              >
                {partenaire.statut_relation}
              </Badge>
            </CardDescription>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => onToggleFavorite(partenaire.id)}
                    aria-label="Favori"
                  >
                    <Star
                      className={cn('h-4 w-4', isFavorite && 'fill-yellow-500 text-yellow-500')}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Informations clés */}
        <div className="space-y-2 text-sm">
          {partenaire.ville && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {partenaire.ville}
                {partenaire.region && ` • ${partenaire.region}`}
              </span>
            </div>
          )}

          {partenaire.responsable && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="shrink-0">👤</span>
              <span className="truncate">
                {partenaire.responsable.prenom} {partenaire.responsable.nom}
              </span>
            </div>
          )}

          {partenaire.dernier_contact && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="text-xs truncate">
                Dernier contact:{' '}
                {formatDistanceToNow(new Date(partenaire.dernier_contact), {
                  addSuffix: true,
                  locale: fr,
                })}
              </span>
            </div>
          )}

          {partenaire.prochaine_action && (
            <div
              className={cn(
                'flex items-center gap-2',
                new Date(partenaire.prochaine_action) < new Date()
                  ? 'text-red-600'
                  : 'text-muted-foreground'
              )}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-xs truncate">
                Prochaine action:{' '}
                {new Date(partenaire.prochaine_action).toLocaleDateString('fr-FR')}
              </span>
            </div>
          )}
        </div>

        {/* Métriques */}
        <div className="space-y-2 pt-2 border-t">
          {partenaire.valeur_partenariat && partenaire.valeur_partenariat > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Valeur:</span>
              <span className="font-semibold text-purple-600">
                {(partenaire.valeur_partenariat / 1000).toFixed(0)}k€
              </span>
            </div>
          )}

          {partenaire.engagement_score > 0 && (
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-muted-foreground">Engagement:</span>
                <span className="font-medium">{partenaire.engagement_score}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${partenaire.engagement_score}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions rapides */}
        <TooltipProvider>
          <div
            className="flex items-center justify-between pt-2 border-t"
            onClick={(e) => e.stopPropagation()}
          >
            <PartenaireQuickActions partenaireId={partenaire.id} partenaireName={partenaire.nom} />

            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleMailClick}
                    disabled={!partenaire.email}
                    aria-label="E-mail"
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Envoyer email</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handlePhoneClick}
                    disabled={!partenaire.telephone}
                    aria-label="Appeler"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Appeler</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
