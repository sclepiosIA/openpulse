import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Toggle } from '@/components/ui/toggle'
import { useSupportTickets, SupportTicket } from '@/hooks/support/useSupportTickets'
import { useAuth } from '@/components/AuthProvider'
import {
  Search,
  Plus,
  Building2,
  AlertTriangle,
  Clock,
  User,
  Globe,
  ChevronRight,
  UserCheck,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface SupportTicketListProps {
  selectedTicketId: string | null
  onSelectTicket: (ticketId: string) => void
  onClearSelection?: () => void
  onCreateTicket: () => void
}

const statusConfig: Record<string, { label: string; color: string }> = {
  nouveau: { label: 'Nouveau', color: 'bg-blue-500' },
  en_cours: { label: 'En cours', color: 'bg-amber-500' },
  en_attente_client: { label: 'Attente client', color: 'bg-orange-500' },
  en_attente_interne: { label: 'Attente interne', color: 'bg-purple-500' },
  resolu: { label: 'Résolu', color: 'bg-green-500' },
  ferme: { label: 'Fermé', color: 'bg-muted-foreground' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  basse: { label: 'Basse', color: 'text-muted-foreground' },
  moyenne: { label: 'Moyenne', color: 'text-blue-500' },
  haute: { label: 'Haute', color: 'text-orange-500' },
  critique: { label: 'Critique', color: 'text-red-500' },
}

export function SupportTicketList({
  selectedTicketId,
  onSelectTicket,
  onClearSelection,
  onCreateTicket,
}: SupportTicketListProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('tous')
  const [priorityFilter, setPriorityFilter] = useState('toutes')
  const [origineFilter, setOrigineFilter] = useState<'tous' | 'portail' | 'interne'>('tous')
  const [mineOnly, setMineOnly] = useState(false)
  const { user } = useAuth()

  const {
    data: tickets,
    isLoading,
    isError,
    error,
    refetch,
  } = useSupportTickets({
    statut: statusFilter,
    priorite: priorityFilter,
    origine: origineFilter,
    assigne_a: mineOnly && user?.id ? user.id : undefined,
  })

  const filteredTickets = useMemo(
    () =>
      tickets?.filter((ticket) => {
        if (!search) return true
        const searchLower = search.toLowerCase()
        return (
          ticket.titre.toLowerCase().includes(searchLower) ||
          ticket.numero_ticket.toLowerCase().includes(searchLower) ||
          ticket.contact_email?.toLowerCase().includes(searchLower) ||
          ticket.etablissement?.nom?.toLowerCase().includes(searchLower)
        )
      }),
    [search, tickets]
  )

  const hasActiveFilter =
    search.trim().length > 0 ||
    statusFilter !== 'tous' ||
    priorityFilter !== 'toutes' ||
    origineFilter !== 'tous' ||
    mineOnly

  useEffect(() => {
    if (!selectedTicketId || !onClearSelection || !hasActiveFilter || !filteredTickets) return
    if (!filteredTickets.some((ticket) => ticket.id === selectedTicketId)) {
      onClearSelection()
    }
  }, [filteredTickets, hasActiveFilter, onClearSelection, selectedTicketId])

  return (
    <Card className="h-full flex flex-col border-primary/10 bg-card/80 backdrop-blur-sm shadow-lg">
      <CardHeader className="pb-3 border-b border-primary/10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Tickets Support</CardTitle>
          <Button size="sm" onClick={onCreateTicket} className="h-8 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-1" />
            Nouveau
          </Button>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-muted/30 border-primary/10 focus:border-primary/30 rounded-lg"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            {/* `role="combobox"` ne tire pas son nom accessible de son contenu :
                sans aria-label, axe remonte `button-name` (critical). */}
            <SelectTrigger
              aria-label="Filtre statut"
              className="h-8 w-[130px] bg-muted/30 border-primary/10 rounded-lg text-xs"
            >
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous statuts</SelectItem>
              <SelectItem value="nouveau">Nouveau</SelectItem>
              <SelectItem value="en_cours">En cours</SelectItem>
              <SelectItem value="en_attente_client">Attente client</SelectItem>
              <SelectItem value="en_attente_interne">Attente interne</SelectItem>
              <SelectItem value="resolu">Résolu</SelectItem>
              <SelectItem value="ferme">Fermé</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger
              aria-label="Filtre priorité"
              data-testid="support-priority-filter"
              className="h-8 w-[130px] bg-muted/30 border-primary/10 rounded-lg text-xs"
            >
              <SelectValue placeholder="Priorité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toutes">Toutes priorités</SelectItem>
              <SelectItem value="critique" data-testid="support-priority-urgent">
                Urgent (critique)
              </SelectItem>
              <SelectItem value="haute">Haute</SelectItem>
              <SelectItem value="moyenne">Moyenne</SelectItem>
              <SelectItem value="basse">Basse</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={origineFilter}
            onValueChange={(v) => setOrigineFilter(v as typeof origineFilter)}
          >
            <SelectTrigger
              aria-label="Filtre origine"
              className="h-8 w-[110px] bg-muted/30 border-primary/10 rounded-lg text-xs"
            >
              <SelectValue placeholder="Origine" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Toutes origines</SelectItem>
              <SelectItem value="portail">Portail client</SelectItem>
              <SelectItem value="interne">Interne</SelectItem>
            </SelectContent>
          </Select>

          <Toggle
            pressed={mineOnly}
            onPressedChange={setMineOnly}
            variant="outline"
            size="sm"
            aria-label={
              mineOnly ? 'Afficher tous les tickets' : "Filtrer pour n'afficher que mes tickets"
            }
            title="Filtre Mes tickets"
            className="h-8 gap-1.5 text-xs whitespace-nowrap data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
          >
            <UserCheck className="h-3.5 w-3.5" />
            Mes tickets
          </Toggle>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={`support-ticket-list-skeleton-${i}`} className="h-20 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-muted-foreground space-y-3">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
              <p className="font-medium text-foreground">Impossible de charger les tickets</p>
              <p className="text-sm">{(error as Error)?.message ?? 'Erreur inconnue'}</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                Réessayer
              </Button>
            </div>
          ) : filteredTickets?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground space-y-3">
              <p>Aucun ticket trouvé</p>
              <Button size="sm" onClick={onCreateTicket} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Créer un ticket
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {filteredTickets?.map((ticket) => (
                <TicketListItem
                  key={ticket.id}
                  ticket={ticket}
                  isSelected={ticket.id === selectedTicketId}
                  onClick={() => onSelectTicket(ticket.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function TicketListItem({
  ticket,
  isSelected,
  onClick,
}: {
  ticket: SupportTicket
  isSelected: boolean
  onClick: () => void
}) {
  const status = statusConfig[ticket.statut] || statusConfig.nouveau
  const priority = priorityConfig[ticket.priorite] || priorityConfig.moyenne

  return (
    <button
      onClick={onClick}
      aria-label={`Voir le détail du ticket ${ticket.numero_ticket} — ${ticket.titre}`}
      title="Voir le détail"
      className={cn(
        'group w-full text-left p-4 transition-all duration-200 cursor-pointer',
        isSelected
          ? 'bg-primary/10 border-l-4 border-l-primary'
          : 'hover:bg-primary/5 border-l-4 border-l-transparent'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{ticket.numero_ticket}</span>
            {ticket.created_via_portal && (
              <Badge
                variant="outline"
                className="text-xs gap-1 border-primary/40 text-primary bg-primary/5"
              >
                <Globe className="h-3 w-3" />
                Portail
              </Badge>
            )}
            <Badge variant="outline" className={cn('text-xs', priority.color)}>
              {priority.label}
            </Badge>
            {ticket.priorite === 'critique' && <AlertTriangle className="h-3 w-3 text-red-500" />}
          </div>

          {/* Title */}
          <h4 className="font-medium text-sm line-clamp-1">{ticket.titre}</h4>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {ticket.etablissement && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {ticket.etablissement.nom}
              </span>
            )}
            {ticket.assigne && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {ticket.assigne.prenom}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(ticket.date_ouverture), {
                addSuffix: true,
                locale: fr,
              })}
            </span>
          </div>
        </div>

        {/* Status badge + chevron */}
        <div className="flex flex-col items-end gap-2 mt-1">
          <div className={cn('w-2 h-2 rounded-full', status.color)} title={status.label} />
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      {ticket.sla_breached && (
        <Badge variant="destructive" className="mt-2 text-xs">
          SLA dépassé
        </Badge>
      )}
    </button>
  )
}
