import { memo, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Eye, Sparkles } from 'lucide-react'

// Import des VRAIS composants
import { HeroMetrics } from '@/components/dashboard/HeroMetrics'
import { EmailListItemModern } from '@/components/email/EmailListItemModern'
import { EnhancedEtablissementCard } from '@/components/etablissement/EnhancedEtablissementCard'

// Import des mock providers et données
import {
  TutorielPreviewWrapper,
  mockHeroMetricsProps,
  mockEmailThreads,
  mockEtablissement,
  mockProfiles,
  mockThreadEnrichedData,
} from './TutorielMockProviders'

// Import des Live Previews par module
import { TresorerieDashboardPreview, TresorerieRevenusPreview, TresorerieDepensesPreview } from './previews/TresoreriePreviews'
import { RHOverviewPreview, RHTeamListPreview, RHSalairesPreview, RHBulletinParsingPreview, RHAbsencesPreview } from './previews/RHPreviews'
import { CalendarTimelinePreview, CalendarMonthPreview, CalendarEventDetailPreview, CalendarRemindersPreview } from './previews/CalendrierPreviews'
import { GanttChartPreview, GanttTaskBarPreview, GanttFiltersPreview } from './previews/GanttPreviews'
import { RDDashboardPreview, RDSprintBoardPreview, RDBurndownPreview, RDAIAssistPreview } from './previews/RDPreviews'
import { DeploiementPhasesPreview, DeploiementKanbanPreview, DeploiementGanttPreview, DeploiementAlertesPreview } from './previews/DeploiementPreviews'
import { ProductionHealthScorePreview, ProductionCohortsPreview, ProductionCSMActionsPreview, ProductionRenewalAlertsPreview } from './previews/ProductionPreviews'
import { ProjetsTaskListPreview, ProjetsFiltresPreview, ProjetsAnalyticsPreview, ProjetsActionsEnMassePreview } from './previews/ProjetsPreviews'
import { AdminUsersListPreview, AdminSecurityPreview, AdminSettingsPreview } from './previews/AdministrationPreviews'
// Nouveaux previews Motion Design
import { DashboardKPIsPreview, DashboardPipelinePreview, DashboardActionsPreview } from './previews/DashboardPreviews'
import { EmailInboxPreview, EmailComposePreview, EmailClassificationPreview } from './previews/EmailsPreviews'
import { CRMEtablissementPreview, CRMContactsPreview, CRMNotesPreview } from './previews/CRMPreviews'
import { GroupeCardPreview, PartenaireCardPreview, RelationsTimelinePreview } from './previews/GroupesPartenairesPreviews'
import { ForumPostListPreview, ForumPostDetailPreview, ForumStatsPreview } from './previews/ForumPreviews'
import { RapportChartPreview, RapportExportPreview, RapportFiltersPreview } from './previews/RapportsPreviews'
import { MapPreview, TableauGeoPreview, RegionDetailPreview } from './previews/AnalyseGeographiquePreviews'

interface TutorielLivePreviewProps {
  moduleId: string
  sectionId: string
  fallbackTitle?: string
  fallbackIcon?: string
}

// ============================================
// WRAPPER COMPONENTS
// ============================================

const PreviewWrapper = memo(({ children, label }: { children: React.ReactNode; label: string }) => (
  <div className="relative rounded-xl border-2 border-border/50 overflow-hidden bg-background shadow-lg">
    <div className="absolute top-3 right-3 z-10">
      <Badge variant="secondary" className="gap-1.5 bg-primary/10 text-primary border-primary/20">
        <Eye className="h-3 w-3" />
        Composant réel
      </Badge>
    </div>
    <div className="p-4 overflow-hidden">
      {children}
    </div>
    <div className="px-4 py-2 bg-muted/50 border-t text-xs text-muted-foreground flex items-center gap-2">
      <Sparkles className="h-3 w-3" />
      {label}
    </div>
  </div>
))
PreviewWrapper.displayName = 'PreviewWrapper'

const FallbackPreview = memo(({ title, moduleId, sectionId }: { title: string; moduleId: string; sectionId: string }) => {
  const colors = useMemo(() => {
    const hue = moduleId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360
    return { primary: `hsl(${hue}, 70%, 50%)`, secondary: `hsl(${hue}, 60%, 95%)` }
  }, [moduleId])

  return (
    <div className="relative rounded-xl border-2 border-dashed border-border overflow-hidden" style={{ backgroundColor: colors.secondary }}>
      <div className="p-8 flex flex-col items-center justify-center min-h-[200px] text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: colors.primary + '20' }}>
          <Eye className="h-8 w-8" style={{ color: colors.primary }} />
        </div>
        <h4 className="font-semibold text-foreground mb-2">{title}</h4>
        <p className="text-sm text-muted-foreground max-w-xs">Aperçu en cours de développement</p>
        <Badge variant="outline" className="mt-4 text-xs">{moduleId}/{sectionId}</Badge>
      </div>
    </div>
  )
})
FallbackPreview.displayName = 'FallbackPreview'

// ============================================
// DASHBOARD - VRAI HeroMetrics
// ============================================

const RealHeroMetrics = memo(() => (
  <TutorielPreviewWrapper>
    <HeroMetrics {...mockHeroMetricsProps} />
  </TutorielPreviewWrapper>
))
RealHeroMetrics.displayName = 'RealHeroMetrics'

// ============================================
// EMAIL - VRAI EmailListItemModern
// ============================================

const RealEmailList = memo(() => (
  <TutorielPreviewWrapper>
    <div className="divide-y divide-border">
      {mockEmailThreads.map((thread) => (
        <EmailListItemModern
          key={thread.id}
          thread={thread as any}
          selected={false}
          isNew={thread.id === 'demo-thread-1'}
          enrichedData={mockThreadEnrichedData.get(thread.id)}
          onSelect={() => {}}
          onClick={() => {}}
        />
      ))}
    </div>
  </TutorielPreviewWrapper>
))
RealEmailList.displayName = 'RealEmailList'

// ============================================
// CRM - VRAI EnhancedEtablissementCard
// ============================================

const RealEtablissementCard = memo(() => (
  <TutorielPreviewWrapper>
    <div className="max-w-md">
      <EnhancedEtablissementCard
        etablissement={mockEtablissement as any}
        profiles={mockProfiles as any}
        isSelectionMode={false}
        isSelected={false}
        onSelect={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    </div>
  </TutorielPreviewWrapper>
))
RealEtablissementCard.displayName = 'RealEtablissementCard'

// ============================================
// SECTION MAPPING - Utilise les vrais composants
// ============================================

const getSectionPreview = (moduleId: string, sectionId: string): { component: React.ReactNode; label: string } | null => {
  const mapping: Record<string, Record<string, { component: React.ReactNode; label: string }>> = {
    // PRISE EN MAIN
    'prise-en-main': {
      'premiere-connexion': { component: <DashboardKPIsPreview />, label: 'Interface de connexion' },
      'navigation': { component: <DashboardActionsPreview />, label: 'Navigation dans l\'application' },
      'personnalisation': { component: <AdminSettingsPreview />, label: 'Personnalisation du profil' },
    },

    // DASHBOARD
    'dashboard': {
      'kpis': { component: <RealHeroMetrics />, label: 'Vrai composant HeroMetrics avec 5 cartes KPI' },
      'vue-ensemble': { component: <DashboardKPIsPreview />, label: 'KPIs animés du Dashboard' },
      'pipeline-unifie': { component: <DashboardPipelinePreview />, label: 'Pipeline Kanban unifié' },
      'actions-rapides': { component: <DashboardActionsPreview />, label: 'Actions rapides' },
    },
    
    // EMAILS
    'emails': {
      'boite-reception': { component: <RealEmailList />, label: 'Vrai composant EmailListItemModern × 3' },
      'navigation-emails': { component: <EmailInboxPreview />, label: 'Navigation dans les emails' },
      'redaction': { component: <EmailComposePreview />, label: 'Rédaction avec IA' },
      'classification-ia': { component: <EmailClassificationPreview />, label: 'Classification IA automatique' },
      'outils-ia': { component: <EmailComposePreview />, label: 'Outils IA pour emails' },
    },
    
    // CRM
    'crm': {
      'fiche-etablissement': { component: <RealEtablissementCard />, label: 'Vrai composant EnhancedEtablissementCard' },
      'liste-etablissements': { component: <CRMEtablissementPreview />, label: 'Liste des établissements' },
      'gestion-contacts': { component: <CRMContactsPreview />, label: 'Gestion des contacts' },
      'notes-activites': { component: <CRMNotesPreview />, label: 'Notes et activités' },
      'creation-etablissement': { component: <CRMEtablissementPreview />, label: 'Création d\'établissement' },
    },

    // GROUPES & PARTENAIRES
    'groupes-partenaires': {
      'gestion-groupes': { component: <GroupeCardPreview />, label: 'Gestion des groupes' },
      'gestion-partenaires': { component: <PartenaireCardPreview />, label: 'Gestion des partenaires' },
      'relations-historique': { component: <RelationsTimelinePreview />, label: 'Relations et historique' },
    },

    // FORUM
    'forum': {
      'decouverte': { component: <ForumPostListPreview />, label: 'Découverte du forum' },
      'consultation': { component: <ForumPostDetailPreview />, label: 'Consultation des sujets' },
      'participation': { component: <ForumPostDetailPreview />, label: 'Participation au forum' },
      'moderation': { component: <ForumStatsPreview />, label: 'Modération admin' },
      'bonnes-pratiques': { component: <ForumPostListPreview />, label: 'Bonnes pratiques' },
    },

    // TRÉSORERIE
    'tresorerie': {
      'dashboard-financier': { component: <TresorerieDashboardPreview />, label: 'Dashboard Trésorerie avec KPIs animés' },
      'gestion-revenus': { component: <TresorerieRevenusPreview />, label: 'Liste des revenus avec progression' },
      'gestion-depenses': { component: <TresorerieDepensesPreview />, label: 'Liste des dépenses par catégorie' },
      'integration-qonto': { component: <TresorerieDashboardPreview />, label: 'Intégration Qonto' },
      'previsionnel': { component: <TresorerieDashboardPreview />, label: 'Prévisionnel financier' },
    },

    // RH / PEOPLE
    'rh': {
      'vue-ensemble': { component: <RHOverviewPreview />, label: 'Vue d\'ensemble RH avec KPIs' },
      'dossiers-rh': { component: <RHTeamListPreview />, label: 'Dossiers RH des employés' },
      'gestion-salaires': { component: <RHSalairesPreview />, label: 'Gestion des salaires' },
      'parsing-bulletins': { component: <RHBulletinParsingPreview />, label: 'Parsing IA des bulletins' },
      'absences-conges': { component: <RHAbsencesPreview />, label: 'Planning des absences' },
    },

    // CALENDRIER
    'calendrier': {
      'vues-calendrier': { component: <CalendarTimelinePreview />, label: 'Vues du calendrier' },
      'creation-evenements': { component: <CalendarEventDetailPreview />, label: 'Création d\'événements' },
      'partage-calendriers': { component: <CalendarMonthPreview />, label: 'Partage de calendriers' },
      'rappels-notifications': { component: <CalendarRemindersPreview />, label: 'Rappels et notifications' },
    },

    // GANTT
    'gantt': {
      'lecture-gantt': { component: <GanttChartPreview />, label: 'Diagramme Gantt animé' },
      'manipulation-taches': { component: <GanttTaskBarPreview />, label: 'Manipulation des tâches' },
      'filtres-affichage': { component: <GanttFiltersPreview />, label: 'Filtres et affichage' },
    },

    // DÉPLOIEMENT
    'deploiement': {
      'phases-deploiement': { component: <DeploiementPhasesPreview />, label: 'Phases de déploiement' },
      'actions-rapides': { component: <DeploiementKanbanPreview />, label: 'Actions rapides' },
      'vues-filtres': { component: <DeploiementGanttPreview />, label: 'Vues et filtres' },
      'export-rapports': { component: <DeploiementAlertesPreview />, label: 'Alertes et exports' },
    },

    // PRODUCTION
    'production': {
      'metriques-sante': { component: <ProductionHealthScorePreview />, label: 'Métriques de santé client' },
      'cohortes': { component: <ProductionCohortsPreview />, label: 'Analyse par cohortes' },
      'actions-csm': { component: <ProductionCSMActionsPreview />, label: 'Actions CSM' },
      'alertes-renouvellement': { component: <ProductionRenewalAlertsPreview />, label: 'Alertes de renouvellement' },
    },

    // PROJETS
    'projets': {
      'liste-taches': { component: <ProjetsTaskListPreview />, label: 'Liste des tâches' },
      'filtres-tri': { component: <ProjetsFiltresPreview />, label: 'Filtres et tri' },
      'analytics-projets': { component: <ProjetsAnalyticsPreview />, label: 'Analytics projets' },
      'actions-masse': { component: <ProjetsActionsEnMassePreview />, label: 'Actions en masse' },
    },

    // R&D
    'rd-agile': {
      'dashboard-rd': { component: <RDDashboardPreview />, label: 'Dashboard R&D' },
      'backlog': { component: <RDSprintBoardPreview />, label: 'Backlog et User Stories' },
      'sprint-board': { component: <RDSprintBoardPreview />, label: 'Sprint Board Kanban' },
      'burndown-velocite': { component: <RDBurndownPreview />, label: 'Burndown et Vélocité' },
      'ai-assist': { component: <RDAIAssistPreview />, label: 'Assistant IA R&D' },
    },


    // RAPPORTS
    'rapports': {
      'types-rapports': { component: <RapportFiltersPreview />, label: 'Types de rapports disponibles' },
      'generation-export': { component: <RapportExportPreview />, label: 'Génération et export' },
      'visualisation': { component: <RapportChartPreview />, label: 'Visualisation graphique' },
    },

    // ANALYSE GÉOGRAPHIQUE
    'analyse-geographique': {
      'carte-interactive': { component: <MapPreview />, label: 'Carte interactive' },
      'tableau-donnees': { component: <TableauGeoPreview />, label: 'Tableau des données' },
      'filtres-export': { component: <RegionDetailPreview />, label: 'Filtres et export' },
    },

    // ADMINISTRATION
    'administration': {
      'gestion-utilisateurs': { component: <AdminUsersListPreview />, label: 'Gestion des utilisateurs' },
      'securite-2fa': { component: <AdminSecurityPreview />, label: 'Sécurité et 2FA' },
      'configuration-systeme': { component: <AdminSettingsPreview />, label: 'Configuration système' },
    },
  }

  return mapping[moduleId]?.[sectionId] || null
}

// ============================================
// MAIN COMPONENT
// ============================================

export const TutorielLivePreview = memo(({ moduleId, sectionId, fallbackTitle, fallbackIcon }: TutorielLivePreviewProps) => {
  const preview = getSectionPreview(moduleId, sectionId)

  if (preview) {
    return (
      <PreviewWrapper label={preview.label}>
        {preview.component}
      </PreviewWrapper>
    )
  }

  return <FallbackPreview title={fallbackTitle || sectionId} moduleId={moduleId} sectionId={sectionId} />
})

TutorielLivePreview.displayName = 'TutorielLivePreview'
