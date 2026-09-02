import {
  Building2,
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  Calendar,
  ChartGantt,
  Target,
  Truck,
  Factory,
  MapPin,
  Mail,
  Handshake,
  GraduationCap,
  Euro,
  UserCog,
  Boxes,
  Package,
  FlaskConical,
  Headphones,
  Activity,
  MessageCircle,
  Server,
  CreditCard,
  Lock,
  CloudCog,
  BookOpen,
  GitBranch,
  Palette,
  FileSignature,
  Smartphone,
  CheckSquare,
  FolderOpen,
  CalendarCheck,
  TrendingUp,
  FileAudio,
  Linkedin,
  ClipboardList,
  Workflow,
  ShieldAlert,
  Share2,
  ClipboardCheck,
  Landmark,
  StickyNote,
  Sparkles,
  Clock,
  Laptop,
} from 'lucide-react'
import type { NavigationSection } from './navigationConfig'
import { LEXIQUE } from './secteurs'
import marqueIcon from '@/assets/marque/logo.png'

export const navigationSections: NavigationSection[] = [
  {
    section: 'Général',
    items: [
      {
        label: 'Tableau de bord',
        path: '/',
        icon: LayoutDashboard,
        exactMatch: true,
      },
      {
        label: 'Pulse',
        path: '/pulse',
        icon: MessageCircle,
        badgeKey: 'pulseUnread',
      },
      {
        label: 'Calendrier',
        path: '/calendrier',
        icon: Calendar,
        badgeKey: 'calendarEvents',
        requiredPermissions: ['canViewCalendar'],
      },
      {
        label: 'Emails',
        path: '/emails',
        icon: Mail,
        badgeKey: 'emailsUnread',
        requiredPermissions: ['canViewSharedEmails', 'canViewAllEmails'],
      },
      // Page Appels/VOIP masquée — la traçabilité des appels/interactions physiques
      // reste disponible via l'onglet « Interactions » des établissements/groupes.
      {
        label: 'Todos',
        path: '/todos',
        icon: CheckSquare,
        badgeKey: 'todosCount',
      },
      {
        label: 'Notes',
        path: '/notes',
        icon: StickyNote,
      },
      {
        label: 'Documents',
        path: '/documents',
        icon: FolderOpen,
      },
      {
        label: 'Tutoriels',
        path: '/tutoriels',
        icon: GraduationCap,
      },
      {
        label: 'Apps mobiles',
        path: '/m/install',
        icon: Smartphone,
      },
      {
        label: 'Prise de RDV',
        path: '/prise-rdv',
        icon: CalendarCheck,
        badgeKey: 'pendingBookings',
      },
      {
        label: 'Notes de réunion',
        path: '/meeting-notes',
        icon: FileAudio,
      },
      {
        label: 'Formulaires',
        path: '/formulaires',
        icon: ClipboardList,
      },
    ],
  },
  {
    section: 'CRM',
    items: [
      {
        // Le mot vient du secteur configuré : « Organisations » par défaut,
        // « Établissements » pour un exploitant du secteur santé, ou celui que
        // l'exploitant choisit. Le chemin, lui, ne bouge pas : c'est une
        // adresse, pas un libellé, et des liens existent dessus.
        label: LEXIQUE.entites,
        path: '/etablissements',
        icon: Building2,
        requiredPermissions: [
          'canViewAllEtablissements',
          'canViewProduction',
          'canViewDeploiement',
          'canViewProspects',
        ],
      },
      {
        label: 'Groupes',
        path: '/groupes',
        icon: Users,
        requiredPermissions: ['canViewAllEtablissements'],
      },
      {
        label: 'Partenaires',
        path: '/partenaires',
        icon: Handshake,
        requiredPermissions: ['canViewAllEtablissements'],
      },
    ],
  },
  {
    section: 'Prospection',
    allowedTeams: ['direction', 'commercial'],
    items: [
      {
        label: 'Commercial',
        path: '/prospects',
        icon: Target,
        requiredPermissions: ['canViewProspects', 'canViewPipeline'],
        allowedTeams: ['direction', 'commercial'],
      },
      {
        label: "Apporteurs d'Affaires",
        path: '/apporteurs-affaires',
        icon: Handshake,
        allowedTeams: ['direction', 'commercial'],
      },
      {
        label: 'Scoring prospects',
        path: '/prospects/scoring',
        icon: Activity,
        allowedTeams: ['direction', 'commercial'],
      },
      {
        label: 'Carte',
        path: '/analyse-geographique',
        icon: MapPin,
        requiredPermissions: ['canViewAllEtablissements'],
      },
    ],
  },
  {
    section: 'CSM',
    allowedTeams: ['direction', 'technique', 'csm'],
    items: [
      {
        label: 'Déploiement',
        path: '/deploiement',
        icon: Truck,
        requiredPermissions: ['canViewDeploiement'],
        allowedTeams: ['direction', 'technique', 'csm'],
      },
      {
        label: 'Production',
        path: '/production',
        icon: Factory,
        requiredPermissions: ['canViewProduction'],
        allowedTeams: ['direction', 'technique', 'csm'],
      },
      {
        label: 'Enquêtes',
        path: '/enquetes',
        icon: ClipboardCheck,
        requiredPermissions: ['canViewFormations'],
        allowedTeams: ['direction', 'technique', 'csm'],
      },
      {
        label: 'Support',
        path: '/support',
        icon: Headphones,
        badgeKey: 'supportTickets',
        requiredPermissions: ['canViewAllTickets', 'canManageTickets', 'canViewOwnTickets'],
        allowedTeams: ['direction', 'technique', 'csm'],
      },
      {
        label: 'Risque de churn',
        path: '/churn',
        icon: ShieldAlert,
        allowedTeams: ['direction', 'technique', 'csm'],
      },
    ],
  },
  {
    section: 'Marketing',
    allowedTeams: ['direction', 'commercial', 'marketing'],
    items: [
      {
        label: 'Calendrier éditorial',
        path: '/marketing/calendrier-editorial',
        icon: Linkedin,
        rightLogo: marqueIcon,
        allowedTeams: ['direction', 'commercial', 'marketing'],
      },
      {
        label: 'Statistiques',
        path: '/marketing/statistiques',
        icon: BarChart3,
        allowedTeams: ['direction', 'commercial', 'marketing'],
      },
    ],
  },

  {
    section: 'Technique',
    allowedTeams: ['direction', 'technique'],
    items: [
      {
        label: 'Projets',
        path: '/projets',
        icon: Boxes,
        requiredPermissions: ['canViewAllEtablissements', 'canViewDeploiement'],
        allowedTeams: ['direction', 'technique'],
      },
      {
        label: 'Gantt',
        path: '/gantt',
        icon: ChartGantt,
        requiredPermissions: ['canViewGantt'],
        allowedTeams: ['direction', 'technique'],
      },
      {
        label: 'R&D',
        path: '/rd',
        icon: FlaskConical,
        badgeKey: 'rdOpenTasks',
        requiredPermissions: ['canViewRD'],
        allowedTeams: ['direction', 'technique'],
      },
      {
        label: 'Parc IT & licences',
        path: '/it',
        icon: Laptop,
        allowedTeams: ['direction', 'technique'],
      },
    ],
  },
  {
    section: 'Direction',
    allowedTeams: ['direction'],
    items: [
      {
        label: 'Finances',
        path: '/finances',
        icon: Landmark,
        requiredPermissions: ['canViewTresorerie'],
        allowedTeams: ['direction'],
      },
      {
        label: 'Trésorerie',
        path: '/tresorerie',
        icon: Euro,
        requiredPermissions: ['canViewTresorerie'],
        allowedTeams: ['direction'],
      },
      {
        label: 'Facturation',
        path: '/facturation',
        icon: CreditCard,
        requiredPermissions: ['canViewTresorerie'],
        allowedTeams: ['direction'],
      },
      {
        label: 'Comptabilité',
        path: '/comptabilite',
        icon: BookOpen,
        requiredPermissions: ['canViewTresorerie'],
        allowedTeams: ['direction'],
      },
      {
        label: 'Contrats',
        path: '/contrats',
        icon: FileSignature,
        requiredPermissions: ['canViewTresorerie'],
        allowedTeams: ['direction'],
      },
      {
        label: 'Catalogue produits',
        path: '/catalogue-produits',
        icon: Package,
        allowedTeams: ['direction', 'commercial'],
      },
      {
        label: 'People',
        path: '/people',
        icon: UserCog,
        requiredPermissions: ['canViewAllTeamMembers', 'canViewRHObjectifs'],
        allowedTeams: ['direction'],
      },
      {
        label: 'Forecasting',
        path: '/forecasting',
        icon: TrendingUp,
        allowedTeams: ['direction', 'commercial'],
      },
      {
        label: 'Automatisations',
        path: '/automatisations',
        icon: Workflow,
        allowedTeams: ['direction'],
      },
      {
        label: 'Rapports',
        path: '/rapports',
        icon: BarChart3,
        requiredPermissions: ['canViewReports'],
        allowedTeams: ['direction'],
      },
      {
        label: 'Rapports personnalisés',
        path: '/rapports-custom',
        icon: BarChart3,
        allowedTeams: ['direction'],
      },
      {
        label: 'BI Studio',
        path: '/bi',
        icon: Sparkles,
        allowedTeams: ['direction'],
      },
      {
        label: 'Suivi des temps',
        path: '/temps',
        icon: Clock,
      },
      {
        label: "Fil d'activité",
        path: '/activite',
        icon: Activity,
      },
    ],
  },
  {
    section: 'Compte',
    items: [
      {
        label: 'Paramètres',
        path: '/parametres',
        icon: Settings,
      },
    ],
  },
]

// Note: la page dédiée /admin/satisfaction reste accessible (routes AdminRoutes)
// mais l'entrée sidebar est retirée : l'exploitation V3 est fusionnée dans /enquetes.
void ClipboardCheck
