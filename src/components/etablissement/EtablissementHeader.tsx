import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, ChevronRight, Home, ChevronDown, Check, TrendingUp, CheckCircle2, Users, Circle, Clock, AlertTriangle, Sparkles, CheckCircle, XCircle } from "lucide-react"
import { Link } from "react-router-dom"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { QuickActionsBar } from "@/components/etablissement/QuickActionsBar"
import { NotificationsBell } from "@/components/notifications/NotificationsBell"
import { GlobalSearchDialog } from "@/components/search/GlobalSearchDialog"
import { EntityAvatar } from "@/components/ui/EntityAvatar"
import { useGroupesForEtablissement } from "@/hooks/crm/useEtablissementGroupes"
import { useUpdateEtablissement } from "@/hooks/crm/useEtablissements"
import { PHASE_GROUPS } from "@/config/phases"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { TasksBreakdown } from "@/hooks/analytics/useTasksBreakdown"
import type { AISuggestion } from "@/hooks/ai/useAISuggestions"
import { FavoriteButton } from "@/components/views/FavoriteButton"

interface AISuggestionsHeaderProps {
  suggestions: AISuggestion[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  isApproving?: boolean
  isRejecting?: boolean
}

interface EtablissementHeaderProps {
  etablissement: {
    id: string
    nom: string
    ville: string
    region: string
    statut: string
    logo_url?: string | null
    enrichment_status?: string | null
    enrichment_at?: string | null
    commercial?: { id: string; prenom: string | null; nom: string | null } | null
    chef_projet?: { id: string; prenom: string | null; nom: string | null } | null
    csm?: { id: string; prenom: string | null; nom: string | null } | null
  }
  onEdit: () => void
  progression?: number
  tasksCompleted?: number
  tasksTotal?: number
  tasksBreakdown?: TasksBreakdown | null
  upcomingDeadlines?: number
  tasksStatusBreakdown?: { aFaire: number; enCours: number; bloque: number; termine: number }
  groupeId?: string
  onNavigate?: (tab: string, options?: { phase?: string }) => void
  // AI Suggestions
  aiSuggestions?: AISuggestion[]
  onApproveSuggestion?: (id: string) => void
  onRejectSuggestion?: (id: string) => void
  isApprovingSuggestion?: boolean
  isRejectingSuggestion?: boolean
}

const HORS_PIPELINE_STATUTS = ['Suspendu', 'Refus', 'Reporté']

const PHASE_SECTIONS = [
  { key: 'commercial' as const, label: 'Commercial', statuts: PHASE_GROUPS.commercial.statuts },
  { key: 'deploiement' as const, label: 'Déploiement', statuts: PHASE_GROUPS.deploiement.statuts },
  { key: 'production' as const, label: 'Production', statuts: PHASE_GROUPS.production.statuts },
  { key: 'hors_pipeline', label: 'Hors pipeline', statuts: HORS_PIPELINE_STATUTS },
]

const PHASE_DISPLAY = [
  { key: 'commercial', label: 'Commercial', color: 'bg-amber-500' },
  { key: 'contractuel', label: 'Contractuel', color: 'bg-orange-500' },
  { key: 'conformite', label: 'Conformité', color: 'bg-warning' },
  { key: 'deploiement', label: 'Déploiement', color: 'bg-primary' },
  { key: 'formation', label: 'Formation', color: 'bg-accent' },
  { key: 'golive', label: 'Go-Live', color: 'bg-emerald-500' },
  { key: 'production', label: 'Production', color: 'bg-success' },
] as const

function getInitials(prenom: string | null, nom: string | null) {
  return `${(prenom || '')[0] || ''}${(nom || '')[0] || ''}`.toUpperCase()
}

function getFullName(prenom: string | null, nom: string | null) {
  return [prenom, nom].filter(Boolean).join(' ') || 'Non assigné'
}

function getActionLabel(type: string) {
  switch (type) {
    case 'update_task': return "Mise à jour tâche"
    case 'create_task': return "Création tâche"
    case 'change_status': return "Changement statut"
    case 'update_summary': return "MAJ résumé"
    case 'send_email_response': return "Réponse email"
    case 'schedule_follow_up': return "Suivi planifié"
    default: return "Action IA"
  }
}

function getActionDescription(suggestion: AISuggestion) {
  const data = suggestion.action_data as Record<string, string | undefined>
  switch (suggestion.action_type) {
    case 'update_task': return `Marquer "${data.title || 'tâche'}" → ${data.new_status || data.status}`
    case 'create_task': return `Créer: ${data.title}`
    case 'change_status': return `Statut → "${data.new_status}"`
    case 'update_summary': return "MAJ résumé des échanges"
    case 'send_email_response': return `${data.subject?.substring(0, 50)}...`
    case 'schedule_follow_up': return `${data.follow_up_reason || data.title}`
    default: return data.title || "Action suggérée"
  }
}

function AISuggestionsPopoverContent({ suggestions, onApprove, onReject, isApproving, isRejecting }: AISuggestionsHeaderProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          Suggestions IA
        </h4>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {suggestions.length}
        </Badge>
      </div>
      <ScrollArea className="max-h-[320px]">
        <div className="space-y-1.5 pr-2">
          {suggestions.map((s) => {
            const confidence = Math.round(s.confidence_score * 100)
            return (
              <div key={s.id} className="rounded-lg border bg-card p-2.5 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{getActionLabel(s.action_type)}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{getActionDescription(s)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0 tabular-nums">
                    {confidence}%
                  </Badge>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="h-6 text-[11px] px-2 flex-1"
                    onClick={() => onApprove(s.id)}
                    disabled={isApproving || isRejecting}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Appliquer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[11px] px-2"
                    onClick={() => onReject(s.id)}
                    disabled={isApproving || isRejecting}
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Ignorer
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

export function EtablissementHeader({ 
  etablissement, 
  onEdit, 
  progression, 
  tasksCompleted, 
  tasksTotal,
  tasksBreakdown,
  upcomingDeadlines,
  tasksStatusBreakdown,
  onNavigate,
  aiSuggestions,
  onApproveSuggestion,
  onRejectSuggestion,
  isApprovingSuggestion,
  isRejectingSuggestion,
}: EtablissementHeaderProps) {
  const { data: groupes } = useGroupesForEtablissement(etablissement.id)
  const updateEtablissement = useUpdateEtablissement()
  
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [pendingStatut, setPendingStatut] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  
  const effectiveLogoUrl = etablissement.logo_url || groupes?.[0]?.groupe?.logo_url || null
  const groupeNom = groupes?.[0]?.groupe?.nom

  const handleStatutSelect = (statut: string) => {
    if (statut === etablissement.statut) return
    setPopoverOpen(false)
    setPendingStatut(statut)
    setConfirmOpen(true)
  }

  const handleConfirm = async () => {
    if (!pendingStatut) return
    await updateEtablissement.mutateAsync({
      id: etablissement.id,
      data: { statut: pendingStatut } as any
    })
    setPendingStatut(null)
    setConfirmOpen(false)
  }

  const getStatutBadgeClasses = (statut: string) => {
    switch (statut) {
      case "Contractuel":
        return "bg-gradient-to-r from-amber-500/20 to-amber-500/5 border border-amber-500/30 text-amber-700 dark:text-amber-300 backdrop-blur-sm shadow-sm"
      case "Conformité":
        return "bg-gradient-to-r from-warning/20 to-warning/5 border border-warning/30 text-warning-foreground backdrop-blur-sm shadow-sm"
      case "Déploiement":
        return "bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 text-primary backdrop-blur-sm shadow-sm"
      case "Formation":
        return "bg-gradient-to-r from-accent/20 to-accent/5 border border-accent/30 text-accent-foreground backdrop-blur-sm shadow-sm"
      case "Go-Live":
      case "Production":
        return "bg-gradient-to-r from-success/20 to-success/5 border border-success/30 text-success backdrop-blur-sm shadow-sm"
      default:
        return ""
    }
  }

  // Team members
  const teamMembers = [
    { role: 'Commercial', member: etablissement.commercial },
    { role: 'Chef de projet', member: etablissement.chef_projet },
    { role: 'CSM', member: etablissement.csm },
  ]
  const teamCount = teamMembers.filter(t => t.member).length

  const pendingSuggestions = aiSuggestions?.filter(s => s.status === 'pending') || []

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <div className="bg-gradient-to-r from-primary/5 to-transparent rounded-xl p-2 backdrop-blur-sm flex items-center gap-2">
        <Breadcrumb className="flex-1 min-w-0">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/dashboard" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Home className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="hidden sm:inline">Accueil</span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="w-4 h-4 text-primary/40" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/etablissements" className="hover:text-primary transition-colors">Établissements</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="w-4 h-4 text-primary/40" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold text-foreground truncate">{etablissement.nom}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="hidden md:flex items-center gap-1 shrink-0">
          <NotificationsBell />
          <GlobalSearchDialog />
        </div>
      </div>

      {/* Header principal */}
      <div className="flex items-start gap-4">
        <EntityAvatar
          name={etablissement.nom}
          logoUrl={effectiveLogoUrl}
          size="xl"
          className="flex-shrink-0"
        />
        
        <div className="flex-1 min-w-0">
          {/* Ligne 1: Nom + Badge statut + indicateurs + actions */}
          <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold truncate">{etablissement.nom}</h1>
              
              {/* Badge statut cliquable */}
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <button type="button" className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-full">
                    <Badge
                      className={cn(
                        getStatutBadgeClasses(etablissement.statut),
                        "cursor-pointer hover:opacity-80 transition-opacity gap-1 pr-1.5"
                      )}
                    >
                      {etablissement.statut}
                      <ChevronDown className="w-3 h-3" />
                    </Badge>
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  align="start" 
                  className="w-56 p-1 z-50 bg-popover border border-border shadow-lg"
                >
                  {PHASE_SECTIONS.map((section, sectionIdx) => (
                    <div key={section.key}>
                      {sectionIdx > 0 && <Separator className="my-1" />}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {section.label}
                      </div>
                      {section.statuts.map((statut) => (
                        <button
                          key={statut}
                          type="button"
                          onClick={() => handleStatutSelect(statut)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left",
                            statut === etablissement.statut && "font-medium text-primary"
                          )}
                        >
                          <Check className={cn(
                            "w-3.5 h-3.5 flex-shrink-0",
                            statut === etablissement.statut ? "opacity-100" : "opacity-0"
                          )} />
                          {statut}
                        </button>
                      ))}
                    </div>
                  ))}
                </PopoverContent>
              </Popover>

              {/* Indicateurs compacts interactifs - desktop */}
              <div className="hidden md:flex items-center gap-1.5">
                <span className="w-px h-5 bg-border" />

                {/* Progression Popover avec micro barre */}
                {progression !== undefined && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button 
                        type="button"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors text-sm cursor-pointer"
                      >
                        <TrendingUp className="w-3.5 h-3.5 text-primary" />
                        <span className="font-semibold text-foreground">{progression}%</span>
                        <div className="w-[48px] bg-secondary rounded-full h-[3px] overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progression}%` }} />
                        </div>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-72 p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Progression globale</h4>
                          <span className="text-lg font-bold text-primary">{progression}%</span>
                        </div>
                        <Progress value={progression} className="h-2" />
                        
                        {tasksBreakdown && (
                          <>
                            <Separator />
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Par phase</p>
                              {PHASE_DISPLAY.map(phase => {
                                const data = tasksBreakdown[phase.key as keyof TasksBreakdown]
                                if (!data || data.total === 0) return null
                                const pct = Math.round((data.completed / data.total) * 100)
                                return (
                                  <button
                                    key={phase.key}
                                    type="button"
                                    onClick={() => onNavigate?.('taches', { phase: phase.key })}
                                    className="w-full flex items-center gap-2 hover:bg-muted/50 rounded-md px-1.5 py-1 transition-colors text-left"
                                  >
                                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0", phase.color)} />
                                    <span className="text-xs flex-1 truncate">{phase.label}</span>
                                    <span className="text-xs text-muted-foreground">{data.completed}/{data.total}</span>
                                    <div className="w-12 bg-secondary rounded-full h-1.5 overflow-hidden">
                                      <div className={cn("h-full rounded-full", phase.color)} style={{ width: `${pct}%` }} />
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {/* Tâches Popover */}
                {tasksTotal !== undefined && tasksCompleted !== undefined && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button 
                        type="button"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/5 hover:bg-success/10 transition-colors text-sm cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        <span className="font-semibold text-foreground">{tasksCompleted}/{tasksTotal}</span>
                        <span className="text-muted-foreground hidden sm:inline">tâches</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-4">
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold">Répartition des tâches</h4>
                        {tasksStatusBreakdown && (
                          <div className="space-y-1.5">
                            {[
                              { label: 'À faire', count: tasksStatusBreakdown.aFaire, icon: Circle, color: 'text-blue-500', bg: 'bg-blue-500' },
                              { label: 'En cours', count: tasksStatusBreakdown.enCours, icon: Clock, color: 'text-orange-500', bg: 'bg-orange-500' },
                              { label: 'Bloqué', count: tasksStatusBreakdown.bloque, icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive' },
                              { label: 'Terminé', count: tasksStatusBreakdown.termine, icon: CheckCircle2, color: 'text-success', bg: 'bg-success' },
                            ].map(item => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => onNavigate?.('kanban')}
                                className="w-full flex items-center gap-2.5 hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors text-left"
                              >
                                <item.icon className={cn("w-4 h-4 flex-shrink-0", item.color)} />
                                <span className="text-sm flex-1">{item.label}</span>
                                <span className="text-sm font-semibold">{item.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {upcomingDeadlines !== undefined && upcomingDeadlines > 0 && (
                          <>
                            <Separator />
                            <div className="flex items-center gap-2 text-xs text-warning">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{upcomingDeadlines} échéance{upcomingDeadlines > 1 ? 's' : ''} cette semaine</span>
                            </div>
                          </>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {/* Équipe Popover */}
                {teamCount > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button 
                        type="button"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-accent/30 transition-colors text-sm cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-semibold text-foreground">{teamCount}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-4">
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold">Équipe assignée</h4>
                        <div className="space-y-2">
                          {teamMembers.map(({ role, member }) => (
                            <div key={role} className="flex items-center gap-2.5">
                              <Avatar className="w-7 h-7">
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                                  {member ? getInitials(member.prenom, member.nom) : '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {member ? getFullName(member.prenom, member.nom) : 'Non assigné'}
                                </p>
                                <p className="text-xs text-muted-foreground">{role}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {/* Suggestions IA Popover */}
                {pendingSuggestions.length > 0 && onApproveSuggestion && onRejectSuggestion && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button 
                        type="button"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/5 hover:bg-purple-500/10 transition-colors text-sm cursor-pointer relative"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span className="font-semibold text-foreground">{pendingSuggestions.length}</span>
                        <span className="text-muted-foreground hidden lg:inline">IA</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-3">
                      <AISuggestionsPopoverContent
                        suggestions={pendingSuggestions}
                        onApprove={onApproveSuggestion}
                        onReject={onRejectSuggestion}
                        isApproving={isApprovingSuggestion}
                        isRejecting={isRejectingSuggestion}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {/* Spacer to push actions right */}
              <div className="flex-1" />

              {/* Actions inline */}
              <FavoriteButton
                item={{
                  id: etablissement.id,
                  type: 'etablissement',
                  title: etablissement.nom,
                  subtitle: [etablissement.ville, etablissement.region].filter(Boolean).join(' · '),
                  url: `/etablissements/${etablissement.id}`,
                }}
              />
              <QuickActionsBar
                onEdit={onEdit}
                etablissementNom={etablissement.nom}
                etablissementId={etablissement.id}
                enrichmentStatus={etablissement.enrichment_status ?? undefined}
                enrichmentAt={etablissement.enrichment_at ?? undefined}
              />
            </div>

            {/* Ligne 2: Localisation + Groupe */}
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-muted-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{etablissement.ville}, {etablissement.region}</span>
              </p>
              {groupeNom && (
                <>
                  <span className="w-px h-4 bg-border hidden sm:block" />
                  <Link 
                    to={`/groupes`}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    <span className="font-medium">{groupeNom}</span>
                  </Link>
                </>
              )}
            </div>

            {/* Indicateurs mobiles - en dessous */}
            <div className="flex md:hidden items-center gap-2 mt-2 flex-wrap">
              {progression !== undefined && (
                <Badge variant="secondary" className="gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {progression}%
                </Badge>
              )}
              {tasksTotal !== undefined && tasksCompleted !== undefined && (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {tasksCompleted}/{tasksTotal}
                </Badge>
              )}
              {teamCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Users className="w-3 h-3" />
                  {teamCount}
                </Badge>
              )}
              {pendingSuggestions.length > 0 && onApproveSuggestion && onRejectSuggestion && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button">
                      <Badge variant="secondary" className="gap-1 cursor-pointer bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300">
                        <Sparkles className="w-3 h-3" />
                        {pendingSuggestions.length} IA
                      </Badge>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-80 p-3">
                    <AISuggestionsPopoverContent
                      suggestions={pendingSuggestions}
                      onApprove={onApproveSuggestion}
                      onReject={onRejectSuggestion}
                      isApproving={isApprovingSuggestion}
                      isRejecting={isRejectingSuggestion}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Changer le statut"
        description={`Voulez-vous changer le statut de "${etablissement.nom}" de "${etablissement.statut}" vers "${pendingStatut}" ?`}
        confirmText="Confirmer"
        onConfirm={handleConfirm}
        loading={updateEtablissement.isPending}
      />
    </div>
  )
}
