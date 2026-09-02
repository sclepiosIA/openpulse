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
  LucideIcon,
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
  ClipboardList,
  Workflow,
  Phone,
  ShieldAlert,
  Share2,
} from 'lucide-react'
import type { RolePermissions, TeamType } from '@/hooks/auth/useRolePermissions'
import {
  resolveInternalToolPresentation,
  type InternalToolRuntimeConfig,
  type InternalToolRuntimeContext,
} from './internalTools'
import { iconeApplication } from './iconesApplications'
import {
  estApplicationAffichable,
  type ApplicationExterne,
} from '@/hooks/shared/useApplicationsExternes'

export interface NavigationItem {
  label: string
  path: string
  icon: LucideIcon
  badge?: number
  // Clé pour badge dynamique (ex: 'pulseUnread')
  badgeKey?: string
  exactMatch?: boolean
  // Permissions requises (au moins une doit être vraie)
  requiredPermissions?: (keyof RolePermissions)[]
  // Équipes autorisées
  allowedTeams?: TeamType[]
  // Admin uniquement
  adminOnly?: boolean
  // Logo image (URL) à afficher à droite du label dans la sidebar
  rightLogo?: string
}

export interface NavigationSection {
  section: string
  items: NavigationItem[]
  // Permissions pour afficher la section entière
  requiredPermissions?: (keyof RolePermissions)[]
  allowedTeams?: TeamType[]
}

export interface ExternalLink {
  label: string
  url: string
  icon: LucideIcon
  allowedTeams?: TeamType[]
  adminOnly?: boolean
  section?: string // Section où le lien doit apparaître
  // Clé dans app_config.tool_urls / backend_urls d'où provient l'URL (dynamique)
  configKey?: string
}

export interface ExternalLinkGroup {
  label: string
  icon: LucideIcon
  links: ExternalLink[]
  allowedTeams?: TeamType[]
}

// Liens backend affichés en iframe interne
export interface BackendLink {
  label: string
  key: string // clé utilisée dans ?backend=<key>
  icon: LucideIcon
}

export interface BackendLinkGroup {
  label: string
  icon: LucideIcon
  basePath: string // ex: /backend
  links: BackendLink[]
  allowedTeams?: TeamType[]
}

// Liens internes affichés en iframe (simulateur, etc.)
export interface InternalIframeLink {
  label: string
  key: string
  icon: LucideIcon
  allowedTeams?: TeamType[]
  adminOnly?: boolean
  section?: string // Section où le lien doit apparaître
}

// navigationSections data extracted to ./navigationSectionsData for module size
export { navigationSections } from './navigationSectionsData'

// Groupes de liens externes avec sous-menus (ouverts en nouvel onglet)
export const externalLinkGroups: ExternalLinkGroup[] = []

// Groupes de liens backend affichés en iframe dans l'app
export const backendLinkGroups: BackendLinkGroup[] = []

// Liens iframe internes avec leur section d'appartenance.
export const internalIframeLinks: InternalIframeLink[] = []

const INTERNAL_TOOL_IFRAME_LINKS: InternalIframeLink[] = []

export function getInternalIframeLinksWithConfig(
  toolUrls: Record<string, InternalToolRuntimeConfig | undefined> | null | undefined,
  context: InternalToolRuntimeContext
): InternalIframeLink[] {
  return INTERNAL_TOOL_IFRAME_LINKS.filter((link) => {
    return resolveInternalToolPresentation(link.key, toolUrls?.[link.key], context).mode === 'iframe'
  })
}

// Liens externes avec leur section d'appartenance
export const externalLinks: ExternalLink[] = [
  // Direction
  // Direction
  {
    label: 'Qonto',
    url: '', // URL set dynamically via qonto_config from app_config
    icon: CreditCard,
    allowedTeams: ['direction'],
    section: 'Direction',
  },
  {
    label: 'DocuSeal',
    url: '',
    icon: FileSignature,
    allowedTeams: ['direction'],
    section: 'Direction',
    configKey: 'docuseal',
  },
  {
    label: 'Secrets',
    url: '',
    icon: Lock,
    allowedTeams: ['direction'],
    section: 'Direction',
    configKey: 'secrets',
  },
  {
    label: 'Fichiers HDS',
    url: '',
    icon: FolderOpen,
    allowedTeams: ['direction'],
    section: 'Direction',
    configKey: 'fichiers_hds',
  },
]

/**
 * Returns externalLinks with dynamic URLs injected (Qonto + tool_urls entries)

 */
export function getExternalLinksWithConfig(
  qontoUrl?: string,
  toolUrls?: Record<string, InternalToolRuntimeConfig | undefined> | null,
  internalToolContext?: InternalToolRuntimeContext,
  applicationsDeclarees?: ApplicationExterne[] | null
): ExternalLink[] {
  return externalLinks
    .map((link): ExternalLink | null => {
      if (link.label === 'Qonto' && qontoUrl) {
        return { ...link, url: qontoUrl }
      }
      if (link.configKey && toolUrls) {
        const configuredTool = toolUrls[link.configKey]
        if (
          internalToolContext &&
          (link.configKey === 'gitea' || link.configKey === 'penpot')
        ) {
          const presentation = resolveInternalToolPresentation(
            link.configKey,
            configuredTool,
            internalToolContext
          )
          if (presentation.mode !== 'external') return null
          return { ...link, url: presentation.url }
        }

        const resolved = configuredTool?.url
        if (resolved) return { ...link, url: resolved }
      }
      return link
    })
    .filter((link): link is ExternalLink => Boolean(link?.url))
    .concat(
      // Les applications declarees par l'exploitant. Une entree incomplete est
      // ecartee ici plutot qu'affichee morte dans le menu.
      (applicationsDeclarees ?? []).filter(estApplicationAffichable).map((app) => ({
        label: app.libelle,
        url: app.url,
        icon: iconeApplication(app.icone),
        section: app.section,
        allowedTeams: app.equipes.length ? (app.equipes as TeamType[]) : undefined,
      }))
    )
}

/**
 * Rôles à accès lecture-seule / non techniques : ne doivent jamais voir les outils
 * backend (Gitea, Penpot, DocuSeal, Secrets, HDS, Azure, etc.) même s'ils sont
 * mappés à l'équipe `direction`.
 */
export const RESTRICTED_TOOL_ROLES: string[] = ['copil', 'consultant', 'lecteur', 'rh']

export function isToolRestrictedRole(role: string | null | undefined): boolean {
  return !!role && RESTRICTED_TOOL_ROLES.includes(role)
}

/**
 * Filtre les liens iframe internes selon l'équipe de l'utilisateur
 */
export function filterInternalIframeLinksByTeam(
  links: InternalIframeLink[],
  team: TeamType | null,
  isAdmin: boolean,
  role?: string | null
): InternalIframeLink[] {
  if (isToolRestrictedRole(role)) return []
  return links.filter((link) => {
    if (link.adminOnly && !isAdmin) return false
    if (!link.allowedTeams || link.allowedTeams.length === 0) {
      return true
    }
    if (isAdmin) {
      return true
    }
    return team && link.allowedTeams.includes(team)
  })
}

/**
 * Récupère les liens iframe pour une section donnée
 */
export function getIframeLinksBySection(
  links: InternalIframeLink[],
  section: string,
  team: TeamType | null,
  isAdmin: boolean
): InternalIframeLink[] {
  return filterInternalIframeLinksByTeam(links, team, isAdmin).filter(
    (link) => link.section === section
  )
}

/**
 * Récupère les liens externes pour une section donnée
 */
export function getExternalLinksBySection(
  links: ExternalLink[],
  section: string,
  team: TeamType | null,
  isAdmin: boolean
): ExternalLink[] {
  return filterExternalLinksByTeam(links, team, isAdmin).filter((link) => link.section === section)
}

/**
 * Whitelist des chemins visibles dans la sidebar pour le rôle `rh`.
 * Le rôle RH ne doit voir que son périmètre métier (People, Recrutement,
 * Formation, Calendrier, Documents) + outils transverses (Tableau de bord,
 * Pulse, Emails, Todos, Notifications, Paramètres personnels).
 */
export const RH_ALLOWED_NAV_PATHS: string[] = [
  '/tutoriels',
  '/',
  '/pulse',
  '/calendrier',
  '/emails',
  '/todos',
  '/notes',
  '/documents',
  '/m/install',
  '/prise-rdv',
  '/meeting-notes',
  '/formulaires',
  '/people',
  '/recrutement',
  '/competences',
  '/rapports',
  '/activite',
  '/parametres',
  '/profil',
  '/marketing/calendrier-editorial',
  '/marketing/statistiques',
  '/notifications',
]

/**
 * Whitelist des chemins visibles dans la sidebar pour le rôle `csm`.
 * Le CSM ne doit voir que son périmètre métier (déploiement, production,
 * formation, support) + outils transverses.
 */
export const CSM_ALLOWED_NAV_PATHS: string[] = [
  '/tutoriels',
  '/',
  '/pulse',
  '/calendrier',
  '/emails',
  '/appels',
  '/todos',
  '/notes',
  '/documents',
  '/m/install',
  '/prise-rdv',
  '/meeting-notes',
  '/etablissements',
  '/deploiement',
  '/production',
  '/support',
  '/churn',
  '/parametres',
  '/profil',
  '/marketing/calendrier-editorial',
  '/marketing/statistiques',
  '/notifications',
]

/**
 * Whitelist sidebar pour le rôle `commercial`.
 * Périmètre : CRM (prospects/établissements), emails, agenda, support léger,
 * pas de RH, pas de Trésorerie, pas de R&D, pas d'admin.
 */
export const COMMERCIAL_ALLOWED_NAV_PATHS: string[] = [
  '/tutoriels',
  '/',
  '/pulse',
  '/calendrier',
  '/emails',
  '/appels',
  '/todos',
  '/notes',
  '/documents',
  '/m/install',
  '/prise-rdv',
  '/meeting-notes',
  '/etablissements',
  '/groupes',
  '/partenaires',
  '/carte',
  '/commercial',
  '/prospects',
  '/prospects/scoring',
  '/forecasting',
  '/catalogue',
  '/contrats',
  '/activite',
  '/marketing/calendrier-editorial',
  '/marketing/statistiques',
  '/profil',
  '/notifications',
]

/**
 * Whitelist sidebar pour le rôle `copil` (comité de pilotage / lecture seule transverse).
 * Voit Dashboard, CRM, Trésorerie (lecture), R&D (lecture), Support, Reporting,
 * Churn, Forecasting. Pas de RH, pas d'admin, pas de Backend.
 */
export const COPIL_ALLOWED_NAV_PATHS: string[] = [
  '/tutoriels',
  '/',
  '/pulse',
  '/calendrier',
  '/emails',
  '/todos',
  '/notes',
  '/documents',
  '/m/install',
  '/meeting-notes',
  '/etablissements',
  '/groupes',
  '/partenaires',
  '/carte',
  '/deploiement',
  '/production',
  '/playbooks-csm',
  '/csm',
  '/rd',
  '/gantt',
  '/cfo',
  '/tresorerie',
  '/facturation',
  '/contrats',
  '/catalogue',
  '/forecasting',
  '/churn',
  '/rapports',
  '/rapports-custom',
  '/activite',
  '/support',
  '/profil',
  '/marketing/calendrier-editorial',
  '/marketing/statistiques',
  '/notifications',
]

/**
 * Whitelist sidebar pour le rôle `marketing`.
 * Périmètre strict : Communication & marketing + outils transverses.
 * Pas de CRM, pas de pipe commercial, pas de RH, pas de trésorerie, pas d'admin.
 */
export const MARKETING_ALLOWED_NAV_PATHS: string[] = [
  '/tutoriels',
  '/',
  '/pulse',
  '/calendrier',
  '/emails',
  '/todos',
  '/notes',
  '/documents',
  '/m/install',
  '/prise-rdv',
  '/meeting-notes',
  '/marketing/calendrier-editorial',
  '/marketing/statistiques',
  '/social',
  '/social/inbox',
  '/activite',
  '/profil',
  '/parametres',
  '/notifications',
]

/**
 * Filtre les items de navigation selon les permissions de l'utilisateur
 */
export function filterNavigationByPermissions(
  sections: NavigationSection[],
  permissions: RolePermissions
): NavigationSection[] {
  const isRh = permissions.role === 'rh'
  const isCsm = permissions.role === 'csm' && !permissions.isAdmin
  const isCommercial = permissions.role === 'commercial' && !permissions.isAdmin
  const isCopil = permissions.role === 'copil' && !permissions.isAdmin
  const isMarketing = permissions.role === 'marketing' && !permissions.isAdmin
  return sections
    .map((section) => {
      // RH : whitelist stricte des chemins visibles
      if (isRh) {
        const rhItems = section.items.filter((item) => RH_ALLOWED_NAV_PATHS.includes(item.path))
        return { ...section, items: rhItems }
      }

      // CSM : whitelist stricte des chemins visibles (défense en profondeur
      // au-delà des requiredPermissions/allowedTeams par item)
      if (isCsm) {
        const csmItems = section.items.filter((item) => CSM_ALLOWED_NAV_PATHS.includes(item.path))
        return { ...section, items: csmItems }
      }

      // COMMERCIAL : whitelist stricte
      if (isCommercial) {
        const items = section.items.filter((item) =>
          COMMERCIAL_ALLOWED_NAV_PATHS.includes(item.path)
        )
        return { ...section, items }
      }

      // MARKETING : whitelist stricte
      if (isMarketing) {
        const items = section.items.filter((item) =>
          MARKETING_ALLOWED_NAV_PATHS.includes(item.path)
        )
        return { ...section, items }
      }

      // COPIL : whitelist stricte (lecture seule transverse)
      if (isCopil) {
        const items = section.items.filter((item) => COPIL_ALLOWED_NAV_PATHS.includes(item.path))
        return { ...section, items }
      }

      // Vérifier les équipes autorisées pour la section entière
      if (section.allowedTeams && section.allowedTeams.length > 0) {
        if (
          !permissions.isAdmin &&
          (!permissions.team || !section.allowedTeams.includes(permissions.team))
        ) {
          return { ...section, items: [] }
        }
      }

      // Filtrer les items de la section
      const filteredItems = section.items.filter((item) => {
        // Admin only check
        if (item.adminOnly && !permissions.isAdmin) {
          return false
        }

        // Vérifier les équipes autorisées
        if (item.allowedTeams && item.allowedTeams.length > 0) {
          if (!permissions.team || !item.allowedTeams.includes(permissions.team)) {
            // Si pas dans l'équipe autorisée, vérifier si admin
            if (!permissions.isAdmin) {
              return false
            }
          }
        }

        // Vérifier les permissions requises (au moins une doit être vraie)
        if (item.requiredPermissions && item.requiredPermissions.length > 0) {
          const hasAnyPermission = item.requiredPermissions.some(
            (perm) => permissions[perm] === true
          )
          if (!hasAnyPermission) {
            return false
          }
        }

        return true
      })

      return {
        ...section,
        items: filteredItems,
      }
    })
    .filter((section) => section.items.length > 0) // Supprimer les sections vides
}

/**
 * Filtre les liens externes selon l'équipe de l'utilisateur
 */
export function filterExternalLinksByTeam(
  links: ExternalLink[],
  team: TeamType | null,
  isAdmin: boolean,
  role?: string | null
): ExternalLink[] {
  if (isToolRestrictedRole(role)) return []
  return links.filter((link) => {
    if (link.adminOnly && !isAdmin) return false
    if (!link.allowedTeams || link.allowedTeams.length === 0) {
      return true
    }
    if (isAdmin) {
      return true
    }
    return team && link.allowedTeams.includes(team)
  })
}

/**
 * Filtre les groupes de liens externes selon l'équipe de l'utilisateur
 */
export function filterExternalLinkGroupsByTeam(
  groups: ExternalLinkGroup[],
  team: TeamType | null,
  isAdmin: boolean,
  role?: string | null
): ExternalLinkGroup[] {
  if (isToolRestrictedRole(role)) return []
  return groups.filter((group) => {
    if (!group.allowedTeams || group.allowedTeams.length === 0) {
      return true
    }
    if (isAdmin) {
      return true
    }
    return team && group.allowedTeams.includes(team)
  })
}

/**
 * Filtre les groupes de liens backend selon l'équipe de l'utilisateur
 */
export function filterBackendLinkGroupsByTeam(
  groups: BackendLinkGroup[],
  team: TeamType | null,
  isAdmin: boolean,
  role?: string | null
): BackendLinkGroup[] {
  if (isToolRestrictedRole(role)) return []
  return groups.filter((group) => {
    if (!group.allowedTeams || group.allowedTeams.length === 0) {
      return true
    }
    if (isAdmin) {
      return true
    }
    return team && group.allowedTeams.includes(team)
  })
}

// Configuration des couleurs par équipe
export const teamConfig: Record<TeamType, { label: string; color: string; bgColor: string }> = {
  direction: {
    label: 'Direction',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  technique: {
    label: 'Technique',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  csm: {
    label: 'CSM',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  commercial: {
    label: 'Commercial',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  marketing: {
    label: 'Marketing',
    color: 'text-pink-700 dark:text-pink-400',
    bgColor: 'bg-pink-100 dark:bg-pink-900/30',
  },
}
