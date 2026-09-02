import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry'

// Auth et NotFound chargées immédiatement (critiques)
export { default as Auth } from '@/pages/Auth'
export { default as ResetPassword } from '@/pages/ResetPassword'
export { default as NotFound } from '@/pages/NotFound'

// Dashboard importé directement pour éviter les problèmes de lazy loading sur la page d'accueil
export { default as Dashboard } from '@/pages/Dashboard'
export const DirectionDashboard = lazy(() => import('@/pages/DirectionDashboard'))

// Lazy loaded - chunk recovery in main.tsx handles dynamic import errors

// Lazy-loaded pages
export const EnqueteSatisfactionSolution = lazy(() => import('@/pages/EnqueteSatisfactionSolution'))
export const EnqueteCES = lazy(() => import('@/pages/enquetes/EnqueteCES'))
export const EnqueteSatisfaction = lazy(() => import('@/pages/enquetes/EnqueteSatisfaction'))
export const EnqueteSuiviCSM = lazy(() => import('@/pages/enquetes/EnqueteSuiviCSM'))
export const EnquetesDashboard = lazy(() => import('@/pages/EnquetesDashboard'))
export const EtablissementDetail = lazy(() => import('@/pages/EtablissementDetail'))

export const Equipe = lazy(() => import('@/pages/Equipe'))
export const People = lazy(() => import('@/pages/People'))
export const Parametres = lazy(() => import('@/pages/Parametres'))
export const ParametresFeedbacks = lazy(() => import('@/pages/ParametresFeedbacks'))
export const ParametresVisioconference = lazy(() => import('@/pages/ParametresVisioconference'))
export const ParametresWebDAV = lazy(() => import('@/pages/ParametresWebDAV'))
export const ParametresConfiguration = lazy(() => import('@/pages/ParametresConfiguration'))
export const ParametresPlatformApi = lazy(() => import('@/pages/ParametresPlatformApi'))
export const PortailClient = lazy(() => import('@/pages/PortailClient'))
export const PortailClientTaches = lazy(() => import('@/pages/PortailClientTaches'))
export const TemplatesTaches = lazy(() => import('@/pages/TemplatesTaches'))
export const Profil = lazy(() => import('@/pages/Profil'))
export const Prospects = lazy(() => import('@/pages/Prospects'))
export const ProspectsScoring = lazy(() => import('@/pages/ProspectsScoring'))
export const ApporteursAffaires = lazy(() => import('@/pages/ApporteursAffaires'))
export const Etablissements = lazy(() => import('@/pages/Etablissements'))
export const ForumModeration = lazy(() =>
  import('@/components/forum/ForumModeration').then((m) => ({ default: m.ForumModeration }))
)
export const ForumPostDetail = lazy(() => import('@/pages/ForumPostDetail'))
export const Rapports = lazy(() => import('@/pages/Rapports'))
export const RapportsBuilderList = lazy(() => import('@/pages/RapportsBuilderList'))
export const RapportBuilderView = lazy(() => import('@/pages/RapportBuilderView'))
export const BIStudio = lazy(() => import('@/pages/BIStudio'))
export const TempsTracking = lazy(() => import('@/pages/TempsTracking'))
export const ITAssets = lazy(() => import('@/pages/ITAssets'))
export const Comptabilite = lazy(() => import('@/pages/Comptabilite'))
export const RapportBuilderEdit = lazy(() => import('@/pages/RapportBuilderEdit'))
export const Calendrier = lazy(() => import('@/pages/Calendrier'))
export const CalendrierEditorial = lazy(() => import('@/pages/CalendrierEditorial'))
export const MarketingStatistiques = lazy(() => import('@/pages/MarketingStatistiques'))
export const Gantt = lazy(() => import('@/pages/Gantt'))
export const AnalyseGeographique = lazy(() => import('@/pages/AnalyseGeographique'))
export const Projets = lazy(() => import('@/pages/Projets'))
export const Deploiement = lazy(() => import('@/pages/Deploiement'))
export const Production = lazy(() => import('@/pages/Production'))
export const RD = lazy(() => import('@/pages/RD'))
export const Support = lazy(() => import('@/pages/Support'))
export const ImportCommercialData = lazy(() => import('@/pages/ImportCommercialData'))
export const Forecasting = lazy(() => import('@/pages/Forecasting'))
export const AttributionV2 = lazy(() => import('@/pages/AttributionV2'))
export const Automatisations = lazy(() => import('@/pages/Automatisations'))
export const AutomatisationBuilder = lazy(() => import('@/pages/AutomatisationBuilder'))
export const AutomationsHealth = lazy(() => import('@/pages/AutomationsHealth'))
export const AutomationsRunsExplorer = lazy(() => import('@/pages/AutomationsRunsExplorer'))
export const AutomationsWebhooksAndAlerts = lazy(
  () => import('@/pages/AutomationsWebhooksAndAlerts')
)
export const Appels = lazy(() => import('@/pages/Appels'))
export const ActivityFeed = lazy(() => import('@/pages/ActivityFeed'))

export const ChurnPredictor = lazy(() => import('@/pages/ChurnPredictor'))
export const PlaybooksCsm = lazy(() => import('@/pages/PlaybooksCsm'))

// Administration
export const GestionUtilisateurs = lazy(() => import('@/pages/GestionUtilisateurs'))
export const ConfigurationSysteme = lazy(() => import('@/pages/ConfigurationSysteme'))
export const GestionSecurite = lazy(() => import('@/pages/GestionSecurite'))
export const GestionBaseDonnees = lazy(() => import('@/pages/GestionBaseDonnees'))
export const GestionNotifications = lazy(() => import('@/pages/GestionNotifications'))
export const CentreNotifications = lazy(() => import('@/pages/CentreNotifications'))
export const LogsSysteme = lazy(() => import('@/pages/LogsSysteme'))
export const HealthCheck = lazy(() => import('@/pages/HealthCheck'))
export const SafeShell = lazy(() => import('@/pages/SafeShell'))
export const MarqueMonitor = lazy(() => import('@/pages/MarqueMonitor'))
export const AdminSatisfaction = lazy(() => import('@/pages/AdminSatisfaction'))
export const AdminSatisfactionCampagnes = lazy(() => import('@/pages/AdminSatisfactionCampagnes'))

// Email
export const Emails = lazy(() => import('@/pages/Emails'))
export const EmailTemplates = lazy(() => import('@/pages/EmailTemplates'))
export const EmailAnalytics = lazy(() => import('@/pages/EmailAnalytics'))
export const EmailClassificationAnalytics = lazy(
  () => import('@/pages/EmailClassificationAnalytics')
)
export const GestionEmailDomains = lazy(() => import('@/pages/GestionEmailDomains'))

// CRM
export const Groupes = lazy(() => import('@/pages/Groupes'))
export const GroupeDetail = lazy(() => import('@/pages/GroupeDetail'))
export const Partenaires = lazy(() => import('@/pages/Partenaires'))
export const PartenaireDetail = lazy(() => import('@/pages/PartenaireDetail'))

// Finance
export const Finances = lazy(() => import('@/pages/Finances'))
export const Tresorerie = lazy(() => import('@/pages/Tresorerie'))
export const Facturation = lazy(() => import('@/pages/Facturation'))
export const Contrats = lazy(() => import('@/pages/Contrats'))
export const ContratDetail = lazy(() => import('@/pages/ContratDetail'))
export const ContractBuilder = lazy(() => import('@/pages/ContractBuilder'))
export const CatalogueProduits = lazy(() => import('@/pages/CatalogueProduits'))

// RH
export const Recrutement = lazy(() => import('@/pages/Recrutement'))
export const Competences = lazy(() => import('@/pages/Competences'))

// Divers
export const LiveChat = lazy(() => import('@/pages/LiveChat'))
export const Pulse = lazy(() => import('@/pages/Pulse'))
export const Visio = lazy(() => import('@/pages/Visio'))
export const MeetingNotes = lazy(() => import('@/pages/MeetingNotes'))
export const Notes = lazy(() => import('@/pages/Notes'))
export const Forms = lazy(() => import('@/pages/Forms'))
export const FormBuilder = lazy(() => import('@/pages/FormBuilder'))
export const FormPublic = lazy(() => import('@/pages/FormPublic'))
export const PublicLinkPlaceholder = lazy(() => import('@/pages/PublicLinkPlaceholder'))
export const FormResponses = lazy(() => import('@/pages/FormResponses'))
export const Tutoriels = lazy(() => import('@/pages/Tutoriels'))
export const TutorielModule = lazy(() => import('@/pages/TutorielModule'))
export const BackendViewer = lazy(() => import('@/pages/BackendViewer'))
export const SimulateurROI = lazy(() => import('@/pages/SimulateurROI'))
export const Todos = lazy(() => import('@/pages/Todos'))
export const Documents = lazy(() => import('@/pages/Documents'))
export const AIUsageDashboard = lazy(() => import('@/pages/AIUsageDashboard'))
export const Booking = lazy(() => import('@/pages/Booking'))
export const PublicBooking = lazy(() => import('@/pages/PublicBooking'))
export const Rgpd = lazy(() => import('@/pages/Rgpd'))
export const DpoExemple = lazy(() => import('@/pages/DpoExemple'))
export const MentionsLegales = lazy(() => import('@/pages/MentionsLegales'))
export const PolitiqueConfidentialite = lazy(() => import('@/pages/PolitiqueConfidentialite'))
export const PublicTransfer = lazy(() => import('@/pages/PublicTransfer'))
export const ApiDeveloper = lazy(() => import('@/pages/ApiDeveloper'))

// Social / Réseaux sociaux
export const SocialDashboard = lazy(() => import('@/pages/SocialDashboard'))
export const ParametresSocial = lazy(() => import('@/pages/ParametresSocial'))
export const SocialComposer = lazy(() => import('@/pages/SocialComposer'))
export const SocialCalendar = lazy(() => import('@/pages/SocialCalendar'))
export const SocialInbox = lazy(() => import('@/pages/SocialInbox'))

// Mobile Apps
export const MobileMailApp = lazy(() => import('@/pages/mobile/MobileMailApp'))
export const MobileTodosApp = lazy(() => import('@/pages/mobile/MobileTodosApp'))
export const MobilePulseApp = lazy(() => import('@/pages/mobile/MobilePulseApp'))
export const MobileCalendarApp = lazy(() => import('@/pages/mobile/MobileCalendarApp'))
export const MobileDocumentsApp = lazy(() => import('@/pages/mobile/MobileDocumentsApp'))
export const MobileBookingApp = lazy(() => import('@/pages/mobile/MobileBookingApp'))
export const MobileJarvisApp = lazy(() => import('@/pages/mobile/MobileJarvisApp'))
export const MobileAppsInstall = lazy(() => import('@/pages/mobile/MobileAppsInstall'))
export const MobileAppInstallPage = lazy(() => import('@/pages/mobile/MobileAppInstallPage'))
