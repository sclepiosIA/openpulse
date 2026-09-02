import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  useSupportTicketById,
  useSupportTicketComments,
  useUpdateSupportTicket,
  useAssignTicket,
  useAddTicketComment,
} from '@/hooks/support/useSupportTickets'
import { useProfiles } from '@/hooks/profile/useProfiles'
import {
  Building2,
  User,
  Mail,
  Clock,
  CheckCircle,
  MessageSquare,
  ExternalLink,
  Sparkles,
  Send,
  Globe,
  XCircle,
  Lock,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { SafeHtmlContent } from '@/components/forum/SafeHtmlContent'

const HTML_RE = /<\/?[a-z][\s\S]*?>/i

interface SupportTicketDetailProps {
  ticketId: string | null
}

const statusOptions = [
  { value: 'nouveau', label: 'Nouveau' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'en_attente_client', label: 'Attente client' },
  { value: 'en_attente_interne', label: 'Attente interne' },
  { value: 'resolu', label: 'Résolu' },
  { value: 'ferme', label: 'Fermé' },
  { value: 'abandonne', label: 'Abandonné' },
]

const priorityOptions = [
  { value: 'basse', label: 'Basse' },
  { value: 'moyenne', label: 'Moyenne' },
  { value: 'haute', label: 'Haute' },
  { value: 'critique', label: 'Critique' },
]

const typeOptions = [
  { value: 'bug', label: 'Bug' },
  { value: 'question', label: 'Question' },
  { value: 'demande_fonctionnalite', label: 'Demande fonctionnalité' },
  { value: 'performance', label: 'Performance' },
  { value: 'connexion', label: 'Connexion' },
  { value: 'formation', label: 'Formation' },
  { value: 'facturation', label: 'Facturation' },
  { value: 'autre', label: 'Autre' },
]

export function SupportTicketDetail({ ticketId }: SupportTicketDetailProps) {
  const navigate = useNavigate()
  const { data: ticket, isLoading, isError, error, refetch } = useSupportTicketById(ticketId)
  const { data: comments } = useSupportTicketComments(ticketId)
  const { data: profiles } = useProfiles()
  const updateTicket = useUpdateSupportTicket()
  const assignTicket = useAssignTicket()
  const addComment = useAddTicketComment()

  const [newComment, setNewComment] = useState('')
  const [isPublicReply, setIsPublicReply] = useState(false)

  useEffect(() => {
    if (ticket?.created_via_portal) setIsPublicReply(true)
  }, [ticket?.created_via_portal, ticket?.id])

  if (!ticketId) {
    return (
      <Card className="h-full flex items-center justify-center border-primary/10 bg-card/80 backdrop-blur-sm">
        <div className="text-center text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">Sélectionnez un ticket pour voir les détails</p>
        </div>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card className="h-full border-primary/10 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card className="h-full flex items-center justify-center border-destructive/20 bg-card/90">
        <div className="max-w-sm p-6 text-center space-y-3">
          <XCircle className="h-10 w-10 mx-auto text-destructive" />
          <p className="font-medium">Impossible d’ouvrir le ticket</p>
          <p className="text-sm text-muted-foreground">
            {(error as Error)?.message || 'Erreur de chargement'}
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Réessayer
          </Button>
        </div>
      </Card>
    )
  }

  if (!ticket) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p>Ticket non trouvé</p>
        </div>
      </Card>
    )
  }

  const handleStatusChange = (value: string) => {
    const updates: Record<string, unknown> = { statut: value }
    if (value === 'resolu') {
      updates.date_resolution = new Date().toISOString()
    } else if (value === 'ferme' || value === 'abandonne') {
      updates.date_fermeture = new Date().toISOString()
    }
    updateTicket.mutate({ ticketId: ticket.id, updates })
  }

  const handleAssigneeChange = (value: string) => {
    assignTicket.mutate({
      ticketId: ticket.id,
      profileId: value === 'none' ? null : value,
    })
  }

  const handleAddComment = () => {
    if (!newComment.trim()) return
    addComment.mutate({ ticketId: ticket.id, content: newComment, isInternal: !isPublicReply })
    setNewComment('')
  }

  const isClosed = ['resolu', 'ferme', 'abandonne'].includes(ticket.statut)

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono text-muted-foreground mb-1">{ticket.numero_ticket}</p>
            <CardTitle className="text-lg">{ticket.titre}</CardTitle>
          </div>
          {ticket.sla_breached && <Badge variant="destructive">SLA dépassé</Badge>}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden flex flex-col gap-4">
        <ScrollArea className="flex-1">
          <div className="space-y-4 pr-4">
            {/* Bandeau origine portail */}
            {ticket.created_via_portal && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
                <Globe className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-primary">Ticket créé depuis le portail client</p>
                  {ticket.client_portal_user && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Par{' '}
                      <span className="font-medium text-foreground">
                        {[ticket.client_portal_user.prenom, ticket.client_portal_user.nom]
                          .filter(Boolean)
                          .join(' ') || ticket.client_portal_user.email}
                      </span>
                      {ticket.client_portal_user.prenom && (
                        <> — {ticket.client_portal_user.email}</>
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Quick close actions */}
            {!isClosed && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleStatusChange('resolu')}
                  disabled={updateTicket.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Marquer résolu
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm('Abandonner ce ticket ? Il sera fermé sans résolution.')) {
                      handleStatusChange('abandonne')
                    }
                  }}
                  disabled={updateTicket.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1.5" />
                  Abandonner
                </Button>
              </div>
            )}

            {/* Selects */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Statut</label>
                <Select value={ticket.statut} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Priorité</label>
                <Select
                  value={ticket.priorite}
                  onValueChange={(v) =>
                    updateTicket.mutate({
                      ticketId: ticket.id,
                      updates: { priorite: v },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                <Select
                  value={ticket.type_probleme || 'autre'}
                  onValueChange={(v) =>
                    updateTicket.mutate({
                      ticketId: ticket.id,
                      updates: { type_probleme: v },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Assigné à</label>
                <Select value={ticket.assigne_a || 'none'} onValueChange={handleAssigneeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Non assigné" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non assigné</SelectItem>
                    {profiles
                      ?.filter(
                        (profile) =>
                          profile?.id && typeof profile.id === 'string' && profile.id.trim() !== ''
                      )
                      .map((profile) => (
                        <SelectItem key={profile.id} value={profile.id || 'unknown'}>
                          {profile.prenom} {profile.nom}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Description */}
            {ticket.description && (
              <div>
                <h4 className="text-sm font-medium mb-2">Description</h4>
                {HTML_RE.test(ticket.description) ? (
                  <SafeHtmlContent
                    html={ticket.description}
                    className="text-sm text-muted-foreground"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {ticket.description}
                  </p>
                )}
              </div>
            )}

            {/* AI Summary */}
            {ticket.ai_summary && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Résumé IA</span>
                </div>
                <p className="text-sm text-muted-foreground">{ticket.ai_summary}</p>
                {ticket.ai_suggested_solution && (
                  <div className="mt-2 pt-2 border-t border-primary/20">
                    <p className="text-xs font-medium mb-1">Solution suggérée :</p>
                    <p className="text-sm text-muted-foreground">{ticket.ai_suggested_solution}</p>
                  </div>
                )}
              </div>
            )}

            {/* Links */}
            <div className="space-y-2">
              {ticket.etablissement && (
                <Link
                  to={`/etablissements/${ticket.etablissement.id}`}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Building2 className="h-4 w-4" />
                  {ticket.etablissement.nom} - {ticket.etablissement.ville}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
              {ticket.tache && (
                <Link
                  to="/projets"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <CheckCircle className="h-4 w-4" />
                  Tâche liée : {ticket.tache.titre}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
              {ticket.email_thread_id && (
                <Link
                  to={`/emails?thread=${ticket.email_thread_id}`}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Mail className="h-4 w-4" />
                  Voir l'email associé
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>

            {/* Contact Info */}
            {(ticket.contact_nom || ticket.contact_email) && (
              <div className="bg-muted/50 rounded-lg p-3">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contact
                </h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  {ticket.contact_nom && <p>{ticket.contact_nom}</p>}
                  {ticket.contact_email && (
                    <button
                      onClick={() => {
                        const params = new URLSearchParams({
                          compose: 'true',
                          to: ticket.contact_email!,
                        })
                        if (ticket.contact_nom) params.set('toName', ticket.contact_nom)
                        navigate(`/emails?${params.toString()}`)
                      }}
                      className="text-primary hover:underline"
                    >
                      {ticket.contact_email}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Historique
              </h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  Ouvert :{' '}
                  {format(new Date(ticket.date_ouverture), 'dd/MM/yyyy HH:mm', { locale: fr })}
                </p>
                {ticket.date_premiere_reponse && (
                  <p>
                    Première réponse :{' '}
                    {format(new Date(ticket.date_premiere_reponse), 'dd/MM/yyyy HH:mm', {
                      locale: fr,
                    })}
                  </p>
                )}
                {ticket.date_resolution && (
                  <p>
                    Résolu :{' '}
                    {format(new Date(ticket.date_resolution), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                )}
                {ticket.sla_deadline && (
                  <p className={cn(ticket.sla_breached && 'text-red-500')}>
                    SLA :{' '}
                    {format(new Date(ticket.sla_deadline), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Comments */}
            <div>
              <h4 className="text-sm font-medium mb-3">Échanges & notes</h4>
              <div className="space-y-3">
                {comments?.map((comment) => {
                  const isPublic = !comment.is_internal
                  return (
                    <div
                      key={comment.id}
                      className={cn(
                        'rounded-lg p-3 border',
                        isPublic
                          ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900'
                          : 'bg-muted/50 border-transparent'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {comment.author?.prenom} {comment.author?.nom}
                          </span>
                          <Badge
                            variant={isPublic ? 'default' : 'secondary'}
                            className="text-[10px] h-5 gap-1"
                          >
                            {isPublic ? (
                              <>
                                <Globe className="h-3 w-3" /> Visible client
                              </>
                            ) : (
                              <>
                                <Lock className="h-3 w-3" /> Interne
                              </>
                            )}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.created_at), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  )
                })}

                {comments?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun échange pour le moment
                  </p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Add Comment */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="public-reply"
                checked={isPublicReply}
                onCheckedChange={setIsPublicReply}
              />
              <label
                htmlFor="public-reply"
                className="text-xs cursor-pointer flex items-center gap-1.5"
              >
                {isPublicReply ? (
                  <>
                    <Globe className="h-3.5 w-3.5 text-emerald-600" />{' '}
                    <span className="font-medium">Réponse au client</span>{' '}
                    <span className="text-muted-foreground">(visible portail)</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />{' '}
                    <span className="font-medium">Note interne</span>{' '}
                    <span className="text-muted-foreground">(équipe uniquement)</span>
                  </>
                )}
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <Textarea
              placeholder={
                isPublicReply ? 'Rédiger une réponse au client…' : 'Ajouter une note interne…'
              }
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className={cn(
                'min-h-[60px] resize-none',
                isPublicReply && 'border-emerald-300 focus-visible:ring-emerald-500'
              )}
            />
            <Button
              size="icon"
              onClick={handleAddComment}
              disabled={!newComment.trim() || addComment.isPending}
              className={cn(isPublicReply && 'bg-emerald-600 hover:bg-emerald-700 text-white')}
              aria-label="Envoyer"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
