/**
 * MCP Server - Serveur Model Context Protocol pour Claude Cowork / Desktop
 * 
 * Expose l'intégralité des 135+ outils Jarvis via le protocole MCP Streamable HTTP.
 * Authentification via JWT Supabase (Bearer token).
 * 
 * Architecture :
 * - tools/list → charge les outils depuis ai_tools_config (DB) + registre statique
 * - tools/call → délègue l'exécution à jarvis-brain via HTTP interne
 */

import { createClient } from "@supabase/supabase-js";
import { origineAutorisee } from '../_shared/cors.ts'
import { validateUserAuth } from "../_shared/auth-helpers.ts";
import { ALLOWED_TABLES } from "../jarvis-brain/tool-registry.ts";
import { safeErrorLog } from "../_shared/error-sanitizer.ts";


// ============================================================
// CORS
// ============================================================
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============================================================
// STATIC TOOL REGISTRY (lightweight MCP-format definitions)
// Mirrors jarvis-brain/tool-registry.ts but in MCP schema format
// ============================================================
const STATIC_TOOLS: Array<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}> = [
  // ── CORE ──
  {
    name: "query_database",
    description: "Interroge la base de données OpenPulse (50+ tables : établissements, contacts, tâches, factures, emails, etc.). Supporte filtres, tri, pagination.",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Nom de la table à interroger" },
        select: { type: "string", description: "Colonnes à sélectionner (format Supabase)" },
        filters: {
          type: "array",
          description: "Filtres [{column, operator, value}]",
          items: {
            type: "object",
            properties: {
              column: { type: "string" },
              operator: { type: "string", enum: ["eq", "neq", "gt", "lt", "gte", "lte", "like", "ilike", "in", "is", "contains"] },
              value: { type: "string" },
            },
            required: ["column", "operator", "value"],
          },
        },
        order_by: { type: "string" },
        ascending: { type: "boolean" },
        limit: { type: "number", description: "Max 100" },
      },
      required: ["table"],
    },
  },
  {
    name: "send_email",
    description: "Envoie un email via le compte SMTP de l'utilisateur. Peut répondre à un thread existant.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Adresse email du destinataire" },
        subject: { type: "string" },
        body: { type: "string", description: "Corps de l'email (HTML ou texte)" },
        thread_id: { type: "string", description: "ID du thread pour répondre" },
        cc: { type: "array", items: { type: "string" } },
      },
      required: ["to", "body"],
    },
  },
  {
    name: "create_task",
    description: "Crée une tâche dans le CRM OpenPulse.",
    inputSchema: {
      type: "object",
      properties: {
        titre: { type: "string" },
        description: { type: "string" },
        priorite: { type: "string", enum: ["basse", "moyenne", "haute", "urgente"] },
        responsable_id: { type: "string" },
        etablissement_id: { type: "string" },
        date_echeance: { type: "string" },
        phase: { type: "string" },
      },
      required: ["titre"],
    },
  },
  {
    name: "update_task",
    description: "Met à jour une tâche existante (statut, priorité, responsable, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        updates: { type: "object", description: "Champs à mettre à jour" },
      },
      required: ["task_id", "updates"],
    },
  },
  {
    name: "schedule_meeting",
    description: "Planifie une réunion dans le calendrier.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        start_time: { type: "string" },
        end_time: { type: "string" },
        description: { type: "string" },
        attendees: { type: "array", items: { type: "string" } },
        location: { type: "string" },
        etablissement_id: { type: "string" },
      },
      required: ["title", "start_time", "end_time"],
    },
  },
  {
    name: "search_knowledge_base",
    description: "Recherche sémantique dans la base documentaire (RAG).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
        category: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "update_entity_status",
    description: "Met à jour le statut d'une entité (établissement, ticket, devis, facture, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        entity_type: { type: "string" },
        entity_id: { type: "string" },
        new_status: { type: "string" },
        reason: { type: "string" },
      },
      required: ["entity_type", "entity_id", "new_status"],
    },
  },
  {
    name: "get_user_context",
    description: "Récupère le contexte complet de l'utilisateur (profil, rôle, préférences, stats).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "calculate_metrics",
    description: "Calcule des métriques business (CA, pipeline, KPIs).",
    inputSchema: {
      type: "object",
      properties: {
        metric_type: { type: "string", enum: ["ca_mensuel", "pipeline", "taux_conversion", "ca_par_commercial", "ca_par_region", "tasks_completion", "email_volume", "support_kpis"] },
        period: { type: "string" },
        filters: { type: "object" },
      },
      required: ["metric_type"],
    },
  },

  // ── TRÉSORERIE ──
  {
    name: "sync_qonto_transactions",
    description: "Synchronise les transactions bancaires depuis l'API Qonto.",
    inputSchema: { type: "object", properties: { days: { type: "number" } } },
  },
  {
    name: "get_bank_balance",
    description: "Récupère le solde bancaire actuel depuis Qonto.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_invoice",
    description: "Crée une nouvelle facture.",
    inputSchema: {
      type: "object",
      properties: {
        etablissement_id: { type: "string" },
        lignes: { type: "array", description: "Lignes de facture" },
        date_echeance: { type: "string" },
        notes: { type: "string" },
      },
      required: ["etablissement_id", "lignes"],
    },
  },
  {
    name: "forecast_cashflow",
    description: "Prévisions de trésorerie sur N mois.",
    inputSchema: { type: "object", properties: { months: { type: "number" } } },
  },
  {
    name: "manage_expense",
    description: "Gère les dépenses (CRUD).",
    inputSchema: {
      type: "object",
      properties: { action: { type: "string", enum: ["create", "update", "delete", "list"] }, data: { type: "object" } },
      required: ["action"],
    },
  },
  {
    name: "manage_revenue",
    description: "Gère les revenus (CRUD).",
    inputSchema: {
      type: "object",
      properties: { action: { type: "string", enum: ["create", "update", "delete", "list"] }, data: { type: "object" } },
      required: ["action"],
    },
  },
  {
    name: "manage_budget",
    description: "Gère les budgets (CRUD).",
    inputSchema: {
      type: "object",
      properties: { action: { type: "string", enum: ["create", "update", "delete", "list"] }, data: { type: "object" } },
      required: ["action"],
    },
  },
  {
    name: "get_tresorerie_summary",
    description: "Vue d'ensemble trésorerie (solde, revenus, dépenses, prévisions).",
    inputSchema: { type: "object", properties: { period: { type: "string" } } },
  },
  {
    name: "manage_invoice",
    description: "Gère les factures (CRUD, envoi, relance).",
    inputSchema: {
      type: "object",
      properties: { action: { type: "string" }, invoice_id: { type: "string" }, data: { type: "object" } },
      required: ["action"],
    },
  },

  // ── RH ──
  {
    name: "parse_payslip",
    description: "Extrait les données d'un bulletin de paie (PDF) via IA.",
    inputSchema: {
      type: "object",
      properties: { file_url: { type: "string" }, employee_id: { type: "string" } },
      required: ["file_url"],
    },
  },
  {
    name: "manage_absence",
    description: "Gère les absences (création, validation, refus).",
    inputSchema: {
      type: "object",
      properties: { action: { type: "string" }, employee_id: { type: "string" }, data: { type: "object" } },
      required: ["action"],
    },
  },
  {
    name: "calculate_payroll_kpis",
    description: "Calcule les KPIs de paie (masse salariale, coût employeur, etc.).",
    inputSchema: { type: "object", properties: { period: { type: "string" } } },
  },
  {
    name: "recommend_training",
    description: "Recommande des formations basées sur les compétences.",
    inputSchema: { type: "object", properties: { employee_id: { type: "string" } }, required: ["employee_id"] },
  },
  {
    name: "get_employee_competences",
    description: "Récupère les compétences d'un employé.",
    inputSchema: { type: "object", properties: { employee_id: { type: "string" } }, required: ["employee_id"] },
  },
  {
    name: "get_employee_dossier",
    description: "Récupère le dossier RH complet d'un employé.",
    inputSchema: { type: "object", properties: { employee_id: { type: "string" } }, required: ["employee_id"] },
  },
  {
    name: "update_profile",
    description: "Met à jour le profil d'un utilisateur.",
    inputSchema: { type: "object", properties: { user_id: { type: "string" }, updates: { type: "object" } }, required: ["user_id", "updates"] },
  },

  // ── R&D ──
  {
    name: "manage_epic",
    description: "Gère les epics du backlog R&D.",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },
  {
    name: "manage_user_story",
    description: "Gère les user stories (création, estimation, priorisation).",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },
  {
    name: "manage_sprint",
    description: "Gère les sprints (planification, démarrage, clôture).",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },
  {
    name: "move_story_to_sprint",
    description: "Déplace une user story vers un sprint.",
    inputSchema: { type: "object", properties: { story_id: { type: "string" }, sprint_id: { type: "string" } }, required: ["story_id", "sprint_id"] },
  },
  {
    name: "calculate_rd_metrics",
    description: "Calcule les métriques R&D (vélocité, burndown, CFD).",
    inputSchema: { type: "object", properties: { sprint_id: { type: "string" } } },
  },
  {
    name: "ai_assist_story",
    description: "Assistance IA pour rédiger/affiner une user story.",
    inputSchema: { type: "object", properties: { story_id: { type: "string" }, instruction: { type: "string" } }, required: ["instruction"] },
  },

  // ── SUPPORT ──
  {
    name: "create_support_ticket",
    description: "Crée un ticket de support.",
    inputSchema: { type: "object", properties: { subject: { type: "string" }, description: { type: "string" }, priority: { type: "string" }, etablissement_id: { type: "string" } }, required: ["subject"] },
  },
  {
    name: "update_ticket_status",
    description: "Met à jour le statut d'un ticket.",
    inputSchema: { type: "object", properties: { ticket_id: { type: "string" }, status: { type: "string" } }, required: ["ticket_id", "status"] },
  },
  {
    name: "assign_ticket",
    description: "Assigne un ticket à un membre de l'équipe.",
    inputSchema: { type: "object", properties: { ticket_id: { type: "string" }, assignee_id: { type: "string" } }, required: ["ticket_id", "assignee_id"] },
  },
  {
    name: "get_support_kpis",
    description: "KPIs support (temps résolution, satisfaction, backlog).",
    inputSchema: { type: "object", properties: { period: { type: "string" } } },
  },

  // ── RECRUTEMENT ──
  {
    name: "manage_job_offer",
    description: "Gère les offres d'emploi.",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },
  {
    name: "manage_candidate",
    description: "Gère les candidats (ajout, mise à jour, suivi).",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },
  {
    name: "schedule_interview",
    description: "Planifie un entretien de recrutement.",
    inputSchema: { type: "object", properties: { candidate_id: { type: "string" }, date: { type: "string" }, interviewers: { type: "array", items: { type: "string" } } }, required: ["candidate_id", "date"] },
  },
  {
    name: "evaluate_candidate",
    description: "Enregistre l'évaluation d'un candidat.",
    inputSchema: { type: "object", properties: { candidate_id: { type: "string" }, scores: { type: "object" }, notes: { type: "string" } }, required: ["candidate_id"] },
  },
  {
    name: "parse_cv",
    description: "Analyse un CV via IA et extrait les informations structurées.",
    inputSchema: { type: "object", properties: { file_url: { type: "string" } }, required: ["file_url"] },
  },

  // ── COMMUNICATION / EMAIL ──
  {
    name: "translate_email",
    description: "Traduit un email dans la langue cible.",
    inputSchema: { type: "object", properties: { text: { type: "string" }, target_language: { type: "string" } }, required: ["text", "target_language"] },
  },
  {
    name: "correct_email",
    description: "Corrige l'orthographe et la grammaire d'un email.",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "reformulate_email",
    description: "Reformule un email avec un ton professionnel.",
    inputSchema: { type: "object", properties: { text: { type: "string" }, tone: { type: "string" } }, required: ["text"] },
  },
  {
    name: "suggest_email_response",
    description: "Suggère une réponse à un email.",
    inputSchema: { type: "object", properties: { thread_id: { type: "string" }, context: { type: "string" } }, required: ["thread_id"] },
  },
  {
    name: "create_email_template",
    description: "Crée un modèle d'email réutilisable.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, category: { type: "string" } }, required: ["name", "body"] },
  },

  // ── CALENDRIER ──
  {
    name: "get_my_calendar",
    description: "Récupère les événements du calendrier de l'utilisateur.",
    inputSchema: { type: "object", properties: { start_date: { type: "string" }, end_date: { type: "string" }, calendar_id: { type: "string" } } },
  },
  {
    name: "create_recurring_event",
    description: "Crée un événement récurrent.",
    inputSchema: { type: "object", properties: { title: { type: "string" }, start_time: { type: "string" }, end_time: { type: "string" }, recurrence_rule: { type: "string" } }, required: ["title", "start_time", "end_time", "recurrence_rule"] },
  },
  {
    name: "detect_calendar_conflicts",
    description: "Détecte les conflits dans le calendrier.",
    inputSchema: { type: "object", properties: { start_time: { type: "string" }, end_time: { type: "string" } }, required: ["start_time", "end_time"] },
  },
  {
    name: "update_calendar_event",
    description: "Met à jour un événement du calendrier.",
    inputSchema: { type: "object", properties: { event_id: { type: "string" }, updates: { type: "object" } }, required: ["event_id", "updates"] },
  },
  {
    name: "delete_calendar_event",
    description: "Supprime un événement du calendrier.",
    inputSchema: { type: "object", properties: { event_id: { type: "string" } }, required: ["event_id"] },
  },
  {
    name: "manage_booking",
    description: "Gère les réservations (créer, modifier, annuler).",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },

  // ── ADMIN ──
  {
    name: "manage_user",
    description: "Gère les utilisateurs (inviter, désactiver, modifier).",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },
  {
    name: "manage_user_role",
    description: "Gère les rôles utilisateur (attribuer, retirer).",
    inputSchema: { type: "object", properties: { user_id: { type: "string" }, role: { type: "string" }, action: { type: "string" } }, required: ["user_id", "role"] },
  },
  {
    name: "get_system_logs",
    description: "Récupère les logs système et d'audit.",
    inputSchema: { type: "object", properties: { type: { type: "string" }, limit: { type: "number" }, since: { type: "string" } } },
  },
  {
    name: "export_data_rgpd",
    description: "Exporte les données personnelles d'un utilisateur (conformité RGPD).",
    inputSchema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] },
  },
  {
    name: "get_ai_usage_stats",
    description: "Statistiques d'utilisation de l'IA (tokens, coûts, modèles).",
    inputSchema: { type: "object", properties: { period: { type: "string" } } },
  },

  // ── FORMATIONS ──
  {
    name: "create_training_session",
    description: "Crée une session de formation.",
    inputSchema: { type: "object", properties: { title: { type: "string" }, date: { type: "string" }, etablissement_id: { type: "string" }, trainer_id: { type: "string" } }, required: ["title", "date"] },
  },
  {
    name: "register_attendance",
    description: "Enregistre la présence à une session de formation.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" }, attendee_ids: { type: "array", items: { type: "string" } } }, required: ["session_id", "attendee_ids"] },
  },
  {
    name: "get_training_analytics",
    description: "Analytics de formation (taux complétion, scores, tendances).",
    inputSchema: { type: "object", properties: { etablissement_id: { type: "string" }, period: { type: "string" } } },
  },
  {
    name: "manage_certification",
    description: "Gère les certifications employés.",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },

  // ── CONTRATS ──
  {
    name: "generate_contract",
    description: "Génère un contrat à partir d'un modèle.",
    inputSchema: { type: "object", properties: { template_id: { type: "string" }, variables: { type: "object" } }, required: ["template_id", "variables"] },
  },
  {
    name: "ai_assist_contract",
    description: "Assistance IA pour la rédaction de contrats.",
    inputSchema: { type: "object", properties: { contract_id: { type: "string" }, instruction: { type: "string" } }, required: ["instruction"] },
  },
  {
    name: "request_signature",
    description: "Demande de signature électronique pour un document.",
    inputSchema: { type: "object", properties: { document_id: { type: "string" }, signers: { type: "array", items: { type: "object" } } }, required: ["document_id", "signers"] },
  },
  {
    name: "manage_contract_template",
    description: "Gère les modèles de contrats.",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },
  {
    name: "manage_document",
    description: "Gère les documents (upload, classification, partage).",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },

  // ── ANALYTICS ──
  {
    name: "get_dashboard_summary",
    description: "Résumé du dashboard principal (KPIs, pipeline, tâches, alertes).",
    inputSchema: { type: "object", properties: { period: { type: "string" } } },
  },
  {
    name: "get_daily_digest",
    description: "Digest quotidien personnalisé (tâches, emails, réunions, alertes).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_performance_report",
    description: "Rapport de performance par commercial/équipe.",
    inputSchema: { type: "object", properties: { user_id: { type: "string" }, period: { type: "string" } } },
  },
  {
    name: "analyze_trends",
    description: "Analyse les tendances (CA, churn, satisfaction, etc.).",
    inputSchema: { type: "object", properties: { metric: { type: "string" }, period: { type: "string" }, granularity: { type: "string" } }, required: ["metric"] },
  },
  {
    name: "predict_trend",
    description: "Prédiction de tendance via analyse statistique.",
    inputSchema: { type: "object", properties: { metric: { type: "string" }, horizon: { type: "number" } }, required: ["metric"] },
  },
  {
    name: "detect_anomalies",
    description: "Détecte les anomalies dans les données business.",
    inputSchema: { type: "object", properties: { metric: { type: "string" }, period: { type: "string" } }, required: ["metric"] },
  },

  // ── CRM ──
  {
    name: "manage_etablissement",
    description: "Gère les établissements (CRUD, recherche, filtrage).",
    inputSchema: { type: "object", properties: { action: { type: "string", enum: ["create", "update", "get", "list", "search"] }, data: { type: "object" } }, required: ["action"] },
  },
  {
    name: "manage_contact",
    description: "Gère les contacts (CRUD, recherche).",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },
  {
    name: "manage_groupe",
    description: "Gère les groupes d'établissements.",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },
  {
    name: "manage_partenaire",
    description: "Gère les partenaires.",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },
  {
    name: "score_prospects",
    description: "Score les prospects selon des critères IA.",
    inputSchema: { type: "object", properties: { etablissement_ids: { type: "array", items: { type: "string" } } } },
  },

  // ── CSM ──
  {
    name: "get_csm_health_score",
    description: "Score de santé client (health score).",
    inputSchema: { type: "object", properties: { etablissement_id: { type: "string" } }, required: ["etablissement_id"] },
  },
  {
    name: "get_csm_kpis",
    description: "KPIs Customer Success Management.",
    inputSchema: { type: "object", properties: { period: { type: "string" } } },
  },
  {
    name: "manage_csm_milestone",
    description: "Gère les jalons du parcours client.",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },
  {
    name: "get_churn_predictions",
    description: "Prédictions de churn client.",
    inputSchema: { type: "object", properties: { threshold: { type: "number" } } },
  },

  // ── DOCUMENTS ──
  {
    name: "search_documents",
    description: "Recherche dans les documents (fichiers, stockage).",
    inputSchema: { type: "object", properties: { query: { type: "string" }, bucket: { type: "string" }, limit: { type: "number" } }, required: ["query"] },
  },
  {
    name: "index_document",
    description: "Indexe un document pour la recherche sémantique.",
    inputSchema: { type: "object", properties: { file_path: { type: "string" }, metadata: { type: "object" } }, required: ["file_path"] },
  },
  {
    name: "list_files",
    description: "Liste les fichiers dans un répertoire de stockage.",
    inputSchema: { type: "object", properties: { path: { type: "string" }, bucket: { type: "string" } } },
  },

  // ── DEVIS / FACTURES / AVOIRS ──
  {
    name: "manage_devis",
    description: "Gère les devis (création, modification, envoi).",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },
  {
    name: "convert_devis_to_invoice",
    description: "Convertit un devis accepté en facture.",
    inputSchema: { type: "object", properties: { devis_id: { type: "string" } }, required: ["devis_id"] },
  },
  {
    name: "manage_avoir",
    description: "Gère les avoirs (création, modification).",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },

  // ── BATCH ──
  {
    name: "batch_update_tasks",
    description: "Met à jour plusieurs tâches en batch.",
    inputSchema: { type: "object", properties: { task_ids: { type: "array", items: { type: "string" } }, updates: { type: "object" } }, required: ["task_ids", "updates"] },
  },
  {
    name: "batch_send_emails",
    description: "Envoie des emails en batch.",
    inputSchema: { type: "object", properties: { emails: { type: "array" } }, required: ["emails"] },
  },
  {
    name: "export_data",
    description: "Exporte des données en CSV/Excel.",
    inputSchema: { type: "object", properties: { table: { type: "string" }, format: { type: "string", enum: ["csv", "excel"] }, filters: { type: "object" } }, required: ["table"] },
  },

  // ── FORUM / PULSE ──
  {
    name: "manage_forum_post",
    description: "Gère les posts du forum interne.",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },
  {
    name: "send_pulse_message",
    description: "Envoie un message sur Pulse (messagerie interne).",
    inputSchema: { type: "object", properties: { conversation_id: { type: "string" }, content: { type: "string" } }, required: ["conversation_id", "content"] },
  },
  {
    name: "create_pulse_conversation",
    description: "Crée une nouvelle conversation Pulse.",
    inputSchema: { type: "object", properties: { participant_ids: { type: "array", items: { type: "string" } }, title: { type: "string" } }, required: ["participant_ids"] },
  },

  // ── WORKFLOWS ──
  {
    name: "execute_workflow",
    description: "Exécute un workflow prédéfini (onboarding, relance impayés, revue hebdo, etc.).",
    inputSchema: { type: "object", properties: { workflow_name: { type: "string" }, params: { type: "object" } }, required: ["workflow_name"] },
  },
  {
    name: "create_automation_rule",
    description: "Crée une règle d'automatisation.",
    inputSchema: { type: "object", properties: { trigger: { type: "string" }, conditions: { type: "object" }, actions: { type: "array" } }, required: ["trigger", "actions"] },
  },

  // ── WEB / UTILITY ──
  {
    name: "web_search",
    description: "Recherche sur le web (via Brave Search API).",
    inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] },
  },
  {
    name: "web_scrape",
    description: "Scrape le contenu d'une page web.",
    inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
  {
    name: "get_weather",
    description: "Récupère la météo pour une ville.",
    inputSchema: { type: "object", properties: { city: { type: "string" } }, required: ["city"] },
  },
  {
    name: "calculate_date",
    description: "Calcule des dates (ajouter jours, différence, jours ouvrés).",
    inputSchema: { type: "object", properties: { operation: { type: "string" }, date: { type: "string" }, value: { type: "number" } }, required: ["operation", "date"] },
  },
  {
    name: "convert_units",
    description: "Convertit des unités (monnaie, mesure, temps).",
    inputSchema: { type: "object", properties: { value: { type: "number" }, from: { type: "string" }, to: { type: "string" } }, required: ["value", "from", "to"] },
  },

  // ── EMAIL MANAGEMENT ──
  {
    name: "manage_email_draft",
    description: "Gère les brouillons d'email.",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },
  {
    name: "manage_email_filter",
    description: "Gère les filtres d'email (règles de tri automatique).",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },
  {
    name: "manage_email_thread",
    description: "Gère les threads d'email (archiver, marquer lu, déplacer).",
    inputSchema: { type: "object", properties: { action: { type: "string" }, thread_id: { type: "string" }, data: { type: "object" } }, required: ["action", "thread_id"] },
  },
  {
    name: "classify_email_thread",
    description: "Classifie un thread email via IA.",
    inputSchema: { type: "object", properties: { thread_id: { type: "string" } }, required: ["thread_id"] },
  },

  // ── INTELLIGENCE (Jarvis 13.0) ──
  {
    name: "generate_briefing",
    description: "Génère un briefing quotidien personnalisé.",
    inputSchema: { type: "object", properties: { scope: { type: "string", enum: ["personal", "team", "company"] } } },
  },
  {
    name: "compare_analysis",
    description: "Compare deux périodes ou entités sur des métriques.",
    inputSchema: { type: "object", properties: { entity_a: { type: "string" }, entity_b: { type: "string" }, metrics: { type: "array", items: { type: "string" } } }, required: ["entity_a", "entity_b"] },
  },
  {
    name: "suggest_actions",
    description: "Suggère des actions proactives basées sur le contexte.",
    inputSchema: { type: "object", properties: { context: { type: "string" } } },
  },
  {
    name: "bulk_action",
    description: "Exécute une action groupée sur plusieurs entités.",
    inputSchema: { type: "object", properties: { action: { type: "string" }, entity_type: { type: "string" }, entity_ids: { type: "array", items: { type: "string" } }, params: { type: "object" } }, required: ["action", "entity_type", "entity_ids"] },
  },

  // ── NOTIFICATIONS ──
  {
    name: "send_notification",
    description: "Envoie une notification push à un utilisateur.",
    inputSchema: { type: "object", properties: { user_id: { type: "string" }, title: { type: "string" }, body: { type: "string" }, url: { type: "string" } }, required: ["user_id", "title", "body"] },
  },
  {
    name: "get_notifications",
    description: "Récupère les notifications de l'utilisateur.",
    inputSchema: { type: "object", properties: { unread_only: { type: "boolean" }, limit: { type: "number" } } },
  },

  // ── REPORTING ──
  {
    name: "generate_report",
    description: "Génère un rapport structuré (PDF, Excel).",
    inputSchema: { type: "object", properties: { type: { type: "string" }, params: { type: "object" }, format: { type: "string", enum: ["pdf", "excel", "json"] } }, required: ["type"] },
  },
  {
    name: "export_to_excel",
    description: "Exporte des données au format Excel.",
    inputSchema: { type: "object", properties: { data_source: { type: "string" }, filters: { type: "object" }, columns: { type: "array", items: { type: "string" } } }, required: ["data_source"] },
  },

  // ── TASK MANAGEMENT EXTENDED ──
  {
    name: "delete_task",
    description: "Supprime une tâche.",
    inputSchema: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] },
  },
  {
    name: "manage_subtask",
    description: "Gère les sous-tâches.",
    inputSchema: { type: "object", properties: { action: { type: "string" }, parent_task_id: { type: "string" }, data: { type: "object" } }, required: ["action", "parent_task_id"] },
  },
  {
    name: "log_time_entry",
    description: "Enregistre du temps passé sur une tâche.",
    inputSchema: { type: "object", properties: { task_id: { type: "string" }, duration_minutes: { type: "number" }, description: { type: "string" } }, required: ["task_id", "duration_minutes"] },
  },

  // ── OBJECTIVES ──
  {
    name: "create_objective",
    description: "Crée un objectif stratégique.",
    inputSchema: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, target_value: { type: "number" }, deadline: { type: "string" } }, required: ["title"] },
  },
  {
    name: "list_objectives",
    description: "Liste les objectifs en cours.",
    inputSchema: { type: "object", properties: { status: { type: "string" } } },
  },

  // ── CSM BILLING ──
  {
    name: "manage_csm_billing_followup",
    description: "Gère le suivi de facturation CSM.",
    inputSchema: { type: "object", properties: { action: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },

  // ── P6→P10 : WORKFLOWS / AUTOMATISATIONS ──
  {
    name: "list_workflows_v2",
    description: "Liste les workflows d'automatisation (actifs, désactivés ou tous).",
    inputSchema: { type: "object", properties: { status: { type: "string", enum: ["active", "inactive", "all"] }, limit: { type: "number" } } },
  },
  {
    name: "get_workflow_runs",
    description: "Historique d'exécutions d'un workflow (succès/échec, durée, erreurs).",
    inputSchema: { type: "object", properties: { workflow_id: { type: "string" }, status: { type: "string" }, limit: { type: "number" } } },
  },
  {
    name: "create_workflow_from_prompt",
    description: "Crée un workflow d'automatisation à partir d'une description en langue naturelle (direction uniquement).",
    inputSchema: { type: "object", properties: { prompt: { type: "string", description: "Description du workflow souhaité" } }, required: ["prompt"] },
  },
  {
    name: "toggle_workflow",
    description: "Active ou désactive un workflow (direction uniquement).",
    inputSchema: { type: "object", properties: { workflow_id: { type: "string" }, enabled: { type: "boolean" } }, required: ["workflow_id", "enabled"] },
  },
  {
    name: "run_workflow_now",
    description: "Déclenche manuellement l'exécution d'un workflow (direction uniquement).",
    inputSchema: { type: "object", properties: { workflow_id: { type: "string" }, payload: { type: "object" } }, required: ["workflow_id"] },
  },

  // ── P6→P10 : CATALOGUE PRODUITS ──
  {
    name: "list_catalogue_produits",
    description: "Recherche dans le catalogue produits (filtres nom/catégorie/prix).",
    inputSchema: { type: "object", properties: { search: { type: "string" }, category: { type: "string" }, min_price: { type: "number" }, max_price: { type: "number" }, limit: { type: "number" } } },
  },
  {
    name: "get_catalogue_stats",
    description: "Statistiques d'utilisation du catalogue (devis, factures, CA cumulé par produit).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "manage_catalogue_produit",
    description: "Crée, modifie ou archive un produit du catalogue (direction uniquement).",
    inputSchema: { type: "object", properties: { action: { type: "string", enum: ["create", "update", "archive"] }, produit_id: { type: "string" }, data: { type: "object" } }, required: ["action"] },
  },

  // ── P6→P10 : RAPPORTS PERSONNALISÉS ──
  {
    name: "list_custom_reports",
    description: "Liste les dashboards personnalisés (mes propres + partagés + templates).",
    inputSchema: { type: "object", properties: { search: { type: "string" }, include_templates: { type: "boolean" }, limit: { type: "number" } } },
  },
  {
    name: "run_custom_report",
    description: "Exécute un rapport sur une source de données whitelistée avec filtres.",
    inputSchema: { type: "object", properties: { source: { type: "string", description: "Clé de source (etablissements_pipeline, factures_par_mois, etc.)" }, filters: { type: "object" } }, required: ["source"] },
  },
  {
    name: "export_custom_report",
    description: "Exporte un rapport au format PDF, XLSX ou CSV (URL signée 1h).",
    inputSchema: { type: "object", properties: { dashboard_id: { type: "string" }, source: { type: "string" }, filters: { type: "object" }, format: { type: "string", enum: ["pdf", "xlsx", "csv"] } } },
  },

  // ── P6→P10 : ACTIVITY FEED ──
  {
    name: "get_activity_feed",
    description: "Flux d'activité global de l'équipe (tâches, emails, calendrier, etc.) avec filtres et pagination cursor.",
    inputSchema: { type: "object", properties: { limit: { type: "number" }, cursor: { type: "string" }, types: { type: "array", items: { type: "string" } }, user_ids: { type: "array", items: { type: "string" } }, etablissement_ids: { type: "array", items: { type: "string" } }, date_from: { type: "string" }, date_to: { type: "string" }, search: { type: "string" } } },
  },
  {
    name: "pin_activity_event",
    description: "Épingle ou désépingle un événement de l'activity feed.",
    inputSchema: { type: "object", properties: { activity_key: { type: "string" }, action: { type: "string", enum: ["pin", "unpin"] }, note: { type: "string" } }, required: ["activity_key", "action"] },
  },

  // ── P6→P10 : CHURN PREDICTOR ──
  {
    name: "get_churn_risk_accounts",
    description: "Top N comptes à risque de churn (filtres tier critique/élevé/modéré/faible).",
    inputSchema: { type: "object", properties: { tier: { type: "string", enum: ["critical", "high", "medium", "low", "all"] }, limit: { type: "number" } } },
  },
  {
    name: "recompute_churn_risk",
    description: "Relance le calcul des prédictions de churn pour tous les comptes (direction uniquement).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_churn_account_detail",
    description: "Détail du score de churn pour un établissement (facteurs + recommandations).",
    inputSchema: { type: "object", properties: { etablissement_id: { type: "string" } }, required: ["etablissement_id"] },
  },

  // ── P6→P10 : SALES FORECASTING ──
  {
    name: "get_sales_forecast",
    description: "Prévisions de ventes pondérées (vue trimestre/commercial/phase).",
    inputSchema: { type: "object", properties: { range: { type: "string", enum: ["current_quarter", "next_quarter", "year", "rolling_12"] } } },
  },
  {
    name: "compare_forecast_vs_actual",
    description: "Compare le pipeline pondéré au réalisé (factures gagnées vs prévision).",
    inputSchema: { type: "object", properties: { range: { type: "string", enum: ["current_quarter", "next_quarter", "year", "rolling_12"] } } },
  },

  // ── P6→P10 : SIGNATURES DOCUSEAL ──
  {
    name: "list_signature_requests",
    description: "Liste des demandes de signature électronique (filtre par statut pending/signed/expired).",
    inputSchema: { type: "object", properties: { status: { type: "string" }, limit: { type: "number" } } },
  },
  {
    name: "remind_signature",
    description: "Envoie un rappel pour une demande de signature en attente.",
    inputSchema: { type: "object", properties: { signature_request_id: { type: "string" } }, required: ["signature_request_id"] },
  },
  {
    name: "cancel_signature",
    description: "Annule une demande de signature (direction uniquement).",
    inputSchema: { type: "object", properties: { signature_request_id: { type: "string" }, reason: { type: "string" } }, required: ["signature_request_id"] },
  },

  // ── P6→P10 : ATTRIBUTION MULTI-TOUCH ──
  {
    name: "get_attribution_analysis",
    description: "Analyse d'attribution multi-touch pour un établissement (modèle time_decay, first_touch, last_touch ou linear).",
    inputSchema: { type: "object", properties: { etablissement_id: { type: "string" }, model: { type: "string", enum: ["first_touch", "last_touch", "linear", "time_decay"] } }, required: ["etablissement_id"] },
  },
];

// ============================================================
// SERVER INFO
// ============================================================
const SERVER_INFO = {
  name: "marque-ia",
  version: "1.0.0",
};

const CAPABILITIES = {
  tools: { listChanged: false },
};

// ============================================================
// JSON-RPC HANDLER
// ============================================================
type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

async function handleJsonRpc(
  rpcReq: JsonRpcRequest,
  httpReq: Request
): Promise<unknown> {
  const { method, params, id } = rpcReq;

  switch (method) {
    // ── Lifecycle ──
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-03-26",
          serverInfo: SERVER_INFO,
          capabilities: CAPABILITIES,
        },
      };

    case "notifications/initialized":
    case "initialized":
      return null; // Notification, no response

    // ── Tools ──
    case "tools/list": {
      const cursor = (params as any)?.cursor as string | undefined;
      const startIdx = cursor ? parseInt(cursor, 10) : 0;
      const PAGE_SIZE = 64;
      const page = STATIC_TOOLS.slice(startIdx, startIdx + PAGE_SIZE);
      const nextCursor =
        startIdx + PAGE_SIZE < STATIC_TOOLS.length
          ? String(startIdx + PAGE_SIZE)
          : undefined;

      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: page,
          ...(nextCursor ? { nextCursor } : {}),
        },
      };
    }

    case "tools/call": {
      const toolName = (params as any)?.name as string;
      const toolArgs = ((params as any)?.arguments ?? {}) as Record<string, unknown>;

      if (!toolName) {
        return { jsonrpc: "2.0", id, error: { code: -32602, message: "Missing tool name" } };
      }

      // Check tool exists
      const toolExists = STATIC_TOOLS.some((t) => t.name === toolName);
      if (!toolExists) {
        return { jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool: ${toolName}` } };
      }

      // Authenticate
      const authResult = await validateUserAuth(httpReq);
      if ("error" in authResult) {
        return { jsonrpc: "2.0", id, error: { code: -32001, message: authResult.error } };
      }

      // Delegate to jarvis-brain via internal HTTP call
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const authHeader = httpReq.headers.get("Authorization")!;

      try {
        // Build a jarvis-brain request that triggers a single tool call
        const brainPayload = {
          message: `__MCP_TOOL_CALL__`,
          mcp_tool_call: {
            name: toolName,
            arguments: toolArgs,
          },
          conversation_id: `mcp-${Date.now()}`,
        };

        const brainResponse = await fetch(`${supabaseUrl}/functions/v1/jarvis-brain`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify(brainPayload),
        });

        if (!brainResponse.ok) {
          const errorText = await brainResponse.text();
          console.error(`[MCP] jarvis-brain error: ${brainResponse.status}`, errorText);

          // If jarvis-brain doesn't support direct tool calls, fall back to direct execution
          // via a lightweight Supabase client
          return await executeToolDirectly(toolName, toolArgs, httpReq, id);
        }

        const brainData = await brainResponse.json();

        // L'absence du champ signifie que jarvis-brain n'a PAS execute l'outil :
        // il a repondu en conversation. Le rendre comme un succes donnait au
        // client un texte plausible a la place du resultat.
        if (!brainData || brainData.mcp_tool_result === undefined) {
          console.error(`[MCP] ${toolName} : reponse sans resultat d'outil`);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{
                type: "text",
                text: `L'outil ${toolName} n'a pas ete execute : la reponse ne portait pas de resultat.`,
              }],
              isError: true,
            },
          };
        }

        // Un outil qui ECHOUE rend un resultat DEFINI portant success: false --
        // outil desactive, permission refusee, delai depasse, outil inconnu.
        // Ne regarder que la presence du champ annoncait ces quatre cas comme
        // des succes, le refus lui-meme tenant lieu de reponse. Le repli
        // d'execution directe, lui, lisait deja `!result.success`.
        const resultatOutil = brainData.mcp_tool_result as { success?: boolean }
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(brainData.mcp_tool_result) }],
            isError: resultatOutil?.success === false,
          },
        };
      } catch (error) {
        console.error(`[MCP] Tool execution error for ${toolName}:`, error);
        // Fall back to direct execution
        return await executeToolDirectly(toolName, toolArgs, httpReq, id);
      }
    }

    // ── Ping ──
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

// ============================================================
// DIRECT TOOL EXECUTION (fallback when jarvis-brain delegation fails)
// Executes tools directly via Supabase client — simpler but covers core use cases
// ============================================================
async function executeToolDirectly(
  toolName: string,
  args: Record<string, unknown>,
  httpReq: Request,
  rpcId: string | number | null | undefined
): Promise<unknown> {
  const authHeader = httpReq.headers.get("Authorization")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Validate JWT
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return { jsonrpc: "2.0", id: rpcId, error: { code: -32001, message: "Authentication failed" } };
  }

  const authUserId = claimsData.claims.sub as string;

  // Resolve profile ID
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("user_id", authUserId)
    .single();

  const userId = profile?.id || authUserId;

  try {
    let result: { success: boolean; data?: unknown; error?: string };

    // Direct execution for the most common read tools
    switch (toolName) {
      case "query_database": {
        const table = args.table as string;
        const select = (args.select as string) || "*";
        const limit = Math.min((args.limit as number) || 50, 100);
        const orderBy = args.order_by as string;
        const ascending = args.ascending as boolean ?? true;

        if (!ALLOWED_TABLES.includes(table)) {
          result = { success: false, error: `Table '${table}' is not allowed via MCP.` };
          break;
        }

        let query = supabase.from(table).select(select).limit(limit);
        if (orderBy) query = query.order(orderBy, { ascending });


        const filters = args.filters as Array<{ column: string; operator: string; value: string }>;
        if (filters) {
          for (const f of filters) {
            switch (f.operator) {
              case "eq": query = query.eq(f.column, f.value); break;
              case "neq": query = query.neq(f.column, f.value); break;
              case "gt": query = query.gt(f.column, f.value); break;
              case "lt": query = query.lt(f.column, f.value); break;
              case "gte": query = query.gte(f.column, f.value); break;
              case "lte": query = query.lte(f.column, f.value); break;
              case "like": query = query.like(f.column, f.value); break;
              case "ilike": query = query.ilike(f.column, f.value.replace(/%/g, "%25")); break;
              case "in": query = query.in(f.column, f.value.split(",")); break;
              case "is": query = query.is(f.column, f.value === "null" ? null : f.value); break;
            }
          }
        }

        const { data, error } = await query;
        result = error
          ? { success: false, error: error.message }
          : { success: true, data: { rows: data, count: data?.length || 0 } };
        break;
      }

      case "get_user_context": {
        const { data } = await supabase
          .from("profiles")
          .select("id, nom, prenom, email, poste, avatar_url")
          .eq("id", userId)
          .single();

        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", authUserId)
          .maybeSingle();

        result = { success: true, data: { profile: data, role: roleData?.role } };
        break;
      }

      case "get_my_calendar": {
        const startDate = (args.start_date as string) || new Date().toISOString().split("T")[0];
        const endDate = (args.end_date as string) || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

        const { data, error } = await supabase
          .from("calendar_events")
          .select("id, title, start_time, end_time, location, description, all_day, status")
          .gte("start_time", `${startDate}T00:00:00`)
          .lte("start_time", `${endDate}T23:59:59`)
          .order("start_time", { ascending: true })
          .limit(50);

        result = error
          ? { success: false, error: error.message }
          : { success: true, data: { events: data, count: data?.length || 0 } };
        break;
      }

      case "get_dashboard_summary": {
        const { data: stats } = await supabase.rpc("get_analytics_overview");
        result = { success: true, data: stats };
        break;
      }

      default: {
        // For all other tools, return a clear error suggesting to use jarvis-brain directly
        result = {
          success: false,
          error: `L'outil "${toolName}" nécessite l'exécution via jarvis-brain. Vérifiez que le serveur est accessible.`,
        };
      }
    }

    return {
      jsonrpc: "2.0",
      id: rpcId,
      result: {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: !result.success,
      },
    };
  } catch (error: unknown) {
    console.error(safeErrorLog('mcp-server.tool', error));
    return {
      jsonrpc: "2.0",
      id: rpcId,
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "Tool execution failed",
            }),
          },
        ],
        isError: true,
      },
    };
  }

}

// ============================================================
// HTTP HANDLER
// ============================================================
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // GET — server info (MCP discovery) + health check
  if (req.method === "GET") {
    const url = new URL(req.url);
    const isHealthCheck = url.searchParams.get("health") === "1";

    return jsonResponse({
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      description:
        "OpenPulse MCP Server — 135+ outils de gestion (CRM, RH, Trésorerie, R&D, Support, Email, Calendrier, Formations, Contrats, Analytics...)",
      tools_count: STATIC_TOOLS.length,
      protocol: "MCP Streamable HTTP",
      auth: "Bearer <JWT_SUPABASE>",
      ...(isHealthCheck && {
        status: "ok",
        timestamp: new Date().toISOString(),
        tools: STATIC_TOOLS.map((t) => t.name),
      }),
    });
  }

  // POST — JSON-RPC
  if (req.method === "POST") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } },
        400
      );
    }

    // Handle batch requests
    if (Array.isArray(body)) {
      const results = await Promise.all(
        (body as JsonRpcRequest[]).map((rpc) => handleJsonRpc(rpc, req))
      );
      const responses = results.filter((r) => r !== null);
      return jsonResponse(responses.length === 1 ? responses[0] : responses);
    }

    // Single request
    const result = await handleJsonRpc(body as JsonRpcRequest, req);
    if (result === null) {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    return jsonResponse(result);
  }

  // DELETE — session cleanup (stateless, no-op)
  if (req.method === "DELETE") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return jsonResponse(
    { jsonrpc: "2.0", error: { code: -32600, message: "Method not allowed" } },
    405
  );
});
