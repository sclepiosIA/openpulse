import { useMemo } from 'react'
import { useUserRole } from '../shared/useUserRole'

export type AppRole =
  | 'direction'
  | 'copil'
  | 'admin'
  | 'chef_projet'
  | 'csm'
  | 'commercial'
  | 'rh'
  | 'marketing'

export type TeamType = 'direction' | 'technique' | 'csm' | 'commercial' | 'marketing'

// Mapping des rôles vers les équipes
export const roleToTeam: Record<AppRole, TeamType> = {
  direction: 'direction',
  copil: 'direction',
  admin: 'direction',
  rh: 'direction',
  chef_projet: 'technique',
  csm: 'csm',
  commercial: 'commercial',
  marketing: 'marketing',
}

export interface RolePermissions {
  // === RH ===
  canViewSalaries: boolean
  canEditSalaries: boolean
  canViewRHDocuments: boolean
  canUploadRHDocuments: boolean
  canViewRHObjectifs: boolean
  canEditRHObjectifs: boolean
  canViewAllAbsences: boolean
  canManageAbsences: boolean
  canExportPayroll: boolean

  // === Équipe ===
  canViewAllTeamMembers: boolean
  canViewTeamStats: boolean
  canEditTeamMembers: boolean
  canViewSensitiveTeamData: boolean

  // === CRM ===
  canViewAllEtablissements: boolean
  canViewProspects: boolean
  canViewDeploiement: boolean
  canViewProduction: boolean
  canEditEtablissements: boolean
  canDeleteEtablissements: boolean
  canViewPipeline: boolean

  // === Emails ===
  canViewAllEmails: boolean
  canViewSharedEmails: boolean
  canManageEmailDomains: boolean
  canViewEmailAnalytics: boolean

  // === Trésorerie ===
  canViewTresorerie: boolean
  canEditTresorerie: boolean
  canViewFactures: boolean
  canExportTresorerie: boolean

  // === R&D ===
  canViewRD: boolean
  canManageRDProjects: boolean
  canManageSprints: boolean
  canViewRDAnalytics: boolean

  // === Support ===
  canViewAllTickets: boolean
  canViewOwnTickets: boolean
  canManageTickets: boolean
  canViewSupportAnalytics: boolean

  // === Admin ===
  canAccessAdmin: boolean
  canManageUsers: boolean
  canViewSystemLogs: boolean
  canManageSecuritySettings: boolean

  // === Général ===
  canViewCalendar: boolean
  canViewGantt: boolean
  canViewReports: boolean
  canViewFormations: boolean

  // Filtrage
  viewScope: 'all' | 'managed' | 'own'
  etablissementScope:
    | 'all'
    | 'production'
    | 'deploiement'
    | 'deploiement_production'
    | 'prospects'
    | 'assigned'

  // Informations du rôle
  role: AppRole | null
  team: TeamType | null
  isAdmin: boolean
  isLoading: boolean
}

export function useRolePermissions(): RolePermissions {
  const { role, isAdmin, isLoading } = useUserRole()

  const permissions = useMemo<RolePermissions>(() => {
    const roleStr = (role as AppRole) || null
    const team = roleStr ? roleToTeam[roleStr] || null : null

    // === ADMIN / DIRECTION ===
    // Tous les droits
    if (isAdmin) {
      return {
        // RH
        canViewSalaries: true,
        canEditSalaries: true,
        canViewRHDocuments: true,
        canUploadRHDocuments: true,
        canViewRHObjectifs: true,
        canEditRHObjectifs: true,
        canViewAllAbsences: true,
        canManageAbsences: true,
        canExportPayroll: true,
        // Équipe
        canViewAllTeamMembers: true,
        canViewTeamStats: true,
        canEditTeamMembers: true,
        canViewSensitiveTeamData: true,
        // CRM
        canViewAllEtablissements: true,
        canViewProspects: true,
        canViewDeploiement: true,
        canViewProduction: true,
        canEditEtablissements: true,
        canDeleteEtablissements: true,
        canViewPipeline: true,
        // Emails
        canViewAllEmails: true,
        canViewSharedEmails: true,
        canManageEmailDomains: true,
        canViewEmailAnalytics: true,
        // Trésorerie
        canViewTresorerie: true,
        canEditTresorerie: true,
        canViewFactures: true,
        canExportTresorerie: true,
        // R&D
        canViewRD: true,
        canManageRDProjects: true,
        canManageSprints: true,
        canViewRDAnalytics: true,
        // Support
        canViewAllTickets: true,
        canViewOwnTickets: true,
        canManageTickets: true,
        canViewSupportAnalytics: true,
        // Admin
        canAccessAdmin: true,
        canManageUsers: true,
        canViewSystemLogs: true,
        canManageSecuritySettings: true,
        // Général
        canViewCalendar: true,
        canViewGantt: true,
        canViewReports: true,
        canViewFormations: true,
        // Scopes
        viewScope: 'all' as const,
        etablissementScope: 'all' as const,
        role: roleStr,
        team: 'direction' as TeamType,
        isAdmin: true,
        isLoading: false,
      }
    }

    // === COPIL ===
    // Accès CRM, Emails, R&D, Support - PAS de RH ni Finances
    if (role === 'copil') {
      return {
        // RH - AUCUN accès
        canViewSalaries: false,
        canEditSalaries: false,
        canViewRHDocuments: false,
        canUploadRHDocuments: false,
        canViewRHObjectifs: false,
        canEditRHObjectifs: false,
        canViewAllAbsences: false,
        canManageAbsences: false,
        canExportPayroll: false,
        // Équipe - Lecture seule (profils sans données sensibles)
        canViewAllTeamMembers: true,
        canViewTeamStats: false,
        canEditTeamMembers: false,
        canViewSensitiveTeamData: false,
        // CRM - Accès complet
        canViewAllEtablissements: true,
        canViewProspects: true,
        canViewDeploiement: true,
        canViewProduction: true,
        canEditEtablissements: true,
        canDeleteEtablissements: false,
        canViewPipeline: true,
        // Emails - Accès complet
        canViewAllEmails: true,
        canViewSharedEmails: true,
        canManageEmailDomains: false,
        canViewEmailAnalytics: true,
        // Trésorerie - Lecture seule (vue exécutive Direction)
        canViewTresorerie: true,
        canEditTresorerie: false,
        canViewFactures: true,
        canExportTresorerie: false,
        // R&D - Lecture seule
        canViewRD: true,
        canManageRDProjects: false,
        canManageSprints: false,
        canViewRDAnalytics: true,
        // Support - Accès complet
        canViewAllTickets: true,
        canViewOwnTickets: true,
        canManageTickets: true,
        canViewSupportAnalytics: true,
        // Admin - AUCUN accès
        canAccessAdmin: false,
        canManageUsers: false,
        canViewSystemLogs: false,
        canManageSecuritySettings: false,
        // Général
        canViewCalendar: true,
        canViewGantt: true,
        canViewReports: true,
        canViewFormations: true,
        // Scopes
        viewScope: 'all' as const,
        etablissementScope: 'all' as const,
        role: roleStr,
        team: 'direction' as TeamType,
        isAdmin: false,
        isLoading: false,
      }
    }

    // === CHEF DE PROJET / TECHNIQUE ===
    if (role === 'chef_projet') {
      return {
        // RH - Lecture limitée
        canViewSalaries: false,
        canEditSalaries: false,
        canViewRHDocuments: false,
        canUploadRHDocuments: false,
        canViewRHObjectifs: true,
        canEditRHObjectifs: false,
        canViewAllAbsences: true,
        canManageAbsences: false,
        canExportPayroll: false,
        // Équipe
        canViewAllTeamMembers: true,
        canViewTeamStats: true,
        canEditTeamMembers: false,
        canViewSensitiveTeamData: false,
        // CRM - Focus déploiement
        canViewAllEtablissements: true,
        canViewProspects: false,
        canViewDeploiement: true,
        canViewProduction: true,
        canEditEtablissements: true,
        canDeleteEtablissements: false,
        canViewPipeline: true,
        // Emails
        canViewAllEmails: true,
        canViewSharedEmails: true,
        canManageEmailDomains: false,
        canViewEmailAnalytics: true,
        // Trésorerie - Non
        canViewTresorerie: false,
        canEditTresorerie: false,
        canViewFactures: false,
        canExportTresorerie: false,
        // R&D - Complet
        canViewRD: true,
        canManageRDProjects: true,
        canManageSprints: true,
        canViewRDAnalytics: true,
        // Support - Complet
        canViewAllTickets: true,
        canViewOwnTickets: true,
        canManageTickets: true,
        canViewSupportAnalytics: true,
        // Admin - Non
        canAccessAdmin: false,
        canManageUsers: false,
        canViewSystemLogs: false,
        canManageSecuritySettings: false,
        // Général
        canViewCalendar: true,
        canViewGantt: true,
        canViewReports: true,
        canViewFormations: true,
        // Scopes
        viewScope: 'all' as const,
        etablissementScope: 'deploiement' as const,
        role: roleStr,
        team: 'technique' as TeamType,
        isAdmin: false,
        isLoading: false,
      }
    }

    // === RH ===
    if (role === 'rh') {
      return {
        // RH - Complet
        canViewSalaries: true,
        canEditSalaries: true,
        canViewRHDocuments: true,
        canUploadRHDocuments: true,
        canViewRHObjectifs: true,
        canEditRHObjectifs: true,
        canViewAllAbsences: true,
        canManageAbsences: true,
        canExportPayroll: true,
        // Équipe
        canViewAllTeamMembers: true,
        canViewTeamStats: true,
        canEditTeamMembers: false,
        canViewSensitiveTeamData: true,
        // CRM - Lecture seule
        canViewAllEtablissements: true,
        canViewProspects: false,
        canViewDeploiement: false,
        canViewProduction: true,
        canEditEtablissements: false,
        canDeleteEtablissements: false,
        canViewPipeline: false,
        // Emails
        canViewAllEmails: false,
        canViewSharedEmails: true,
        canManageEmailDomains: false,
        canViewEmailAnalytics: false,
        // Trésorerie - Aucun accès hors paie (la paie reste accessible via /people?tab=salaires)
        canViewTresorerie: false,
        canEditTresorerie: false,
        canViewFactures: false,
        canExportTresorerie: false,
        // R&D - Non
        canViewRD: false,
        canManageRDProjects: false,
        canManageSprints: false,
        canViewRDAnalytics: false,
        // Support - Non
        canViewAllTickets: false,
        canViewOwnTickets: false,
        canManageTickets: false,
        canViewSupportAnalytics: false,
        // Admin - Non
        canAccessAdmin: false,
        canManageUsers: false,
        canViewSystemLogs: false,
        canManageSecuritySettings: false,
        // Général
        canViewCalendar: true,
        canViewGantt: false,
        canViewReports: true,
        canViewFormations: true,
        // Scopes
        viewScope: 'all' as const,
        etablissementScope: 'production' as const,
        role: roleStr,
        team: 'direction' as TeamType,
        isAdmin: false,
        isLoading: false,
      }
    }

    // === CSM ===
    if (role === 'csm') {
      return {
        // RH - Propres objectifs uniquement
        canViewSalaries: false,
        canEditSalaries: false,
        canViewRHDocuments: false,
        canUploadRHDocuments: false,
        canViewRHObjectifs: true,
        canEditRHObjectifs: false,
        canViewAllAbsences: false,
        canManageAbsences: false,
        canExportPayroll: false,
        // Équipe
        canViewAllTeamMembers: false,
        canViewTeamStats: false,
        canEditTeamMembers: false,
        canViewSensitiveTeamData: false,
        // CRM - Focus déploiement + production (CSM prépare la prise en charge)
        canViewAllEtablissements: false,
        canViewProspects: false,
        canViewDeploiement: true,
        canViewProduction: true,
        canEditEtablissements: true,
        canDeleteEtablissements: false,
        canViewPipeline: false,
        // Emails
        canViewAllEmails: false,
        canViewSharedEmails: true,
        canManageEmailDomains: false,
        canViewEmailAnalytics: false,
        // Trésorerie - Non
        canViewTresorerie: false,
        canEditTresorerie: false,
        canViewFactures: false,
        canExportTresorerie: false,
        // R&D - Non
        canViewRD: false,
        canManageRDProjects: false,
        canManageSprints: false,
        canViewRDAnalytics: false,
        // Support - Accès à ses propres tickets
        canViewAllTickets: false,
        canViewOwnTickets: true,
        canManageTickets: false,
        canViewSupportAnalytics: false,
        // Admin - Non
        canAccessAdmin: false,
        canManageUsers: false,
        canViewSystemLogs: false,
        canManageSecuritySettings: false,
        // Général
        canViewCalendar: true,
        canViewGantt: true,
        canViewReports: false,
        canViewFormations: true,
        // Scopes
        viewScope: 'managed' as const,
        etablissementScope: 'deploiement_production' as const,
        role: roleStr,
        team: 'csm' as TeamType,
        isAdmin: false,
        isLoading: false,
      }
    }

    // === COMMERCIAL ===
    if (role === 'commercial') {
      return {
        // RH - Propres objectifs uniquement
        canViewSalaries: false,
        canEditSalaries: false,
        canViewRHDocuments: false,
        canUploadRHDocuments: false,
        canViewRHObjectifs: true,
        canEditRHObjectifs: false,
        canViewAllAbsences: false,
        canManageAbsences: false,
        canExportPayroll: false,
        // Équipe
        canViewAllTeamMembers: false,
        canViewTeamStats: false,
        canEditTeamMembers: false,
        canViewSensitiveTeamData: false,
        // CRM - Focus prospects
        canViewAllEtablissements: false,
        canViewProspects: true,
        canViewDeploiement: false,
        canViewProduction: false,
        canEditEtablissements: true,
        canDeleteEtablissements: false,
        canViewPipeline: true,
        // Emails
        canViewAllEmails: false,
        canViewSharedEmails: true,
        canManageEmailDomains: false,
        canViewEmailAnalytics: false,
        // Trésorerie - Non
        canViewTresorerie: false,
        canEditTresorerie: false,
        canViewFactures: false,
        canExportTresorerie: false,
        // R&D - Non
        canViewRD: false,
        canManageRDProjects: false,
        canManageSprints: false,
        canViewRDAnalytics: false,
        // Support - Non
        canViewAllTickets: false,
        canViewOwnTickets: false,
        canManageTickets: false,
        canViewSupportAnalytics: false,
        // Admin - Non
        canAccessAdmin: false,
        canManageUsers: false,
        canViewSystemLogs: false,
        canManageSecuritySettings: false,
        // Général
        canViewCalendar: true,
        canViewGantt: false,
        canViewReports: false,
        canViewFormations: false,
        // Scopes
        viewScope: 'managed' as const,
        etablissementScope: 'prospects' as const,
        role: roleStr,
        team: 'commercial' as TeamType,
        isAdmin: false,
        isLoading: false,
      }
    }

    // === MARKETING ===
    // Périmètre strict : communication & marketing + outils transverses.
    // Aucun accès CRM, aucun accès pipe commercial, aucun accès RH/finance/R&D/admin.
    if (role === 'marketing') {
      return {
        // RH - Aucun accès (ses propres objectifs restent visibles via /profil si besoin)
        canViewSalaries: false,
        canEditSalaries: false,
        canViewRHDocuments: false,
        canUploadRHDocuments: false,
        canViewRHObjectifs: false,
        canEditRHObjectifs: false,
        canViewAllAbsences: false,
        canManageAbsences: false,
        canExportPayroll: false,
        // Équipe
        canViewAllTeamMembers: false,
        canViewTeamStats: false,
        canEditTeamMembers: false,
        canViewSensitiveTeamData: false,
        // CRM - Aucun accès
        canViewAllEtablissements: false,
        canViewProspects: false,
        canViewDeploiement: false,
        canViewProduction: false,
        canEditEtablissements: false,
        canDeleteEtablissements: false,
        canViewPipeline: false,
        // Emails - Boîte partagée uniquement
        canViewAllEmails: false,
        canViewSharedEmails: true,
        canManageEmailDomains: false,
        canViewEmailAnalytics: false,
        // Trésorerie - Non
        canViewTresorerie: false,
        canEditTresorerie: false,
        canViewFactures: false,
        canExportTresorerie: false,
        // R&D - Non
        canViewRD: false,
        canManageRDProjects: false,
        canManageSprints: false,
        canViewRDAnalytics: false,
        // Support - Non
        canViewAllTickets: false,
        canViewOwnTickets: false,
        canManageTickets: false,
        canViewSupportAnalytics: false,
        // Admin - Non
        canAccessAdmin: false,
        canManageUsers: false,
        canViewSystemLogs: false,
        canManageSecuritySettings: false,
        // Général
        canViewCalendar: true,
        canViewGantt: false,
        canViewReports: false,
        canViewFormations: false,
        // Scopes
        viewScope: 'own' as const,
        etablissementScope: 'assigned' as const,
        role: roleStr,
        team: 'marketing' as TeamType,
        isAdmin: false,
        isLoading: false,
      }
    }

    // === PAR DÉFAUT (aucune permission) ===
    return {
      canViewSalaries: false,
      canEditSalaries: false,
      canViewRHDocuments: false,
      canUploadRHDocuments: false,
      canViewRHObjectifs: false,
      canEditRHObjectifs: false,
      canViewAllAbsences: false,
      canManageAbsences: false,
      canExportPayroll: false,
      canViewAllTeamMembers: false,
      canViewTeamStats: false,
      canEditTeamMembers: false,
      canViewSensitiveTeamData: false,
      canViewAllEtablissements: false,
      canViewProspects: false,
      canViewDeploiement: false,
      canViewProduction: false,
      canEditEtablissements: false,
      canDeleteEtablissements: false,
      canViewPipeline: false,
      canViewAllEmails: false,
      canViewSharedEmails: false,
      canManageEmailDomains: false,
      canViewEmailAnalytics: false,
      canViewTresorerie: false,
      canEditTresorerie: false,
      canViewFactures: false,
      canExportTresorerie: false,
      canViewRD: false,
      canManageRDProjects: false,
      canManageSprints: false,
      canViewRDAnalytics: false,
      canViewAllTickets: false,
      canViewOwnTickets: false,
      canManageTickets: false,
      canViewSupportAnalytics: false,
      canAccessAdmin: false,
      canManageUsers: false,
      canViewSystemLogs: false,
      canManageSecuritySettings: false,
      canViewCalendar: false,
      canViewGantt: false,
      canViewReports: false,
      canViewFormations: false,
      viewScope: 'own' as const,
      etablissementScope: 'assigned' as const,
      role: roleStr,
      team: null,
      isAdmin: false,
      isLoading,
    }
  }, [role, isAdmin, isLoading])

  return permissions
}
