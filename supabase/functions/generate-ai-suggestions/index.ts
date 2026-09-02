import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { wrapUserContent } from "../_shared/security-utils.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://gestion-marque-ia.apercu.example.org",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-function-secret",
};

// Input validation schema
const GenerateSuggestionsRequestSchema = z.object({
  thread_id: z.string().uuid(),
  etablissement_id: z.string().uuid().nullable().optional(),
  partenaire_id: z.string().uuid().nullable().optional(),
}).refine(
  data => {
    const hasEtab = !!data.etablissement_id;
    const hasPart = !!data.partenaire_id;
    return (hasEtab && !hasPart) || (!hasEtab && hasPart) || (!hasEtab && !hasPart);
  },
  { message: "Provide either etablissement_id or partenaire_id, not both" }
);

// Simple rate limiting (in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 50;

// Phase 1: Déduplication et seuils de confiance
const MIN_CONFIDENCE = 0.85; // Augmenté de 0.75 à 0.85
const MAX_SUGGESTIONS_PER_EMAIL = 3;

/**
 * Extrait les mots-clés significatifs d'un titre (ignore les stop words)
 */
function extractKeywords(title: string): string[] {
  const stopWords = [
    'suivre', 'confirmer', 'relancer', 'vérifier', 'organiser', 'planifier',
    'le', 'la', 'les', 'de', 'du', 'des', 'pour', 'avec', 'sur', 'dans',
    'un', 'une', 'et', 'ou', 'mais', 'donc', 'car', 'si', 'que', 'qui'
  ];
  
  return title
    .toLowerCase()
    .replace(/[^\w\sàéèêëïîôùûç]/g, '') // Garder les accents
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.includes(w))
    .sort();
}

/**
 * Clés métier identifiant un doublon EXACT selon le type d'action
 * (utilisé quand il n'y a pas de titre comparable)
 */
function getBusinessKey(s: any): string | null {
  const d = s.action_data || {};
  switch (s.action_type) {
    case 'update_task':
      return d.task_id ? `update_task:${d.task_id}:${d.new_status || ''}:${d.new_progression ?? ''}` : null;
    case 'update_status':
      return `update_status:${d.new_status || ''}`;
    case 'update_phase':
      return `update_phase:${d.new_phase || ''}`;
    case 'update_progression':
      return `update_progression:${d.new_progression ?? ''}`;
    case 'create_contact':
      return d.email ? `create_contact:${(d.email || '').toLowerCase()}` : null;
    case 'link_to_etablissement':
      return d.etablissement_id ? `link:${d.etablissement_id}` : null;
    default:
      return null;
  }
}

/**
 * Vérifie si deux suggestions sont sémantiquement similaires
 */
function areSuggestionsSimilar(s1: any, s2: any): boolean {
  // Même type d'action obligatoire
  if (s1.action_type !== s2.action_type) return false;

  // 1) Match métier EXACT (task_id, statut, email, etc.) — couvre les actions sans titre
  const k1 = getBusinessKey(s1);
  const k2 = getBusinessKey(s2);
  if (k1 && k2 && k1 === k2) return true;

  // 2) Sinon, comparaison sémantique sur le titre
  const kw1 = extractKeywords(s1.action_data?.title || '');
  const kw2 = extractKeywords(s2.action_data?.title || '');

  if (kw1.length === 0 || kw2.length === 0) return false;

  const commonWords = kw1.filter(w => kw2.includes(w));
  const similarityRatio = commonWords.length / Math.max(kw1.length, kw2.length);

  return similarityRatio >= 0.6;
}

/**
 * Génère une clé de similarité pour détecter les suggestions redondantes
 */
function generateSimilarityKey(suggestion: any): string {
  // Si une clé métier exacte existe (ex: update_task:<task_id>:<status>), l'utiliser
  const businessKey = getBusinessKey(suggestion);
  if (businessKey) return businessKey;

  const actionType = suggestion.action_type || '';
  const category = suggestion.action_data?.category || '';
  const keywords = extractKeywords(suggestion.action_data?.title || '').slice(0, 3).join('_');
  return `${actionType}_${category}_${keywords}`;
}

/**
 * Déduplique les suggestions en gardant celle avec le meilleur score de confiance
 * dans chaque groupe de suggestions similaires
 */
function deduplicateSuggestions(suggestions: any[]): any[] {
  const groups = new Map<string, any[]>();
  
  // Grouper par similarité sémantique
  for (const sugg of suggestions) {
    const key = generateSimilarityKey(sugg);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(sugg);
  }
  
  // Pour chaque groupe, garder uniquement la suggestion avec le meilleur score
  const deduplicated = Array.from(groups.values()).map(group => {
    return group.reduce((best, curr) => 
      (curr.confidence_score || 0) > (best.confidence_score || 0) ? curr : best
    );
  });
  
  console.log(`🔄 Déduplication: ${suggestions.length} suggestions → ${deduplicated.length} suggestions uniques`);
  if (suggestions.length !== deduplicated.length) {
    console.log(`  ✂️ Supprimé ${suggestions.length - deduplicated.length} doublons (${Math.round((1 - deduplicated.length / suggestions.length) * 100)}% de réduction)`);
  }
  
  return deduplicated;
}

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // SECURITY: Validate service role key (Authorization header ou apikey)
    const authHeader = req.headers.get("Authorization");
    const apiKey = req.headers.get("apikey");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if ((!authHeader || !authHeader.includes(serviceRoleKey)) && apiKey !== serviceRoleKey) {
      console.error("Unauthorized: Invalid service role key");
      return new Response(
        JSON.stringify({ error: "Unauthorized: Service role key required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("🔑 Service role authentication validated");

    // SECURITY: Rate limiting
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(clientIp)) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    const body = await req.json();

    // SECURITY: Validate input with Zod
    const validationResult = GenerateSuggestionsRequestSchema.safeParse(body);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ 
          error: "Invalid input", 
          details: validationResult.error.errors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { thread_id, etablissement_id, partenaire_id } = validationResult.data;

    // Fetch thread with AI data
    const { data: thread } = await supabase
      .from("email_threads")
      .select("*, messages:email_messages(*)")
      .eq("id", thread_id)
      .single();

    if (!thread || !thread.ai_extracted_data) {
      return new Response(JSON.stringify({ error: "Thread or AI data not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 🛡️ GARDE ANTI-RETRAITEMENT: vérifier si des suggestions ont déjà été générées
    // pour ce thread depuis le dernier message
    const { data: recentSuggestionLog } = await supabase
      .from("ai_processing_log")
      .select("id, processed_at")
      .eq("email_thread_id", thread_id)
      .eq("processing_type", "suggestion_generation")
      .eq("success", true)
      .order("processed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (recentSuggestionLog) {
      const lastSuggestionAt = new Date(recentSuggestionLog.processed_at);
      const lastMessageDate = new Date(thread.last_message_date);
      if (lastMessageDate <= lastSuggestionAt) {
        console.log(`⏭️ Skipping suggestion generation for thread ${thread_id}: already generated after last message (suggestion: ${recentSuggestionLog.processed_at}, message: ${thread.last_message_date})`);
        return new Response(JSON.stringify({ 
          success: true, 
          skipped: true,
          suggestions_count: 0,
          reason: 'Suggestions already generated for current thread state'
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.log(`🔄 Re-generating suggestions for thread ${thread_id}: new messages since last generation`);
    }

    // PHASE 1 : Vérifier l'ancienneté du mail (max 7 jours)
    const lastMessageDate = new Date(thread.last_message_date);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    if (lastMessageDate < sevenDaysAgo) {
      console.log(`⏭️ Skipping old email (${thread.last_message_date}) - older than 7 days`);
      return new Response(JSON.stringify({ 
        success: true, 
        suggestions_count: 0,
        reason: 'Email too old (>7 days)'
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch entity data based on type
    let entity = null;
    let entityType: 'etablissement' | 'partenaire' | null = null;
    let activeTasks: any[] = [];

    if (etablissement_id) {
      const { data } = await supabase
        .from("etablissements")
        .select(`
          *, 
          taches:taches!etablissement_id(
            id,
            titre,
            description,
            statut,
            priorite,
            echeance,
            responsable_id,
            categorie:categories_taches(id, nom, couleur)
          )
        `)
        .eq("id", etablissement_id)
        .single();
      
      entity = data;
      entityType = 'etablissement';
      activeTasks = data?.taches?.filter((t: any) => t.statut !== 'Terminé' && !t.archive) || [];
    } else if (partenaire_id) {
      const { data } = await supabase
        .from("partenaires")
        .select("*")
        .eq("id", partenaire_id)
        .single();
      
      entity = data;
      entityType = 'partenaire';
    }

    // Prepare context for AI
    const aiData = thread.ai_extracted_data;
    
    // Wrap AI data for security (prevent injection from extracted email data)
    const wrappedAiData = wrapUserContent(JSON.stringify(aiData, null, 2), 'EMAIL_AI_DATA');
    
    const systemPrompt = entityType === 'partenaire'
      ? `Tu es un assistant IA expert pour la gestion de relations partenaires dans le secteur santé.
Ton rôle est d'analyser les emails et de suggérer des actions UNIQUEMENT avec haute confiance (>0.85).

⚠️ TYPES D'ACTIONS AUTORISÉS (UNIQUEMENT CEUX-CI):
1. update_task: Mettre à jour une tâche existante
2. create_task: Créer une nouvelle tâche
3. change_status: Changer le statut de l'entité
4. update_summary: Mettre à jour le résumé

Réponds UNIQUEMENT avec un JSON valide contenant "suggestions" avec:
- action_type (UNIQUEMENT l'un des 4 types ci-dessus)
- action_data
- confidence_score
- reason

Si aucune action évidente des 4 types ci-dessus, retourne un tableau "suggestions" vide [].
Ne propose JAMAIS d'autres types d'actions.

⚠️ PHASE 2 : RÈGLES ANTI-DUPLICATION STRICTES

1. CONSOLIDATION OBLIGATOIRE :
   - Si plusieurs besoins similaires sont détectés, REGROUPE-LES en UNE SEULE tâche
   - Exemple : "Diagnostiquer bastion" + "Vérifier config bastion" + "Coordonner tests"
     → UNE tâche : "Diagnostiquer et résoudre incident bastion (config + tests + coordination)"

2. VÉRIFICATION ANTI-DOUBLON :
   - Avant de suggérer create_task, VÉRIFIE la liste des tâches actives
   - Si une tâche similaire existe (même sujet, même but) : suggère update_task au lieu de create_task
   - Similarité = même domaine (ex: bastion, contrat, formation) + même action (diagnostiquer, envoyer, planifier)

3. DÉTECTION DE DIRECTION :
   - Si l'email contient une DEMANDE de notre part ("Pouvez-vous...") :
     * NE PAS créer de tâche pour l'action demandée
     * CHERCHER une tâche "Demander [X]" existante et suggérer update_task (statut: Terminé)
     * OPTIONNEL : Créer une tâche de suivi "Suivre : [X]" avec délai 3-5 jours
   
   - Si l'email contient une RÉPONSE confirmant une action de leur part ("Je vais...", "Nous envoyons...") :
     * Créer une tâche de SUIVI : "Suivre : [Action attendue]"
     * Fixer un délai raisonnable (3-7 jours selon urgence)

4. SÉLECTIVITÉ MAXIMALE :
   - Objectif : Maximum 2-3 suggestions par email
   - Ne suggère QUE les actions les plus évidentes et à forte valeur ajoutée
   - Si < 85% de confiance, NE PAS suggérer

5. VARIANTES INTERDITES :
   ❌ Ne JAMAIS créer plusieurs suggestions qui sont des reformulations du même besoin
   ✅ Correct : UNE suggestion consolidée

EXEMPLE :
📧 Email : "Pouvez-vous nous envoyer le contrat signé avant vendredi ?"
Tâches actives : ["Demander contrat signé (statut: En cours)"]

✅ BON :
suggestions: [
  { 
    action_type: "update_task", 
    action_data: { task_id: "[id-tache]", new_status: "Terminé" },
    reason: "Email confirme que la demande a été faite"
  },
  { 
    action_type: "create_task", 
    action_data: { 
      title: "Suivre : Réception contrat signé", 
      deadline_days: 3,
      priority: "high"
    },
    reason: "Besoin de s'assurer de la réception avant vendredi"
  }
]`
      : `Tu es un assistant IA expert pour un CRM de gestion d'établissements de santé.
Ton rôle est d'analyser les emails et de suggérer des actions concrètes UNIQUEMENT avec une haute confiance (>0.85).

⚠️ TYPES D'ACTIONS AUTORISÉS (UNIQUEMENT CEUX-CI):
1. update_task: Marquer une tâche existante comme terminée si l'email le confirme explicitement
   Format: { "task_id": "uuid-de-la-tache", "new_status": "Terminé" }
   ⚠️ IMPORTANT: Utilise l'ID exact de la tâche fournie dans la liste des tâches actives
   ⚠️ Ne suggère cette action QUE si l'email mentionne explicitement qu'une tâche est terminée

2. create_task: Créer une nouvelle tâche si un besoin clair est identifié QUI N'EST PAS DÉJÀ dans les tâches actives
   Format: { 
     "title": "titre", 
     "description": "description détaillée",
     "category": "nom exact de catégorie (Commercial, Formation, Configuration, etc.)",
     "priority": "low|medium|high",
     "deadline_days": nombre_de_jours
   }
   ⚠️ IMPORTANT: Ne crée pas de doublon ! Vérifie d'abord que cette tâche n'existe pas déjà dans les tâches actives

3. change_status: Changer le statut de l'établissement si un événement majeur est mentionné (signature, déploiement, etc.)
4. update_summary: Mettre à jour le résumé des derniers échanges avec des insights clés

Réponds UNIQUEMENT avec un JSON valide contenant un tableau "suggestions" avec des objets ayant:
- action_type: string (UNIQUEMENT: update_task, create_task, change_status, ou update_summary)
- action_data: object (contenu variable selon le type)
- confidence_score: number (0-1)
- reason: string (explication courte)

⚠️ PHASE 2 : RÈGLES ANTI-DUPLICATION STRICTES

1. CONSOLIDATION OBLIGATOIRE :
   - Si plusieurs besoins similaires sont détectés, REGROUPE-LES en UNE SEULE tâche
   - Exemple : "Diagnostiquer bastion" + "Vérifier config bastion" + "Coordonner tests"
     → UNE tâche : "Diagnostiquer et résoudre incident bastion (config + tests + coordination)"

2. VÉRIFICATION ANTI-DOUBLON :
   - Avant de suggérer create_task, VÉRIFIE la liste des tâches actives
   - Si une tâche similaire existe (même sujet, même but) : suggère update_task au lieu de create_task
   - Similarité = même domaine (ex: bastion, contrat, formation) + même action (diagnostiquer, envoyer, planifier)

3. DÉTECTION DE DIRECTION :
   - Si l'email contient une DEMANDE de notre part ("Pouvez-vous...") :
     * NE PAS créer de tâche pour l'action demandée
     * CHERCHER une tâche "Demander [X]" existante et suggérer update_task (statut: Terminé)
     * OPTIONNEL : Créer une tâche de suivi "Suivre : [X]" avec délai 3-5 jours
   
   - Si l'email contient une RÉPONSE confirmant une action de leur part ("Je vais...", "Nous envoyons...") :
     * Créer une tâche de SUIVI : "Suivre : [Action attendue]"
     * Fixer un délai raisonnable (3-7 jours selon urgence)

4. SÉLECTIVITÉ MAXIMALE :
   - Objectif : Maximum 2-3 suggestions par email
   - Ne suggère QUE les actions les plus évidentes et à forte valeur ajoutée
   - Si < 85% de confiance, NE PAS suggérer

5. VARIANTES INTERDITES :
   ❌ Ne JAMAIS créer plusieurs suggestions qui sont des reformulations du même besoin
   ✅ Correct : UNE suggestion consolidée

EXEMPLE :
📧 Email : "Pouvez-vous nous envoyer le contrat signé avant vendredi ?"
Tâches actives : ["Demander contrat signé (statut: En cours)"]

✅ BON :
suggestions: [
  { 
    action_type: "update_task", 
    action_data: { task_id: "[id-tache]", new_status: "Terminé" },
    reason: "Email confirme que la demande a été faite"
  },
  { 
    action_type: "create_task", 
    action_data: { 
      title: "Suivre : Réception contrat signé", 
      deadline_days: 3,
      priority: "high"
    },
    reason: "Besoin de s'assurer de la réception avant vendredi"
  }
]

⚠️ RÈGLES STRICTES :
- UTILISE UNIQUEMENT les 4 types d'actions autorisés ci-dessus
- Pour update_task : utilise UNIQUEMENT les IDs fournis dans la liste des tâches actives
- Pour create_task : vérifie que la tâche n'existe pas déjà dans les tâches actives
- Confidence score > 0.85 uniquement pour des actions évidentes
- Si aucune action évidente des 4 types, retourne un tableau vide []
- NE propose JAMAIS d'autres types d'actions (no_action, send_email_response, etc.)

Sois TRÈS sélectif. Ne suggère que des actions évidentes avec forte confiance.`;

    // Déterminer la direction du dernier message
    const lastMessage = thread.messages?.sort(
      (a: any, b: any) => new Date(b.sent_date).getTime() - new Date(a.sent_date).getTime()
    )[0];

    const isOutgoingEmail = lastMessage?.from_address?.includes('exploitant.example.org');
    const emailDirection = isOutgoingEmail ? 'NOUS → EUX' : 'EUX → NOUS';

    // Analyser les actions "outgoing" détectées
    const outgoingActions = aiData?.outgoing_actions || [];

    let outgoingActionsContext = '';
    if (outgoingActions.length > 0) {
      outgoingActionsContext = `

⚠️ ACTIONS "OUTGOING" DÉTECTÉES (Phase 2) :
Le dernier email contient ${outgoingActions.length} demande(s) de notre part :
${outgoingActions.map((action: any, idx: number) => 
  `${idx + 1}. "${action.title}" (${action.category || 'Non catégorisé'})`
).join('\n')}

TRAITEMENT ATTENDU :
- Pour chaque action ci-dessus, NE PAS créer de tâche d'exécution
- CHERCHER dans les tâches actives si une tâche "Demander [X]" existe
- Si oui : suggérer update_task pour la marquer Terminé
- Si besoin : suggérer create_task pour une tâche de SUIVI "Suivre : [X]"
`;
    }

    const userPrompt = entityType === 'partenaire' && entity
      ? `
📧 CONTEXTE DE L'EMAIL :
Thread ID: ${thread_id}
Nombre de messages: ${thread.messages?.length || 0}
Dernier message de: ${lastMessage?.from_address || 'Inconnu'}
Direction: ${emailDirection}
${outgoingActionsContext}

Partenaire: ${entity.nom}
Type: ${entity.type_partenaire}
Statut relation: ${entity.statut_relation}
Score engagement: ${entity.engagement_score || 'Non défini'}

Résumé IA de l'email:
${aiData.summary || 'Pas de résumé'}

Données extraites:
${JSON.stringify(aiData, null, 2)}

Analyse cet email et suggère des actions CRM pertinentes.`
      : entityType === 'etablissement' && entity
      ? `
📧 CONTEXTE DE L'EMAIL :
Thread ID: ${thread_id}
Nombre de messages: ${thread.messages?.length || 0}
Dernier message de: ${lastMessage?.from_address || 'Inconnu'}
Direction: ${emailDirection}
${outgoingActionsContext}

Établissement: ${entity.nom} (${entity.ville})
Statut actuel: ${entity.statut}

Résumé IA de l'email:
${aiData.summary || 'Pas de résumé'}

Données extraites de l'email:
${JSON.stringify(aiData, null, 2)}

${activeTasks.length > 0 ? `
Tâches ACTIVES de cet établissement (${activeTasks.length}) :
${activeTasks.map((t: any) => {
  return `
ID: ${t.id}
Titre: ${t.titre}
Catégorie: ${t.categorie?.nom || 'Non définie'}
Statut: ${t.statut}
Priorité: ${t.priorite || 'Non définie'}
Échéance: ${t.echeance || 'Non définie'}
Description: ${t.description || 'Aucune description'}
---`;
}).join('\n')}
` : 'Aucune tâche active pour cet établissement.'}

EXEMPLES DE SUGGESTIONS VALIDES :

Exemple 1 - Mise à jour de tâche existante :
Si l'email dit "La formation est terminée", et qu'il existe une tâche ID: abc-123 avec titre "Formation des utilisateurs" :
{
  "action_type": "update_task",
  "action_data": {
    "task_id": "abc-123",
    "new_status": "Terminé"
  },
  "confidence_score": 0.9,
  "reason": "Email confirme explicitement que la formation est terminée"
}

Exemple 2 - Création de nouvelle tâche :
Si l'email dit "Il faudra planifier une réunion de suivi dans 2 semaines" et qu'aucune tâche similaire n'existe :
{
  "action_type": "create_task",
  "action_data": {
    "title": "Réunion de suivi post-déploiement",
    "description": "Planifier une réunion pour faire le point sur le déploiement",
    "category": "Suivi",
    "priority": "medium",
    "deadline_days": 14
  },
  "confidence_score": 0.85,
  "reason": "Email demande explicitement une réunion de suivi"
}

Analyse cet email et suggère UNIQUEMENT des actions évidentes avec haute confiance (>0.75).
RAPPEL: UNIQUEMENT les types update_task, create_task, change_status, update_summary.`
      : `Email non encore lié à une entité.

Résumé IA de l'email:
${aiData.summary || 'Pas de résumé'}

Données extraites:
${JSON.stringify(aiData, null, 2)}

Comme cet email n'est pas lié à une entité, tu ne peux suggérer que update_summary pour résumer les insights.
Retourne un tableau vide [] si aucune action évidente.
⚠️ NE SUGGÈRE PAS create_etablissement, link_etablissement ou no_action (types non autorisés).`;

    // Add 90s timeout for Azure GPT-5 call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    let azureResponse: Response;
    try {
      azureResponse = await fetch(
        Deno.env.get("AZURE_OPENAI_ENDPOINT")!,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": Deno.env.get("AZURE_OPENAI_API_KEY")!,
          },
          body: JSON.stringify({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            max_completion_tokens: 2000,
            response_format: { type: "json_object" },
            reasoning_effort: "low",
            verbosity: "low"
          }),
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error("Azure request timeout (90s)");
        throw new Error("Azure request timeout (90s)");
      }
      throw error;
    }

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error("Azure OpenAI error:", errorText);
      throw new Error(`Azure OpenAI API error: ${azureResponse.status}`);
    }

    const azureData = await azureResponse.json();
    const aiResult = JSON.parse(azureData.choices[0].message.content);
    const suggestions = aiResult.suggestions || [];

    // LOG DEBUG : vérifier les suggestions générées
    console.log(`📊 AI generated ${suggestions.length} suggestions for ${entityType} ${entity?.nom}`);
    suggestions.forEach((s: any, idx: number) => {
      console.log(`  ${idx + 1}. ${s.action_type} (confidence: ${s.confidence_score})`);
      if (s.action_type === 'update_task') {
        console.log(`     → task_id: ${s.action_data?.task_id}`);
      }
    });

    // SECURITY: Allowed action types (DB constraint)
    const ALLOWED_ACTIONS = ['update_task', 'create_task', 'change_status', 'update_summary'];
    
    // Function to validate action_data structure
    function validateActionData(action_type: string, action_data: any): { valid: boolean; reason?: string } {
      switch (action_type) {
        case 'update_task':
          if (!action_data?.task_id) {
            return { valid: false, reason: 'task_id manquant' };
          }
          if (!action_data?.new_status) {
            return { valid: false, reason: 'new_status manquant' };
          }
          return { valid: true };
          
        case 'create_task':
          if (!action_data?.title) {
            return { valid: false, reason: 'title manquant' };
          }
          
          // Phase 2 : Vérifier que ce n'est pas une action "outgoing" mal placée
          const title = action_data.title.toLowerCase();
          const outgoingKeywords = ['envoyer', 'transmettre', 'fournir', 'livrer', 'donner'];
          const isLikelyOutgoing = outgoingKeywords.some((kw: string) => title.includes(kw));
          
          if (isLikelyOutgoing && !title.includes('suivre')) {
            console.warn(`⚠️ Phase 2: Possible outgoing action in create_task: "${action_data.title}"`);
            console.warn(`  → Should this be a follow-up task instead?`);
            // Ne pas rejeter, mais log pour monitoring
          }
          
          return { valid: true };
          
        case 'change_status':
          if (!action_data?.new_status) {
            return { valid: false, reason: 'new_status manquant' };
          }
          return { valid: true };
          
        case 'update_summary':
          if (!action_data?.summary_text) {
            return { valid: false, reason: 'summary_text manquant' };
          }
          return { valid: true };
          
        default:
          return { valid: false, reason: 'action_type inconnu' };
      }
    }
    
    // Phase 1: Déduplication AVANT filtrage
    console.log(`📊 Suggestions brutes reçues de l'IA: ${suggestions.length}`);
    const deduplicatedSuggestions = deduplicateSuggestions(suggestions);
    
    // Filter high confidence suggestions, validate action types AND action_data
    const validSuggestions = [];
    const invalidSuggestions = [];

    for (const s of deduplicatedSuggestions) {
      // Check confidence (Phase 1: seuil augmenté à 0.85)
      if (s.confidence_score < MIN_CONFIDENCE) {
        invalidSuggestions.push({ ...s, reject_reason: `confidence_score trop faible (< ${MIN_CONFIDENCE})` });
        continue;
      }
      
      // Check allowed action type
      if (!ALLOWED_ACTIONS.includes(s.action_type)) {
        invalidSuggestions.push({ ...s, reject_reason: 'action_type non autorisé' });
        continue;
      }
      
      // Validate action_data structure
      const validation = validateActionData(s.action_type, s.action_data);
      if (!validation.valid) {
        invalidSuggestions.push({ ...s, reject_reason: `action_data invalide: ${validation.reason}` });
        continue;
      }
      
      validSuggestions.push(s);
    }
    
    // Phase 1: Limiter à MAX_SUGGESTIONS_PER_EMAIL (3 suggestions max)
    const finalSuggestions = validSuggestions
      .sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0)) // Trier par confiance décroissante
      .slice(0, MAX_SUGGESTIONS_PER_EMAIL);
    
    if (validSuggestions.length > MAX_SUGGESTIONS_PER_EMAIL) {
      const rejected = validSuggestions.slice(MAX_SUGGESTIONS_PER_EMAIL);
      rejected.forEach((s: any) => {
        invalidSuggestions.push({ 
          ...s, 
          reject_reason: `Limite de ${MAX_SUGGESTIONS_PER_EMAIL} suggestions atteinte (score: ${s.confidence_score})` 
        });
      });
      console.log(`⚠️ Limité à ${MAX_SUGGESTIONS_PER_EMAIL} suggestions (${rejected.length} suggestions valides supplémentaires écartées)`);
    }

    // Log rejected suggestions for debugging
    if (invalidSuggestions.length > 0) {
      console.warn(`⚠️ Rejected ${invalidSuggestions.length} invalid suggestions:`);
      invalidSuggestions.forEach((s: any) => {
        console.warn(`  - ${s.action_type}: ${s.reject_reason}`);
        if (s.action_type === 'update_task') {
          console.warn(`    action_data: ${JSON.stringify(s.action_data)}`);
        }
      });
    }
    
    console.log(`✅ ${finalSuggestions.length} suggestions finales retenues (après déduplication, filtrage confiance >= ${MIN_CONFIDENCE}, et limite de ${MAX_SUGGESTIONS_PER_EMAIL})`);
    
    const insertedSuggestions = [];
    for (const suggestion of finalSuggestions) {
      try {
        // PHASE 2 : Vérification anti-doublon au niveau ÉTABLISSEMENT (pas juste thread)
        let deduplicationQuery = supabase
          .from("ai_suggested_actions")
          .select("id, action_type, action_data, confidence_score")
          .eq("action_type", suggestion.action_type)
          .eq("status", "pending");
        
        // Élargir la vérification au niveau établissement ou partenaire
        if (etablissement_id) {
          deduplicationQuery = deduplicationQuery.eq("etablissement_id", etablissement_id);
        } else if (partenaire_id) {
          deduplicationQuery = deduplicationQuery.eq("partenaire_id", partenaire_id);
        } else {
          // Fallback : vérifier au moins au niveau thread
          deduplicationQuery = deduplicationQuery.eq("email_thread_id", thread_id);
        }
        
        const { data: existingSuggestions } = await deduplicationQuery;
        
        // Utiliser la fonction de similarité sémantique améliorée
        const isDuplicate = existingSuggestions?.some((existing: any) => 
          areSuggestionsSimilar(suggestion, existing)
        );
        
        if (isDuplicate) {
          console.log(`⏭️ Skipping duplicate suggestion (établissement-wide): ${suggestion.action_type} - ${suggestion.action_data?.title || 'N/A'}`);
          continue;
        }
        
        const { data: inserted, error: insertError } = await supabase
          .from("ai_suggested_actions")
          .insert({
            email_thread_id: thread_id,
            etablissement_id: etablissement_id || null,
            partenaire_id: partenaire_id || null,
            action_type: suggestion.action_type,
            action_data: suggestion.action_data,
            confidence_score: suggestion.confidence_score,
            reason: suggestion.reason,
            status: 'pending'
          })
          .select()
          .single();
        
        if (insertError) {
          console.error(`Failed to insert suggestion ${suggestion.action_type}:`, insertError);
        } else if (inserted) {
          insertedSuggestions.push(inserted);
        }
      } catch (error) {
        console.error(`Error inserting suggestion:`, error);
      }
    }

    // Log the AI processing
    await supabase.from("ai_processing_log").insert({
      email_thread_id: thread_id,
      processing_type: "suggestion_generation",
      model_used: "gpt-5.4",
      prompt_tokens: azureData.usage?.prompt_tokens,
      completion_tokens: azureData.usage?.completion_tokens,
      total_tokens: azureData.usage?.total_tokens,
      result: { 
        suggestions_raw: suggestions.length,
        suggestions_after_dedup: deduplicatedSuggestions.length,
        suggestions_final: finalSuggestions.length,
        suggestions: finalSuggestions 
      },
      success: true,
    });

    // Create in-app notifications for relevant users
    if (insertedSuggestions.length > 0 && entity) {
      const usersToNotify = new Set<string>();
      let entityName = '';
      
      if (entityType === 'etablissement') {
        entityName = entity.nom;
        
        // Get user_ids for notifications based on establishment roles
        if (entity.commercial_id) {
          const { data: commercial } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('id', entity.commercial_id)
            .single();
          if (commercial?.user_id) usersToNotify.add(commercial.user_id);
        }
        
        if (entity.chef_projet_id) {
          const { data: chef_projet } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('id', entity.chef_projet_id)
            .single();
          if (chef_projet?.user_id) usersToNotify.add(chef_projet.user_id);
        }
        
        if (entity.csm_id) {
          const { data: csm } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('id', entity.csm_id)
            .single();
          if (csm?.user_id) usersToNotify.add(csm.user_id);
        }
      } else if (entityType === 'partenaire') {
        entityName = entity.nom;
        
        if (entity.responsable_marque_id) {
          const { data: responsable } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('id', entity.responsable_marque_id)
            .single();
          if (responsable?.user_id) usersToNotify.add(responsable.user_id);
        }
      }

      // Send notifications to each user
      for (const userId of usersToNotify) {
        await supabase.functions.invoke('create-in-app-notification', {
          body: {
            user_id: userId,
            title: `${insertedSuggestions.length} suggestion${insertedSuggestions.length > 1 ? 's' : ''} IA`,
            message: `L'IA a généré ${insertedSuggestions.length} suggestion${insertedSuggestions.length > 1 ? 's' : ''} pour ${entityName}`,
            type: 'ai_suggestion',
            related_id: etablissement_id || partenaire_id,
            related_type: entityType,
          },
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      suggestions_count: insertedSuggestions.length,
      suggestions: insertedSuggestions
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in generate-ai-suggestions:", error);
    return buildErrorResponse('generate-ai-suggestions', error, corsHeaders, 500);
  }
});