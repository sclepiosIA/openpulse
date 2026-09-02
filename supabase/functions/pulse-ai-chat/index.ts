// @ts-ignore Deno built-in serve
import { createClient } from '@supabase/supabase-js'
import {
  sanitizeForAI,
  detectPromptInjection,
  logSecurityEvent,
} from '../_shared/security-utils.ts'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT')
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY')

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface AIAction {
  type:
    | 'open_email_composer'
    | 'open_task'
    | 'open_etablissement'
    | 'open_email'
    | 'created_task'
    | 'created_etablissement'
    | 'updated_etablissement'
  data: any
}

interface EntityLink {
  type: 'etablissement' | 'tache' | 'contact' | 'email' | 'groupe' | 'partenaire'
  id: string
  name: string
}

// Define GPT-5 tools for function calling
const tools = [
  {
    type: 'function',
    function: {
      name: 'search_entity',
      description:
        'Rechercher des entités (établissements, tâches, contacts, emails, groupes, partenaires)',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Terme de recherche' },
          entity_types: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['etablissement', 'tache', 'contact', 'email', 'groupe', 'partenaire'],
            },
            description: "Types d'entités à rechercher (par défaut: tous)",
          },
          limit: { type: 'number', description: 'Nombre max de résultats (défaut: 10)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_etablissement_details',
      description:
        "Obtenir les détails complets d'un établissement avec ses contacts, tâches et métriques",
      parameters: {
        type: 'object',
        properties: {
          etablissement_id: { type: 'string', description: "ID de l'établissement" },
        },
        required: ['etablissement_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_email_details',
      description: "Obtenir les détails complets d'un fil d'email avec tous ses messages",
      parameters: {
        type: 'object',
        properties: {
          thread_id: { type: 'string', description: 'ID du thread email' },
        },
        required: ['thread_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_task_details',
      description: "Obtenir les détails complets d'une tâche",
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'ID de la tâche' },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepare_email',
      description:
        "Préparer un brouillon d'email à envoyer. L'utilisateur pourra le revoir et l'envoyer.",
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'array',
            items: { type: 'string' },
            description: 'Adresses email des destinataires',
          },
          cc: {
            type: 'array',
            items: { type: 'string' },
            description: 'Adresses en copie (optionnel)',
          },
          subject: { type: 'string', description: "Sujet de l'email" },
          body: { type: 'string', description: "Corps de l'email en texte ou HTML simple" },
          etablissement_id: {
            type: 'string',
            description: "ID de l'établissement lié (optionnel)",
          },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Créer une nouvelle tâche dans le CRM',
      parameters: {
        type: 'object',
        properties: {
          titre: { type: 'string', description: 'Titre de la tâche' },
          description: { type: 'string', description: 'Description détaillée de la tâche' },
          priorite: {
            type: 'string',
            enum: ['basse', 'normale', 'haute', 'urgente'],
            description: 'Niveau de priorité',
          },
          date_echeance: { type: 'string', description: "Date d'échéance au format YYYY-MM-DD" },
          etablissement_id: {
            type: 'string',
            description: "ID de l'établissement lié (optionnel)",
          },
          assignee_id: {
            type: 'string',
            description:
              "ID du profil à qui assigner la tâche (optionnel, sinon assignée à l'utilisateur courant)",
          },
          categorie_id: { type: 'string', description: 'ID de la catégorie de tâche (optionnel)' },
        },
        required: ['titre'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_etablissement',
      description: 'Créer un nouvel établissement de santé dans le CRM',
      parameters: {
        type: 'object',
        properties: {
          nom: { type: 'string', description: "Nom de l'établissement" },
          ville: { type: 'string', description: 'Ville' },
          region: { type: 'string', description: 'Région' },
          type: {
            type: 'string',
            enum: ['CHU', 'CH', 'Clinique', 'ESPIC', 'Privé', 'Autre'],
            description: "Type d'établissement",
          },
          statut: {
            type: 'string',
            enum: [
              'prospect',
              'contact_initial',
              'demo_planifiee',
              'demo_effectuee',
              'proposition_envoyee',
              'negociation',
              'contractuel',
              'deploiement',
              'production',
              'churne',
            ],
            description: 'Statut commercial',
          },
          notes: { type: 'string', description: 'Notes additionnelles' },
          telephone: { type: 'string', description: 'Téléphone principal' },
          email: { type: 'string', description: 'Email principal' },
        },
        required: ['nom', 'ville'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_etablissement',
      description: "Modifier les informations d'un établissement existant",
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: "ID de l'établissement à modifier" },
          updates: {
            type: 'object',
            description: 'Champs à mettre à jour',
            properties: {
              nom: { type: 'string' },
              ville: { type: 'string' },
              region: { type: 'string' },
              statut: { type: 'string' },
              notes: { type: 'string' },
              telephone: { type: 'string' },
              email: { type: 'string' },
            },
          },
        },
        required: ['id', 'updates'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_contact_details',
      description: "Obtenir les détails complets d'un contact avec son établissement et historique",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'ID du contact' },
        },
        required: ['contact_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_groupe_details',
      description: "Obtenir les détails d'un groupe d'établissements avec tous ses membres",
      parameters: {
        type: 'object',
        properties: {
          groupe_id: { type: 'string', description: 'ID du groupe' },
        },
        required: ['groupe_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_partenaire_details',
      description: "Obtenir les détails d'un partenaire avec ses établissements liés",
      parameters: {
        type: 'object',
        properties: {
          partenaire_id: { type: 'string', description: 'ID du partenaire' },
        },
        required: ['partenaire_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_emails_for_etablissement',
      description:
        "Obtenir les derniers emails d'un établissement avec leur contenu complet. Utilise cet outil quand on te demande le contenu ou le détail des emails d'un établissement.",
      parameters: {
        type: 'object',
        properties: {
          etablissement_id: { type: 'string', description: "ID de l'établissement" },
          limit: { type: 'number', description: "Nombre max d'emails (défaut: 5)" },
          include_content: {
            type: 'boolean',
            description: 'Inclure le contenu des messages (défaut: true)',
          },
        },
        required: ['etablissement_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepare_reply_email',
      description:
        "Préparer une réponse à un email existant. L'utilisateur pourra la revoir et l'envoyer. Utilise cet outil quand on te demande de répondre à un email.",
      parameters: {
        type: 'object',
        properties: {
          thread_id: { type: 'string', description: 'ID du thread email auquel répondre' },
          body: { type: 'string', description: 'Corps de la réponse' },
          reply_all: { type: 'boolean', description: 'Répondre à tous (défaut: false)' },
        },
        required: ['thread_id', 'body'],
      },
    },
  },
  // Global mode additional tools
  {
    type: 'function',
    function: {
      name: 'search_todos',
      description: "Rechercher dans les todos personnels de l'utilisateur",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Terme de recherche (optionnel)' },
          include_done: {
            type: 'boolean',
            description: 'Inclure les todos terminés (défaut: false)',
          },
          limit: { type: 'number', description: 'Nombre max de résultats (défaut: 20)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_rd',
      description: 'Rechercher dans les projets et user stories R&D',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Terme de recherche (optionnel)' },
          type: {
            type: 'string',
            enum: ['projet', 'user_story', 'all'],
            description: 'Type à rechercher (défaut: all)',
          },
          limit: { type: 'number', description: 'Nombre max de résultats (défaut: 20)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_support',
      description: 'Rechercher dans les tickets support',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Terme de recherche (optionnel)' },
          status: {
            type: 'string',
            enum: ['open', 'closed', 'all'],
            description: 'Filtrer par statut (défaut: open)',
          },
          limit: { type: 'number', description: 'Nombre max de résultats (défaut: 20)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_calendar',
      description: "Rechercher dans le calendrier de l'utilisateur",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Terme de recherche (optionnel)' },
          date_start: {
            type: 'string',
            description: "Date de début (format YYYY-MM-DD, défaut: aujourd'hui)",
          },
          date_end: {
            type: 'string',
            description: 'Date de fin (format YYYY-MM-DD, défaut: +30 jours)',
          },
          limit: { type: 'number', description: 'Nombre max de résultats (défaut: 20)' },
        },
        required: [],
      },
    },
  },
  // NEW: Tool for full context with video links and cross-references
  {
    type: 'function',
    function: {
      name: 'get_full_context_for_etablissement',
      description:
        "Obtenir un contexte complet d'un établissement : détails, emails récents avec contenu, tâches, événements prévus (visios incluses avec liens), contacts. Utilise cet outil quand on te demande un résumé, une vue d'ensemble ou les prochaines visios.",
      parameters: {
        type: 'object',
        properties: {
          etablissement_id: { type: 'string', description: "ID de l'établissement" },
          days_ahead: {
            type: 'number',
            description: 'Nombre de jours pour les événements futurs (défaut: 30)',
          },
        },
        required: ['etablissement_id'],
      },
    },
  },
  // NEW: Tool for account review (Point compte)
  {
    type: 'function',
    function: {
      name: 'generate_account_review',
      description:
        "Générer un point compte complet sur les établissements en production et déploiement. Récupère tâches, emails récents, événements et contacts pour chaque établissement actif. Utilise cet outil quand on te demande un 'point compte', une 'revue des comptes' ou un état des lieux des clients.",
      parameters: {
        type: 'object',
        properties: {
          phases: {
            type: 'array',
            items: { type: 'string', enum: ['deploiement', 'production'] },
            description: 'Phases à inclure (défaut: les deux)',
          },
          days_back: {
            type: 'number',
            description: "Nombre de jours pour l'historique récent (défaut: 14)",
          },
          days_ahead: {
            type: 'number',
            description: 'Nombre de jours pour les événements futurs (défaut: 30)',
          },
        },
        required: [],
      },
    },
  },
]

// Tool execution functions

// Sanitize search query for PostgREST filters
function sanitizeSearchTerm(query: string): string {
  if (!query || typeof query !== 'string') return ''
  return query
    .replace(/[(),."\\\s]+/g, ' ')
    .trim()
    .substring(0, 200)
    .toLowerCase()
}

async function executeSearchEntity(
  supabase: any,
  args: { query: string; entity_types?: string[]; limit?: number }
) {
  const { query, entity_types = ['etablissement', 'tache', 'contact', 'email'], limit = 10 } = args
  const results: any = {}
  const sanitized = sanitizeSearchTerm(query)
  if (!sanitized) return results
  const searchTerm = `%${sanitized}%`

  if (entity_types.includes('etablissement')) {
    const { data } = await supabase
      .from('etablissements')
      .select('id, nom, ville, region, statut, type')
      .or(`nom.ilike.${searchTerm},ville.ilike.${searchTerm}`)
      .limit(limit)
    results.etablissements = data || []
  }

  if (entity_types.includes('tache')) {
    const { data } = await supabase
      .from('taches')
      .select('id, titre, statut, priorite, date_echeance, etablissement:etablissements(id, nom)')
      .or(`titre.ilike.${searchTerm},description.ilike.${searchTerm}`)
      .limit(limit)
    results.taches = data || []
  }

  if (entity_types.includes('contact')) {
    const { data } = await supabase
      .from('contacts')
      .select('id, nom, prenom, email, fonction, etablissement:etablissements(id, nom)')
      .or(`nom.ilike.${searchTerm},prenom.ilike.${searchTerm},email.ilike.${searchTerm}`)
      .limit(limit)
    results.contacts = data || []
  }

  if (entity_types.includes('email')) {
    // Recherche dans les threads par sujet OU par établissement lié
    const { data } = await supabase
      .from('email_threads')
      .select(
        'id, subject, ai_generated_title, category, last_message_date, etablissement:etablissements(id, nom)'
      )
      .or(`subject.ilike.${searchTerm},ai_generated_title.ilike.${searchTerm}`)
      .order('last_message_date', { ascending: false })
      .limit(limit)

    // Aussi chercher par nom d'établissement si pas de résultat direct
    let emails = data || []
    if (emails.length === 0) {
      // Chercher des établissements qui matchent
      const { data: matchingEtabs } = await supabase
        .from('etablissements')
        .select('id')
        .ilike('nom', searchTerm)
        .limit(5)

      if (matchingEtabs && matchingEtabs.length > 0) {
        const etabIds = matchingEtabs.map((e: any) => e.id)
        const { data: etabEmails } = await supabase
          .from('email_threads')
          .select(
            'id, subject, ai_generated_title, category, last_message_date, etablissement:etablissements(id, nom)'
          )
          .in('etablissement_id', etabIds)
          .order('last_message_date', { ascending: false })
          .limit(limit)
        emails = etabEmails || []
      }
    }
    results.emails = emails
  }

  if (entity_types.includes('groupe')) {
    const { data } = await supabase
      .from('groupes_etablissements')
      .select('id, nom, description')
      .or(`nom.ilike.${searchTerm},description.ilike.${searchTerm}`)
      .limit(limit)
    results.groupes = data || []
  }

  if (entity_types.includes('partenaire')) {
    const { data } = await supabase
      .from('partenaires')
      .select('id, nom, type')
      .or(`nom.ilike.${searchTerm}`)
      .limit(limit)
    results.partenaires = data || []
  }

  return results
}

async function executeGetEtablissementDetails(supabase: any, args: { etablissement_id: string }) {
  const { etablissement_id } = args

  const { data: etablissement } = await supabase
    .from('etablissements')
    .select(
      `
      *,
      contacts(*),
      taches(id, titre, statut, priorite, date_echeance),
      customer_health_metrics(*),
      groupe:groupes_etablissements(id, nom)
    `
    )
    .eq('id', etablissement_id)
    .single()

  if (!etablissement) {
    return { error: 'Établissement non trouvé' }
  }

  // Get recent emails
  const { data: emails } = await supabase
    .from('email_threads')
    .select('id, subject, ai_generated_title, category, last_message_date')
    .eq('etablissement_id', etablissement_id)
    .order('last_message_date', { ascending: false })
    .limit(5)

  return { ...etablissement, recent_emails: emails || [] }
}

async function executeGetEmailDetails(supabase: any, args: { thread_id: string }) {
  const { thread_id } = args

  const { data: thread } = await supabase
    .from('email_threads')
    .select(
      `
      *,
      etablissement:etablissements(id, nom, ville),
      email_messages(
        id, subject, from_address, from_name, to_addresses, 
        body_text, sent_date, is_read
      )
    `
    )
    .eq('id', thread_id)
    .single()

  if (!thread) {
    return { error: 'Thread email non trouvé' }
  }

  return thread
}

async function executeGetTaskDetails(supabase: any, args: { task_id: string }) {
  const { task_id } = args

  const { data: task } = await supabase
    .from('taches')
    .select(
      `
      *,
      etablissement:etablissements(id, nom, ville),
      assigne:profiles!taches_assigne_a_fkey(id, nom, prenom),
      categorie:categories_taches(id, nom, couleur)
    `
    )
    .eq('id', task_id)
    .single()

  if (!task) {
    return { error: 'Tâche non trouvée' }
  }

  return task
}

async function executeGetContactDetails(supabase: any, args: { contact_id: string }) {
  const { contact_id } = args

  const { data: contact } = await supabase
    .from('contacts')
    .select(
      `
      *,
      etablissement:etablissements(id, nom, ville, statut, type),
      groupe:groupes_etablissements(id, nom)
    `
    )
    .eq('id', contact_id)
    .single()

  if (!contact) {
    return { error: 'Contact non trouvé' }
  }

  return contact
}

async function executeGetGroupeDetails(supabase: any, args: { groupe_id: string }) {
  const { groupe_id } = args

  const { data: groupe } = await supabase
    .from('groupes_etablissements')
    .select(
      `
      *,
      etablissements(id, nom, ville, statut, type)
    `
    )
    .eq('id', groupe_id)
    .single()

  if (!groupe) {
    return { error: 'Groupe non trouvé' }
  }

  // Get contacts linked to this group
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, nom, prenom, email, fonction')
    .eq('groupe_id', groupe_id)

  return { ...groupe, contacts: contacts || [] }
}

async function executeGetPartenaireDetails(supabase: any, args: { partenaire_id: string }) {
  const { partenaire_id } = args

  const { data: partenaire } = await supabase
    .from('partenaires')
    .select('*')
    .eq('id', partenaire_id)
    .single()

  if (!partenaire) {
    return { error: 'Partenaire non trouvé' }
  }

  // Get etablissements linked to this partenaire
  const { data: etabs } = await supabase
    .from('etablissements')
    .select('id, nom, ville, statut')
    .eq('partenaire_id', partenaire_id)

  // Get email threads for this partenaire
  const { data: emails } = await supabase
    .from('email_threads')
    .select('id, subject, ai_generated_title, last_message_date')
    .eq('partenaire_id', partenaire_id)
    .order('last_message_date', { ascending: false })
    .limit(10)

  return { ...partenaire, etablissements: etabs || [], recent_emails: emails || [] }
}

async function executeGetEmailsForEtablissement(
  supabase: any,
  args: {
    etablissement_id: string
    limit?: number
    include_content?: boolean
  }
) {
  const { etablissement_id, limit = 5, include_content = true } = args

  // D'abord récupérer l'établissement
  const { data: etab } = await supabase
    .from('etablissements')
    .select('id, nom, ville')
    .eq('id', etablissement_id)
    .single()

  if (!etab) {
    return { error: 'Établissement non trouvé' }
  }

  // Récupérer les threads avec les messages
  let selectQuery = 'id, subject, ai_generated_title, last_message_date, category, tags'
  if (include_content) {
    selectQuery += ', email_messages(id, subject, from_address, from_name, body_text, sent_date)'
  }

  const { data: threads } = await supabase
    .from('email_threads')
    .select(selectQuery)
    .eq('etablissement_id', etablissement_id)
    .order('last_message_date', { ascending: false })
    .limit(limit)

  return {
    etablissement: etab.nom,
    etablissement_id: etab.id,
    emails_count: threads?.length || 0,
    threads:
      threads?.map((t: any) => {
        const result: any = {
          id: t.id,
          title: t.ai_generated_title || t.subject,
          date: t.last_message_date,
          category: t.category,
          tags: t.tags,
        }

        // Garder le dernier message pour le contenu
        if (include_content && t.email_messages && t.email_messages.length > 0) {
          // Trier par date décroissante pour avoir le plus récent
          const sortedMessages = [...t.email_messages].sort(
            (a: any, b: any) => new Date(b.sent_date).getTime() - new Date(a.sent_date).getTime()
          )
          const lastMsg = sortedMessages[0]
          result.last_message = {
            from: lastMsg.from_name || lastMsg.from_address,
            date: lastMsg.sent_date,
            content: lastMsg.body_text?.slice(0, 1500), // Limiter le contenu
          }
        }

        return result
      }) || [],
  }
}

async function executePrepareReplyEmail(
  supabase: any,
  args: {
    thread_id: string
    body: string
    reply_all?: boolean
  }
) {
  const { thread_id, body, reply_all = false } = args

  // Récupérer le thread et le dernier message
  const { data: thread } = await supabase
    .from('email_threads')
    .select(
      `
      id, subject, etablissement_id,
      email_messages(id, from_address, from_name, to_addresses, cc_addresses, sent_date)
    `
    )
    .eq('id', thread_id)
    .single()

  if (!thread) {
    return { error: 'Thread email non trouvé' }
  }

  // Trier pour avoir le dernier message
  const sortedMessages = [...(thread.email_messages || [])].sort(
    (a: any, b: any) => new Date(b.sent_date).getTime() - new Date(a.sent_date).getTime()
  )
  const lastMessage = sortedMessages[0]

  if (!lastMessage) {
    return { error: 'Aucun message dans ce thread' }
  }

  // Préparer les destinataires
  const to = [lastMessage.from_address]
  const cc: string[] = []

  if (reply_all) {
    // Ajouter les autres destinataires en CC
    const toAddresses = lastMessage.to_addresses || []
    const ccAddresses = lastMessage.cc_addresses || []

    for (const addr of [...toAddresses, ...ccAddresses]) {
      const email = typeof addr === 'string' ? addr : addr?.address
      if (email && !to.includes(email) && !cc.includes(email)) {
        cc.push(email)
      }
    }
  }

  return {
    success: true,
    message: 'Réponse email préparée',
    reply_data: {
      thread_id,
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject: thread.subject?.startsWith('Re:') ? thread.subject : `Re: ${thread.subject}`,
      body,
      etablissement_id: thread.etablissement_id,
      in_reply_to: lastMessage.id,
    },
  }
}

async function executeCreateTask(supabase: any, profileId: string, args: any) {
  const {
    titre,
    description,
    priorite = 'normale',
    date_echeance,
    etablissement_id,
    assignee_id,
    categorie_id,
  } = args

  const { data, error } = await supabase
    .from('taches')
    .insert({
      titre,
      description,
      priorite,
      date_echeance,
      etablissement_id,
      assigne_a: assignee_id || profileId,
      categorie_id,
      statut: 'a_faire',
      creee_par: profileId,
    })
    .select('id, titre, statut, priorite, date_echeance')
    .single()

  if (error) {
    return { error: error.message }
  }

  return { success: true, task: data }
}

async function executeCreateEtablissement(supabase: any, args: any) {
  const { nom, ville, region, type, statut = 'prospect', notes, telephone, email } = args

  const { data, error } = await supabase
    .from('etablissements')
    .insert({
      nom,
      ville,
      region,
      type,
      statut,
      notes,
      telephone,
      email,
    })
    .select('id, nom, ville, statut')
    .single()

  if (error) {
    return { error: error.message }
  }

  return { success: true, etablissement: data }
}

async function executeUpdateEtablissement(supabase: any, args: { id: string; updates: any }) {
  const { id, updates } = args

  const { data, error } = await supabase
    .from('etablissements')
    .update(updates)
    .eq('id', id)
    .select('id, nom, ville, statut')
    .single()

  if (error) {
    return { error: error.message }
  }

  return { success: true, etablissement: data }
}

// Global mode tool functions
async function executeSearchTodos(
  supabase: any,
  profileId: string,
  args: { query?: string; include_done?: boolean; limit?: number }
) {
  const { query, include_done = false, limit = 20 } = args

  let queryBuilder = supabase
    .from('personal_todos')
    .select('id, title, description, is_done, due_date, priority, created_at')
    .eq('user_id', profileId)

  if (!include_done) {
    queryBuilder = queryBuilder.eq('is_done', false)
  }

  if (query) {
    const searchTerm = `%${query.toLowerCase()}%`
    queryBuilder = queryBuilder.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`)
  }

  const { data, error } = await queryBuilder
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) {
    return { error: error.message }
  }

  return { todos: data || [], count: data?.length || 0 }
}

async function executeSearchRD(
  supabase: any,
  args: { query?: string; type?: string; limit?: number }
) {
  const { query, type = 'all', limit = 20 } = args
  const results: any = { projets: [], user_stories: [] }
  const searchTerm = query ? `%${query.toLowerCase()}%` : null

  if (type === 'all' || type === 'projet') {
    let queryBuilder = supabase
      .from('rd_projets')
      .select('id, nom, description, statut, date_debut, date_fin_prevue')

    if (searchTerm) {
      queryBuilder = queryBuilder.or(`nom.ilike.${searchTerm},description.ilike.${searchTerm}`)
    }

    const { data } = await queryBuilder.order('created_at', { ascending: false }).limit(limit)
    results.projets = data || []
  }

  if (type === 'all' || type === 'user_story') {
    let queryBuilder = supabase
      .from('rd_user_stories')
      .select('id, titre, description, statut, points, priorite, projet:rd_projets(id, nom)')
      .neq('statut', 'termine')

    if (searchTerm) {
      queryBuilder = queryBuilder.or(`titre.ilike.${searchTerm},description.ilike.${searchTerm}`)
    }

    const { data } = await queryBuilder.order('priorite', { ascending: false }).limit(limit)
    results.user_stories = data || []
  }

  return results
}

async function executeSearchSupport(
  supabase: any,
  args: { query?: string; status?: string; limit?: number }
) {
  const { query, status = 'open', limit = 20 } = args

  let queryBuilder = supabase
    .from('support_tickets')
    .select(
      'id, numero_ticket, titre, description, statut, priorite, date_ouverture, etablissement:etablissements(id, nom)'
    )

  if (status === 'open') {
    queryBuilder = queryBuilder.in('statut', ['nouveau', 'en_cours', 'en_attente'])
  } else if (status === 'closed') {
    queryBuilder = queryBuilder.in('statut', ['resolu', 'ferme'])
  }

  if (query) {
    const searchTerm = `%${query.toLowerCase()}%`
    queryBuilder = queryBuilder.or(
      `titre.ilike.${searchTerm},description.ilike.${searchTerm},numero_ticket.ilike.${searchTerm}`
    )
  }

  const { data, error } = await queryBuilder
    .order('date_ouverture', { ascending: false })
    .limit(limit)

  if (error) {
    return { error: error.message }
  }

  return { tickets: data || [], count: data?.length || 0 }
}

async function executeSearchCalendar(
  supabase: any,
  profileId: string,
  args: { query?: string; date_start?: string; date_end?: string; limit?: number }
) {
  const { query, limit = 20 } = args

  const now = new Date()
  const dateStart = args.date_start || now.toISOString().split('T')[0]
  const dateEnd =
    args.date_end || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Get user's calendars first
  const { data: calendars } = await supabase
    .from('calendars')
    .select('id')
    .eq('owner_id', profileId)

  if (!calendars || calendars.length === 0) {
    return { events: [], count: 0 }
  }

  const calendarIds = calendars.map((c: any) => c.id)

  let queryBuilder = supabase
    .from('calendar_events')
    .select(
      'id, title, description, start_time, end_time, location, video_conference_url, all_day, etablissement:etablissements(id, nom)'
    )
    .in('calendar_id', calendarIds)
    .gte('start_time', dateStart)
    .lte('start_time', dateEnd + 'T23:59:59')

  if (query) {
    const searchTerm = `%${query.toLowerCase()}%`
    queryBuilder = queryBuilder.or(
      `title.ilike.${searchTerm},description.ilike.${searchTerm},location.ilike.${searchTerm}`
    )
  }

  const { data, error } = await queryBuilder.order('start_time', { ascending: true }).limit(limit)

  if (error) {
    return { error: error.message }
  }

  // Format events with video link info
  const formattedEvents = (data || []).map((e: any) => ({
    ...e,
    hasVisio: !!e.video_conference_url,
    visioLink: e.video_conference_url,
  }))

  return {
    events: formattedEvents,
    count: formattedEvents.length,
    date_range: { start: dateStart, end: dateEnd },
  }
}

// NEW: Get full context with video links and cross-references
async function executeGetFullContextForEtablissement(
  supabase: any,
  profileId: string,
  args: { etablissement_id: string; days_ahead?: number }
) {
  const { etablissement_id, days_ahead = 30 } = args

  // Parallelize all queries for performance
  const [etabResult, emailsResult, tasksResult, eventsResult, contactsResult] = await Promise.all([
    // Établissement with health metrics
    supabase
      .from('etablissements')
      .select('*, customer_health_metrics(*), groupe:groupes_etablissements(id, nom)')
      .eq('id', etablissement_id)
      .single(),

    // Recent emails with content
    supabase
      .from('email_threads')
      .select(
        'id, subject, ai_generated_title, last_message_date, category, tags, email_messages(from_name, from_address, body_text, sent_date)'
      )
      .eq('etablissement_id', etablissement_id)
      .order('last_message_date', { ascending: false })
      .limit(8),

    // Active tasks
    supabase
      .from('taches')
      .select(
        'id, titre, statut, priorite, echeance, description, assigne:profiles!taches_assigne_a_fkey(nom, prenom)'
      )
      .eq('etablissement_id', etablissement_id)
      .in('statut', ['A faire', 'En cours'])
      .order('echeance', { ascending: true }),

    // Upcoming events WITH video links
    supabase
      .from('calendar_events')
      .select(
        'id, title, start_time, end_time, location, video_conference_url, description, all_day'
      )
      .eq('etablissement_id', etablissement_id)
      .gte('start_time', new Date().toISOString())
      .lte('start_time', new Date(Date.now() + days_ahead * 24 * 60 * 60 * 1000).toISOString())
      .order('start_time', { ascending: true }),

    // Contacts
    supabase
      .from('contacts')
      .select('id, nom, prenom, email, fonction, telephone, est_contact_principal')
      .eq('etablissement_id', etablissement_id)
      .limit(15),
  ])

  // Format emails with summary
  const emails = (emailsResult.data || []).map((e: any) => ({
    id: e.id,
    title: e.ai_generated_title || e.subject,
    date: e.last_message_date,
    category: e.category,
    tags: e.tags,
    messages: (e.email_messages || []).slice(0, 3).map((m: any) => ({
      from: m.from_name || m.from_address,
      date: m.sent_date,
      content: m.body_text?.slice(0, 800), // First 800 chars
    })),
  }))

  // Format events with video link prominence
  const events = (eventsResult.data || []).map((e: any) => ({
    id: e.id,
    title: e.title,
    date: e.start_time,
    end_date: e.end_time,
    location: e.location,
    all_day: e.all_day,
    hasVisio: !!e.video_conference_url,
    visioLink: e.video_conference_url,
    description: e.description?.slice(0, 200),
  }))

  // Format contacts with principal flag
  const contacts = (contactsResult.data || []).map((c: any) => ({
    id: c.id,
    fullName: `${c.prenom || ''} ${c.nom}`.trim(),
    email: c.email,
    fonction: c.fonction,
    telephone: c.telephone,
    isPrincipal: c.est_contact_principal,
  }))

  // Build cross-references summary
  const crossReferences: string[] = []

  // Link events to contacts if possible
  const principalContact = contacts.find((c: any) => c.isPrincipal)
  if (principalContact && events.length > 0) {
    crossReferences.push(
      `Contact principal: ${principalContact.fullName} - potentiellement présent aux ${events.length} événement(s) à venir`
    )
  }

  // Highlight visios
  const visioEvents = events.filter((e: any) => e.hasVisio)
  if (visioEvents.length > 0) {
    crossReferences.push(
      `${visioEvents.length} visioconférence(s) prévue(s) avec liens disponibles`
    )
  }

  return {
    etablissement: etabResult.data,
    emails,
    tasks: tasksResult.data || [],
    events,
    contacts,
    crossReferences,
    summary: {
      emailCount: emails.length,
      taskCount: (tasksResult.data || []).length,
      eventCount: events.length,
      visioCount: visioEvents.length,
      contactCount: contacts.length,
    },
  }
}

// NEW: Generate account review for production and deployment establishments
async function executeGenerateAccountReview(
  supabase: any,
  profileId: string,
  args: { phases?: string[]; days_back?: number; days_ahead?: number }
) {
  const phases = args.phases || ['deploiement', 'production']
  const daysBack = args.days_back || 14
  const daysAhead = args.days_ahead || 30

  // Statuts correspondant aux phases
  const DEPLOIEMENT_STATUTS = [
    'Contractuel',
    'Contractualisation',
    'Conformité',
    'Déploiement',
    'Formation',
    'Go-Live',
  ]
  const PRODUCTION_STATUTS = ['Production']

  let statuts: string[] = []
  if (phases.includes('deploiement')) statuts.push(...DEPLOIEMENT_STATUTS)
  if (phases.includes('production')) statuts.push(...PRODUCTION_STATUTS)

  // 1. Récupérer les établissements actifs
  const { data: etablissements, error: etabError } = await supabase
    .from('etablissements')
    .select('id, nom, ville, statut, csm_id, progression')
    .in('statut', statuts)
    .order('nom')

  if (etabError) {
    console.error('[Pulse AI] Error fetching etablissements:', etabError)
    return { etablissements: [], summary: { message: `Erreur: ${etabError.message}` } }
  }

  if (!etablissements || etablissements.length === 0) {
    return {
      etablissements: [],
      summary: { message: 'Aucun établissement en production ou déploiement' },
    }
  }

  const now = new Date()
  const pastDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)
  const etabIds = etablissements.map((e: any) => e.id)

  // 2. Récupérer les données en parallèle (sans joins FK fragiles)
  const [tasksResult, emailsResult, eventsResult, contactsResult] = await Promise.all([
    // Tâches (actives ou complétées récemment) - requête simple sans join
    supabase
      .from('taches')
      .select(
        'id, titre, statut, priorite, echeance, etablissement_id, date_realisation, responsable_id'
      )
      .in('etablissement_id', etabIds)
      .or(`statut.in.(A faire,En cours),date_realisation.gte.${pastDate.toISOString()}`),

    // Emails récents
    supabase
      .from('email_threads')
      .select('id, subject, ai_generated_title, last_message_date, etablissement_id, category')
      .in('etablissement_id', etabIds)
      .gte('last_message_date', pastDate.toISOString())
      .order('last_message_date', { ascending: false })
      .limit(50),

    // Événements (passés récents + futurs)
    supabase
      .from('calendar_events')
      .select('id, title, start_time, end_time, video_conference_url, etablissement_id')
      .in('etablissement_id', etabIds)
      .gte('start_time', pastDate.toISOString())
      .lte('start_time', futureDate.toISOString())
      .order('start_time', { ascending: true })
      .limit(50),

    // Contacts principaux
    supabase
      .from('contacts')
      .select('id, nom, prenom, email, fonction, etablissement_id, niveau_contact')
      .in('etablissement_id', etabIds)
      .or('niveau_contact.eq.principal,est_contact_principal.eq.true')
      .limit(50),
  ])

  // Log errors if any
  if (tasksResult.error) console.error('[Pulse AI] Error fetching tasks:', tasksResult.error)
  if (emailsResult.error) console.error('[Pulse AI] Error fetching emails:', emailsResult.error)
  if (eventsResult.error) console.error('[Pulse AI] Error fetching events:', eventsResult.error)
  if (contactsResult.error)
    console.error('[Pulse AI] Error fetching contacts:', contactsResult.error)

  const tasks = tasksResult.data || []
  const emails = emailsResult.data || []
  const events = eventsResult.data || []
  const contacts = contactsResult.data || []

  console.log(
    `[Pulse AI] Data retrieved: ${tasks.length} tasks, ${emails.length} emails, ${events.length} events, ${contacts.length} contacts`
  )

  // 2b. Récupérer les profils pour les responsables de tâches (enrichissement en mémoire)
  const responsableIds = [...new Set(tasks.map((t: any) => t.responsable_id).filter(Boolean))]
  let profilesMap: Map<string, { nom: string; prenom: string }> = new Map()

  if (responsableIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nom, prenom')
      .in('id', responsableIds)

    if (profiles) {
      profiles.forEach((p: any) =>
        profilesMap.set(p.id, { nom: p.nom || '', prenom: p.prenom || '' })
      )
    }
  }

  // 3. Agréger par établissement
  const accountReview = etablissements.map((etab: any) => {
    const etabTasks = tasks.filter((t: any) => t.etablissement_id === etab.id)
    const etabEmails = emails.filter((e: any) => e.etablissement_id === etab.id).slice(0, 5)
    const etabEvents = events.filter((e: any) => e.etablissement_id === etab.id).slice(0, 5)
    const etabContacts = contacts.filter((c: any) => c.etablissement_id === etab.id).slice(0, 3)

    // Utiliser les valeurs exactes de l'enum statut_tache
    const completedTasks = etabTasks.filter((t: any) => t.statut === 'Terminé')
    const todoTasks = etabTasks.filter((t: any) => t.statut === 'A faire')
    const inProgressTasks = etabTasks.filter((t: any) => t.statut === 'En cours')
    const pastEvents = etabEvents.filter((e: any) => new Date(e.start_time) < now)
    const upcomingEvents = etabEvents.filter((e: any) => new Date(e.start_time) >= now)

    // Helper pour obtenir le nom du responsable
    const getAssigneeName = (responsableId: string | null) => {
      if (!responsableId) return null
      const profile = profilesMap.get(responsableId)
      return profile ? `${profile.prenom} ${profile.nom}`.trim() : null
    }

    return {
      id: etab.id,
      nom: etab.nom,
      ville: etab.ville,
      statut: etab.statut,
      progression: etab.progression,

      // Résumé des actions récentes
      recent: {
        tasks_completed: completedTasks.length,
        tasks_completed_list: completedTasks.slice(0, 3).map((t: any) => ({
          id: t.id,
          titre: t.titre,
          date_realisation: t.date_realisation,
        })),
        emails_exchanged: etabEmails.length,
        last_email: etabEmails[0]
          ? {
              id: etabEmails[0].id,
              subject: etabEmails[0].ai_generated_title || etabEmails[0].subject,
              date: etabEmails[0].last_message_date,
            }
          : null,
        events_past: pastEvents.length,
      },

      // Ce qui reste à faire (limité pour éviter payload trop lourd)
      pending: {
        tasks_todo: todoTasks.slice(0, 5).map((t: any) => ({
          id: t.id,
          titre: t.titre,
          priorite: t.priorite,
          echeance: t.echeance,
          assignee: getAssigneeName(t.responsable_id),
        })),
        tasks_in_progress: inProgressTasks.slice(0, 5).map((t: any) => ({
          id: t.id,
          titre: t.titre,
          priorite: t.priorite,
          echeance: t.echeance,
          assignee: getAssigneeName(t.responsable_id),
        })),
        upcoming_events: upcomingEvents.slice(0, 3).map((e: any) => ({
          id: e.id,
          title: e.title,
          date: e.start_time,
          video_url: e.video_conference_url,
          hasVisio: !!e.video_conference_url,
        })),
      },

      // Contacts clés
      contacts: etabContacts.map((c: any) => ({
        id: c.id,
        nom: `${c.prenom || ''} ${c.nom}`.trim(),
        email: c.email,
        fonction: c.fonction,
      })),
    }
  })

  // 4. Générer des suggestions d'actions
  const suggestions: any[] = []

  for (const etab of accountReview) {
    // Relance si pas d'email récent et tâches en attente
    if (!etab.recent.last_email && etab.pending.tasks_todo.length > 0) {
      suggestions.push({
        type: 'relance',
        etablissement: etab.nom,
        etablissement_id: etab.id,
        priorite: 'moyenne',
        raison: "Pas d'échange email récent avec des tâches en attente",
      })
    }

    // Suivi urgent si tâches en retard
    const overdueTasks = etab.pending.tasks_todo.filter(
      (t: any) => t.echeance && new Date(t.echeance) < now
    )
    if (overdueTasks.length > 0) {
      suggestions.push({
        type: 'suivi_urgent',
        etablissement: etab.nom,
        etablissement_id: etab.id,
        priorite: 'haute',
        raison: `${overdueTasks.length} tâche(s) en retard`,
        tasks: overdueTasks.slice(0, 3),
      })
    }

    // Préparation visio si événement proche
    const upcomingVisio = etab.pending.upcoming_events.find((e: any) => e.hasVisio)
    if (upcomingVisio) {
      const eventDate = new Date(upcomingVisio.date)
      const daysDiff = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysDiff <= 7) {
        suggestions.push({
          type: 'preparation_visio',
          etablissement: etab.nom,
          etablissement_id: etab.id,
          priorite: daysDiff <= 2 ? 'haute' : 'moyenne',
          event: upcomingVisio,
          jours_restants: daysDiff,
          raison: `Visio dans ${daysDiff} jour(s)`,
        })
      }
    }

    // Félicitations si beaucoup de tâches complétées
    if (etab.recent.tasks_completed >= 3 && etab.recent.emails_exchanged > 0) {
      suggestions.push({
        type: 'felicitations',
        etablissement: etab.nom,
        etablissement_id: etab.id,
        priorite: 'basse',
        raison: `${etab.recent.tasks_completed} tâches complétées récemment - bon moment pour un point de satisfaction`,
      })
    }
  }

  // Trier suggestions par priorité
  const priorityOrder: Record<string, number> = { haute: 0, moyenne: 1, basse: 2 }
  suggestions.sort((a, b) => (priorityOrder[a.priorite] || 2) - (priorityOrder[b.priorite] || 2))

  // Phase 3: Générer un markdown pré-formaté pour fallback/usage direct
  const markdownLines: string[] = []
  markdownLines.push(`## 📊 Point Compte - Synthèse\n`)
  markdownLines.push(
    `**${accountReview.length} établissements** analysés sur les ${daysBack} derniers jours\n`
  )

  const enProd = accountReview.filter((e: any) => e.statut === 'Production').length
  const enDeploi = accountReview.length - enProd
  markdownLines.push(`- 🟢 **${enProd}** en Production`)
  markdownLines.push(`- 🔵 **${enDeploi}** en Déploiement/Contractualisation\n`)

  // Tableau récapitulatif
  markdownLines.push(`### Vue d'ensemble\n`)
  markdownLines.push(
    `| Établissement | Statut | Tâches À faire | En cours | Emails | Prochain RDV |`
  )
  markdownLines.push(
    `|---------------|--------|----------------|----------|--------|--------------|`
  )

  for (const etab of accountReview.slice(0, 15)) {
    const nextEvent = etab.pending.upcoming_events[0]
    const nextEventStr = nextEvent ? new Date(nextEvent.date).toLocaleDateString('fr-FR') : '-'
    markdownLines.push(
      `| [${etab.nom}](/etablissements/${etab.id}) | ${etab.statut} | ${etab.pending.tasks_todo.length} | ${etab.pending.tasks_in_progress.length} | ${etab.recent.emails_exchanged} | ${nextEventStr} |`
    )
  }

  // Actions suggérées
  if (suggestions.length > 0) {
    markdownLines.push(`\n### 🎯 Actions suggérées (${suggestions.length})\n`)
    for (const sugg of suggestions.slice(0, 5)) {
      const icon = sugg.priorite === 'haute' ? '🔴' : sugg.priorite === 'moyenne' ? '🟠' : '🟢'
      markdownLines.push(`${icon} **${sugg.etablissement}** : ${sugg.raison}`)
    }
  }

  // Détails des établissements avec activité
  const activeEtabs = accountReview.filter(
    (e: any) =>
      e.pending.tasks_todo.length > 0 ||
      e.pending.tasks_in_progress.length > 0 ||
      e.pending.upcoming_events.length > 0
  )

  if (activeEtabs.length > 0) {
    markdownLines.push(`\n### 📋 Détail par établissement\n`)
    for (const etab of activeEtabs.slice(0, 8)) {
      markdownLines.push(`#### [${etab.nom}](/etablissements/${etab.id}) (${etab.statut})`)

      if (etab.pending.tasks_todo.length > 0) {
        markdownLines.push(`**À faire :**`)
        for (const t of etab.pending.tasks_todo.slice(0, 3)) {
          markdownLines.push(
            `- [${t.titre}](/taches?id=${t.id}) ${t.priorite === 'Haute' || t.priorite === 'Urgente' ? '⚠️' : ''}`
          )
        }
      }

      if (etab.pending.tasks_in_progress.length > 0) {
        markdownLines.push(`**En cours :**`)
        for (const t of etab.pending.tasks_in_progress.slice(0, 3)) {
          markdownLines.push(`- [${t.titre}](/taches?id=${t.id})`)
        }
      }

      if (etab.pending.upcoming_events.length > 0) {
        markdownLines.push(`**Prochains RDV :**`)
        for (const e of etab.pending.upcoming_events) {
          const dateStr = new Date(e.date).toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
          markdownLines.push(`- ${e.title} - ${dateStr}${e.hasVisio ? ' 📹' : ''}`)
        }
      }
      markdownLines.push('')
    }
  }

  const markdownContent = markdownLines.join('\n')

  return {
    summary: {
      total_etablissements: accountReview.length,
      en_production: enProd,
      en_deploiement: enDeploi,
      total_tasks_pending: accountReview.reduce(
        (acc: number, e: any) =>
          acc + e.pending.tasks_todo.length + e.pending.tasks_in_progress.length,
        0
      ),
      total_upcoming_events: accountReview.reduce(
        (acc: number, e: any) => acc + e.pending.upcoming_events.length,
        0
      ),
      actions_suggested: suggestions.length,
      date_range: {
        history: `${daysBack} jours`,
        future: `${daysAhead} jours`,
      },
    },
    etablissements: accountReview,
    suggested_actions: suggestions,
    markdown: markdownContent,
  }
}

// Execute a tool call
async function executeTool(
  supabase: any,
  profileId: string,
  toolName: string,
  args: any
): Promise<{ result: any; action?: AIAction; entityLink?: EntityLink }> {
  console.log(`[Pulse AI] Executing tool: ${toolName}`, args)

  switch (toolName) {
    case 'search_entity':
      return { result: await executeSearchEntity(supabase, args) }

    case 'get_etablissement_details':
      return { result: await executeGetEtablissementDetails(supabase, args) }

    case 'get_email_details':
      return { result: await executeGetEmailDetails(supabase, args) }

    case 'get_task_details':
      return { result: await executeGetTaskDetails(supabase, args) }

    case 'get_contact_details':
      return { result: await executeGetContactDetails(supabase, args) }

    case 'get_groupe_details':
      return { result: await executeGetGroupeDetails(supabase, args) }

    case 'get_partenaire_details':
      return { result: await executeGetPartenaireDetails(supabase, args) }

    case 'prepare_email':
      return {
        result: { success: true, message: 'Email préparé et prêt à être envoyé' },
        action: {
          type: 'open_email_composer',
          data: args,
        },
      }

    case 'create_task':
      const taskResult = await executeCreateTask(supabase, profileId, args)
      if (taskResult.success) {
        return {
          result: taskResult,
          action: {
            type: 'created_task',
            data: taskResult.task,
          },
        }
      }
      return { result: taskResult }

    case 'create_etablissement':
      const etabResult = await executeCreateEtablissement(supabase, args)
      if (etabResult.success) {
        return {
          result: etabResult,
          action: {
            type: 'created_etablissement',
            data: etabResult.etablissement,
          },
        }
      }
      return { result: etabResult }

    case 'update_etablissement':
      const updateResult = await executeUpdateEtablissement(supabase, args)
      if (updateResult.success) {
        return {
          result: updateResult,
          action: {
            type: 'updated_etablissement',
            data: updateResult.etablissement,
          },
        }
      }
      return { result: updateResult }

    case 'get_emails_for_etablissement':
      return { result: await executeGetEmailsForEtablissement(supabase, args) }

    case 'prepare_reply_email':
      const replyResult = await executePrepareReplyEmail(supabase, args)
      if (replyResult.success && replyResult.reply_data) {
        return {
          result: replyResult,
          action: {
            type: 'open_email_composer',
            data: replyResult.reply_data,
          },
        }
      }
      return { result: replyResult }

    // Global mode tools
    case 'search_todos':
      return { result: await executeSearchTodos(supabase, profileId, args) }

    case 'search_rd':
      return { result: await executeSearchRD(supabase, args) }

    case 'search_support':
      return { result: await executeSearchSupport(supabase, args) }

    case 'search_calendar':
      return { result: await executeSearchCalendar(supabase, profileId, args) }

    case 'get_full_context_for_etablissement':
      return { result: await executeGetFullContextForEtablissement(supabase, profileId, args) }

    case 'generate_account_review':
      return { result: await executeGenerateAccountReview(supabase, profileId, args) }

    default:
      return { result: { error: `Unknown tool: ${toolName}` } }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })

    // Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nom, prenom')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.json()
    const { conversation_id, messages, global_mode, stream } = payload

    console.log(
      '[Pulse AI Chat] User:',
      profile.id,
      'ConversationId:',
      conversation_id,
      'GlobalMode:',
      global_mode || false,
      'Stream:',
      stream || false
    )

    // SECURITY: Sanitize and detect injection in user messages (CRITICAL - interactive chat)
    const sanitizedMessages = messages.map((msg: ChatMessage) => {
      if (msg.role === 'user' && msg.content) {
        // Sanitize content
        const sanitizedContent = sanitizeForAI(msg.content, {
          maxLength: 10000,
          functionName: 'pulse-ai-chat',
        })

        // Detect prompt injection attempts
        const detection = detectPromptInjection(msg.content)
        if (detection.isDetected) {
          logSecurityEvent({
            type: 'injection_attempt',
            functionName: 'pulse-ai-chat',
            userId: profile.id,
            details: {
              patterns: detection.patterns,
              messageLength: msg.content.length,
            },
            riskLevel: detection.riskLevel,
          })

          // For high-risk attempts, log warning but continue (don't block to avoid false positives)
          if (detection.riskLevel === 'high') {
            console.warn(
              `[Pulse AI Chat] HIGH RISK injection attempt detected from user ${profile.id}`
            )
          }
        }

        return { ...msg, content: sanitizedContent }
      }
      return msg
    })

    // Use sanitized messages for the rest of the flow
    const processedMessages = sanitizedMessages

    // Build enriched context data
    let contextData = ''

    // If conversation_id provided, get recent messages
    if (conversation_id) {
      const { data: membership } = await supabase
        .from('pulse_conversation_members')
        .select('id')
        .eq('conversation_id', conversation_id)
        .eq('user_id', profile.id)
        .single()

      if (membership) {
        const { data: pulseMessages } = await supabase
          .from('pulse_messages')
          .select(
            `
            content,
            created_at,
            user:profiles!pulse_messages_user_id_fkey(nom, prenom)
          `
          )
          .eq('conversation_id', conversation_id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(50)

        if (pulseMessages && pulseMessages.length > 0) {
          contextData += '\n\n## CONVERSATION PULSE EN COURS :\n'
          contextData += pulseMessages
            .reverse()
            .map((m: any) => {
              const userName = m.user ? `${m.user.prenom} ${m.user.nom}` : 'Inconnu'
              return `[${new Date(m.created_at).toLocaleString('fr-FR')}] ${userName}: ${m.content}`
            })
            .join('\n')
        }

        // Get conversation info
        const { data: convInfo } = await supabase
          .from('pulse_conversations')
          .select('name, description, etablissement_id')
          .eq('id', conversation_id)
          .single()

        if (convInfo) {
          contextData += `\n\n## INFOS CONVERSATION :\nNom: ${convInfo.name}\nDescription: ${convInfo.description || 'Aucune'}`

          if (convInfo.etablissement_id) {
            const { data: etab } = await supabase
              .from('etablissements')
              .select('id, nom, ville, statut, type')
              .eq('id', convInfo.etablissement_id)
              .single()

            if (etab) {
              contextData += `\nÉtablissement lié: ${etab.nom} (${etab.ville}) - ${etab.statut}`
            }
          }
        }
      }
    }

    // ============================================
    // LOAD DATA IN PARALLEL - OPTIMIZED LIMITS
    // ============================================
    const basePromises = [
      supabase
        .from('etablissements')
        .select('id, nom, ville, statut', { count: 'exact' })
        .order('nom'),
      supabase
        .from('taches')
        .select('id, titre, statut, priorite', { count: 'exact' })
        .in('statut', ['a_faire', 'en_cours'])
        .order('date_echeance', { ascending: true })
        .limit(100),
      supabase
        .from('email_threads')
        .select(
          'id, ai_generated_title, subject, etablissement_id, etablissement:etablissements(id, nom)',
          { count: 'exact' }
        )
        .order('last_message_date', { ascending: false })
        .limit(50),
      supabase
        .from('contacts')
        .select('id, nom, prenom, email', { count: 'exact' })
        .order('nom')
        .limit(200),
      supabase.from('groupes_etablissements').select('id, nom', { count: 'exact' }),
      supabase.from('partenaires').select('id, nom, type', { count: 'exact' }),
      supabase.from('profiles').select('id, nom, prenom, poste'),
      supabase.from('categories_taches').select('id, nom'),
    ]

    // Additional data for global mode
    const globalPromises = global_mode
      ? [
          supabase
            .from('personal_todos')
            .select('id, title, is_done, due_date, priority')
            .eq('user_id', profile.id)
            .eq('is_done', false)
            .order('due_date', { ascending: true })
            .limit(30),
          supabase
            .from('rd_user_stories')
            .select('id, titre, statut, points, projet:rd_projets(nom)')
            .neq('statut', 'termine')
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('support_tickets')
            .select('id, numero_ticket, titre, statut, priorite')
            .in('statut', ['nouveau', 'en_cours', 'en_attente'])
            .order('date_ouverture', { ascending: false })
            .limit(20),
          supabase
            .from('calendar_events')
            .select(
              'id, title, start_time, end_time, all_day, video_conference_url, location, etablissement:etablissements(id, nom)'
            )
            .gte('start_time', new Date().toISOString())
            .lte('start_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
            .order('start_time', { ascending: true })
            .limit(20),
        ]
      : [
          Promise.resolve({ data: null }),
          Promise.resolve({ data: null }),
          Promise.resolve({ data: null }),
          Promise.resolve({ data: null }),
        ]

    const [
      etabResult,
      tasksResult,
      emailsResult,
      contactsResult,
      groupesResult,
      partenairesResult,
      teamResult,
      categoriesResult,
      todosResult,
      rdStoriesResult,
      supportResult,
      calendarResult,
    ] = await Promise.all([...basePromises, ...globalPromises])

    // ============================================
    // BUILD CONTEXT WITHOUT VISIBLE IDs
    // Store internal mappings for entity extraction
    // ============================================
    const entityMappings = {
      etablissements: new Map<string, { id: string; name: string; ville: string }>(),
      taches: new Map<string, { id: string; name: string }>(),
      emails: new Map<string, { id: string; name: string }>(),
      contacts: new Map<string, { id: string; name: string }>(),
      groupes: new Map<string, { id: string; name: string }>(),
      partenaires: new Map<string, { id: string; name: string }>(),
    }

    // Build compact context - NO IDs VISIBLE to AI
    if (etabResult.data && etabResult.data.length > 0) {
      contextData += `\n\n## ÉTABLISSEMENTS (${etabResult.count || etabResult.data.length}):\n`
      contextData += etabResult.data
        .map((e: any) => {
          entityMappings.etablissements.set(e.nom.toLowerCase(), {
            id: e.id,
            name: e.nom,
            ville: e.ville,
          })
          return `- ${e.nom} (${e.ville}, ${e.statut})`
        })
        .join('\n')
    }

    if (tasksResult.data && tasksResult.data.length > 0) {
      contextData += `\n\n## TÂCHES ACTIVES (${tasksResult.count || tasksResult.data.length}, top 100):\n`
      contextData += tasksResult.data
        .map((t: any) => {
          entityMappings.taches.set(t.titre.toLowerCase(), { id: t.id, name: t.titre })
          return `- ${t.titre} [${t.statut}, ${t.priorite}]`
        })
        .join('\n')
    }

    if (emailsResult.data && emailsResult.data.length > 0) {
      contextData += `\n\n## EMAILS RÉCENTS (${emailsResult.count || emailsResult.data.length}, top 50):\n`
      contextData += emailsResult.data
        .map((e: any) => {
          const title = e.ai_generated_title || e.subject
          const etabInfo = e.etablissement?.nom ? ` [${e.etablissement.nom}]` : ''
          if (title) {
            entityMappings.emails.set(title.toLowerCase(), { id: e.id, name: title })
          }
          return `- ${title}${etabInfo}`
        })
        .join('\n')
    }

    if (contactsResult.data && contactsResult.data.length > 0) {
      contextData += `\n\n## CONTACTS (${contactsResult.count || contactsResult.data.length}, top 200):\n`
      contextData += contactsResult.data
        .map((c: any) => {
          const fullName = `${c.prenom || ''} ${c.nom}`.trim()
          entityMappings.contacts.set(fullName.toLowerCase(), { id: c.id, name: fullName })
          return `- ${fullName}${c.email ? ` <${c.email}>` : ''}`
        })
        .join('\n')
    }

    if (groupesResult.data && groupesResult.data.length > 0) {
      contextData += `\n\n## GROUPES (${groupesResult.count || groupesResult.data.length}):\n`
      contextData += groupesResult.data
        .map((g: any) => {
          entityMappings.groupes.set(g.nom.toLowerCase(), { id: g.id, name: g.nom })
          return `- ${g.nom}`
        })
        .join('\n')
    }

    if (partenairesResult.data && partenairesResult.data.length > 0) {
      contextData += `\n\n## PARTENAIRES (${partenairesResult.count || partenairesResult.data.length}):\n`
      contextData += partenairesResult.data
        .map((p: any) => {
          entityMappings.partenaires.set(p.nom.toLowerCase(), { id: p.id, name: p.nom })
          return `- ${p.nom}${p.type ? ` (${p.type})` : ''}`
        })
        .join('\n')
    }

    if (teamResult.data && teamResult.data.length > 0) {
      contextData += `\n\n## ÉQUIPE (${teamResult.data.length}):\n`
      contextData += teamResult.data
        .map((t: any) => `- ${t.prenom} ${t.nom}${t.poste ? ` (${t.poste})` : ''}`)
        .join('\n')
    }

    if (categoriesResult.data && categoriesResult.data.length > 0) {
      contextData += `\n\n## CATÉGORIES TÂCHES:\n`
      contextData += categoriesResult.data.map((c: any) => `- ${c.nom}`).join('\n')
    }

    // Add global mode specific data
    if (global_mode) {
      if (todosResult.data && todosResult.data.length > 0) {
        contextData += `\n\n## MES TODOS (${todosResult.data.length}):\n`
        contextData += todosResult.data
          .map(
            (t: any) =>
              `- ${t.title}${t.due_date ? ` (échéance: ${new Date(t.due_date).toLocaleDateString('fr-FR')})` : ''}${t.priority ? ` [${t.priority}]` : ''}`
          )
          .join('\n')
      }

      if (rdStoriesResult.data && rdStoriesResult.data.length > 0) {
        contextData += `\n\n## R&D USER STORIES (${rdStoriesResult.data.length}):\n`
        contextData += rdStoriesResult.data
          .map(
            (s: any) =>
              `- ${s.titre} [${s.statut}${s.points ? `, ${s.points} pts` : ''}]${s.projet?.nom ? ` - ${s.projet.nom}` : ''}`
          )
          .join('\n')
      }

      if (supportResult.data && supportResult.data.length > 0) {
        contextData += `\n\n## TICKETS SUPPORT OUVERTS (${supportResult.data.length}):\n`
        contextData += supportResult.data
          .map(
            (t: any) =>
              `- ${t.numero_ticket}: ${t.titre} [${t.statut}${t.priorite ? `, ${t.priorite}` : ''}]`
          )
          .join('\n')
      }

      if (calendarResult.data && calendarResult.data.length > 0) {
        contextData += `\n\n## ÉVÉNEMENTS PROCHAINS (7 jours, ${calendarResult.data.length}):\n`
        contextData += calendarResult.data
          .map((e: any) => {
            const date = new Date(e.start_time).toLocaleDateString('fr-FR')
            const time = e.all_day
              ? 'Journée'
              : new Date(e.start_time).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
            let line = `- ${date} ${time}: ${e.title}`
            if (e.location) line += ` - 📍 ${e.location}`
            if (e.video_conference_url) line += ` - 🎥 **VISIO**: ${e.video_conference_url}`
            if (e.etablissement?.nom) line += ` [${e.etablissement.nom}]`
            return line
          })
          .join('\n')
      }
    }

    // Build enriched system prompt
    const globalModeTools = global_mode
      ? `
- search_todos : Rechercher dans tes todos personnels
- search_rd : Rechercher dans les projets et user stories R&D
- search_support : Rechercher dans les tickets support
- search_calendar : Rechercher dans le calendrier (avec liens visio)
- get_full_context_for_etablissement : Obtenir vue d'ensemble complète (emails, tâches, événements avec visios, contacts)
- generate_account_review : Point compte complet sur les établissements en production/déploiement (tâches, emails, événements, actions suggérées)`
      : ''

    const systemPrompt = `Tu es l'assistant IA de OpenPulse, une plateforme CRM pour le secteur de la santé.
Tu parles à ${profile.prenom} ${profile.nom}.${global_mode ? "\nTu es en MODE GLOBAL : tu as accès à TOUTES les données de l'application (CRM, emails, todos, R&D, support, calendrier)." : ''}

## RÈGLES CRITIQUES :
- Réponds en français, de manière CONCISE et DIRECTE
- **SOIS PROACTIF** : quand on te demande un résumé, des détails ou du contenu, UTILISE TES OUTILS sans demander confirmation
- **UTILISE LE FORMAT MARKDOWN** pour structurer tes réponses (titres ##, listes -, **gras**)
- N'invente JAMAIS d'identifiants ou UUIDs - utilise uniquement ceux retournés par les outils

## FORMAT DE RÉPONSE ET LIENS (OBLIGATOIRE) :
- Utilise ## pour les titres de sections
- Utilise - pour les listes à puces
- Utilise **gras** pour mettre en valeur les informations importantes
- **ÉTABLISSEMENTS** : [Nom établissement](/etablissements/UUID)
- **EMAILS** : [Objet ou résumé](/emails?thread=UUID)
- **CONTACTS** : [Prénom Nom](/contacts/UUID)
- **TÂCHES** : [Titre tâche](/taches/UUID)
- **ÉVÉNEMENTS/VISIOS** : [Titre événement](/calendrier?event=UUID)
- **LIENS VISIO EXTERNES** : [🎥 Rejoindre la visio](URL_COMPLETE_GOOGLE_MEET_OU_ZOOM)
- Exemple tableau: | Date | [Email](/emails?thread=abc) | [Contact](/contacts/def) | [🎥 Visio](https://meet.google.com/xxx) |

## QUAND UTILISER LES OUTILS (OBLIGATOIRE - NE DEMANDE PAS CONFIRMATION) :
- "Résume les échanges avec X" → Appelle get_full_context_for_etablissement OU get_emails_for_etablissement
- "Vue d'ensemble de X" / "Résumé client X" → Appelle get_full_context_for_etablissement (donne emails + tâches + événements + visios + contacts)
- "Quels sont les derniers emails de X" → Appelle get_emails_for_etablissement avec include_content=true
- "Détail du client X" → Appelle get_etablissement_details
- "Prochaines visios" / "Événements avec X" → Appelle get_full_context_for_etablissement
- "Point compte" / "Revue des comptes" / "État des lieux clients" → Appelle generate_account_review pour avoir une vue exhaustive de TOUS les établissements en production et déploiement
- "Recherche X" → Appelle search_entity
- **NE DEMANDE JAMAIS À L'UTILISATEUR S'IL VEUT QUE TU FASSES QUELQUE CHOSE - FAIS-LE**

## FORMAT POINT COMPTE (quand generate_account_review est utilisé) :
1. Commence par un **tableau récapitulatif** : | Établissement | Statut | Tâches | Emails récents | Prochaine action |
2. Puis **détaille par établissement** les actions récentes, tâches en cours, et événements à venir
3. Termine par les **actions suggérées** classées par priorité (haute → moyenne → basse)
4. TOUJOURS inclure des liens cliquables vers les tâches, emails, contacts et visios

## RECOUPEMENTS ET LIENS VISIO :
- Quand tu as des événements avec visioconférence, AFFICHE TOUJOURS le lien visio de façon visible
- Fais des recoupements intelligents : relie les contacts aux événements, les emails aux tâches
- Mentionne toujours les **visios prévues** avec leur lien cliquable

## OUTILS DISPONIBLES :
- get_etablissement_details : Détails établissement + tâches + contacts
- get_emails_for_etablissement : Derniers emails d'un établissement AVEC CONTENU COMPLET - utilise toujours include_content=true
- get_email_details : Détail complet d'un fil email spécifique
- get_task_details / get_contact_details / get_groupe_details / get_partenaire_details : Détails autres entités
- search_entity : Recherche approximative (établissements, emails, contacts...)
- prepare_email : Préparer un nouvel email
- prepare_reply_email : Préparer une réponse à un email existant
- create_task : Créer une tâche
- create_etablissement / update_etablissement : Gérer les établissements${globalModeTools}

## DONNÉES DISPONIBLES (pour référence, utilise les outils pour les détails) :
${contextData}`

    // Check Azure config
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Azure OpenAI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Prepare messages for API (use sanitized messages)
    const apiMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...processedMessages.slice(-15), // Keep last 15 messages for context
    ]

    // Tool execution loop - OPTIMIZED: fewer iterations, smaller tokens
    const collectedActions: AIAction[] = []
    const collectedEntityLinks: EntityLink[] = []
    let maxIterations = 4 // Increased from 3 for point compte
    let iteration = 0
    let finalResponse = ''
    let lastGeneratedMarkdown = '' // Store markdown from generate_account_review for fallback

    while (iteration < maxIterations) {
      iteration++
      console.log(`[Pulse AI] Iteration ${iteration}/${maxIterations}`)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 90000)

      let azureResponse: Response
      try {
        azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': AZURE_OPENAI_API_KEY,
          },
          body: JSON.stringify({
            messages: apiMessages,
            max_completion_tokens: 2000, // Reduced from 3000
            reasoning_effort: 'low',
            verbosity: 'low', // Reduced from "medium"
            tools: tools,
            tool_choice: 'auto',
            parallel_tool_calls: true, // Enable parallel tool execution
          }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        // Handle rate limiting with retry
        if (azureResponse.status === 429) {
          console.warn('[Pulse AI Chat] Rate limited, retrying in 2s...')
          await new Promise((r) => setTimeout(r, 2000))

          // Single retry
          azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-key': AZURE_OPENAI_API_KEY,
            },
            body: JSON.stringify({
              messages: apiMessages,
              max_completion_tokens: 1500, // Even smaller for retry
              reasoning_effort: 'low',
              verbosity: 'low',
              tools: tools,
              tool_choice: 'auto',
              parallel_tool_calls: true,
            }),
            signal: controller.signal,
          })

          if (azureResponse.status === 429) {
            console.warn('[Pulse AI Chat] Still rate limited after retry')
            return new Response(
              JSON.stringify({ error: 'Trop de requêtes. Veuillez patienter quelques secondes.' }),
              {
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            )
          }
        }

        if (!azureResponse.ok) {
          const errorText = await azureResponse.text()
          console.error('[Pulse AI Chat] Azure error:', azureResponse.status, errorText)
          throw new Error(`Azure error: ${azureResponse.status}`)
        }
      } catch (error: any) {
        clearTimeout(timeoutId)
        if (error.name === 'AbortError') {
          throw new Error('Request timeout (90s)')
        }
        throw error
      }

      const azureData = await azureResponse.json()
      const choice = azureData.choices?.[0]

      if (!choice) {
        throw new Error('No response from Azure')
      }

      const assistantMessage = choice.message

      // Check if there are tool calls
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Add assistant message with tool calls to conversation
        apiMessages.push({
          role: 'assistant',
          content: assistantMessage.content || '',
          tool_calls: assistantMessage.tool_calls,
        })

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name
          const toolArgs = JSON.parse(toolCall.function.arguments)

          const { result, action, entityLink } = await executeTool(
            supabase,
            profile.id,
            toolName,
            toolArgs
          )

          if (action) {
            collectedActions.push(action)
          }
          if (entityLink) {
            collectedEntityLinks.push(entityLink)
          }

          // Capture markdown from generate_account_review for deterministic fallback
          if (toolName === 'generate_account_review' && result?.markdown) {
            lastGeneratedMarkdown = result.markdown
            console.log('[Pulse AI] Captured markdown from generate_account_review for fallback')
          }

          // Add tool result to conversation
          apiMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          })
        }

        // Continue loop to get final response
        continue
      }

      // No more tool calls, we have the final response
      // Enhanced UUID cleaning (safety net)
      finalResponse = (assistantMessage.content || '')
        // UUID entre parenthèses: (abc123-def...)
        .replace(/\s*\([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\)/gi, '')
        // UUID seul
        .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, '')
        // Format id:nom résiduel
        .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:/gi, '')
        // Doubles espaces résiduels
        .replace(/\s{2,}/g, ' ')
        .trim()
      break
    }

    // ============================================
    // FALLBACK: If no final response, use markdown or force summary
    // ============================================
    if (!finalResponse || finalResponse.trim() === '') {
      console.log('[Pulse AI Chat] No final response from model')

      // Phase 4: Use pre-generated markdown from generate_account_review if available
      if (lastGeneratedMarkdown) {
        console.log('[Pulse AI Chat] Using pre-generated markdown as fallback')
        finalResponse = lastGeneratedMarkdown
      } else {
        console.log('[Pulse AI Chat] Requesting summary fallback')

        // Add instruction to force a response
        apiMessages.push({
          role: 'user',
          content: 'Résume les informations trouvées de manière concise et utile en français.',
        })

        // New call WITHOUT tools to force text response
        const summaryResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': AZURE_OPENAI_API_KEY,
          },
          body: JSON.stringify({
            messages: apiMessages,
            max_completion_tokens: 1500,
            reasoning_effort: 'low',
            verbosity: 'low',
            // NO tools here - force text response
          }),
        })

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json()
          finalResponse =
            summaryData.choices?.[0]?.message?.content ||
            "Je n'ai pas trouvé d'informations pertinentes pour cette requête."
          console.log('[Pulse AI Chat] Summary fallback generated:', finalResponse.slice(0, 100))
        } else {
          finalResponse = "Je n'ai pas trouvé d'informations pertinentes pour cette requête."
        }
      }
    }

    // ============================================
    // IMPROVED ENTITY EXTRACTION WITH FUZZY MATCHING
    // ============================================
    const autoExtractedLinks: EntityLink[] = []
    const mentionedIds = new Set<string>()

    // Helper: normalize text for matching (remove accents, lowercase)
    function normalizeText(text: string): string {
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
    }

    // Helper: check if name is mentioned in response (exact or normalized)
    function isNameMentioned(
      responseLower: string,
      responseNormalized: string,
      name: string
    ): boolean {
      if (!name || name.length < 3) return false
      const nameLower = name.toLowerCase()
      const nameNormalized = normalizeText(name)
      return responseLower.includes(nameLower) || responseNormalized.includes(nameNormalized)
    }

    const responseLower = finalResponse.toLowerCase()
    const responseNormalized = normalizeText(finalResponse)

    // Extract etablissements mentioned
    if (etabResult.data) {
      // Sort by name length (longest first) to avoid partial matches
      const sortedEtabs = [...etabResult.data].sort(
        (a, b) => (b.nom?.length || 0) - (a.nom?.length || 0)
      )
      for (const etab of sortedEtabs) {
        if (etab.nom && isNameMentioned(responseLower, responseNormalized, etab.nom)) {
          if (!mentionedIds.has(etab.id)) {
            autoExtractedLinks.push({ type: 'etablissement', id: etab.id, name: etab.nom })
            mentionedIds.add(etab.id)
          }
        }
      }
    }

    // Extract contacts mentioned (by full name)
    if (contactsResult.data) {
      const sortedContacts = [...contactsResult.data]
        .map((c) => ({ ...c, fullName: `${c.prenom || ''} ${c.nom}`.trim() }))
        .filter((c) => c.fullName.length > 2)
        .sort((a, b) => b.fullName.length - a.fullName.length)

      for (const contact of sortedContacts) {
        if (isNameMentioned(responseLower, responseNormalized, contact.fullName)) {
          if (!mentionedIds.has(contact.id)) {
            autoExtractedLinks.push({ type: 'contact', id: contact.id, name: contact.fullName })
            mentionedIds.add(contact.id)
          }
        }
      }
    }

    // Extract groupes mentioned
    if (groupesResult.data) {
      const sortedGroupes = [...groupesResult.data].sort(
        (a, b) => (b.nom?.length || 0) - (a.nom?.length || 0)
      )
      for (const groupe of sortedGroupes) {
        if (groupe.nom && isNameMentioned(responseLower, responseNormalized, groupe.nom)) {
          if (!mentionedIds.has(groupe.id)) {
            autoExtractedLinks.push({ type: 'groupe', id: groupe.id, name: groupe.nom })
            mentionedIds.add(groupe.id)
          }
        }
      }
    }

    // Extract partenaires mentioned
    if (partenairesResult.data) {
      const sortedPartenaires = [...partenairesResult.data].sort(
        (a, b) => (b.nom?.length || 0) - (a.nom?.length || 0)
      )
      for (const partenaire of sortedPartenaires) {
        if (partenaire.nom && isNameMentioned(responseLower, responseNormalized, partenaire.nom)) {
          if (!mentionedIds.has(partenaire.id)) {
            autoExtractedLinks.push({ type: 'partenaire', id: partenaire.id, name: partenaire.nom })
            mentionedIds.add(partenaire.id)
          }
        }
      }
    }

    // Extract tasks mentioned (by title, min 5 chars to avoid false positives)
    if (tasksResult.data) {
      const sortedTasks = [...tasksResult.data]
        .filter((t) => t.titre && t.titre.length >= 5)
        .sort((a, b) => (b.titre?.length || 0) - (a.titre?.length || 0))

      for (const task of sortedTasks) {
        if (isNameMentioned(responseLower, responseNormalized, task.titre)) {
          if (!mentionedIds.has(task.id)) {
            autoExtractedLinks.push({ type: 'tache', id: task.id, name: task.titre })
            mentionedIds.add(task.id)
          }
        }
      }
    }

    // Extract emails mentioned (by title, min 5 chars)
    if (emailsResult.data) {
      const sortedEmails = [...emailsResult.data]
        .map((e) => ({ ...e, title: e.ai_generated_title || e.subject }))
        .filter((e) => e.title && e.title.length >= 5)
        .sort((a, b) => (b.title?.length || 0) - (a.title?.length || 0))

      for (const email of sortedEmails) {
        if (isNameMentioned(responseLower, responseNormalized, email.title)) {
          if (!mentionedIds.has(email.id)) {
            autoExtractedLinks.push({ type: 'email', id: email.id, name: email.title })
            mentionedIds.add(email.id)
          }
        }
      }
    }

    // Merge with any manually collected links (from tool calls, if still collected)
    const allEntityLinks = [...collectedEntityLinks, ...autoExtractedLinks]

    // Check if client requested streaming
    const wantsStream = stream === true

    console.log(
      '[Pulse AI Chat] Response with',
      collectedActions.length,
      'actions and',
      allEntityLinks.length,
      'links (auto-extracted:',
      autoExtractedLinks.length,
      '), stream:',
      wantsStream
    )

    if (wantsStream) {
      // Stream the response via SSE
      const encoder = new TextEncoder()

      const streamBody = new ReadableStream({
        async start(controller) {
          try {
            // Stream content word by word for typing effect
            const words = finalResponse.split(' ')
            let currentContent = ''

            for (let i = 0; i < words.length; i++) {
              currentContent += (i === 0 ? '' : ' ') + words[i]
              const chunk = JSON.stringify({
                type: 'content',
                content: words[i] + (i < words.length - 1 ? ' ' : ''),
              })
              controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))

              // Small delay between words for natural typing effect
              await new Promise((r) => setTimeout(r, 15))
            }

            // Send actions and entity links
            if (collectedActions.length > 0) {
              const actionsChunk = JSON.stringify({ type: 'actions', actions: collectedActions })
              controller.enqueue(encoder.encode(`data: ${actionsChunk}\n\n`))
            }

            if (allEntityLinks.length > 0) {
              const linksChunk = JSON.stringify({
                type: 'entityLinks',
                entityLinks: allEntityLinks,
              })
              controller.enqueue(encoder.encode(`data: ${linksChunk}\n\n`))
            }

            // Send complete event
            const completeChunk = JSON.stringify({
              type: 'complete',
              message: finalResponse,
              actions: collectedActions.length > 0 ? collectedActions : undefined,
              entityLinks: allEntityLinks.length > 0 ? allEntityLinks : undefined,
            })
            controller.enqueue(encoder.encode(`data: ${completeChunk}\n\n`))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))

            controller.close()
          } catch (error) {
            console.error('[Pulse AI Chat] Stream error:', error)
            const errorChunk = JSON.stringify({ type: 'error', error: String(error) })
            controller.enqueue(encoder.encode(`data: ${errorChunk}\n\n`))
            controller.close()
          }
        },
      })

      return new Response(streamBody, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // Non-streaming response (original behavior)
    const responsePayload = {
      message: finalResponse,
      actions: collectedActions.length > 0 ? collectedActions : undefined,
      entityLinks: allEntityLinks.length > 0 ? allEntityLinks : undefined,
    }

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    return buildErrorResponse('pulse-ai-chat', error, corsHeaders, 500)
  }
})
