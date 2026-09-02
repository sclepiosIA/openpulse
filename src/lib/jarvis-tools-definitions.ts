/**
 * JARVIS Realtime Tools Definitions
 * 
 * Définitions des outils pour le mode vocal GPT Realtime.
 * Version optimisée pour le frontend avec descriptions concises.
 */

export interface JarvisRealtimeTool {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      items?: { type: string };
    }>;
    required?: string[];
  };
}

// Actions sensibles nécessitant confirmation vocale
export const SENSITIVE_VOICE_ACTIONS = [
  'send_email',
  'batch_send_emails',
  'create_invoice',
  'manage_user',
  'manage_user_role',
  'request_signature',
  'cleanup_old_data',
  'delete_entity',
  'create_workflow_from_prompt',
  'run_workflow_now',
  'toggle_workflow',
  'manage_catalogue_produit',
  'cancel_signature',
  'remind_signature',
  'recompute_churn_risk',
];

// Outils optimisés pour le mode vocal (subset des 60+ outils)
// Les descriptions sont courtes pour une meilleure compréhension vocale
export const JARVIS_REALTIME_TOOLS: JarvisRealtimeTool[] = [
  // === CORE TOOLS ===
  {
    type: 'function',
    name: 'query_database',
    description: 'Cherche des données dans la base (établissements, tâches, emails, contacts, factures, etc.)',
    parameters: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Nom de la table' },
        filters: { type: 'array', description: 'Filtres [{column, operator, value}]' },
        limit: { type: 'number', description: 'Nombre max de résultats' },
      },
      required: ['table'],
    },
  },
  {
    type: 'function',
    name: 'send_email',
    description: 'Envoie un email depuis le compte de l\'utilisateur',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Email du destinataire' },
        subject: { type: 'string', description: 'Sujet' },
        body: { type: 'string', description: 'Contenu de l\'email' },
        thread_id: { type: 'string', description: 'ID du thread pour répondre' },
      },
      required: ['to', 'body'],
    },
  },
  {
    type: 'function',
    name: 'create_task',
    description: 'Crée une nouvelle tâche',
    parameters: {
      type: 'object',
      properties: {
        titre: { type: 'string', description: 'Titre de la tâche' },
        description: { type: 'string', description: 'Description' },
        priorite: { type: 'string', enum: ['basse', 'moyenne', 'haute', 'critique'] },
        etablissement_id: { type: 'string', description: 'ID établissement lié' },
        date_echeance: { type: 'string', description: 'Date limite ISO' },
      },
      required: ['titre'],
    },
  },
  {
    type: 'function',
    name: 'update_entity_status',
    description: 'Met à jour le statut d\'une entité (tâche, établissement, ticket)',
    parameters: {
      type: 'object',
      properties: {
        entity_type: { type: 'string', enum: ['tache', 'etablissement', 'ticket'] },
        entity_id: { type: 'string', description: 'UUID de l\'entité' },
        new_status: { type: 'string', description: 'Nouveau statut' },
      },
      required: ['entity_type', 'entity_id', 'new_status'],
    },
  },
  {
    type: 'function',
    name: 'schedule_meeting',
    description: 'Planifie une réunion dans le calendrier',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Titre' },
        start_time: { type: 'string', description: 'Date/heure début ISO' },
        end_time: { type: 'string', description: 'Date/heure fin ISO' },
        location: { type: 'string', description: 'Lieu ou lien visio' },
      },
      required: ['title', 'start_time', 'end_time'],
    },
  },
  {
    type: 'function',
    name: 'get_user_context',
    description: 'Récupère le contexte de travail (tâches en cours, emails non lus, événements)',
    parameters: {
      type: 'object',
      properties: {
        include_emails: { type: 'boolean' },
        include_tasks: { type: 'boolean' },
        include_calendar: { type: 'boolean' },
      },
    },
  },
  {
    type: 'function',
    name: 'search_knowledge_base',
    description: 'Recherche dans la base de connaissances',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termes de recherche' },
      },
      required: ['query'],
    },
  },

  // === TREASURY TOOLS ===
  {
    type: 'function',
    name: 'get_bank_balance',
    description: 'Récupère le solde bancaire Qonto actuel',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'sync_qonto_transactions',
    description: 'Synchronise les transactions bancaires Qonto',
    parameters: {
      type: 'object',
      properties: {
        days_back: { type: 'number', description: 'Jours à synchroniser' },
      },
    },
  },
  {
    type: 'function',
    name: 'forecast_cashflow',
    description: 'Génère une prévision de trésorerie',
    parameters: {
      type: 'object',
      properties: {
        months_ahead: { type: 'number', description: 'Mois à prévoir (1-12)' },
      },
      required: ['months_ahead'],
    },
  },
  {
    type: 'function',
    name: 'create_invoice',
    description: 'Crée une facture pour un établissement',
    parameters: {
      type: 'object',
      properties: {
        etablissement_id: { type: 'string', description: 'ID établissement client' },
        lignes: { type: 'array', description: 'Lignes de facture' },
      },
      required: ['etablissement_id', 'lignes'],
    },
  },

  // === HR TOOLS ===
  {
    type: 'function',
    name: 'calculate_payroll_kpis',
    description: 'Calcule les KPIs RH (masse salariale, coût employeur)',
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string', description: 'Période YYYY-MM' },
      },
      required: ['period'],
    },
  },
  {
    type: 'function',
    name: 'manage_absence',
    description: 'Gère les absences (congés, RTT, maladie)',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'list'] },
        profile_id: { type: 'string' },
        data: { type: 'object' },
      },
      required: ['action', 'profile_id'],
    },
  },

  // === R&D TOOLS ===
  {
    type: 'function',
    name: 'manage_user_story',
    description: 'Gère les user stories R&D',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'update', 'list'] },
        data: { type: 'object' },
      },
      required: ['action'],
    },
  },
  {
    type: 'function',
    name: 'calculate_rd_metrics',
    description: 'Calcule les métriques R&D (vélocité, burndown)',
    parameters: {
      type: 'object',
      properties: {
        sprint_id: { type: 'string' },
        metric_type: { type: 'string', enum: ['velocity', 'burndown', 'all'] },
      },
    },
  },

  // === SUPPORT TOOLS ===
  {
    type: 'function',
    name: 'create_support_ticket',
    description: 'Crée un ticket support',
    parameters: {
      type: 'object',
      properties: {
        titre: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
      },
      required: ['titre', 'description'],
    },
  },
  {
    type: 'function',
    name: 'get_support_kpis',
    description: 'Calcule les KPIs support',
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string' },
      },
    },
  },

  // === ANALYTICS TOOLS ===
  {
    type: 'function',
    name: 'get_dashboard_summary',
    description: 'Résumé du tableau de bord (CA, tâches, pipeline)',
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string' },
      },
    },
  },
  {
    type: 'function',
    name: 'calculate_metrics',
    description: 'Calcule des métriques business',
    parameters: {
      type: 'object',
      properties: {
        metric_type: { type: 'string', enum: ['pipeline_value', 'conversion_rate', 'tasks_completion'] },
      },
      required: ['metric_type'],
    },
  },

  // === CRM TOOLS ===
  {
    type: 'function',
    name: 'manage_etablissement',
    description: 'Gère les établissements (créer, modifier, lister)',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'update', 'get', 'list'] },
        etablissement_id: { type: 'string' },
        data: { type: 'object' },
      },
      required: ['action'],
    },
  },
  {
    type: 'function',
    name: 'manage_contact',
    description: 'Gère les contacts',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'update', 'list'] },
        data: { type: 'object' },
      },
      required: ['action'],
    },
  },

  // === COMMUNICATION TOOLS ===
  {
    type: 'function',
    name: 'translate_email',
    description: 'Traduit un email',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        target_language: { type: 'string', enum: ['fr', 'en', 'de', 'es'] },
      },
      required: ['content', 'target_language'],
    },
  },
  {
    type: 'function',
    name: 'suggest_email_response',
    description: 'Suggère une réponse à un email',
    parameters: {
      type: 'object',
      properties: {
        thread_id: { type: 'string' },
      },
      required: ['thread_id'],
    },
  },

  // === WEB SEARCH ===
  {
    type: 'function',
    name: 'web_search',
    description: 'Recherche sur le web',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termes de recherche' },
        num_results: { type: 'number' },
      },
      required: ['query'],
    },
  },

  // === REMINDER ===
  {
    type: 'function',
    name: 'create_reminder',
    description: 'Crée un rappel',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        remind_at: { type: 'string', description: 'Date/heure ISO du rappel' },
      },
      required: ['message', 'remind_at'],
    },
  },

  // === P6→P10 — Lecture/écriture vocale ===
  {
    type: 'function',
    name: 'list_workflows_v2',
    description: 'Liste les workflows / automatisations',
    parameters: { type: 'object', properties: { active_only: { type: 'boolean' }, search: { type: 'string' } } },
  },
  {
    type: 'function',
    name: 'create_workflow_from_prompt',
    description: 'Crée une automatisation à partir d\'une description',
    parameters: { type: 'object', properties: { prompt: { type: 'string' }, activate: { type: 'boolean' } }, required: ['prompt'] },
  },
  {
    type: 'function',
    name: 'list_catalogue_produits',
    description: 'Recherche dans le catalogue produits/services',
    parameters: { type: 'object', properties: { search: { type: 'string' }, type: { type: 'string' } } },
  },
  {
    type: 'function',
    name: 'get_activity_feed',
    description: 'Flux d\'activité récente (emails, tâches, factures, signatures...)',
    parameters: { type: 'object', properties: { limit: { type: 'number' }, types: { type: 'array', items: { type: 'string' } } } },
  },
  {
    type: 'function',
    name: 'get_churn_risk_accounts',
    description: 'Comptes clients à risque de churn',
    parameters: { type: 'object', properties: { tier: { type: 'string', enum: ['critique', 'eleve', 'modere', 'faible'] }, limit: { type: 'number' } } },
  },
  {
    type: 'function',
    name: 'get_sales_forecast',
    description: 'Prévisions de ventes pondérées',
    parameters: { type: 'object', properties: { range: { type: 'string', enum: ['current_quarter', 'next_quarter', 'year', 'rolling_12'] } } },
  },
  {
    type: 'function',
    name: 'list_signature_requests',
    description: 'Liste les demandes de signature électronique',
    parameters: { type: 'object', properties: { status: { type: 'string' } } },
  },
  {
    type: 'function',
    name: 'run_custom_report',
    description: 'Exécute un rapport personnalisé (factures, pipeline, churn, MRR, etc.)',
    parameters: { type: 'object', properties: { source: { type: 'string' }, filters: { type: 'object' } }, required: ['source'] },
  },
  {
    type: 'function',
    name: 'get_workflow_runs',
    description: 'Historique d\'exécution des workflows (succès, échecs, durée)',
    parameters: { type: 'object', properties: { workflow_id: { type: 'string' }, status: { type: 'string', enum: ['success', 'failed', 'running'] }, limit: { type: 'number' } } },
  },
  {
    type: 'function',
    name: 'get_churn_account_detail',
    description: 'Détail du score de churn pour un établissement (facteurs + recommandations)',
    parameters: { type: 'object', properties: { etablissement_id: { type: 'string' } }, required: ['etablissement_id'] },
  },
  {
    type: 'function',
    name: 'compare_forecast_vs_actual',
    description: 'Compare prévisions de ventes pondérées vs réalisé',
    parameters: { type: 'object', properties: { range: { type: 'string', enum: ['current_quarter', 'last_quarter', 'year'] } } },
  },
  {
    type: 'function',
    name: 'get_attribution_analysis',
    description: 'Analyse d\'attribution multi-touch des sources de conversion d\'un compte',
    parameters: { type: 'object', properties: { etablissement_id: { type: 'string' }, model: { type: 'string', enum: ['time_decay', 'first_touch', 'last_touch', 'linear'] } }, required: ['etablissement_id'] },
  },
];

// Convertir au format GPT Realtime session.update tools
export function getRealtimeToolsForSession(): Array<{
  type: 'function';
  name: string;
  description: string;
  parameters: object;
}> {
  return JARVIS_REALTIME_TOOLS.map(tool => ({
    type: tool.type,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

// Obtenir la description d'une action pour confirmation vocale
export function getActionDescription(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'send_email':
      return `envoyer un email à ${args.to || 'destinataire'}`;
    case 'create_invoice':
      return `créer une facture`;
    case 'manage_user':
      return `modifier un utilisateur`;
    case 'request_signature':
      return `demander une signature`;
    case 'cleanup_old_data':
      return `nettoyer les anciennes données`;
    case 'create_workflow_from_prompt':
      return `créer une automatisation : "${String(args.prompt || '').slice(0, 60)}…"`;
    case 'run_workflow_now':
      return `déclencher manuellement un workflow`;
    case 'toggle_workflow':
      return `${args.is_active ? 'activer' : 'désactiver'} un workflow`;
    case 'manage_catalogue_produit':
      return `${args.action || 'modifier'} un produit du catalogue`;
    case 'cancel_signature':
      return `annuler une demande de signature`;
    case 'remind_signature':
      return `relancer les signataires`;
    case 'recompute_churn_risk':
      return `recalculer les prédictions de churn`;
    default:
      return `exécuter ${toolName}`;
  }
}
