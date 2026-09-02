import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  CommandDialog,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import {
  Search,
  Building2,
  Mail,
  CheckSquare,
  Users,
  Briefcase,
  FileText,
  Loader2,
  Plus,
  Beaker,
  ListTodo,
  Handshake,
  MessageSquare,
  MessageSquarePlus,
  Headphones,
  Calendar,
  Sparkles,
  Inbox,
  Target,
  Rocket,
  Factory,
  Map,
  Wallet,
  Bot,
  Receipt,
  FileSignature,
  GraduationCap,
  BookOpen,
  LayoutDashboard,
  Workflow,
  UserPlus,
  BriefcaseBusiness,
  MessagesSquare,
  Share2,
  Package,
  CreditCard,
  Undo2,
  MailPlus,
  Send,
  CalendarCheck,
  CalendarRange,
  FileCode2,
  BookMarked,
  Layers,
  CalendarDays,
  CalendarOff,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  StickyNote,
  ClipboardCheck,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { useGlobalSearch, type SearchResult } from '@/hooks/search/useGlobalSearch'
import { AISearchOverview } from './AISearchOverview'
import { cn } from '@/lib/utils'
import { useJarvisUnified } from '@/contexts/JarvisUnifiedContext'
import { useFavorites } from '@/hooks/views/useFavorites'
import { Star } from 'lucide-react'

// Actions rapides organisées par sections
const quickActionsSections = [
  {
    title: 'Créer',
    actions: [
      {
        id: 'new-etablissement',
        label: 'Nouvel établissement',
        icon: Plus,
        href: '/etablissements?new=true',
      },
      { id: 'new-task', label: 'Nouvelle tâche', icon: CheckSquare, href: '/projets?new=true' },
      { id: 'new-email', label: 'Composer un email', icon: Mail, href: '/emails?compose=true' },
      {
        id: 'new-pulse',
        label: 'Nouvelle discussion Pulse',
        icon: MessageSquarePlus,
        href: '/pulse?new=true',
      },
    ],
  },
  {
    title: 'Aller à',
    actions: [
      { id: 'calendar', label: 'Calendrier', icon: Calendar, href: '/calendrier' },
      { id: 'tasks', label: 'Mes tâches', icon: ListTodo, href: '/projets' },
      { id: 'inbox', label: 'Boîte de réception', icon: Inbox, href: '/emails' },
      { id: 'pulse', label: 'Pulse', icon: MessageSquare, href: '/pulse' },
    ],
  },
  {
    title: 'Vues CRM',
    actions: [
      { id: 'prospects', label: 'Prospects', icon: Target, href: '/prospects' },
      { id: 'deploiement', label: 'Déploiement', icon: Rocket, href: '/deploiement' },
      { id: 'production', label: 'Production', icon: Factory, href: '/production' },
      { id: 'geo', label: 'Carte géographique', icon: Map, href: '/analyse-geographique' },
    ],
  },
  {
    title: 'Équipe',
    actions: [
      { id: 'people', label: 'Équipe & RH', icon: Users, href: '/people' },
      { id: 'tresorerie', label: 'Trésorerie', icon: Wallet, href: '/tresorerie' },
      { id: 'support', label: 'Support', icon: Headphones, href: '/support' },
    ],
  },
]

// Icon colors by category
const categoryIconColors: Record<string, string> = {
  etablissements: 'text-emerald-500',
  emails: 'text-sky-500',
  taches: 'text-amber-500',
  contacts: 'text-pink-500',
  groupes: 'text-indigo-500',
  partenaires: 'text-violet-500',
  pulseMessages: 'text-purple-500',
  pulseConversations: 'text-fuchsia-500',
  profiles: 'text-blue-500',
  documents: 'text-orange-500',
  todos: 'text-green-500',
  rdUserStories: 'text-cyan-500',
  rdProjets: 'text-teal-500',
  supportTickets: 'text-red-500',
  events: 'text-rose-500',
  factures: 'text-emerald-600',
  devis: 'text-lime-600',
  contrats: 'text-indigo-600',
  kbArticles: 'text-blue-600',
  customDashboards: 'text-violet-600',
  workflows: 'text-fuchsia-600',
  candidates: 'text-pink-600',
  jobOffers: 'text-rose-600',
  forumPosts: 'text-sky-600',
  socialPosts: 'text-purple-600',
  produits: 'text-orange-600',
  notesFrais: 'text-yellow-600',
  avoirs: 'text-emerald-700',
  emailTemplates: 'text-sky-700',
  emailSequences: 'text-blue-700',
  bookings: 'text-rose-700',
  bookingPages: 'text-pink-700',
  contratTemplates: 'text-indigo-700',
  csmPlaybooks: 'text-teal-700',
  aiAgents: 'text-purple-700',
  clientSegments: 'text-amber-700',
  calendars: 'text-cyan-700',
  absences: 'text-orange-700',
  revenus: 'text-emerald-800',
  depenses: 'text-red-700',
  proactiveAlerts: 'text-red-600',
  polls: 'text-violet-500',
  dashboardNotes: 'text-yellow-500',
  candidateEvaluations: 'text-pink-800',
}

// Category config
const categoryConfig: Record<string, { title: string; icon: React.ElementType }> = {
  etablissements: { title: 'Établissements', icon: Building2 },
  emails: { title: 'Emails', icon: Mail },
  taches: { title: 'Tâches CRM', icon: CheckSquare },
  contacts: { title: 'Contacts', icon: Users },
  groupes: { title: 'Groupes', icon: Briefcase },
  partenaires: { title: 'Partenaires', icon: Handshake },
  pulseMessages: { title: 'Messages Pulse', icon: MessageSquare },
  pulseConversations: { title: 'Conversations Pulse', icon: MessageSquare },
  profiles: { title: 'Membres', icon: Users },
  documents: { title: 'Documents', icon: FileText },
  todos: { title: 'Todos personnels', icon: ListTodo },
  rdUserStories: { title: 'R&D User Stories', icon: Beaker },
  rdProjets: { title: 'R&D Projets', icon: FileText },
  supportTickets: { title: 'Tickets Support', icon: Headphones },
  events: { title: 'Événements', icon: Calendar },
  factures: { title: 'Factures', icon: Receipt },
  devis: { title: 'Devis', icon: FileText },
  contrats: { title: 'Contrats', icon: FileSignature },
  kbArticles: { title: 'Pages du wiki', icon: BookOpen },
  customDashboards: { title: 'Rapports custom', icon: LayoutDashboard },
  workflows: { title: 'Automatisations', icon: Workflow },
  candidates: { title: 'Candidats', icon: UserPlus },
  jobOffers: { title: "Offres d'emploi", icon: BriefcaseBusiness },
  forumPosts: { title: 'Forum', icon: MessagesSquare },
  socialPosts: { title: 'Publications sociales', icon: Share2 },
  produits: { title: 'Catalogue produits', icon: Package },
  notesFrais: { title: 'Notes de frais', icon: CreditCard },
  avoirs: { title: 'Avoirs', icon: Undo2 },
  emailTemplates: { title: "Modèles d'email", icon: MailPlus },
  emailSequences: { title: 'Séquences email', icon: Send },
  bookings: { title: 'Rendez-vous', icon: CalendarCheck },
  bookingPages: { title: 'Pages de réservation', icon: CalendarRange },
  contratTemplates: { title: 'Modèles de contrats', icon: FileCode2 },
  csmPlaybooks: { title: 'Playbooks CSM', icon: BookMarked },
  aiAgents: { title: 'Agents IA', icon: Bot },
  clientSegments: { title: 'Segments clients', icon: Layers },
  calendars: { title: 'Calendriers', icon: CalendarDays },
  absences: { title: 'Absences RH', icon: CalendarOff },
  revenus: { title: 'Revenus', icon: TrendingUp },
  depenses: { title: 'Dépenses', icon: TrendingDown },
  proactiveAlerts: { title: 'Alertes proactives', icon: AlertTriangle },
  polls: { title: 'Sondages Pulse', icon: BarChart3 },
  dashboardNotes: { title: 'Notes dashboard', icon: StickyNote },
  candidateEvaluations: { title: 'Évaluations candidats', icon: ClipboardCheck },
}

interface GlobalSearchDialogProps {
  triggerClassName?: string
  /** Controlled mode: external open state */
  open?: boolean
  /** Controlled mode: external setOpen function */
  setOpen?: (open: boolean) => void
  /** Hide the trigger button (when using external trigger) */
  hideTrigger?: boolean
}

export function GlobalSearchDialog({
  triggerClassName,
  open: externalOpen,
  setOpen: externalSetOpen,
  hideTrigger = false,
}: GlobalSearchDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false)

  // Use external state if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalSetOpen || setInternalOpen
  const [activeTab, setActiveTab] = useState<'search' | 'ai'>('search')
  const [search, setSearch] = useState('')
  const [recent, setRecent] = useState<SearchResult[]>(() => {
    try {
      const raw = localStorage.getItem('global-search-recent')
      return raw ? (JSON.parse(raw) as SearchResult[]).slice(0, 8) : []
    } catch {
      return []
    }
  })
  const navigate = useNavigate()
  const { executeQuickAction } = useJarvisUnified()
  const { favorites, remove: removeFavorite } = useFavorites()

  const { results, isLoading } = useGlobalSearch(search, open && activeTab === 'search')

  // Raccourci clavier Ctrl+K / Cmd+K (only for internal state)
  useEffect(() => {
    // Skip keyboard handler if using external state control
    if (externalSetOpen) return

    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setInternalOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [externalSetOpen])

  // Reset search when closing
  useEffect(() => {
    if (!open) {
      setSearch('')
      setActiveTab('search')
    }
  }, [open])

  const handleSelect = useCallback(
    (result: SearchResult) => {
      // Persist to recents (dedupe by id, keep latest 8)
      setRecent((prev) => {
        const next = [result, ...prev.filter((r) => r.id !== result.id)].slice(0, 8)
        try {
          localStorage.setItem('global-search-recent', JSON.stringify(next))
        } catch {
          /* noop */
        }
        return next
      })
      setOpen(false)
      setSearch('')
      navigate(result.href)
    },
    [navigate]
  )

  const handleQuickAction = useCallback(
    (href: string) => {
      setOpen(false)
      setSearch('')
      navigate(href)
    },
    [navigate]
  )

  const hasResults = useMemo(() => {
    return Object.values(results).some((arr) => arr.length > 0)
  }, [results])

  const handleClose = useCallback(() => {
    setOpen(false)
    setSearch('')
  }, [])

  // Filter categories with results
  const categoriesWithResults = useMemo(() => {
    return Object.entries(results).filter(([_, items]) => items.length > 0)
  }, [results])

  // Detect if we're in a white/transparent hero context
  const isHeroContext = triggerClassName?.includes('white') || triggerClassName?.includes('ghost')

  return (
    <>
      {/* Bouton de recherche - Premium glassmorphism style (hidden when using external trigger) */}
      {!hideTrigger && (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            'inline-flex items-center gap-2.5 px-4 py-2 text-sm transition-all duration-200 rounded-xl',
            isHeroContext
              ? 'bg-card/10 backdrop-blur-sm border border-white/30 text-white/90 hover:bg-card/20 hover:border-white/50'
              : [
                  // Version premium pour le header global
                  'bg-card/80 hover:bg-card backdrop-blur-sm',
                  'border border-primary/15 hover:border-primary/30',
                  'text-muted-foreground hover:text-foreground',
                ].join(' '),
            triggerClassName
          )}
        >
          <div
            className={cn(
              'w-6 h-6 rounded-md flex items-center justify-center',
              isHeroContext ? 'bg-card/20' : 'bg-primary/10'
            )}
          >
            <Search
              className={cn('w-3.5 h-3.5', isHeroContext ? 'text-white/70' : 'text-primary')}
            />
          </div>
          <span className="hidden sm:inline">Rechercher...</span>
          <kbd
            className={cn(
              'hidden md:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded-md px-1.5 font-mono text-[10px] font-medium',
              isHeroContext
                ? 'bg-card/20 text-white/60 border-0'
                : 'bg-primary/10 text-primary border border-primary/20'
            )}
          >
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      )}

      {/* Dialog de recherche */}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        size={activeTab === 'ai' ? 'large' : 'default'}
      >
        {/* Custom header with premium styling */}
        <div className="flex items-center border-b border-primary/10 px-4 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mr-3 border border-primary/20 shadow-sm">
            <Search className="h-4 w-4 text-primary" />
          </div>
          <input
            className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={
              activeTab === 'search' ? 'Rechercher partout...' : 'Recherche IA avec synthèse...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {/* Onglets premium */}
          <div className="flex gap-1 ml-3 shrink-0 p-1 bg-muted/50 rounded-lg">
            <button
              onClick={() => setActiveTab('search')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                activeTab === 'search'
                  ? 'bg-card dark:bg-background shadow-sm text-primary border border-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/50 dark:hover:bg-background/50'
              )}
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Recherche</span>
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                activeTab === 'ai'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/50 dark:hover:bg-background/50'
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">AI Overview</span>
            </button>
          </div>
        </div>

        {/* Contenu */}
        {activeTab === 'search' ? (
          <CommandList className="max-h-[400px]">
            {/* État de chargement */}
            {search && isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Aucun résultat */}
            {search && !isLoading && !hasResults && (
              <CommandEmpty>
                <div className="text-center py-6">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucun résultat pour "{search}"</p>
                  <p className="text-xs text-muted-foreground mt-1">Essayez avec d'autres termes</p>
                </div>
              </CommandEmpty>
            )}

            {/* Favoris */}
            {!search && favorites.length > 0 && (
              <CommandGroup
                heading="Favoris"
                className="[&_[cmdk-group-heading]]:text-amber-600 dark:[&_[cmdk-group-heading]]:text-amber-400 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
              >
                {favorites.slice(0, 8).map((fav) => (
                  <CommandItem
                    key={`fav-${fav.type}-${fav.id}`}
                    value={`fav-${fav.type}-${fav.id}-${fav.title}`}
                    onSelect={() => {
                      setOpen(false)
                      setSearch('')
                      navigate(fav.url)
                    }}
                    className="flex items-center gap-3 cursor-pointer rounded-lg mx-1 group/fav"
                  >
                    <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm">{fav.title}</p>
                      {fav.subtitle && (
                        <p className="truncate text-xs text-muted-foreground">{fav.subtitle}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFavorite(fav.id, fav.type)
                      }}
                      className="opacity-0 group-hover/fav:opacity-100 text-[11px] text-muted-foreground hover:text-foreground px-1"
                      aria-label="Retirer des favoris"
                    >
                      Retirer
                    </button>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Récents */}
            {!search && recent.length > 0 && (
              <CommandGroup
                heading="Récents"
                className="[&_[cmdk-group-heading]]:text-primary [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
              >
                {recent.slice(0, 6).map((item) => {
                  const cfg = categoryConfig[`${item.type}s`] ||
                    categoryConfig[item.type] || { title: '', icon: Search }
                  const Icon = cfg.icon
                  return (
                    <CommandItem
                      key={`recent-${item.id}`}
                      onSelect={() => handleSelect(item)}
                      className="flex items-center gap-3 cursor-pointer rounded-lg mx-1"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm">{item.title}</p>
                        {item.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                        )}
                      </div>
                    </CommandItem>
                  )
                })}
                <button
                  onClick={() => {
                    setRecent([])
                    try {
                      localStorage.removeItem('global-search-recent')
                    } catch {
                      /* noop */
                    }
                  }}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Effacer l'historique
                </button>
              </CommandGroup>
            )}

            {/* Actions rapides organisées par sections (quand pas de recherche) */}
            {!search &&
              quickActionsSections.map((section, index) => (
                <CommandGroup
                  key={section.title}
                  heading={section.title}
                  className="[&_[cmdk-group-heading]]:text-primary [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                >
                  {section.actions.map((action) => (
                    <CommandItem
                      key={action.id}
                      onSelect={() => handleQuickAction(action.href)}
                      className="flex items-center gap-3 cursor-pointer rounded-lg mx-1 hover:bg-gradient-to-r hover:from-primary/10 hover:to-transparent data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-primary/15 data-[selected=true]:to-primary/5 transition-all"
                    >
                      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                        <action.icon className="h-4 w-4 text-primary shrink-0" />
                      </div>
                      <span className="truncate">{action.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}

            {/* Résultats par catégorie */}
            {!isLoading &&
              categoriesWithResults.map(([category, items]: [string, SearchResult[]]) => {
                const config = categoryConfig[category]
                if (!config || items.length === 0) return null

                const IconComponent = config.icon
                const iconColor = categoryIconColors[category] || 'text-muted-foreground'

                return (
                  <CommandGroup key={category} heading={`${config.title} (${items.length})`}>
                    {items.slice(0, 5).map((item: SearchResult) => (
                      <CommandItem
                        key={item.id}
                        value={`${category}-${item.id}`}
                        onSelect={() => handleSelect(item)}
                        className="flex items-center gap-3 cursor-pointer overflow-hidden"
                      >
                        <IconComponent className={cn('h-4 w-4 shrink-0', iconColor)} />
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="truncate text-sm">{item.title}</p>
                          {item.subtitle && (
                            <p className="truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                        {/* Linked establishment chip */}
                        {item.linkedEtablissement && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpen(false)
                              setSearch('')
                              navigate(`/etablissements/${item.linkedEtablissement!.id}`)
                            }}
                            className="shrink-0 flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition-colors max-w-[120px]"
                            title={`Voir ${item.linkedEtablissement.nom}`}
                          >
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{item.linkedEtablissement.nom}</span>
                          </button>
                        )}
                        {item.badge && !item.linkedEtablissement && (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </CommandItem>
                    ))}
                    {items.length > 5 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        +{items.length - 5} autres résultats
                      </div>
                    )}
                  </CommandGroup>
                )
              })}
          </CommandList>
        ) : (
          <div className="border-t">
            <AISearchOverview query={search} onClose={handleClose} />
          </div>
        )}

        {/* Bouton "Demander à Jarvis" en bas du dialog */}
        {search.trim() && activeTab === 'search' && (
          <div className="border-t border-primary/10 px-4 py-3 bg-gradient-to-r from-primary/5 to-transparent">
            <button
              onClick={() => {
                const query = search.trim()
                setOpen(false)
                setSearch('')
                executeQuickAction(query)
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Bot className="h-4 w-4" />
              Demander à Jarvis
            </button>
          </div>
        )}

        {/* Footer raccourcis clavier (inspiré Twenty CRM) */}
        <div className="border-t border-primary/10 px-4 py-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground bg-muted/30">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border bg-background font-mono">↑↓</kbd>{' '}
              Naviguer
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border bg-background font-mono">↵</kbd> Ouvrir
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border bg-background font-mono">Esc</kbd> Fermer
            </span>
          </div>
          <span className="hidden sm:inline">
            Astuce : <kbd className="px-1 py-0.5 rounded border bg-background font-mono">⌘</kbd>+
            <kbd className="px-1 py-0.5 rounded border bg-background font-mono">K</kbd> n'importe où
          </span>
        </div>
      </CommandDialog>
    </>
  )
}
