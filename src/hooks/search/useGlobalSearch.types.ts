export interface SearchResult {
  id: string;
  type:
    | "etablissement" | "email" | "tache" | "contact" | "groupe" | "event"
    | "pulse" | "pulse_conversation" | "profile" | "document" | "todo"
    | "rd_user_story" | "rd_projet" | "support_ticket" | "partenaire"
    | "facture" | "devis" | "contrat" | "formation_session" | "kb_article"
    | "custom_dashboard" | "workflow" | "candidate" | "job_offer"
    | "forum_post" | "social_post" | "produit" | "note_frais"
    | "avoir" | "email_template" | "email_sequence" | "booking" | "booking_page"
    | "contrat_template" | "csm_playbook" | "ai_agent" | "client_segment" | "calendar"
    | "absence" | "revenu" | "depense" | "proactive_alert" | "poll"
    | "dashboard_note" | "candidate_evaluation";
  title: string;
  subtitle?: string;
  badge?: string;
  href: string;
  linkedEtablissement?: {
    id: string;
    nom: string;
  };
}

export interface SearchResults {
  etablissements: SearchResult[];
  emails: SearchResult[];
  taches: SearchResult[];
  contacts: SearchResult[];
  groupes: SearchResult[];
  events: SearchResult[];
  pulseMessages: SearchResult[];
  pulseConversations: SearchResult[];
  profiles: SearchResult[];
  documents: SearchResult[];
  todos: SearchResult[];
  rdUserStories: SearchResult[];
  rdProjets: SearchResult[];
  supportTickets: SearchResult[];
  partenaires: SearchResult[];
  factures: SearchResult[];
  devis: SearchResult[];
  contrats: SearchResult[];
  kbArticles: SearchResult[];
  customDashboards: SearchResult[];
  workflows: SearchResult[];
  candidates: SearchResult[];
  jobOffers: SearchResult[];
  forumPosts: SearchResult[];
  socialPosts: SearchResult[];
  produits: SearchResult[];
  notesFrais: SearchResult[];
  avoirs: SearchResult[];
  emailTemplates: SearchResult[];
  emailSequences: SearchResult[];
  bookings: SearchResult[];
  bookingPages: SearchResult[];
  contratTemplates: SearchResult[];
  csmPlaybooks: SearchResult[];
  aiAgents: SearchResult[];
  clientSegments: SearchResult[];
  calendars: SearchResult[];
  absences: SearchResult[];
  revenus: SearchResult[];
  depenses: SearchResult[];
  proactiveAlerts: SearchResult[];
  polls: SearchResult[];
  dashboardNotes: SearchResult[];
  candidateEvaluations: SearchResult[];
}

export interface SearchPermissions {
  canViewAllEtablissements?: boolean;
  canViewAllEmails?: boolean;
  canViewSharedEmails?: boolean;
  canViewRHDocuments?: boolean;
  canViewCalendar?: boolean;
  canViewRD?: boolean;
  canViewAllTickets?: boolean;
  viewScope?: 'all' | 'assigned' | 'own' | 'managed';
}

export const EMPTY_RESULTS: SearchResults = {
  etablissements: [], emails: [], taches: [], contacts: [], groupes: [],
  events: [], pulseMessages: [], pulseConversations: [], profiles: [],
  documents: [], todos: [], rdUserStories: [], rdProjets: [],
  supportTickets: [], partenaires: [], factures: [], devis: [], contrats: [],
  kbArticles: [], customDashboards: [], workflows: [],
  candidates: [], jobOffers: [], forumPosts: [], socialPosts: [], produits: [],
  notesFrais: [], avoirs: [], emailTemplates: [], emailSequences: [],
  bookings: [], bookingPages: [], contratTemplates: [], csmPlaybooks: [],
  aiAgents: [], clientSegments: [], calendars: [], absences: [], revenus: [],
  depenses: [], proactiveAlerts: [], polls: [], dashboardNotes: [],
  candidateEvaluations: [],
};
