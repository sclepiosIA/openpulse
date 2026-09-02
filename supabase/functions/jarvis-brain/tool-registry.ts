/**
 * JARVIS 12.0 - Tool Registry
 * 
 * Définit tous les outils disponibles pour GPT-5 Tool Calling.
 * 60+ outils couvrant tous les modules métier de OpenPulse.
 */

// Tables autorisées pour query_database (50+ tables)
export const ALLOWED_TABLES = [
  // CRM
  "etablissements", "contacts", "groupes_etablissements", "partenaires",
  "taches", "task_templates", "document_types",
  
  // CRM/CSM extended
  "csm_kpis_mensuels", "csm_kpis_trimestriels", "csm_sante_comptes",
  "csm_parcours_jalons", "csm_facturation_suivi",
  "customer_health_metrics", "customer_activities", "churn_predictions",
  "client_segments", "etablissement_segments", "contacts_history",
  "ca_forecasts", "catalogue_produits",
  
  // Devis
  "devis", "devis_lignes",
  
  // Emails
  "email_threads", "email_messages", "email_attachments",
  "email_domain_mappings", "email_specific_mappings", "user_email_accounts",
  "email_drafts", "email_filters", "email_templates", "email_sync_logs",
  "email_to_etablissement_suggestions", "email_classification_audit",
  
  // Support
  "support_tickets", "support_ticket_comments",
  
  // Calendrier
  "calendar_events", "calendars", "calendar_shares", "calendar_subscriptions",
  "booking_types", "bookings", "booking_pages", "booking_availability_slots",
  "event_attendees", "event_reminders", "calendar_invitation_suggestions",
  "booking_exceptions", "booking_page_hosts", "booking_page_types",
  
  // Trésorerie
  "factures", "factures_lignes", "avoirs", "avoirs_lignes",
  "tresorerie_revenus", "tresorerie_depenses", "tresorerie_operations_bancaires",
  "tresorerie_budgets", "tresorerie_qonto_connections", "tresorerie_previsions",
  "tresorerie_categories", "tresorerie_rapprochement_log",
  
  // RH
  "profiles", "rh_salaires_mensuels", "rh_absences", "rh_bulletins_parsing_log",
  "employee_certifications", "employee_competences", "referentiel_competences",
  "onboarding_steps", "onboarding_user_progress",
  "competence_evaluations_history",
  
  // Formations
  "sessions_formation", "emargements", "enquetes_satisfaction",
  "formations_certifications", "formations_modules",
  "enquetes_satisfaction_formation", "enquetes_satisfaction_solution",
  
  // R&D
  "rd_epics", "rd_user_stories", "rd_sprints", "rd_tasks",
  "rd_comments", "rd_attachments", "rd_labels", "rd_story_labels",
  "rd_projets", "rd_sprint_stories",
  
  // Recrutement
  "job_offers", "candidates", "interviews", "candidate_evaluations", "candidate_documents",
  "candidate_history",
  
  // Contrats
  "contrats", "contrat_modeles", "contrat_clauses", "contrat_variables",
  "contrat_templates", "contrat_activities", "contrat_alertes", "contrat_avenants",
  "contrat_documents", "contrat_sections", "contrat_section_versions",
  
  // Tâches extended
  "categories_taches", "tache_sous_taches", "tache_recurrences", "tache_time_entries",
  
  // Documents & KB
  "documents",
  "document_folders", "document_shares", "document_relations", "document_audit_log",
  
  // Forum
  "forum_posts", "forum_comments", "forum_votes", "forum_reactions",
  "forum_bookmarks", "forum_user_stats",
  
  // Dashboard & Notifications
  "dashboard_layouts", "dashboard_notes", "in_app_notifications",
  
  // Configuration
  "app_config", "reference_data",
  
  // Système
  "user_roles", "notifications", "user_preferences", "user_feedbacks",
  "ai_processing_log", "ai_suggested_actions", "jarvis_conversations",
  "system_stats",

  // Pulse
  "pulse_conversations", "pulse_messages", "pulse_conversation_members",

  // Email Sequences
  "email_sequences", "email_sequence_enrollments",
];

// Edge Functions disponibles pour execute_edge_function
export const AVAILABLE_EDGE_FUNCTIONS = [
  // Trésorerie & Qonto
  "qonto-sync-transactions", "qonto-get-balance", "qonto-reconcile",
  "generate-invoice-pdf", "predict-cashflow", "export-fec",
  
  // RH & Paie
  "parse-bulletin-salaire", "sync-rh-tresorerie", "recommend-training",
  "export-paie", "calculate-payroll-stats",
  
  // Formations
  "send-formation-survey", "generate-attendance-report",
  
  // R&D
  "rd-ai-assist", "analyze-medical-economic-study",
  
  // Recrutement
  "parse-cv", "schedule-interview-email",
  
  // Emails
  "send-email", "send-email-reply", "translate-email",
  "correct-spelling-email", "reformulate-email", "suggest-email-content",
  "process-email-with-ai", "generate-thread-title",
  
  // Contrats
  "contract-ai-assist", "generate-contract-pdf", "request-docuseal-signature",
  
  // Support
  "create-support-ticket-from-email",
  
  // Calendrier
  "sync-ics-calendar", "detect-calendar-invitations",
  
  // IA
  "analyze-rapports-insights", "generate-ai-suggestions",
  
  // Système
  "hourly-email-sync-and-analysis", "send-push-notification",
  
  // Jarvis Web Intelligence
  "jarvis-web-scrape", "jarvis-background-worker",
];

// Définition complète des outils pour GPT-5 Tool Calling
const JARVIS_TOOLS_V3 = [
  // ============================================================
  // CORE TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "query_database",
      description: `Interroge la base de données OpenPulse pour récupérer des informations. Peut interroger 50+ tables.

COLONNES PRINCIPALES des tables les plus utilisées (utilise EXACTEMENT ces noms) :
- taches: id, titre, description, statut (à_faire/en_cours/terminée/annulée), priorite (basse/moyenne/haute/urgente), responsable_id (UUID profiles.id), etablissement_id, echeance, date_debut, categorie_id, archive, created_at, updated_at
- etablissements: id, nom, statut (prospect/contractuel/deploiement/production/resilie), type_structure, commercial_id, chef_projet_id, csm_id, ville, code_postal, region
- contacts: id, nom, prenom, email, telephone, etablissement_id, fonction, est_principal
- factures: id, numero, montant_ht, montant_ttc, montant_tva, statut, etablissement_id, date_emission, date_echeance
- profiles: id, nom, prenom, email, fonction, avatar_url, user_id, date_embauche, type_contrat
- email_threads: id, subject, ai_generated_title, category, last_message_at, is_read, etablissement_id
- support_tickets: id, subject, status, priority, created_at, etablissement_id
- devis: id, numero, montant_ht, montant_ttc, montant_tva, statut, etablissement_id, client_nom, date_emission, date_validite

IMPORTANT: N'invente JAMAIS de noms de colonnes. Si tu n'es pas sûr du nom exact, utilise select='*' avec limit=1 pour découvrir les colonnes.
Pour le filtre 'in', envoie les valeurs séparées par des virgules SANS parenthèses : "val1,val2,val3".`,
      parameters: {
        type: "object",
        properties: {
          table: {
            type: "string",
            description: "Nom de la table à interroger",
            enum: ALLOWED_TABLES
          },
          select: {
            type: "string",
            description: "Colonnes à sélectionner (format Supabase: 'id, nom, email' ou avec relations 'id, etablissement:etablissements(nom)')"
          },
          filters: {
            type: "array",
            description: "Filtres à appliquer",
            items: {
              type: "object",
              properties: {
                column: { type: "string" },
                operator: { type: "string", enum: ["eq", "neq", "gt", "lt", "gte", "lte", "like", "ilike", "in", "is", "contains"] },
                value: { type: "string" }
              },
              required: ["column", "operator", "value"]
            }
          },
          order_by: { type: "string", description: "Colonne pour le tri" },
          ascending: { type: "boolean", description: "Tri ascendant (true) ou descendant (false)" },
          limit: { type: "number", description: "Nombre max de résultats (max 100)" }
        },
        required: ["table"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Envoie un email depuis le compte de l'utilisateur",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Adresse email du destinataire" },
          subject: { type: "string", description: "Sujet de l'email" },
          body: { type: "string", description: "Corps de l'email (HTML supporté)" },
          thread_id: { type: "string", description: "ID du thread pour répondre à une conversation existante" },
          cc: { type: "array", items: { type: "string" }, description: "Adresses en copie" }
        },
        required: ["to", "body"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Crée une nouvelle tâche dans le système",
      parameters: {
        type: "object",
        properties: {
          titre: { type: "string", description: "Titre de la tâche" },
          description: { type: "string", description: "Description détaillée" },
          priorite: { type: "string", enum: ["basse", "moyenne", "haute", "critique"] },
          etablissement_id: { type: "string", description: "UUID de l'établissement lié" },
          assignee_id: { type: "string", description: "UUID de la personne assignée" },
          date_echeance: { type: "string", description: "Date limite (ISO 8601)" },
          categorie_id: { type: "string", description: "UUID de la catégorie (optionnel, utilise 'Jarvis' par défaut)" }
        },
        required: ["titre"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "schedule_meeting",
      description: "Planifie une réunion dans le calendrier",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Titre de la réunion" },
          start_time: { type: "string", description: "Date/heure de début (ISO 8601)" },
          end_time: { type: "string", description: "Date/heure de fin (ISO 8601)" },
          attendees: { type: "array", items: { type: "string" }, description: "Emails des participants" },
          location: { type: "string", description: "Lieu ou lien visio" },
          description: { type: "string", description: "Description/ordre du jour" },
          create_video_link: { type: "boolean", description: "Créer un lien de visioconférence" }
        },
        required: ["title", "start_time", "end_time"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Recherche dans les pages rédigées et les documents de l'instance, par recherche plein texte",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termes de recherche" },
          limit: { type: "number", description: "Nombre max de résultats" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_documents",
      description: "Recherche sémantique dans les documents indexés (PDF, Word, etc.). Utilise les embeddings vectoriels pour trouver les passages les plus pertinents dans les fichiers uploadés.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Question ou termes de recherche" },
          limit: { type: "number", description: "Nombre max de résultats (défaut: 10)" },
          similarity_threshold: { type: "number", description: "Seuil de similarité minimum (0-1, défaut: 0.65)" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "index_document",
      description: "Indexe un document pour la recherche sémantique RAG. Extrait le texte, le découpe en chunks et génère les embeddings.",
      parameters: {
        type: "object",
        properties: {
          document_id: { type: "string", description: "UUID du document à indexer" },
          force_reindex: { type: "boolean", description: "Forcer la réindexation même si déjà indexé" }
        },
        required: ["document_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_entity_status",
      description: "Met à jour le statut d'une entité (établissement, tâche, ticket)",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", enum: ["etablissement", "tache", "ticket"] },
          entity_id: { type: "string", description: "UUID de l'entité" },
          new_status: { type: "string", description: "Nouveau statut" },
          note: { type: "string", description: "Note explicative du changement" }
        },
        required: ["entity_type", "entity_id", "new_status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_user_context",
      description: "Récupère le contexte de travail de l'utilisateur (emails récents, tâches, événements)",
      parameters: {
        type: "object",
        properties: {
          include_emails: { type: "boolean", description: "Inclure les emails récents" },
          include_tasks: { type: "boolean", description: "Inclure les tâches en cours" },
          include_calendar: { type: "boolean", description: "Inclure les événements à venir" },
          include_tickets: { type: "boolean", description: "Inclure les tickets support ouverts" },
          days_back: { type: "number", description: "Nombre de jours à remonter" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calculate_metrics",
      description: "Calcule des métriques business (pipeline, CA, performance)",
      parameters: {
        type: "object",
        properties: {
          metric_type: {
            type: "string",
            enum: ["pipeline_value", "conversion_rate", "tasks_completion", "response_time", "monthly_revenue", "support_stats"],
            description: "Type de métrique à calculer"
          },
          filters: {
            type: "object",
            properties: {
              date_from: { type: "string" },
              date_to: { type: "string" },
              team_member_id: { type: "string" },
              etablissement_statut: { type: "string" }
            }
          }
        },
        required: ["metric_type"]
      }
    }
  },

  // ============================================================
  // TRÉSORERIE TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "sync_qonto_transactions",
      description: "Synchronise les transactions bancaires Qonto",
      parameters: {
        type: "object",
        properties: {
          days_back: { type: "number", description: "Nombre de jours à synchroniser (défaut: 30)" },
          force_relink: { type: "boolean", description: "Forcer le re-linkage avec l'API Qonto" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_bank_balance",
      description: "Récupère le solde bancaire actuel depuis Qonto",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "create_invoice",
      description: "Crée une nouvelle facture",
      parameters: {
        type: "object",
        properties: {
          etablissement_id: { type: "string", description: "UUID de l'établissement client" },
          lignes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                designation: { type: "string" },
                quantite: { type: "number" },
                prix_unitaire: { type: "number" },
                taux_tva: { type: "number" }
              },
              required: ["designation", "quantite", "prix_unitaire"]
            }
          },
          conditions_paiement: { type: "string" },
          notes: { type: "string" }
        },
        required: ["etablissement_id", "lignes"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "forecast_cashflow",
      description: "Génère une prévision de trésorerie",
      parameters: {
        type: "object",
        properties: {
          months_ahead: { type: "number", description: "Nombre de mois à prévoir (1-12)" }
        },
        required: ["months_ahead"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_expense",
      description: "Gère les dépenses (créer, modifier, supprimer, lister)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "delete", "list"] },
          expense_id: { type: "string", description: "UUID de la dépense (pour update/delete)" },
          data: {
            type: "object",
            properties: {
              designation: { type: "string" },
              montant: { type: "number" },
              categorie: { type: "string" },
              date_depense: { type: "string" },
              fournisseur: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },

  // ============================================================
  // RH & PAIE TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "parse_payslip",
      description: "Analyse un bulletin de salaire PDF pour en extraire les données",
      parameters: {
        type: "object",
        properties: {
          storage_path: { type: "string", description: "Chemin du fichier dans le storage" },
          profile_id: { type: "string", description: "UUID de l'employé concerné" }
        },
        required: ["storage_path", "profile_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_absence",
      description: "Gère les absences (congés, RTT, maladie)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "delete", "list"] },
          profile_id: { type: "string", description: "UUID de l'employé" },
          absence_id: { type: "string", description: "UUID de l'absence (pour update/delete)" },
          data: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["conge_paye", "rtt", "maladie", "sans_solde", "autre"] },
              date_debut: { type: "string" },
              date_fin: { type: "string" },
              motif: { type: "string" }
            }
          }
        },
        required: ["action", "profile_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calculate_payroll_kpis",
      description: "Calcule les KPIs RH (masse salariale, coût employeur, etc.)",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Période au format YYYY-MM" },
          department: { type: "string", description: "Filtrer par département" }
        },
        required: ["period"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "recommend_training",
      description: "Recommande des formations pour un employé",
      parameters: {
        type: "object",
        properties: {
          profile_id: { type: "string", description: "UUID de l'employé" }
        },
        required: ["profile_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_employee_competences",
      description: "Récupère les compétences d'un employé",
      parameters: {
        type: "object",
        properties: {
          profile_id: { type: "string", description: "UUID de l'employé" }
        },
        required: ["profile_id"]
      }
    }
  },

  // ============================================================
  // R&D AGILE TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "manage_epic",
      description: "Gère les epics R&D",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "delete", "list"] },
          epic_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              titre: { type: "string" },
              description: { type: "string" },
              priorite: { type: "string", enum: ["low", "medium", "high", "critical"] },
              statut: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_user_story",
      description: "Gère les user stories R&D",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "delete", "list"] },
          story_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              titre: { type: "string" },
              description: { type: "string" },
              epic_id: { type: "string" },
              sprint_id: { type: "string" },
              points: { type: "number" },
              statut: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_sprint",
      description: "Gère les sprints R&D",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "delete", "list", "start", "complete"] },
          sprint_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              nom: { type: "string" },
              date_debut: { type: "string" },
              date_fin: { type: "string" },
              objectif: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "move_story_to_sprint",
      description: "Déplace une user story vers un sprint",
      parameters: {
        type: "object",
        properties: {
          story_id: { type: "string", description: "UUID de la story" },
          sprint_id: { type: "string", description: "UUID du sprint cible" }
        },
        required: ["story_id", "sprint_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calculate_rd_metrics",
      description: "Calcule les métriques R&D (vélocité, burndown, CFD)",
      parameters: {
        type: "object",
        properties: {
          sprint_id: { type: "string", description: "UUID du sprint (optionnel)" },
          metric_type: { type: "string", enum: ["velocity", "burndown", "cfd", "all"] }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ai_assist_story",
      description: "Améliore la rédaction d'une user story avec l'IA (titre, description, critères d'acceptation)",
      parameters: {
        type: "object",
        properties: {
          titre: { type: "string", description: "Titre de la user story" },
          description: { type: "string", description: "Description actuelle (optionnel)" },
          action: { type: "string", enum: ["improve", "acceptance_criteria", "split"], description: "Type d'amélioration" }
        },
        required: ["titre"]
      }
    }
  },

  // ============================================================
  // SUPPORT TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "create_support_ticket",
      description: "Crée un ticket support",
      parameters: {
        type: "object",
        properties: {
          titre: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
          etablissement_id: { type: "string" }
        },
        required: ["titre", "description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_ticket_status",
      description: "Met à jour le statut d'un ticket",
      parameters: {
        type: "object",
        properties: {
          ticket_id: { type: "string" },
          status: { type: "string", enum: ["open", "in_progress", "waiting", "resolved", "closed"] },
          resolution_note: { type: "string" }
        },
        required: ["ticket_id", "status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "assign_ticket",
      description: "Assigne un ticket à un agent",
      parameters: {
        type: "object",
        properties: {
          ticket_id: { type: "string" },
          agent_id: { type: "string" }
        },
        required: ["ticket_id", "agent_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_support_kpis",
      description: "Calcule les KPIs support (temps de résolution, SLA, etc.)",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Période au format YYYY-MM ou 'last_30_days'" }
        }
      }
    }
  },

  // ============================================================
  // RECRUITMENT TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "manage_job_offer",
      description: "Gère les offres d'emploi",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "delete", "list", "publish", "close"] },
          offer_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              titre: { type: "string" },
              description: { type: "string" },
              departement: { type: "string" },
              type_contrat: { type: "string" },
              salaire_min: { type: "number" },
              salaire_max: { type: "number" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_candidate",
      description: "Gère les candidats",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "delete", "list", "advance_stage"] },
          candidate_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              nom: { type: "string" },
              prenom: { type: "string" },
              email: { type: "string" },
              job_offer_id: { type: "string" },
              stage: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "schedule_interview",
      description: "Planifie un entretien",
      parameters: {
        type: "object",
        properties: {
          candidate_id: { type: "string" },
          interviewer_id: { type: "string" },
          datetime: { type: "string" },
          type: { type: "string", enum: ["phone", "video", "onsite"] },
          notes: { type: "string" }
        },
        required: ["candidate_id", "interviewer_id", "datetime"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "evaluate_candidate",
      description: "Ajoute une évaluation pour un candidat",
      parameters: {
        type: "object",
        properties: {
          candidate_id: { type: "string" },
          criteria: {
            type: "object",
            properties: {
              technical_skills: { type: "number" },
              soft_skills: { type: "number" },
              experience: { type: "number" },
              cultural_fit: { type: "number" }
            }
          },
          recommendation: { type: "string", enum: ["hire", "maybe", "reject"] },
          notes: { type: "string" }
        },
        required: ["candidate_id", "criteria", "recommendation"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "parse_cv",
      description: "Analyse un CV avec l'IA",
      parameters: {
        type: "object",
        properties: {
          document_path: { type: "string", description: "Chemin du CV dans le storage" }
        },
        required: ["document_path"]
      }
    }
  },

  // ============================================================
  // COMMUNICATION TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "translate_email",
      description: "Traduit un email",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" },
          target_language: { type: "string", enum: ["fr", "en", "de", "es", "it"] }
        },
        required: ["content", "target_language"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "correct_email",
      description: "Corrige l'orthographe et la grammaire d'un email",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" }
        },
        required: ["content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reformulate_email",
      description: "Reformule un email avec un ton différent",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" },
          tone: { type: "string", enum: ["formal", "friendly", "concise", "detailed"] }
        },
        required: ["content", "tone"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "suggest_email_response",
      description: "Suggère une réponse à un email",
      parameters: {
        type: "object",
        properties: {
          thread_id: { type: "string" }
        },
        required: ["thread_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_email_template",
      description: "Crée un modèle d'email réutilisable",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
          variables: { type: "array", items: { type: "string" } }
        },
        required: ["name", "subject", "body"]
      }
    }
  },

  // ============================================================
  // CALENDAR TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "get_my_calendar",
      description: "Récupère les événements du calendrier de l'utilisateur pour une période donnée (par défaut la semaine en cours). Retourne titre, horaires, lieu, description, participants, nom du calendrier et couleur. Utilise cet outil quand l'utilisateur demande son planning, ses rendez-vous, son agenda ou ses prochains événements.",
      parameters: {
        type: "object",
        properties: {
          date_from: { type: "string", description: "Date de début ISO (défaut: aujourd'hui)" },
          date_to: { type: "string", description: "Date de fin ISO (défaut: fin de semaine)" },
          include_all_day: { type: "boolean", description: "Inclure les événements journée entière (défaut: true)" },
          calendar_ids: { type: "array", items: { type: "string" }, description: "Filtrer par IDs de calendriers spécifiques (optionnel, défaut: tous les calendriers visibles)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_recurring_event",
      description: "Crée un événement récurrent",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          start_time: { type: "string" },
          end_time: { type: "string" },
          recurrence_rule: { type: "string", description: "Règle RRULE (ex: FREQ=WEEKLY;BYDAY=MO,WE,FR)" },
          location: { type: "string" }
        },
        required: ["title", "start_time", "end_time", "recurrence_rule"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "detect_calendar_conflicts",
      description: "Détecte les conflits d'horaires",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string" },
          date_from: { type: "string" },
          date_to: { type: "string" }
        },
        required: ["date_from", "date_to"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "import_ics_calendar",
      description: "Importe un fichier ICS dans le calendrier",
      parameters: {
        type: "object",
        properties: {
          ics_content: { type: "string" },
          calendar_id: { type: "string" }
        },
        required: ["ics_content"]
      }
    }
  },

  // ============================================================
  // TRAINING TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "create_training_session",
      description: "Crée une session de formation",
      parameters: {
        type: "object",
        properties: {
          etablissement_id: { type: "string" },
          module: { type: "string" },
          date: { type: "string" },
          formateur_id: { type: "string" },
          duree_heures: { type: "number" }
        },
        required: ["etablissement_id", "module", "date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "register_attendance",
      description: "Enregistre la présence à une formation",
      parameters: {
        type: "object",
        properties: {
          session_id: { type: "string" },
          participant_id: { type: "string" },
          signature: { type: "string" }
        },
        required: ["session_id", "participant_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_training_analytics",
      description: "Récupère les statistiques de formation",
      parameters: {
        type: "object",
        properties: {
          etablissement_id: { type: "string" },
          period: { type: "string" }
        }
      }
    }
  },

  // ============================================================
  // CONTRACT TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "generate_contract",
      description: "Génère un contrat depuis un modèle",
      parameters: {
        type: "object",
        properties: {
          template_id: { type: "string" },
          etablissement_id: { type: "string" },
          variables: { type: "object" }
        },
        required: ["template_id", "etablissement_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ai_assist_contract",
      description: "Assistance IA pour la rédaction de contrat",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["adapt", "rewrite", "check", "suggest"] },
          content: { type: "string" },
          instructions: { type: "string" }
        },
        required: ["action", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "request_signature",
      description: "Demande une signature électronique via DocuSeal",
      parameters: {
        type: "object",
        properties: {
          document_id: { type: "string" },
          signataires: {
            type: "array",
            items: {
              type: "object",
              properties: {
                email: { type: "string" },
                nom: { type: "string" },
                role: { type: "string" }
              }
            }
          }
        },
        required: ["document_id", "signataires"]
      }
    }
  },

  // ============================================================
  // ADMIN TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "manage_user",
      description: "Gère les utilisateurs (admin uniquement)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "deactivate", "list"] },
          user_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              email: { type: "string" },
              nom: { type: "string" },
              prenom: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_user_role",
      description: "Modifie les rôles d'un utilisateur (admin uniquement)",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string" },
          role: { type: "string", enum: ["admin", "direction", "rh", "commercial", "csm", "chef_projet", "user"] },
          action: { type: "string", enum: ["add", "remove"] }
        },
        required: ["user_id", "role", "action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "export_data_rgpd",
      description: "Exporte les données RGPD d'un utilisateur",
      parameters: {
        type: "object",
        properties: {
          target_user_id: { type: "string" }
        },
        required: ["target_user_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_ai_usage_stats",
      description: "Récupère les statistiques d'utilisation de l'IA",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Période (ex: 'last_7_days', 'last_30_days', '2024-01')" }
        }
      }
    }
  },

  // ============================================================
  // GENERIC EDGE FUNCTION EXECUTOR
  // ============================================================
  {
    type: "function",
    function: {
      name: "execute_edge_function",
      description: "Exécute une Edge Function Supabase. Permet d'accéder à des fonctionnalités avancées non couvertes par les autres outils.",
      parameters: {
        type: "object",
        properties: {
          function_name: {
            type: "string",
            description: "Nom de l'Edge Function à exécuter",
            enum: AVAILABLE_EDGE_FUNCTIONS
          },
          payload: {
            type: "object",
            description: "Payload à envoyer à la fonction"
          }
        },
        required: ["function_name"]
      }
    }
  },

  // ============================================================
  // ANALYTICS & INSIGHTS TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "get_dashboard_summary",
      description: "Récupère un résumé complet du tableau de bord (CRM, tâches, emails, trésorerie) avec alertes",
      parameters: {
        type: "object",
        properties: {
          include_trends: { type: "boolean", description: "Inclure les tendances" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_daily_digest",
      description: "Génère un résumé quotidien des activités (tâches, réunions, emails, tickets)",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date au format YYYY-MM-DD (défaut: aujourd'hui)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_performance_report",
      description: "Génère un rapport de performance individuel ou équipe",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "UUID de l'utilisateur (optionnel, défaut: utilisateur courant)" },
          period: { type: "string", description: "Date de début de période au format YYYY-MM-DD" },
          type: { type: "string", enum: ["individual", "team"], description: "Type de rapport" }
        },
        required: ["period", "type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_trends",
      description: "Analyse les tendances sur une période (pipeline, tâches, support, revenus)",
      parameters: {
        type: "object",
        properties: {
          metric: { type: "string", enum: ["pipeline", "tasks", "support", "revenue"], description: "Type de métrique à analyser" },
          period_days: { type: "number", description: "Nombre de jours à analyser" }
        },
        required: ["metric", "period_days"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_smart_suggestions",
      description: "Génère des suggestions intelligentes basées sur le contexte (tâches en retard, prospects froids, factures impayées, etc.)",
      parameters: {
        type: "object",
        properties: {
          context: { type: "string", description: "Contexte additionnel (optionnel)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "compare_periods",
      description: "Compare deux périodes pour une métrique donnée",
      parameters: {
        type: "object",
        properties: {
          metric: { type: "string", enum: ["revenue", "tasks_completed", "tickets_resolved"], description: "Métrique à comparer" },
          period1_start: { type: "string", description: "Début période 1 (YYYY-MM-DD)" },
          period1_end: { type: "string", description: "Fin période 1 (YYYY-MM-DD)" },
          period2_start: { type: "string", description: "Début période 2 (YYYY-MM-DD)" },
          period2_end: { type: "string", description: "Fin période 2 (YYYY-MM-DD)" }
        },
        required: ["metric", "period1_start", "period1_end", "period2_start", "period2_end"]
      }
    }
  },

  // ============================================================
  // BATCH OPERATIONS TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "batch_update_tasks",
      description: "Met à jour plusieurs tâches en une seule opération (max 50)",
      parameters: {
        type: "object",
        properties: {
          task_ids: { type: "array", items: { type: "string" }, description: "Liste des UUIDs des tâches" },
          updates: {
            type: "object",
            properties: {
              statut: { type: "string", enum: ["en_attente", "en_cours", "terminee", "annulee"] },
              priorite: { type: "string", enum: ["basse", "moyenne", "haute", "critique"] },
              responsable_id: { type: "string" },
              date_echeance: { type: "string" }
            }
          }
        },
        required: ["task_ids", "updates"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "batch_send_emails",
      description: "Envoie plusieurs emails en une seule opération (max 20)",
      parameters: {
        type: "object",
        properties: {
          emails: {
            type: "array",
            items: {
              type: "object",
              properties: {
                to: { type: "string" },
                subject: { type: "string" },
                body: { type: "string" }
              },
              required: ["to", "subject", "body"]
            }
          }
        },
        required: ["emails"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "batch_create_tasks",
      description: "Crée plusieurs tâches en une seule opération (max 20)",
      parameters: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                titre: { type: "string" },
                description: { type: "string" },
                priorite: { type: "string" },
                etablissement_id: { type: "string" },
                date_echeance: { type: "string" }
              },
              required: ["titre"]
            }
          }
        },
        required: ["tasks"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "batch_assign_tasks",
      description: "Assigne plusieurs tâches à une personne",
      parameters: {
        type: "object",
        properties: {
          task_ids: { type: "array", items: { type: "string" } },
          assignee_id: { type: "string" }
        },
        required: ["task_ids", "assignee_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "batch_close_tickets",
      description: "Ferme plusieurs tickets support en une seule opération",
      parameters: {
        type: "object",
        properties: {
          ticket_ids: { type: "array", items: { type: "string" } },
          resolution_note: { type: "string" }
        },
        required: ["ticket_ids"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "bulk_email_classification",
      description: "Classifie plusieurs threads emails (établissement et/ou catégorie)",
      parameters: {
        type: "object",
        properties: {
          thread_ids: { type: "array", items: { type: "string" } },
          etablissement_id: { type: "string" },
          category: { type: "string" }
        },
        required: ["thread_ids"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "export_data",
      description: "Exporte des données en JSON (établissements, contacts, tâches, factures, tickets)",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", enum: ["etablissements", "contacts", "taches", "factures", "support_tickets"] },
          filters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                column: { type: "string" },
                operator: { type: "string", enum: ["eq", "neq", "gt", "lt", "gte", "lte", "ilike"] },
                value: { type: "string" }
              }
            }
          },
          format: { type: "string", enum: ["json", "csv"] }
        },
        required: ["table"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cleanup_old_data",
      description: "Nettoie les données anciennes (notifications lues, logs IA)",
      parameters: {
        type: "object",
        properties: {
          data_type: { type: "string", enum: ["notifications", "ai_logs", "email_sync_errors"] },
          days_old: { type: "number", description: "Supprimer les données plus anciennes que X jours" }
        },
        required: ["data_type", "days_old"]
      }
    }
  },

  // ============================================================
  // JARVIS SELF-REPORTING TOOL
  // ============================================================
  {
    type: "function",
    function: {
      name: "report_jarvis_issue",
      description: "Signale un problème technique rencontré par JARVIS pour investigation",
      parameters: {
        type: "object",
        properties: {
          tool_name: { type: "string", description: "Nom de l'outil qui a échoué" },
          error_message: { type: "string", description: "Message d'erreur" },
          context: { type: "object", description: "Contexte additionnel" },
          severity: { type: "string", enum: ["low", "medium", "high", "critical"] }
        },
        required: ["tool_name", "error_message"]
      }
    }
  },

  // ============================================================
  // NOTIFICATION & PROACTIVE TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "send_notification",
      description: "Envoie une notification push à un utilisateur",
      parameters: {
        type: "object",
        properties: {
          target_user_id: { type: "string", description: "UUID de l'utilisateur cible (défaut: utilisateur courant)" },
          title: { type: "string", description: "Titre de la notification" },
          message: { type: "string", description: "Corps du message" },
          type: { type: "string", enum: ["info", "success", "warning", "error"], description: "Type de notification" },
          link: { type: "string", description: "Lien à ouvrir au clic" },
          priority: { type: "string", enum: ["low", "normal", "high"] }
        },
        required: ["title", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_notifications",
      description: "Récupère les notifications de l'utilisateur",
      parameters: {
        type: "object",
        properties: {
          unread_only: { type: "boolean", description: "Ne récupérer que les non lues" },
          limit: { type: "number", description: "Nombre max (défaut: 20)" },
          type: { type: "string", description: "Filtrer par type" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "mark_notifications_read",
      description: "Marque des notifications comme lues",
      parameters: {
        type: "object",
        properties: {
          notification_ids: { type: "array", items: { type: "string" }, description: "UUIDs des notifications" },
          mark_all: { type: "boolean", description: "Marquer toutes comme lues" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "auto_followup_check",
      description: "Analyse proactive: détecte tâches en retard, prospects froids, emails sans réponse, factures impayées",
      parameters: {
        type: "object",
        properties: {
          domain: { type: "string", enum: ["all", "tasks", "crm", "emails", "treasury"], description: "Domaine à analyser (défaut: all)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_team_availability",
      description: "Vérifie la disponibilité de l'équipe pour une date/heure donnée",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date/heure ISO 8601" },
          duration_minutes: { type: "number", description: "Durée en minutes (défaut: 60)" },
          team_member_ids: { type: "array", items: { type: "string" }, description: "UUIDs des membres à vérifier (défaut: toute l'équipe)" }
        },
        required: ["date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_workflow",
      description: "Crée un workflow automatisé multi-étapes (ex: relance automatique, onboarding)",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nom du workflow" },
          trigger: { type: "string", description: "Déclencheur (ex: 'new_prospect', 'invoice_unpaid_7_days')" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: { type: "string", description: "Action à exécuter" },
                parameters: { type: "object", description: "Paramètres de l'action" },
                delay_minutes: { type: "number", description: "Délai avant exécution" }
              },
              required: ["action", "parameters"]
            }
          }
        },
        required: ["name", "trigger", "steps"]
      }
    }
  },

  // ============================================================
  // WEB SEARCH TOOLS (NEW)
  // ============================================================
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Recherche sur le web en temps réel via Brave Search avec analyse GPT-5. Utilise pour: actualités, documentation externe, veille concurrentielle, recherches médicales, informations temps réel, réglementation.",
      parameters: {
        type: "object",
        properties: {
          query: { 
            type: "string", 
            description: "Question ou termes de recherche en français ou anglais" 
          },
          search_type: { 
            type: "string", 
            enum: ["web", "news"],
            description: "Type de recherche (web par défaut, news pour actualités)" 
          },
          count: { 
            type: "number", 
            description: "Nombre de résultats (5-20, défaut: 10)" 
          },
          freshness: { 
            type: "string", 
            enum: ["day", "week", "month", "year"],
            description: "Filtrer par fraîcheur des résultats" 
          },
          analyze: { 
            type: "boolean", 
            description: "Demander une analyse GPT-5 des résultats (défaut: true)" 
          },
          analysis_focus: { 
            type: "string", 
            description: "Focus spécifique pour l'analyse (ex: 'aspects réglementaires', 'comparaison de solutions', 'tendances du marché')" 
          }
        },
        required: ["query"]
      }
    }
  },

  // ============================================================
  // CRM MANAGEMENT TOOLS (NEW)
  // ============================================================
  {
    type: "function",
    function: {
      name: "manage_etablissement",
      description: "Gère les établissements de santé (créer, modifier, supprimer, lister, rechercher). Actions CRM complètes sur le portefeuille client.",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["create", "update", "delete", "get", "list", "search"],
            description: "Action à effectuer" 
          },
          etablissement_id: { 
            type: "string", 
            description: "UUID de l'établissement (pour get/update/delete)" 
          },
          data: { 
            type: "object", 
            description: "Données de l'établissement (nom, statut, adresse, ville, code_postal, telephone, email, ca_previsionnel, ca_signe, dpi, commercial_id, csm_id)" 
          },
          filters: { 
            type: "object", 
            description: "Filtres pour list (statut, commercial_id, csm_id, dpi, ville, groupe_id)" 
          },
          search_term: { 
            type: "string", 
            description: "Terme de recherche pour action search" 
          },
          limit: { 
            type: "number", 
            description: "Nombre max de résultats (défaut: 50)" 
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_contact",
      description: "Gère les contacts des établissements (créer, modifier, supprimer, lister). Permet de maintenir la liste des interlocuteurs.",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["create", "update", "delete", "list"],
            description: "Action à effectuer" 
          },
          contact_id: { 
            type: "string", 
            description: "UUID du contact (pour update/delete)" 
          },
          etablissement_id: { 
            type: "string", 
            description: "UUID de l'établissement parent (requis pour create, optionnel pour list)" 
          },
          data: { 
            type: "object", 
            description: "Données du contact (nom, prenom, email, telephone, fonction, est_decideur, notes)" 
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_groupe",
      description: "Gère les groupes d'établissements (créer, modifier, supprimer, ajouter/retirer membres). Permet de regrouper des établissements liés.",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["create", "update", "delete", "list", "add_member", "remove_member"],
            description: "Action à effectuer" 
          },
          groupe_id: { 
            type: "string", 
            description: "UUID du groupe" 
          },
          etablissement_id: { 
            type: "string", 
            description: "UUID de l'établissement (pour add_member/remove_member)" 
          },
          data: { 
            type: "object", 
            description: "Données du groupe (nom, type, description)" 
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_partenaire",
      description: "Gère les partenaires commerciaux (créer, modifier, supprimer, lister). Suivi des apporteurs d'affaires et intégrateurs.",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["create", "update", "delete", "list", "get"],
            description: "Action à effectuer" 
          },
          partenaire_id: { 
            type: "string", 
            description: "UUID du partenaire" 
          },
          data: { 
            type: "object", 
            description: "Données du partenaire (nom, type, email, telephone, adresse, commission_rate, notes, est_actif)" 
          }
        },
        required: ["action"]
      }
    }
  },

  // ============================================================
  // DOCUMENT AI TOOLS (NEW)
  // ============================================================
  {
    type: "function",
    function: {
      name: "summarize_content",
      description: "Synthétise un contenu (email, document, notes de réunion) en utilisant GPT-5. Génère un résumé structuré et actionnable.",
      parameters: {
        type: "object",
        properties: {
          content: { 
            type: "string", 
            description: "Contenu à synthétiser" 
          },
          content_type: { 
            type: "string", 
            enum: ["email_thread", "document", "meeting_notes", "general"],
            description: "Type de contenu pour adapter la synthèse" 
          },
          max_length: { 
            type: "number", 
            description: "Longueur max en mots (100-500, défaut: 300)" 
          },
          format: { 
            type: "string", 
            enum: ["bullet_points", "paragraph", "structured", "executive_summary"],
            description: "Format de sortie souhaité" 
          },
          language: { 
            type: "string", 
            description: "Langue de la synthèse (défaut: français)" 
          }
        },
        required: ["content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_with_ai",
      description: "Analyse contextuelle d'un contenu avec GPT-5: sentiment, thèmes clés, actions à prendre, risques, opportunités.",
      parameters: {
        type: "object",
        properties: {
          content: { 
            type: "string", 
            description: "Contenu à analyser" 
          },
          analysis_type: { 
            type: "string", 
            enum: ["sentiment", "key_topics", "action_items", "risks", "opportunities", "custom"],
            description: "Type d'analyse à effectuer" 
          },
          custom_prompt: { 
            type: "string", 
            description: "Prompt personnalisé pour analysis_type=custom" 
          },
          output_format: { 
            type: "string", 
            enum: ["text", "json"],
            description: "Format de sortie (défaut: text)" 
          }
        },
        required: ["content", "analysis_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "extract_data",
      description: "Extrait des données structurées d'un texte selon un schéma défini. Utilise GPT-5 pour identifier et extraire les informations.",
      parameters: {
        type: "object",
        properties: {
          content: { 
            type: "string", 
            description: "Texte source contenant les données à extraire" 
          },
          extraction_schema: { 
            type: "object", 
            description: "Schéma d'extraction avec fields: [{name, type, description, required}]" 
          },
          strict_mode: { 
            type: "boolean", 
            description: "Mode strict: ne retourne que les valeurs explicitement présentes (défaut: false)" 
          }
        },
        required: ["content", "extraction_schema"]
      }
    }
  },

  // ============================================================
  // UTILITY TOOLS (NEW)
  // ============================================================
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Récupère la météo actuelle et les prévisions pour une ville. Utile pour planifier des déplacements ou réunions.",
      parameters: {
        type: "object",
        properties: {
          city: { 
            type: "string", 
            description: "Nom de la ville" 
          },
          country: { 
            type: "string", 
            description: "Code pays (ex: FR, BE, CH)" 
          },
          days: { 
            type: "number", 
            description: "Nombre de jours de prévision (1-7, défaut: 3)" 
          }
        },
        required: ["city"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calculate_date",
      description: "Effectue des calculs sur les dates: ajouter/soustraire des jours, calculer la différence entre deux dates, compter les jours ouvrés.",
      parameters: {
        type: "object",
        properties: {
          operation: { 
            type: "string", 
            enum: ["add", "subtract", "diff", "format", "workdays"],
            description: "Opération à effectuer" 
          },
          date: { 
            type: "string", 
            description: "Date de base (format ISO ou naturel)" 
          },
          date2: { 
            type: "string", 
            description: "Seconde date (pour diff et workdays)" 
          },
          amount: { 
            type: "number", 
            description: "Quantité à ajouter/soustraire" 
          },
          unit: { 
            type: "string", 
            enum: ["days", "weeks", "months", "years", "hours", "minutes"],
            description: "Unité pour add/subtract" 
          }
        },
        required: ["operation", "date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "convert_units",
      description: "Convertit des valeurs entre différentes unités: longueur, poids, température, données.",
      parameters: {
        type: "object",
        properties: {
          value: { 
            type: "number", 
            description: "Valeur à convertir" 
          },
          from_unit: { 
            type: "string", 
            description: "Unité source (m, km, kg, g, °C, °F, MB, GB, etc.)" 
          },
          to_unit: { 
            type: "string", 
            description: "Unité cible" 
          }
        },
        required: ["value", "from_unit", "to_unit"]
      }
    }
  },

  // ============================================================
  // REPORTING & EXPORT TOOLS (NEW PHASE 2)
  // ============================================================
  {
    type: "function",
    function: {
      name: "generate_report",
      description: "Génère un rapport détaillé selon le type demandé: activité CRM, financier, RH ou support. Agrège les données par période.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Titre du rapport" },
          type: { type: "string", enum: ["crm_activity", "financial", "hr_summary", "support"], description: "Type de rapport" },
          period_start: { type: "string", description: "Date de début (ISO 8601)" },
          period_end: { type: "string", description: "Date de fin (ISO 8601)" },
          filters: { type: "object", description: "Filtres additionnels" }
        },
        required: ["title", "type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "export_to_excel",
      description: "Prépare les données d'une table pour export Excel. Retourne les données formatées que le frontend peut télécharger.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", enum: ["etablissements", "contacts", "taches", "factures", "support_tickets", "rh_absences"], description: "Table à exporter" },
          filters: { type: "array", items: { type: "object", properties: { column: { type: "string" }, operator: { type: "string" }, value: { type: "string" } } }, description: "Filtres" },
          columns: { type: "array", items: { type: "string" }, description: "Colonnes à inclure" },
          filename: { type: "string", description: "Nom du fichier" }
        },
        required: ["table"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_dashboard_snapshot",
      description: "Capture l'état actuel d'un dashboard avec tous ses KPIs. Utile pour comparaison historique.",
      parameters: {
        type: "object",
        properties: {
          dashboard_type: { type: "string", enum: ["executive", "sales", "operations"], description: "Type de dashboard" },
          save_to_storage: { type: "boolean", description: "Sauvegarder en storage" }
        },
        required: ["dashboard_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "schedule_report",
      description: "Programme l'envoi automatique d'un rapport à une fréquence définie.",
      parameters: {
        type: "object",
        properties: {
          report_type: { type: "string", description: "Type de rapport" },
          frequency: { type: "string", enum: ["daily", "weekly", "monthly"], description: "Fréquence" },
          recipients: { type: "array", items: { type: "string" }, description: "Emails des destinataires" },
          title: { type: "string", description: "Titre du rapport" }
        },
        required: ["report_type", "frequency", "recipients", "title"]
      }
    }
  },

  // ============================================================
  // AUTOMATION & WORKFLOW TOOLS (NEW PHASE 2)
  // ============================================================
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Crée un rappel qui sera notifié à l'utilisateur à la date/heure spécifiée.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Titre du rappel" },
          remind_at: { type: "string", description: "Date/heure du rappel (ISO 8601)" },
          entity_type: { type: "string", description: "Type d'entité liée (etablissement, tache, contact)" },
          entity_id: { type: "string", description: "UUID de l'entité liée" },
          repeat: { type: "string", enum: ["none", "daily", "weekly", "monthly"], description: "Répétition" },
          notify_via: { type: "array", items: { type: "string" }, description: "Canaux de notification" }
        },
        required: ["title", "remind_at"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_automation_rule",
      description: "Crée une règle d'automatisation qui déclenche une action quand un événement se produit.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nom de la règle" },
          trigger_type: { type: "string", enum: ["new_email", "task_overdue", "ticket_created", "status_changed", "time_based"], description: "Type de déclencheur" },
          trigger_config: { type: "object", description: "Configuration du déclencheur" },
          action_type: { type: "string", enum: ["send_notification", "create_task", "send_email", "update_status", "assign_to"], description: "Action à exécuter" },
          action_config: { type: "object", description: "Configuration de l'action" },
          is_active: { type: "boolean", description: "Activer immédiatement" }
        },
        required: ["name", "trigger_type", "trigger_config", "action_type", "action_config"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_automation_rules",
      description: "Liste toutes les règles d'automatisation de l'utilisateur.",
      parameters: {
        type: "object",
        properties: {
          active_only: { type: "boolean", description: "Filtrer les règles actives seulement" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "toggle_automation_rule",
      description: "Active ou désactive une règle d'automatisation.",
      parameters: {
        type: "object",
        properties: {
          rule_id: { type: "string", description: "UUID de la règle" },
          is_active: { type: "boolean", description: "Nouvel état" }
        },
        required: ["rule_id", "is_active"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_scheduled_task",
      description: "Crée une tâche récurrente qui sera exécutée automatiquement selon un planning.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Titre de la tâche programmée" },
          description: { type: "string", description: "Description" },
          schedule: { type: "string", enum: ["daily", "weekly", "monthly"], description: "Fréquence d'exécution" },
          task_template: { type: "object", description: "Modèle de tâche à créer" },
          next_run: { type: "string", description: "Prochaine exécution (ISO 8601)" }
        },
        required: ["title", "schedule"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_automation_stats",
      description: "Récupère les statistiques d'utilisation des automatisations.",
      parameters: {
        type: "object",
        properties: {
          period_days: { type: "number", description: "Période en jours" }
        }
      }
    }
  },

  // ============================================================
  // FILE MANAGEMENT TOOLS (NEW PHASE 2)
  // ============================================================
  {
    type: "function",
    function: {
      name: "list_files",
      description: "Liste les fichiers dans un bucket/dossier du storage.",
      parameters: {
        type: "object",
        properties: {
          bucket: { type: "string", description: "Nom du bucket (documents, avatars, formations, rh-documents)" },
          folder: { type: "string", description: "Chemin du dossier" },
          search: { type: "string", description: "Recherche dans les noms" },
          file_type: { type: "string", enum: ["image", "pdf", "document", "spreadsheet", "presentation"], description: "Type de fichier" },
          limit: { type: "number", description: "Nombre max de résultats" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_file_url",
      description: "Génère une URL signée temporaire pour télécharger un fichier.",
      parameters: {
        type: "object",
        properties: {
          bucket: { type: "string", description: "Nom du bucket" },
          path: { type: "string", description: "Chemin du fichier" },
          expires_in: { type: "number", description: "Durée de validité en secondes (défaut: 3600)" }
        },
        required: ["bucket", "path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "move_file",
      description: "Déplace un fichier vers un autre emplacement dans le storage.",
      parameters: {
        type: "object",
        properties: {
          bucket: { type: "string", description: "Nom du bucket" },
          from_path: { type: "string", description: "Chemin source" },
          to_path: { type: "string", description: "Chemin destination" }
        },
        required: ["bucket", "from_path", "to_path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "copy_file",
      description: "Copie un fichier vers un autre emplacement.",
      parameters: {
        type: "object",
        properties: {
          bucket: { type: "string", description: "Nom du bucket" },
          from_path: { type: "string", description: "Chemin source" },
          to_path: { type: "string", description: "Chemin destination" }
        },
        required: ["bucket", "from_path", "to_path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Supprime un ou plusieurs fichiers du storage.",
      parameters: {
        type: "object",
        properties: {
          bucket: { type: "string", description: "Nom du bucket" },
          paths: { type: "array", items: { type: "string" }, description: "Chemins des fichiers à supprimer (max 10)" }
        },
        required: ["bucket", "paths"]
      }
    }
  },
  // (search_documents — déjà déclaré plus haut, doublon supprimé)
  {
    type: "function",
    function: {
      name: "get_storage_stats",
      description: "Récupère les statistiques d'utilisation du storage.",
      parameters: {
        type: "object",
        properties: {
          bucket: { type: "string", description: "Bucket spécifique ou tous" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_folder",
      description: "Crée un nouveau dossier dans le storage.",
      parameters: {
        type: "object",
        properties: {
          bucket: { type: "string", description: "Nom du bucket" },
          folder_path: { type: "string", description: "Chemin du dossier à créer" }
        },
        required: ["bucket", "folder_path"]
      }
    }
  },

  // ============================================================
  // ADVANCED ANALYTICS TOOLS (NEW PHASE 2)
  // ============================================================
  {
    type: "function",
    function: {
      name: "predict_trend",
      description: "Prédit l'évolution future d'une métrique basée sur les données historiques (régression linéaire).",
      parameters: {
        type: "object",
        properties: {
          metric: { type: "string", enum: ["revenue", "new_clients", "support_tickets"], description: "Métrique à prédire" },
          period_months: { type: "number", description: "Mois d'historique à analyser (défaut: 6)" },
          forecast_months: { type: "number", description: "Mois à prédire (défaut: 3)" }
        },
        required: ["metric"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "detect_anomalies",
      description: "Détecte les valeurs anormales dans une série de données (méthode écart-type).",
      parameters: {
        type: "object",
        properties: {
          data_source: { type: "string", enum: ["daily_revenue", "daily_tickets", "daily_tasks"], description: "Source de données" },
          threshold: { type: "number", description: "Nombre d'écarts-types pour anomalie (défaut: 2)" },
          period_days: { type: "number", description: "Période d'analyse en jours (défaut: 30)" }
        },
        required: ["data_source"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "correlation_analysis",
      description: "Analyse la corrélation entre deux métriques (coefficient de Pearson).",
      parameters: {
        type: "object",
        properties: {
          metric_a: { type: "string", enum: ["revenue", "tickets", "new_clients", "tasks_completed", "emails"], description: "Première métrique" },
          metric_b: { type: "string", enum: ["revenue", "tickets", "new_clients", "tasks_completed", "emails"], description: "Seconde métrique" },
          period_months: { type: "number", description: "Période d'analyse en mois (défaut: 6)" }
        },
        required: ["metric_a", "metric_b"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_performance_score",
      description: "Calcule un score de performance global ou par membre d'équipe.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["global", "team_member"], description: "Périmètre du score" },
          entity_id: { type: "string", description: "UUID du membre d'équipe (si scope=team_member)" }
        }
      }
    }
  },
  // ============================================================
  // MEMORY TOOLS (Persistent user context)
  // ============================================================
  {
    type: "function",
    function: {
      name: "manage_memory",
      description: "Mémorise ou récupère des informations sur l'utilisateur pour les prochaines conversations. Utilise cet outil quand l'utilisateur dit 'retiens que...', 'souviens-toi de...', 'oublie que...', ou quand tu apprends des informations importantes sur ses préférences.",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["add", "get", "list", "delete"],
            description: "Action à effectuer: add (mémoriser), get (récupérer une clé), list (lister toutes les mémoires), delete (oublier)"
          },
          category: {
            type: "string",
            enum: ["preference", "fact", "instruction", "context"],
            description: "Type de mémoire: preference (format préféré, signature...), fact (nom manager, établissement principal...), instruction (toujours tutoyer, ignorer spam...), context (projet en cours, deadline...)"
          },
          key: { 
            type: "string", 
            description: "Clé/sujet de la mémoire (ex: 'signature_email', 'nom_manager', 'format_date_prefere')" 
          },
          value: { 
            type: "string", 
            description: "Valeur à mémoriser (ex: 'Cordialement, Jean', 'Marie Dupont', 'DD/MM/YYYY')" 
          },
          importance: { 
            type: "number", 
            description: "Importance de 1 (faible) à 5 (critique). Les mémoires importantes sont prioritaires dans le contexte. Défaut: 3" 
          }
        },
        required: ["action"]
      }
    }
  },

  // ============================================================
  // WORKFLOW EXECUTION TOOLS (NEW - Automated processes)
  // ============================================================
  {
    type: "function",
    function: {
      name: "execute_workflow",
      description: "Exécute un workflow automatisé complet (onboarding client, clôture mensuelle, relance factures, etc.). Un workflow est une séquence d'actions coordonnées.",
      parameters: {
        type: "object",
        properties: {
          workflow_id: {
            type: "string",
            enum: [
              "onboarding_client",
              "cloture_mensuelle",
              "suivi_prospect",
              "weekly_report",
              "new_employee_onboarding",
              "invoice_reminder_sequence",
              "contract_renewal_30days",
              "quarterly_business_review",
              "prospect_nurturing_7days",
              "support_escalation",
              "monthly_report_automation",
              "lead_qualification",
              "offboarding_checklist",
              "weekly_standup_prep"
            ],
            description: "ID du workflow à exécuter"
          },
          params: {
            type: "object",
            description: "Paramètres spécifiques au workflow (etablissement_id, employee_id, invoice_id, etc.)"
          }
        },
        required: ["workflow_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_workflows",
      description: "Liste tous les workflows automatisés disponibles avec leur description.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["crm", "finance", "rh", "reporting", "support", "rd"],
            description: "Filtrer par catégorie"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_workflow_history",
      description: "Récupère l'historique d'exécution des workflows automatisés.",
      parameters: {
        type: "object",
        properties: {
          workflow_id: { type: "string", description: "Filtrer par workflow spécifique" },
          limit: { type: "number", description: "Nombre max de résultats (défaut: 20)" }
        }
      }
    }
  },

  // ============== OBJECTIVES TOOLS (JARVIS 11.0) ==============
  {
    type: "function",
    function: {
      name: "create_objective",
      description: "Créer un nouvel objectif business pour l'utilisateur. Les objectifs peuvent être liés au CA, à la productivité, à la qualité ou à la croissance. Jarvis suivra automatiquement la progression.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Titre de l'objectif (ex: 'Augmenter le CA de 20%')" },
          description: { type: "string", description: "Description détaillée (optionnel)" },
          category: { 
            type: "string", 
            enum: ["revenue", "productivity", "quality", "growth", "custom"],
            description: "Catégorie: revenue (CA/factures), productivity (tâches/emails), quality (satisfaction/tickets), growth (clients/prospects), custom"
          },
          target_metric: { 
            type: "string", 
            description: "Métrique à suivre: ca_mensuel, factures_emises, taches_completees, emails_traites, satisfaction_moyenne, tickets_resolus, nouveaux_etablissements, prospects_convertis"
          },
          target_value: { type: "number", description: "Valeur cible à atteindre" },
          unit: { type: "string", description: "Unité de mesure (€, %, count)" },
          end_date: { type: "string", description: "Date limite au format YYYY-MM-DD" },
          priority: { 
            type: "string", 
            enum: ["low", "medium", "high", "critical"],
            description: "Priorité de l'objectif"
          }
        },
        required: ["title", "category", "target_metric", "target_value", "end_date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_objective_progress",
      description: "Mettre à jour manuellement la progression d'un objectif (utile pour les métriques personnalisées)",
      parameters: {
        type: "object",
        properties: {
          objective_id: { type: "string", description: "ID de l'objectif" },
          new_value: { type: "number", description: "Nouvelle valeur actuelle" },
          note: { type: "string", description: "Note explicative (optionnel)" }
        },
        required: ["objective_id", "new_value"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_objectives",
      description: "Lister les objectifs de l'utilisateur, avec filtrage optionnel par statut",
      parameters: {
        type: "object",
        properties: {
          status: { 
            type: "string", 
            enum: ["active", "paused", "completed", "failed", "cancelled"],
            description: "Filtrer par statut (optionnel, par défaut tous)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_objectives",
      description: "Analyser la progression globale vers les objectifs et obtenir des recommandations d'actions",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },

  // ============== INTELLIGENCE TOOLS (JARVIS 13.0) ==============
  {
    type: "function",
    function: {
      name: "generate_briefing",
      description: "Génère un briefing intelligent personnalisé (quotidien, hebdomadaire, mensuel) avec insights et recommandations d'actions prioritaires. Idéal pour commencer la journée ou faire le point.",
      parameters: {
        type: "object",
        properties: {
          briefing_type: { 
            type: "string", 
            enum: ["daily", "weekly", "monthly", "custom"],
            description: "Type de briefing: daily (24h), weekly (7j), monthly (1 mois)"
          },
          focus_areas: { 
            type: "array", 
            items: { type: "string" },
            description: "Domaines à inclure: tasks, emails, support, calendar, revenue, clients"
          },
          include_recommendations: { 
            type: "boolean", 
            description: "Inclure des recommandations d'actions (défaut: true)"
          }
        },
        required: ["briefing_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "compare_analysis",
      description: "Compare deux périodes (ce mois vs mois dernier) ou deux entités (établissements) pour identifier les tendances et écarts de performance.",
      parameters: {
        type: "object",
        properties: {
          compare_type: { 
            type: "string", 
            enum: ["periods", "entities", "metrics"],
            description: "Type de comparaison"
          },
          entity_a: { type: "string", description: "Première entité/période à comparer" },
          entity_b: { type: "string", description: "Seconde entité/période à comparer" },
          metrics: { 
            type: "array", 
            items: { type: "string" },
            description: "Métriques spécifiques à comparer"
          }
        },
        required: ["compare_type", "entity_a", "entity_b"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "suggest_actions",
      description: "Analyse le contexte actuel et suggère les actions prioritaires à effectuer. Identifie les tâches en retard, tickets critiques, emails urgents et prospects à relancer.",
      parameters: {
        type: "object",
        properties: {
          context_type: { 
            type: "string", 
            enum: ["crm", "emails", "support", "global"],
            description: "Contexte spécifique à analyser (défaut: global)"
          },
          max_suggestions: { 
            type: "number", 
            description: "Nombre max de suggestions (défaut: 10)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "bulk_action",
      description: "Exécute des actions en lot sur plusieurs entités: marquer des tâches comme terminées, assigner des tickets, archiver des emails, etc.",
      parameters: {
        type: "object",
        properties: {
          action_type: { 
            type: "string", 
            enum: ["complete_tasks", "assign_tickets", "archive_emails", "update_statuses"],
            description: "Type d'action à exécuter en lot"
          },
          entity_ids: { 
            type: "array", 
            items: { type: "string" },
            description: "Liste des IDs des entités à modifier"
          },
          action_data: { 
            type: "object", 
            description: "Données supplémentaires (ex: assignee_id pour assign_tickets)"
          }
        },
        required: ["action_type", "entity_ids"]
      }
    }
  },

  // ============================================================
  // WEB TOOLS (Native, No External API)
  // ============================================================
  {
    type: "function",
    function: {
      name: "web_scrape",
      description: "Extrait le contenu d'une page web (texte, markdown, liens, métadonnées). Supporte les sélecteurs CSS pour cibler des éléments spécifiques. Utile pour extraire des informations de sites web, articles, documentation, etc.",
      parameters: {
        type: "object",
        properties: {
          url: { 
            type: "string", 
            description: "URL de la page à scraper (ex: https://example.com)" 
          },
          formats: { 
            type: "array", 
            items: { 
              type: "string", 
              enum: ["text", "markdown", "html", "links", "metadata"] 
            },
            description: "Formats de sortie souhaités (défaut: ['text', 'metadata'])"
          },
          selector: { 
            type: "string", 
            description: "Sélecteur CSS pour cibler un élément spécifique (ex: 'main', '#content', '.article')"
          },
          maxLength: { 
            type: "number", 
            description: "Longueur max du contenu extrait en caractères (défaut: 30000)"
          },
          includeImages: { 
            type: "boolean", 
            description: "Inclure la liste des URLs d'images trouvées"
          }
        },
        required: ["url"]
      }
    }
  },
  // (web_search — déjà déclaré plus haut, doublon supprimé)

  // ============================================================
  // PULSE TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "send_pulse_message",
      description: "Envoie un message dans une conversation Pulse (messagerie interne) existante",
      parameters: {
        type: "object",
        properties: {
          conversation_id: { type: "string", description: "UUID de la conversation Pulse" },
          content: { type: "string", description: "Contenu du message à envoyer" }
        },
        required: ["conversation_id", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_pulse_conversation",
      description: "Crée une nouvelle conversation Pulse et y ajoute des membres",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nom de la conversation" },
          description: { type: "string", description: "Description optionnelle" },
          member_ids: { type: "array", items: { type: "string" }, description: "UUIDs des membres à ajouter (profiles.id)" },
          visibility: { type: "string", enum: ["public", "private"], description: "Visibilité (défaut: private)" }
        },
        required: ["name", "member_ids"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_pulse_conversations",
      description: "Liste les conversations Pulse de l'utilisateur",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Nombre max de résultats (défaut: 10)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_pulse_messages",
      description: "Recherche dans les messages Pulse de l'utilisateur",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termes de recherche" },
          conversation_id: { type: "string", description: "Filtrer par conversation (optionnel)" },
          limit: { type: "number", description: "Nombre max de résultats (défaut: 20)" }
        },
        required: ["query"]
      }
    }
  },

  // ============================================================
  // TASK MANAGEMENT TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Met à jour une tâche existante (titre, description, priorité, échéance, responsable, statut, catégorie)",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "UUID de la tâche" },
          data: {
            type: "object",
            description: "Champs à modifier",
            properties: {
              titre: { type: "string" },
              description: { type: "string" },
              priorite: { type: "string", enum: ["basse", "moyenne", "haute", "critique"] },
              statut: { type: "string" },
              echeance: { type: "string" },
              responsable_id: { type: "string" },
              categorie_id: { type: "string" }
            }
          }
        },
        required: ["task_id", "data"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Supprime une tâche",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "UUID de la tâche à supprimer" }
        },
        required: ["task_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_subtask",
      description: "Gère les sous-tâches (list, create, update, delete)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create", "update", "delete"] },
          task_id: { type: "string", description: "UUID de la tâche parente (pour list/create)" },
          subtask_id: { type: "string", description: "UUID de la sous-tâche (pour update/delete)" },
          data: {
            type: "object",
            properties: {
              titre: { type: "string" },
              est_termine: { type: "boolean" },
              ordre: { type: "number" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_time_entry",
      description: "Enregistre du temps passé sur une tâche",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "UUID de la tâche" },
          duration_minutes: { type: "number", description: "Durée en minutes" },
          description: { type: "string", description: "Description du travail effectué" },
          date: { type: "string", description: "Date (YYYY-MM-DD, défaut: aujourd'hui)" }
        },
        required: ["task_id", "duration_minutes"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_task_recurrence",
      description: "Gère les récurrences de tâches (create, delete, list)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "delete", "list"] },
          task_id: { type: "string" },
          recurrence_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              frequence: { type: "string", enum: ["daily", "weekly", "monthly"] },
              jour_semaine: { type: "number" },
              jour_mois: { type: "number" },
              heure: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },

  // ============================================================
  // DEVIS TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "manage_devis",
      description: "Gère les devis (list, get, create, update, delete)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "get", "create", "update", "delete"] },
          devis_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              etablissement_id: { type: "string" },
              client_nom: { type: "string" },
              objet: { type: "string" },
              montant_ht: { type: "number" },
              montant_tva: { type: "number" },
              montant_ttc: { type: "number" },
              validite_jours: { type: "number" },
              conditions: { type: "string" },
              statut: { type: "string", enum: ["brouillon", "envoye", "accepte", "refuse", "expire", "converti"] }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_devis_ligne",
      description: "Gère les lignes d'un devis (add, update, delete)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add", "update", "delete"] },
          devis_id: { type: "string", description: "UUID du devis (pour add)" },
          ligne_id: { type: "string", description: "UUID de la ligne (pour update/delete)" },
          data: {
            type: "object",
            properties: {
              designation: { type: "string" },
              quantite: { type: "number" },
              prix_unitaire_ht: { type: "number" },
              taux_tva: { type: "number" },
              montant_ht: { type: "number" },
              montant_tva: { type: "number" },
              montant_ttc: { type: "number" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "convert_devis_to_invoice",
      description: "Convertit un devis accepté en facture avec toutes ses lignes",
      parameters: {
        type: "object",
        properties: {
          devis_id: { type: "string", description: "UUID du devis à convertir" }
        },
        required: ["devis_id"]
      }
    }
  },

  // ============================================================
  // FORUM TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "manage_forum_post",
      description: "Gère les posts du forum interne (list, get, create, update, delete, search)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "get", "create", "update", "delete", "search"] },
          post_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              titre: { type: "string" },
              contenu: { type: "string" },
              categorie: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
              query: { type: "string", description: "Termes de recherche (pour action search)" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_forum_comment",
      description: "Gère les commentaires d'un post forum (list, create, delete)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create", "delete"] },
          post_id: { type: "string" },
          comment_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              contenu: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "vote_forum_post",
      description: "Vote ou retire un vote sur un post forum (toggle)",
      parameters: {
        type: "object",
        properties: {
          post_id: { type: "string", description: "UUID du post" }
        },
        required: ["post_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "bookmark_forum_post",
      description: "Ajoute ou retire un favori sur un post forum (toggle)",
      parameters: {
        type: "object",
        properties: {
          post_id: { type: "string", description: "UUID du post" }
        },
        required: ["post_id"]
      }
    }
  },

  // ============================================================
  // CSM TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "get_csm_health_score",
      description: "Récupère le score de santé d'un compte client (NPS, adoption, support, satisfaction)",
      parameters: {
        type: "object",
        properties: {
          etablissement_id: { type: "string", description: "UUID de l'établissement" }
        },
        required: ["etablissement_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_csm_kpis",
      description: "Récupère les KPIs CSM mensuels ou trimestriels",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "UUID du CSM (optionnel, défaut: utilisateur courant)" },
          period_type: { type: "string", enum: ["mensuel", "trimestriel"] },
          period: { type: "string", description: "Période (YYYY-MM ou YYYY-Q1)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_csm_milestone",
      description: "Gère les jalons du parcours client (list, create, update, delete)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create", "update", "delete"] },
          etablissement_id: { type: "string" },
          milestone_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              nom: { type: "string" },
              description: { type: "string" },
              date_prevue: { type: "string" },
              date_realisee: { type: "string" },
              statut: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_churn_predictions",
      description: "Récupère les prédictions de churn (risque de désabonnement) pour les comptes clients",
      parameters: {
        type: "object",
        properties: {
          min_risk_score: { type: "number", description: "Score de risque minimum (0-100, défaut: 50)" },
          limit: { type: "number", description: "Nombre max de résultats (défaut: 20)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_csm_billing_followup",
      description: "Gère le suivi facturation CSM (list, create, update)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create", "update"] },
          etablissement_id: { type: "string" },
          followup_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              type_suivi: { type: "string" },
              montant: { type: "number" },
              statut: { type: "string" },
              notes: { type: "string" },
              date_echeance: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },

  // ============================================================
  // CALENDAR MANAGEMENT TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "update_calendar_event",
      description: "Modifie un événement existant du calendrier",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "UUID de l'événement" },
          data: {
            type: "object",
            properties: {
              title: { type: "string" },
              start_time: { type: "string" },
              end_time: { type: "string" },
              location: { type: "string" },
              description: { type: "string" },
              status: { type: "string", enum: ["confirmed", "tentative", "cancelled"] },
              color: { type: "string" }
            }
          }
        },
        required: ["event_id", "data"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_calendar_event",
      description: "Supprime un événement du calendrier",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "UUID de l'événement" }
        },
        required: ["event_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_event_attendees",
      description: "Gère les participants d'un événement (list, add, remove, update_status)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "add", "remove", "update_status"] },
          event_id: { type: "string" },
          attendee_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              user_id: { type: "string" },
              email: { type: "string" },
              nom: { type: "string" },
              status: { type: "string", enum: ["accepted", "declined", "tentative", "pending"] }
            }
          }
        },
        required: ["action", "event_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_event_reminder",
      description: "Gère les rappels d'événements (list, create, delete)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create", "delete"] },
          event_id: { type: "string" },
          reminder_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              minutes_before: { type: "number" },
              type: { type: "string", enum: ["notification", "email"] }
            }
          }
        },
        required: ["action", "event_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_booking",
      description: "Gère les réservations (list, get, create, update, cancel)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "get", "create", "update", "cancel"] },
          booking_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              booking_type_id: { type: "string" },
              guest_name: { type: "string" },
              guest_email: { type: "string" },
              start_time: { type: "string" },
              end_time: { type: "string" },
              status: { type: "string" },
              notes: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },

  // ============================================================
  // AVOIR (CREDIT NOTE) TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "manage_avoir",
      description: "Gère les avoirs / notes de crédit (list, get, create, update)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "get", "create", "update"] },
          avoir_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              etablissement_id: { type: "string" },
              facture_id: { type: "string" },
              client_nom: { type: "string" },
              motif: { type: "string" },
              montant_ht: { type: "number" },
              montant_tva: { type: "number" },
              montant_ttc: { type: "number" },
              statut: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_avoir_ligne",
      description: "Gère les lignes d'un avoir (add, delete)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add", "delete"] },
          avoir_id: { type: "string" },
          ligne_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              designation: { type: "string" },
              quantite: { type: "number" },
              prix_unitaire_ht: { type: "number" },
              taux_tva: { type: "number" },
              montant_ht: { type: "number" },
              montant_tva: { type: "number" },
              montant_ttc: { type: "number" }
            }
          }
        },
        required: ["action"]
      }
    }
  },

  // ============================================================
  // EMAIL MANAGEMENT TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "manage_email_draft",
      description: "Gère les brouillons d'emails (list, get, create, update, delete, send)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "get", "create", "update", "delete", "send"] },
          draft_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              to_addresses: { type: "array", items: { type: "string" } },
              cc_addresses: { type: "array", items: { type: "string" } },
              subject: { type: "string" },
              body_html: { type: "string" },
              thread_id: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_email_filter",
      description: "Gère les filtres/règles email (list, create, update, delete)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create", "update", "delete"] },
          filter_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              name: { type: "string" },
              conditions: { type: "object" },
              actions: { type: "object" },
              is_active: { type: "boolean" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_email_thread",
      description: "Gère un thread email (archive, mark_read, mark_unread, star, unstar, move)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["archive", "mark_read", "mark_unread", "star", "unstar", "move"] },
          thread_id: { type: "string", description: "UUID du thread" },
          data: {
            type: "object",
            properties: {
              folder: { type: "string", description: "Dossier cible (pour move)" }
            }
          }
        },
        required: ["action", "thread_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "classify_email_thread",
      description: "Assigne manuellement une catégorie et/ou un établissement à un thread email",
      parameters: {
        type: "object",
        properties: {
          thread_id: { type: "string", description: "UUID du thread" },
          category: { type: "string", description: "Catégorie (commercial, support, technique, administratif)" },
          etablissement_id: { type: "string", description: "UUID de l'établissement à associer" },
          tags: { type: "array", items: { type: "string" }, description: "Tags à appliquer" }
        },
        required: ["thread_id"]
      }
    }
  },

  // ============================================================
  // TRESORERIE MANAGEMENT TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "manage_revenue",
      description: "Gère les revenus (list, create, update, delete)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create", "update", "delete"] },
          revenue_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              designation: { type: "string" },
              montant: { type: "number" },
              date_revenu: { type: "string" },
              categorie: { type: "string" },
              etablissement_id: { type: "string" },
              facture_id: { type: "string" },
              statut: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_budget",
      description: "Gère les budgets (list, create, update, delete)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create", "update", "delete"] },
          budget_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              nom: { type: "string" },
              montant_prevu: { type: "number" },
              montant_consomme: { type: "number" },
              periode_debut: { type: "string" },
              periode_fin: { type: "string" },
              categorie: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_tresorerie_summary",
      description: "Résumé complet de la trésorerie : solde, revenus du mois, dépenses du mois, prévisions",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },

  // ============================================================
  // R&D EXTENDED TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "manage_rd_comment",
      description: "Gère les commentaires R&D sur stories/epics (list, create, update, delete)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create", "update", "delete"] },
          story_id: { type: "string" },
          epic_id: { type: "string" },
          comment_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              contenu: { type: "string" },
              type: { type: "string", enum: ["comment", "review", "question"] }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_rd_label",
      description: "Gère les labels R&D et leur assignation aux stories (list, create, delete, assign, unassign)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create", "delete", "assign", "unassign"] },
          label_id: { type: "string" },
          story_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              nom: { type: "string" },
              couleur: { type: "string" },
              description: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },

  // ============================================================
  // CONTRACTS EXTENDED TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "manage_contrat_avenant",
      description: "Gère les avenants de contrats (list, create, update, delete)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create", "update", "delete"] },
          contrat_id: { type: "string" },
          avenant_id: { type: "string" },
          data: {
            type: "object",
            properties: {
              titre: { type: "string" },
              description: { type: "string" },
              date_effet: { type: "string" },
              modifications: { type: "string" },
              statut: { type: "string" }
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_contrat_alerts",
      description: "Récupère les alertes de contrats (expirations, renouvellements, anomalies)",
      parameters: {
        type: "object",
        properties: {
          contrat_id: { type: "string", description: "Filtrer par contrat (optionnel)" },
          severity: { type: "string", enum: ["info", "warning", "critical"], description: "Filtrer par sévérité" },
          limit: { type: "number", description: "Nombre max (défaut: 20)" }
        }
      }
    }
  },

  // ============================================================
  // RECRUITMENT EXTENDED TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "get_candidate_history",
      description: "Récupère l'historique complet d'un candidat (étapes, évaluations, entretiens, documents)",
      parameters: {
        type: "object",
        properties: {
          candidate_id: { type: "string", description: "UUID du candidat" }
        },
        required: ["candidate_id"]
      }
    }
  },

  // ============================================================
  // TRAINING EXTENDED TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "send_satisfaction_survey",
      description: "Envoie une enquête de satisfaction (formation ou solution) par email",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["formation", "solution"], description: "Type d'enquête" },
          session_id: { type: "string", description: "UUID de la session formation (pour type formation)" },
          etablissement_id: { type: "string", description: "UUID de l'établissement (pour type solution)" },
          recipient_emails: { type: "array", items: { type: "string" }, description: "Emails des destinataires" }
        },
        required: ["type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_satisfaction_results",
      description: "Récupère les résultats d'enquêtes de satisfaction",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["formation", "solution"] },
          session_id: { type: "string" },
          etablissement_id: { type: "string" },
          limit: { type: "number", description: "Nombre max de résultats (défaut: 50)" }
        }
      }
    }
  },

  // ============================================================
  // INVOICE MANAGEMENT TOOLS (Phase 2 - Pouvoir total)
  // ============================================================
  {
    type: "function",
    function: {
      name: "manage_invoice",
      description: "Gère les factures existantes (lister, détail, modifier, supprimer brouillon, marquer payée, obtenir impayées)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "get", "update", "mark_paid", "delete", "get_unpaid"], description: "Action à effectuer" },
          invoice_id: { type: "string", description: "UUID de la facture (pour get/update/mark_paid/delete)" },
          data: {
            type: "object",
            description: "Données pour filtres ou modifications",
            properties: {
              statut: { type: "string", description: "Filtrer par statut (list)" },
              etablissement_id: { type: "string", description: "Filtrer par établissement (list)" },
              mode_paiement: { type: "string", description: "Mode de paiement (mark_paid)" },
              reference_paiement: { type: "string", description: "Référence de paiement (mark_paid)" }
            }
          }
        },
        required: ["action"]
      }
    }
  },

  // ============================================================
  // PEOPLE / HR DOSSIER TOOLS (Phase 2 - Pouvoir total)
  // ============================================================
  {
    type: "function",
    function: {
      name: "get_employee_dossier",
      description: "Récupère le dossier RH complet d'un employé: profil, salaires, absences, compétences, certifications, tâches en cours",
      parameters: {
        type: "object",
        properties: {
          profile_id: { type: "string", description: "UUID de l'employé" }
        },
        required: ["profile_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_profile",
      description: "Met à jour le profil d'un employé (fonction, téléphone, email, LinkedIn, date embauche, type contrat)",
      parameters: {
        type: "object",
        properties: {
          profile_id: { type: "string", description: "UUID de l'employé" },
          data: {
            type: "object",
            properties: {
              fonction: { type: "string" },
              telephone: { type: "string" },
              email: { type: "string" },
              linkedin_url: { type: "string" },
              date_embauche: { type: "string" },
              type_contrat: { type: "string", enum: ["cdi", "cdd", "remuneration_dirigeant", "interim", "freelance"] }
            }
          }
        },
        required: ["profile_id", "data"]
      }
    }
  },

  // ============================================================
  // PROSPECT SCORING TOOL
  // ============================================================
  {
    type: "function",
    function: {
      name: "score_prospects",
      description: "Calcule un score de conversion (0-100) pour les prospects/établissements basé sur: avancement pipeline, volume d'interactions email, nombre de RDV, tâches liées, taille de l'établissement, récence d'interaction et équipe assignée. Peut scorer tous les prospects ou des établissements spécifiques.",
      parameters: {
        type: "object",
        properties: {
          etablissement_ids: {
            type: "array",
            items: { type: "string" },
            description: "UUIDs spécifiques à scorer (optionnel, score tous les prospects par défaut)"
          },
          scope: {
            type: "string",
            enum: ["all", "prospects_only"],
            description: "Scope: 'prospects_only' (défaut) ou 'all' (tous les établissements)"
          },
          save: {
            type: "boolean",
            description: "Sauvegarder les scores en base (défaut: true)"
          }
        }
      }
    }
  },

  // ============================================================
  // EMAIL ANALYTICS TOOLS
  // ============================================================
  {
    type: "function",
    function: {
      name: "analyze_sender_emails",
      description: `Analyse avancée des emails d'un expéditeur spécifique. Retourne des statistiques complètes :
- Nombre total d'emails, plage de dates, adresses utilisées
- Distribution horaire (par heure de la journée)
- Distribution par jour de la semaine
- Emails envoyés hors horaires normaux (avant 8h, après 19h, weekends)
- Amplitude quotidienne de travail (écart entre premier et dernier email)
- Jours extrêmes (amplitude > 10h)

Utilise cette fonction pour toute analyse de patterns d'envoi, horaires de travail, ou statistiques sur un expéditeur.`,
      parameters: {
        type: "object",
        properties: {
          sender_pattern: {
            type: "string",
            description: "Nom ou adresse email de l'expéditeur à analyser (recherche partielle supportée, ex: 'Camille Durand' ou 'remi.moreau')"
          }
        },
        required: ["sender_pattern"]
      }
    }
  },

  // ============================================================
  // P6 — AUTOMATION / WORKFLOW BUILDER
  // ============================================================
  {
    type: "function",
    function: {
      name: "list_workflows_v2",
      description: "Liste les workflows métier (table workflows) — automations 'si X alors Y' visuelles. Retourne nom, état actif, trigger, dernier run.",
      parameters: {
        type: "object",
        properties: {
          active_only: { type: "boolean", description: "Filtrer uniquement les workflows actifs" },
          search: { type: "string", description: "Recherche texte sur le nom" },
          limit: { type: "number", description: "Nombre max (défaut 50, max 100)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_workflow_runs",
      description: "Historique des exécutions de workflows : succès, erreurs, durée, payload de déclenchement. Calcule un taux d'erreur.",
      parameters: {
        type: "object",
        properties: {
          workflow_id: { type: "string", description: "UUID d'un workflow (optionnel)" },
          status: { type: "string", enum: ["success", "error", "running", "pending"] },
          limit: { type: "number", description: "Nombre max (défaut 30, max 100)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_workflow_from_prompt",
      description: "Crée un nouveau workflow à partir d'une description en langue naturelle (ex: 'envoie une alerte si une facture dépasse 30 jours d'impayé'). Direction/admin uniquement.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Description du workflow souhaité (8 caractères min)" },
          activate: { type: "boolean", description: "Activer immédiatement (défaut false = brouillon)" }
        },
        required: ["prompt"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "toggle_workflow",
      description: "Active ou désactive un workflow existant. Direction/admin uniquement.",
      parameters: {
        type: "object",
        properties: {
          workflow_id: { type: "string", description: "UUID du workflow" },
          is_active: { type: "boolean", description: "true pour activer, false pour désactiver" }
        },
        required: ["workflow_id", "is_active"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_workflow_now",
      description: "Déclenche manuellement un workflow (sans attendre son trigger). Direction/admin uniquement.",
      parameters: {
        type: "object",
        properties: {
          workflow_id: { type: "string", description: "UUID du workflow" },
          payload: { type: "object", description: "Payload optionnel à passer au workflow" }
        },
        required: ["workflow_id"]
      }
    }
  },

  // ============================================================
  // CATALOGUE PRODUITS & SERVICES
  // ============================================================
  {
    type: "function",
    function: {
      name: "list_catalogue_produits",
      description: "Liste les produits/services du catalogue (devis, factures, contrats). Filtres par type, catégorie, recherche texte.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string" },
          type: { type: "string", description: "Type (produit, service, abonnement...)" },
          categorie: { type: "string" },
          actif_only: { type: "boolean", description: "Inclure les archivés (défaut true = actifs uniquement)" },
          limit: { type: "number" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_catalogue_stats",
      description: "Statistiques d'utilisation du catalogue : nb devis, nb factures, CA cumulé, dernière utilisation par produit. Top N par CA.",
      parameters: {
        type: "object",
        properties: {
          top_n: { type: "number", description: "Nombre de produits à retourner dans le top (défaut 10)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_catalogue_produit",
      description: "Crée, met à jour, archive ou réactive un produit du catalogue. Direction/commercial uniquement.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "archive", "restore"] },
          produit_id: { type: "string", description: "UUID (requis sauf pour create)" },
          data: {
            type: "object",
            properties: {
              code: { type: "string" },
              nom: { type: "string" },
              description: { type: "string" },
              type: { type: "string" },
              categorie: { type: "string" },
              prix_unitaire_ht: { type: "number" },
              taux_tva: { type: "number" },
              unite: { type: "string" },
              recurrence: { type: "string", enum: ["none", "monthly", "quarterly", "yearly"] }
            }
          }
        },
        required: ["action"]
      }
    }
  },

  // ============================================================
  // CUSTOM REPORTS (Rapports sur mesure)
  // ============================================================
  {
    type: "function",
    function: {
      name: "list_custom_reports",
      description: "Liste les rapports personnalisés sauvegardés. Retourne aussi les sources de données disponibles.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string" },
          limit: { type: "number" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_custom_report",
      description: "Exécute un rapport personnalisé via la RPC get_report_data. Sources whitelistées (pipeline, factures, trésorerie, churn, forecast, activity, etc.).",
      parameters: {
        type: "object",
        properties: {
          source: { type: "string", description: "Clé de source (etablissements_pipeline, factures_par_mois, churn_risk_distribution, sales_forecast_pipeline...)" },
          filters: { type: "object", description: "Filtres jsonb (date_from, date_to, etablissement_ids...)" },
          report_id: { type: "string", description: "Si fourni, charge la source et les filtres par défaut du rapport" }
        },
        required: ["source"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "export_custom_report",
      description: "Exporte un rapport en PDF, XLSX ou CSV via l'edge function report-export. Renvoie une URL signée.",
      parameters: {
        type: "object",
        properties: {
          source: { type: "string" },
          filters: { type: "object" },
          format: { type: "string", enum: ["pdf", "xlsx", "csv"] },
          report_id: { type: "string" }
        },
        required: ["source"]
      }
    }
  },

  // ============================================================
  // ACTIVITY FEED (flux global)
  // ============================================================
  {
    type: "function",
    function: {
      name: "get_activity_feed",
      description: "Flux d'activité global agrégé sur 8 sources (interactions, tâches, calendar, emails, devis, factures, signatures, workflows). Cursor-based pagination.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Défaut 30, max 100" },
          cursor: { type: "string", description: "Curseur (occurred_at de la dernière entrée)" },
          types: { type: "array", items: { type: "string" }, description: "Filtre types (interaction, tache, calendar, email, devis, facture, signature, workflow)" },
          user_ids: { type: "array", items: { type: "string" } },
          etablissement_ids: { type: "array", items: { type: "string" } },
          date_from: { type: "string" },
          date_to: { type: "string" },
          search: { type: "string" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "pin_activity_event",
      description: "Épingle ou retire l'épingle sur un événement du flux d'activité (préférence personnelle).",
      parameters: {
        type: "object",
        properties: {
          activity_key: { type: "string", description: "Clé unique de l'événement (type:id)" },
          action: { type: "string", enum: ["pin", "unpin"] },
          note: { type: "string", description: "Note optionnelle pour un pin" }
        },
        required: ["activity_key", "action"]
      }
    }
  },

  // ============================================================
  // CHURN PREDICTOR (extension)
  // ============================================================
  {
    type: "function",
    function: {
      name: "get_churn_risk_accounts",
      description: "Top des comptes clients à risque de churn. Filtre par tier (critique/eleve/modere/faible) et score minimum. Inclut top facteurs et recommandations.",
      parameters: {
        type: "object",
        properties: {
          tier: { type: "string", enum: ["critique", "eleve", "modere", "faible"] },
          limit: { type: "number", description: "Défaut 20, max 100" },
          min_score: { type: "number" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "recompute_churn_risk",
      description: "Relance le calcul des prédictions de churn (RPC compute_churn_predictions). Direction/admin/csm uniquement.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_churn_account_detail",
      description: "Détail de la dernière prédiction churn pour un établissement : score, tier, facteurs détaillés, recommandations.",
      parameters: {
        type: "object",
        properties: {
          etablissement_id: { type: "string" }
        },
        required: ["etablissement_id"]
      }
    }
  },

  // ============================================================
  // SALES FORECASTING
  // ============================================================
  {
    type: "function",
    function: {
      name: "get_sales_forecast",
      description: "Prévisions de ventes pondérées (RPC get_sales_forecast). KPIs pipeline brut/pondéré, deals top, à risque, par trimestre, commercial, phase.",
      parameters: {
        type: "object",
        properties: {
          range: { type: "string", enum: ["current_quarter", "next_quarter", "year", "rolling_12"], description: "Période (défaut year)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "compare_forecast_vs_actual",
      description: "Compare le pipeline pondéré au CA réellement gagné. Calcule taux de conversion et progression vers l'objectif.",
      parameters: {
        type: "object",
        properties: {
          range: { type: "string", enum: ["current_quarter", "next_quarter", "year", "rolling_12"] }
        }
      }
    }
  },

  // ============================================================
  // SIGNATURES ÉLECTRONIQUES (DocuSeal)
  // ============================================================
  {
    type: "function",
    function: {
      name: "list_signature_requests",
      description: "Liste les demandes de signature électronique (DocuSeal). Filtre par statut et contrat.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "sent", "viewed", "signed", "completed", "refused", "expired", "cancelled"] },
          contrat_id: { type: "string" },
          limit: { type: "number" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remind_signature",
      description: "Envoie une relance aux signataires d'une demande en cours.",
      parameters: {
        type: "object",
        properties: {
          request_id: { type: "string" },
          message: { type: "string", description: "Message personnalisé optionnel" }
        },
        required: ["request_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cancel_signature",
      description: "Annule définitivement une demande de signature. Direction/admin uniquement.",
      parameters: {
        type: "object",
        properties: {
          request_id: { type: "string" },
          reason: { type: "string" }
        },
        required: ["request_id"]
      }
    }
  },

  // ============================================================
  // ATTRIBUTION MULTI-TOUCH (Scoring v2)
  // ============================================================
  {
    type: "function",
    function: {
      name: "get_attribution_analysis",
      description: "Analyse d'attribution multi-touch pour un établissement (modèles first_touch, last_touch, linear, time_decay). Retourne first/last touch + top canaux + top utilisateurs contributeurs.",
      parameters: {
        type: "object",
        properties: {
          etablissement_id: { type: "string" },
          model: { type: "string", enum: ["first_touch", "last_touch", "linear", "time_decay"], description: "Modèle (défaut time_decay)" }
        },
        required: ["etablissement_id"]
      }
    }
  }
];

export default JARVIS_TOOLS_V3;

