/**
 * JARVIS 12.0 Brain - Intelligence Artificielle Omnipotente
 * 
 * Cerveau principal avec GPT-5 Tool Calling pour exécuter N'IMPORTE QUELLE action.
 * - 60+ outils couvrant tous les modules métier
 * - Validation des permissions par rôle (RBAC)
 * - Raisonnement multi-étapes automatique
 * - Mode streaming pour réponses temps réel
 * - Mode autonome pour actions à haute confiance
 * - Support natif GPT-5.4 (primary) + GPT-5.2 Responses API (fallback) + GPT-5.2 Chat Completions
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { executeTool, requiresConfirmation, ToolExecutionContext, ToolResult, autoReportFailure } from "./tools-executor.ts";
import JARVIS_TOOLS_V3 from "./tool-registry.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { 
  isResponsesAPIEndpoint, 
  callGpt52ResponsesAPIWithMessages,
  convertMessagesToInput,
  parseToolCallsFromOutput,
  extractTextFromOutput,
  buildToolResultInput,
  type ResponsesAPIInputItem,
  type ParsedToolCall
} from "../_shared/azure-responses-api.ts";
import { getJarvisSystemPrompt } from "../_shared/jarvis-system-prompt.ts";

// JARVIS 10.5 - Multi-Intent Planning
import { 
  createExecutionPlan, 
  enrichPromptWithPlan, 
  getPlanSummary,
  type ExecutionPlan 
} from "./multi-intent-planner.ts";

// JARVIS 11.0 - Optimized Context Builder
import {
  buildOptimizedContext,
  getSystemHealthStatus,
  getContextBudget,
  type SystemHealthStatus,
  type ContextBudget
} from "./optimized-context-builder.ts";

// JARVIS 16.0 - Dynamic Page Context
import { enrichWithPageContext } from "./dynamic-page-context.ts";

// JARVIS 16.0 - Smart Retry & Resilience
import { executeWithSmartRetry } from "./smart-retry.ts";

// JARVIS 16.0 - Tool Analytics & Observability
import { recordToolAnalytics, flushAnalyticsToDB, getAnalyticsSnapshot, getAnalyticsSummaryText } from "./tool-analytics.ts";

// JARVIS 16.0 - Workflow Orchestrator
import { executeWorkflowOrchestrated, WORKFLOW_TEMPLATES, type WorkflowDefinition } from "./workflow-orchestrator.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

// Configuration Azure GPT-5.4 (primary) + GPT-5.2 (fallback)
const AZURE_GPT52_ENDPOINT = Deno.env.get('AZURE_GPT52_ENDPOINT');
const AZURE_GPT52_API_KEY = Deno.env.get('AZURE_GPT52_API_KEY');
const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');  // GPT-5.4
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');

// Use the expanded JARVIS 12.0 tools
const JARVIS_TOOLS = JARVIS_TOOLS_V3;

// ============================================================
// System Prompt (JARVIS 12.0 - Omnipotent)
// ============================================================
// Use shared system prompt
const JARVIS_SYSTEM_PROMPT = getJarvisSystemPrompt();

// ============================================================
// Rich User Context Builder - IMPORTED from optimized-context-builder.ts
// V11.0: 40-60% reduced budget, merged queries, in-memory cache
// ============================================================

// ============================================================
// Request Handler
// ============================================================
interface ChatRequest {
  user_id: string;
  message: string;
  conversation_id?: string;
  conversation_history?: Array<{ role: string; content: string }>;
  autonomous_mode?: boolean;
  stream?: boolean;
  page_context?: string; // JARVIS 16.0: Dynamic page context from frontend
  reasoning_hint?: 'minimal' | 'low' | 'medium' | 'high'; // V17: latency optimization
  max_iterations_hint?: number; // V17: cap iterations for informational queries
  /**
   * Appel d'outil venu du serveur MCP. Le champ existait cote emetteur depuis
   * l'origine ; il n'etait declare ni lu nulle part, si bien que l'appel
   * repartait en conversation avec le modele.
   */
  mcp_tool_call?: { name: string; arguments?: Record<string, unknown> };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const request: ChatRequest = await req.json();

    if (!request.message) {
      throw new Error('Missing required field: message');
    }

    // Override user_id from JWT for non-service callers (prevent IDOR)
    if (!auth.isServiceCall && auth.userId) {
      request.user_id = auth.userId;
    }
    if (!request.user_id) {
      throw new Error('Missing required field: user_id');
    }

    console.log(`[JARVIS Brain] Processing request for user: ${request.user_id}`);
    console.log(`[JARVIS Brain] Message: ${request.message.substring(0, 100)}...`);

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');

    // Admin client (service_role) - ONLY for system operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // User client - respects RLS. Requires valid auth header (no admin fallback).
    let userClient: ReturnType<typeof createClient>;
    if (auth.isServiceCall) {
      userClient = adminClient;
    } else if (authHeader?.startsWith('Bearer ')) {
      userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use adminClient for profile lookup (needs to work even without valid user session)
    const supabase = adminClient;

    // ================================================================
    // PHASE 3: Résolution unifiée des identifiants utilisateur
    // ================================================================
    interface ResolvedUser {
      profileId: string;      // profiles.id - pour FK métier (taches, etablissements, etc.)
      authUserId: string;     // auth.users.id - pour RLS et FK vers auth.users
      email: string;
      fullName: string;
    }

    async function resolveUserIdentity(
      client: typeof supabase,
      requestUserId: string
    ): Promise<ResolvedUser | null> {
      // Essayer d'abord comme auth user_id
      const { data: profileByUserId, error } = await client
        .from('profiles')
        .select('id, user_id, email, prenom, nom, fonction, telephone')
        .eq('user_id', requestUserId)
        .maybeSingle();
      
      if (profileByUserId) {
        return {
          profileId: profileByUserId.id,
          authUserId: profileByUserId.user_id || requestUserId,
          email: profileByUserId.email || '',
          fullName: `${profileByUserId.prenom || ''} ${profileByUserId.nom || ''}`.trim()
        };
      }
      
      // Fallback: essayer comme profile id
      const { data: profileById } = await client
        .from('profiles')
        .select('id, user_id, email, prenom, nom, fonction, telephone')
        .eq('id', requestUserId)
        .maybeSingle();
      
      if (profileById) {
        return {
          profileId: profileById.id,
          authUserId: profileById.user_id || requestUserId,
          email: profileById.email || '',
          fullName: `${profileById.prenom || ''} ${profileById.nom || ''}`.trim()
        };
      }
      
      return null;
    }

    // Résoudre l'identité utilisateur
    const resolvedUser = await resolveUserIdentity(supabase, request.user_id);
    
    if (!resolvedUser) {
      console.error(`[JARVIS Brain] ❌ Profile not found for user_id: ${request.user_id}`);
      throw new Error(`Utilisateur non trouvé: ${request.user_id}`);
    }
    
    console.log(`[JARVIS Brain] ✅ Resolved user: profileId=${resolvedUser.profileId}, authUserId=${resolvedUser.authUserId}, name=${resolvedUser.fullName}`);

    // Pour compatibilité avec le code existant
    const userProfile = {
      id: resolvedUser.profileId,
      user_id: resolvedUser.authUserId,
      email: resolvedUser.email,
      prenom: resolvedUser.fullName.split(' ')[0] || '',
      nom: resolvedUser.fullName.split(' ').slice(1).join(' ') || '',
      fonction: '', // Not needed for context
      telephone: '' // Not needed for context
    };
    const profileId = resolvedUser.profileId;

    // JARVIS 11.0: Optimized context building with in-memory cache
    const healthStatus = await getSystemHealthStatus(supabase);
    console.log(`[JARVIS Brain] 📊 System health: ${healthStatus}`);
    
    // Fetch user's persistent memories, rich context, AND page context IN PARALLEL
    const [userMemoriesResult, richContext, pageContextEnriched] = await Promise.all([
      supabase
        .from('jarvis_user_memory')
        .select('category, key, value')
        .eq('user_id', request.user_id)
        .order('importance', { ascending: false })
        .limit(20),
      buildOptimizedContext(supabase, profileId, healthStatus),
      // JARVIS 16.0: Dynamic page context enrichment
      enrichWithPageContext(supabase, request.page_context || null, profileId)
    ]);

    const userMemories = userMemoriesResult.data;

    console.log(`[JARVIS Brain] 🧠 Rich context loaded: ${richContext.length} chars, page context: ${pageContextEnriched.length} chars`);

    // Format memory context
    const memoryContext = userMemories?.length 
      ? `\n\nMÉMOIRE PERSISTANTE (ce que tu sais sur l'utilisateur):\n${userMemories.map(m => `- [${m.category}] ${m.key}: ${m.value}`).join('\n')}`
      : '';

    // Fetch pending action context (for "reprends", "continue", "oui", "envoie" requests)
    // CRITICAL FIX: Use request.user_id (auth.uid()) - matches RLS policy and new save logic
    const { data: pendingActionContext } = await supabase
      .from('jarvis_action_context')
      .select('id, action_type, action_data, original_message, created_at')
      .eq('user_id', request.user_id)  // ✅ auth.uid() matches RLS policy
      .in('status', ['in_progress', 'paused'])
      .order('last_interaction_at', { ascending: false })
      .limit(5);
    
    console.log(`[JARVIS Brain] Pending context query: user_id=${request.user_id}, found=${pendingActionContext?.length || 0}`);

    // Detect if user is confirming an action (EXPANDED patterns including variations)
    // Matches: "envoie", "envoie le", "envoie le tel quel", "vas-y envoie", "oui envoie", etc.
    const confirmationPatterns = /^(oui|ok|vas-y|go|envoie|envoyer|envoie[-\s]?le|confirme|confirmer|d'accord|let'?s?\s*go|fais[-\s]?le|valide|valider|execute|executer|exécute|exécuter|lance|lancer|fonce|yes|yep|ouais|ouai|bien\s*su?r|absolument|tout\s*à?\s*fait|parfait|c'est\s*bon|c'est\s*parti|allons-y|aller|send|do\s*it|proceed)/i;
    const isConfirmation = confirmationPatterns.test(request.message.trim());

    // ================================================================
    // PHASE 1 CRITICAL FIX: DIRECT EXECUTION ON CONFIRMATION
    // Bypass GPT-5 entirely when user confirms a pending action
    // ================================================================
    if (isConfirmation && pendingActionContext?.length) {
      const mostRecentAction = pendingActionContext[0];
      console.log(`[JARVIS Brain] 🚀 DIRECT EXECUTION: User confirmed action "${mostRecentAction.action_type}"`);
      console.log(`[JARVIS Brain] Action data:`, JSON.stringify(mostRecentAction.action_data).substring(0, 200));
      
      // Tool execution context - CRITICAL: use userClient (respects RLS) for direct execution too
      const toolContext: ToolExecutionContext = {
        supabase: userClient,  // USER CLIENT - respects RLS = same permissions as user
        adminClient,           // Admin client for system operations only
        userId: profileId || request.user_id,  // Use resolved profileId
        authUserId: request.user_id,           // Auth user_id for user_feedbacks FK
        conversationId: request.conversation_id
      };
      
      try {
        // Execute the tool DIRECTLY without going through GPT-5
        const result = await executeTool(
          toolContext, 
          mostRecentAction.action_type, 
          mostRecentAction.action_data as Record<string, unknown>
        );
        
        // Mark the action context as completed
        await supabase
          .from('jarvis_action_context')
          .update({ status: 'completed' })
          .eq('id', mostRecentAction.id);
        
        const processingTime = Date.now() - startTime;
        console.log(`[JARVIS Brain] ✅ Direct execution completed in ${processingTime}ms`);
        
        // Format success/error message
        const responseContent = result.success 
          ? `✅ **Action exécutée avec succès**\n\n${formatExecutionResult(mostRecentAction.action_type, result.data)}`
          : `❌ **Échec de l'action**\n\n${result.error || 'Erreur inconnue'}\n\nVeuillez réessayer ou reformuler votre demande.`;
        
        return new Response(JSON.stringify({
          success: result.success,
          content: responseContent,
          tool_calls: [{
            id: mostRecentAction.id,
            name: mostRecentAction.action_type,
            arguments: mostRecentAction.action_data
          }],
          tool_results: [{
            tool_call_id: mostRecentAction.id,
            name: mostRecentAction.action_type,
            result
          }],
          direct_execution: true,
          processing_time_ms: processingTime
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } catch (execError) {
        console.error('[JARVIS Brain] Direct execution error:', execError);
        // Mark as failed
        await supabase
          .from('jarvis_action_context')
          .update({ status: 'failed' })
          .eq('id', mostRecentAction.id);
        
        const errorMsg = execError instanceof Error ? execError.message : 'Erreur inconnue';
        return new Response(JSON.stringify({
          success: false,
          content: `❌ **Échec de l'exécution directe**\n\n${errorMsg}\n\nVeuillez réessayer.`,
          tool_calls: [],
          tool_results: [],
          processing_time_ms: Date.now() - startTime
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    // ================================================================
    // END PHASE 1 FIX
    // ================================================================

    // Format pending actions context for GPT-5 (normal flow)
    let pendingActionsPrompt = '';
    if (pendingActionContext?.length) {
      pendingActionsPrompt = `

ACTIONS EN ATTENTE (l'utilisateur peut demander de les reprendre avec "reprends", "continue", "termine", "oui", "envoie"):
${pendingActionContext.map((a, i) => `${i + 1}. [${a.action_type}] "${a.original_message}"
   Données: ${JSON.stringify(a.action_data).substring(0, 300)}...
   Créé: ${new Date(a.created_at).toLocaleString('fr-FR')}`).join('\n\n')}

Si l'utilisateur dit "oui", "ok", "envoie", "go" ou similaire, exécute l'action la plus récente avec les données ci-dessus.`;
    }

    const userContext = userProfile 
      ? `\n\nUTILISATEUR ACTUEL:\n- Nom: ${userProfile.prenom || ''} ${userProfile.nom || ''}\n- Email: ${userProfile.email || ''}\n- Poste: ${userProfile.fonction || 'Non défini'}\n- Téléphone: ${userProfile.telephone || 'Non défini'}\n\nUtilise ces informations pour personnaliser tes réponses (signature d'emails, etc.).${richContext}${pageContextEnriched}${memoryContext}${pendingActionsPrompt}`
      : `${richContext}${pageContextEnriched}${memoryContext}${pendingActionsPrompt}`;

    // Tool execution context - CRITICAL: use profileId, not auth user_id
    // Tools expect profile_id (profiles.id) for database operations
    // IMPORTANT: Use userClient (respects RLS) for tool execution, NOT adminClient
    const toolContext: ToolExecutionContext = {
      supabase: userClient,  // USER CLIENT - respects RLS = same permissions as user
      adminClient,           // Admin client for system operations only
      userId: profileId || request.user_id,  // Fallback to auth user_id if profile not found
      authUserId: request.user_id,           // Auth user_id for tables with FK to auth.users
      conversationId: request.conversation_id
    };

    // Appel d'outil venu du serveur MCP : il est deterministe, le modele n'a
    // rien a y faire. On execute et on repond, sans conversation.
    if (request.mcp_tool_call?.name) {
      const nom = request.mcp_tool_call.name;
      console.log(`[JARVIS Brain] Appel MCP direct : ${nom}`);
      const resultat = await executeTool(
        toolContext,
        nom,
        request.mcp_tool_call.arguments ?? {}
      );
      return new Response(
        JSON.stringify({ mcp_tool_result: resultat }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // Build conversation messages with user context + MEMORY instructions
    const memoryInstructions = `

GESTION DE LA MÉMOIRE PERSISTANTE:
- Quand l'utilisateur exprime une PRÉFÉRENCE ("je préfère", "toujours", "jamais", "par défaut"), appelle manage_memory(action: 'add', category: 'preference', key: 'description courte', value: 'détail')
- Quand l'utilisateur partage un FAIT personnel ("mon email est", "je travaille sur", "mon client principal"), appelle manage_memory(action: 'add', category: 'fact', key: 'sujet', value: 'info')
- Quand l'utilisateur donne une INSTRUCTION permanente ("rappelle-moi que", "n'oublie pas", "pense à"), appelle manage_memory(action: 'add', category: 'instruction', key: 'rappel', value: 'instruction')
- Importance: 1 (peu important) à 5 (critique)`;

    // ================================================================
    // JARVIS 10.5 - Multi-Intent Detection & Planning
    // Détecte les requêtes complexes et les décompose en étapes
    // ================================================================
    const executionPlan = createExecutionPlan(request.message);
    let planContext = '';
    
    if (executionPlan.classification.isMultiIntent) {
      console.log(`[JARVIS Brain] Multi-intent detected: ${executionPlan.steps.length} steps, strategy: ${executionPlan.strategy}`);
      planContext = enrichPromptWithPlan('', executionPlan);
      
      // Log le plan pour le debug
      console.log(`[JARVIS Brain] Execution plan: ${executionPlan.steps.map(s => s.intent.type).join(' → ')}`);
    }

    const messages = [
      { role: "system", content: JARVIS_SYSTEM_PROMPT + memoryInstructions + userContext + planContext },
      ...(request.conversation_history || []),
      { role: "user", content: request.message }
    ];

    // Call GPT-5 with tools — apply latency hints from caller (jarvis-brain-stream)
    const reasoningEffort = request.reasoning_hint || 'medium';
    const maxIterations = Math.max(1, Math.min(10, request.max_iterations_hint || 10));
    console.log(`[JARVIS Brain] Latency hints: reasoning=${reasoningEffort}, maxIterations=${maxIterations}`);
    const response = await callGPT5WithTools(messages, toolContext, request.autonomous_mode, maxIterations, reasoningEffort);

    // PHASE 2 FIX: Auto-extract and save memory from user message (non-blocking)
    extractAndSaveMemory(supabase, request.user_id, request.message, response.content)
      .catch(err => console.error('[JARVIS Brain] Memory extraction failed:', err));

    // Save conversation if requested
    if (request.conversation_id) {
      await supabase
        .from('jarvis_conversations')
        .update({
          messages: [
            ...(request.conversation_history || []),
            { role: 'user', content: request.message },
            { role: 'assistant', content: response.content }
          ],
          updated_at: new Date().toISOString()
        })
        .eq('id', request.conversation_id);
    }

    const processingTime = Date.now() - startTime;
    console.log(`[JARVIS Brain] Response generated in ${processingTime}ms`);

    // JARVIS 16.0: Flush analytics (non-blocking)
    flushAnalyticsToDB().catch(e => console.warn('[JARVIS Brain] Analytics flush error:', e));

    return new Response(JSON.stringify({
      success: true,
      content: response.content,
      tool_calls: response.toolCalls,
      tool_results: response.toolResults,
      processing_time_ms: processingTime,
      analytics: getAnalyticsSnapshot() // Include analytics in response for debugging
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[JARVIS Brain] Error:', errorMessage);

    // Return 429 for rate limit errors so client can show proper retry UI (non-sensitive)
    if (errorMessage.startsWith('RATE_LIMITED:')) {
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage.replace('RATE_LIMITED: ', '')
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return buildErrorResponse('jarvis-brain', error, corsHeaders, 500);
  }
});

// ============================================================
// Helper: Format execution result for user (CORRECTION 5: Feedback amélioré)
// ============================================================
function formatExecutionResult(actionType: string, data: unknown): string {
  // CORRECTION 5: Vérifier si c'est une erreur d'abord
  if (data && typeof data === 'object' && 'error' in data) {
    const errorData = data as { error: string };
    return `❌ **Échec: ${actionType.replace(/_/g, ' ')}**\n\n${errorData.error}`;
  }

  switch (actionType) {
    case 'send_email': {
      // Vérifier le succès réel avec les détails
      if (data && typeof data === 'object') {
        const emailData = data as { to?: string; subject?: string; from?: string; message?: string };
        if (emailData.message || emailData.to) {
          return `📧 **Email envoyé avec succès !**\n\n` +
            (emailData.to ? `• Destinataire: ${emailData.to}\n` : '') +
            (emailData.subject ? `• Sujet: ${emailData.subject}\n` : '') +
            (emailData.from ? `• Depuis: ${emailData.from}` : '');
        }
      }
      return `📧 **Email envoyé avec succès !**\n\nVotre email a bien été transmis au destinataire.`;
    }
    case 'create_task':
      return `✅ **Tâche créée avec succès !**\n\nLa tâche a été ajoutée à votre liste.`;
    case 'schedule_meeting':
      return `📅 **Réunion planifiée !**\n\nL'événement a été ajouté à votre calendrier.`;
    case 'update_entity_status':
      return `🔄 **Statut mis à jour !**\n\nLes modifications ont été enregistrées.`;
    case 'create_invoice':
      return `🧾 **Facture créée !**\n\nLa facture a été générée avec succès.`;
    case 'close_ticket':
      return `🎫 **Ticket clôturé !**\n\nLe ticket support a été marqué comme résolu.`;
    case 'query_database': {
      if (data && typeof data === 'object' && 'records' in data) {
        const queryData = data as { records: unknown[]; count: number; table: string };
        return `🔍 **Requête exécutée**\n\n${queryData.count} résultat(s) trouvé(s) dans "${queryData.table}"`;
      }
      return `🔍 **Requête exécutée avec succès**`;
    }
    default:
      return `🔧 **Action "${actionType.replace(/_/g, ' ')}" terminée**\n\n${typeof data === 'object' ? JSON.stringify(data, null, 2).substring(0, 300) : String(data)}`;
  }
}

// ============================================================
// Helper: Format tool preview for user
// ============================================================
function formatToolPreview(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'send_email':
      return `📧 **Envoyer un email**\n` +
             `• À: ${args.to || 'Non spécifié'}\n` +
             `• Sujet: ${args.subject || 'Sans sujet'}\n` +
             `• Contenu: ${String(args.html_body || args.body || '').substring(0, 100)}...`;
    case 'create_task':
      return `✅ **Créer une tâche**\n` +
             `• Titre: ${args.title || args.name || 'Non spécifié'}\n` +
             `• Description: ${String(args.description || '').substring(0, 80)}...`;
    case 'schedule_meeting':
      return `📅 **Planifier une réunion**\n` +
             `• Titre: ${args.title || 'Non spécifié'}\n` +
             `• Date: ${args.start_time || args.date || 'Non spécifiée'}`;
    case 'update_entity_status':
      return `🔄 **Modifier le statut**\n` +
             `• Entité: ${args.entity_type || 'Non spécifié'}\n` +
             `• Nouveau statut: ${args.new_status || 'Non spécifié'}`;
    default:
      return `🔧 **${toolName.replace(/_/g, ' ')}**\n` +
             `• Paramètres: ${JSON.stringify(args).substring(0, 100)}...`;
  }
}

// ============================================================
// Auto-Memory Extraction (PHASE 2 CRITICAL FIX)
// ============================================================
async function extractAndSaveMemory(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userMessage: string,
  _assistantResponse: string
): Promise<void> {
  try {
    // Patterns de détection de préférences
    const preferencePatterns = [
      { regex: /je\s+(?:préfère|prefere|préférerais|prefererais|veux|souhaite|aime)\s+(?:que\s+)?(.+)/i, category: 'preference' as const },
      { regex: /(?:toujours|jamais|par\s+défaut)\s+(.+)/i, category: 'preference' as const },
      { regex: /rappelle[- ]?(?:toi|moi)\s+que?\s+(.+)/i, category: 'instruction' as const },
      { regex: /n'oublie\s+pas\s+(?:que\s+)?(.+)/i, category: 'instruction' as const },
      { regex: /pense\s+à\s+(.+)/i, category: 'instruction' as const },
      { regex: /mon\s+(email|adresse|téléphone|telephone|client|entreprise|projet)\s+(?:est|principal)\s+(.+)/i, category: 'fact' as const },
      { regex: /je\s+(?:travaille|suis|m'occupe)\s+(?:sur|de|chez)\s+(.+)/i, category: 'fact' as const },
    ];

    for (const { regex, category } of preferencePatterns) {
      const match = userMessage.match(regex);
      if (match) {
        const extractedValue = match[1] || match[2];
        if (extractedValue && extractedValue.length > 3 && extractedValue.length < 200) {
          const key = extractedValue.substring(0, 50).replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿç\s-]/gi, '').trim();
          
          // Vérifier si cette mémoire existe déjà
          const { data: existing } = await supabase
            .from('jarvis_user_memory')
            .select('id')
            .eq('user_id', userId)
            .eq('category', category)
            .eq('key', key)
            .single();

          if (!existing) {
            await supabase
              .from('jarvis_user_memory')
              .insert({
                user_id: userId,
                category,
                key,
                value: extractedValue.trim(),
                importance: category === 'instruction' ? 4 : 3,
                metadata: { source: 'auto_extraction', timestamp: new Date().toISOString() }
              });
            console.log(`[JARVIS Brain] Auto-saved memory: [${category}] ${key}`);
          }
        }
        break; // One memory per message max
      }
    }
  } catch (error) {
    console.error('[JARVIS Brain] Memory extraction error:', error);
    // Non-blocking - don't fail the main flow
  }
}

// ============================================================
// GPT-5 with Tool Calling
// ============================================================
interface GPT5Response {
  content: string;
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  toolResults: Array<{
    tool_call_id: string;
    name: string;
    result: ToolResult;
  }>;
}

async function callGPT5WithTools(
  messages: Array<{ role: string; content: string; tool_calls?: unknown; tool_call_id?: string }>,
  toolContext: ToolExecutionContext,
  autonomousMode: boolean = false,
  maxIterations: number = 10,
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' = 'medium'
): Promise<GPT5Response> {
  // Check at least one endpoint is configured
  const hasGpt54 = AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_API_KEY;
  const hasGpt52 = AZURE_GPT52_ENDPOINT && AZURE_GPT52_API_KEY;
  
  if (!hasGpt54 && !hasGpt52) {
    throw new Error('Azure OpenAI credentials not configured (neither GPT-5.4 nor GPT-5.2)');
  }

  const allToolCalls: GPT5Response['toolCalls'] = [];
  const allToolResults: GPT5Response['toolResults'] = [];
  let currentMessages = [...messages];
  let iteration = 0;
  let consecutiveRateLimits = 0;
  let totalRateLimits = 0; // Track across all models
  const MAX_RATE_LIMIT_RETRIES = 3;
  const MAX_TOTAL_RATE_LIMITS = 4; // Across all model fallbacks
  
  // Track which provider we're using - GPT-5.4 is primary now
  let useGpt54 = hasGpt54;
  let useGpt52AsResponses = hasGpt52;
  let currentModel = hasGpt54 ? 'GPT-5.4' : (hasGpt52 ? 'GPT-5.2' : 'GPT-5.4');
  // Check if GPT-5.2 uses Responses API
  const isGpt52ResponsesAPI = hasGpt52 && AZURE_GPT52_ENDPOINT && isResponsesAPIEndpoint(AZURE_GPT52_ENDPOINT);
  
  // For Responses API, we need to track input differently
  let responsesAPIInput: ResponsesAPIInputItem[] = [];
  let responsesAPIInstructions = '';
  
  if (isGpt52ResponsesAPI && !useGpt54 && useGpt52AsResponses) {
    const converted = convertMessagesToInput(currentMessages);
    responsesAPIInput = converted.input;
    responsesAPIInstructions = converted.instructions;
  }

  while (iteration < maxIterations) {
    iteration++;
    console.log(`[JARVIS Brain] ${currentModel} iteration ${iteration}${!useGpt54 && isGpt52ResponsesAPI && useGpt52AsResponses ? ' (Responses API)' : ''}`);
    
    // Select endpoint based on current provider
    // GPT-5.4 uses AZURE_OPENAI_ENDPOINT, GPT-5.2 uses AZURE_GPT52_ENDPOINT
    const endpoint = useGpt54 ? AZURE_OPENAI_ENDPOINT! : AZURE_GPT52_ENDPOINT!;
    const apiKey = useGpt54 ? AZURE_OPENAI_API_KEY! : AZURE_GPT52_API_KEY!;

    // Setup timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
      // Use Responses API for GPT-5.2 if detected (only when NOT using GPT-5.4)
      if (!useGpt54 && useGpt52AsResponses && isGpt52ResponsesAPI) {
        clearTimeout(timeoutId);
        
        try {
          console.log(`[JARVIS Brain] Calling GPT-5.2 via Responses API with ${responsesAPIInput.length} input items...`);
          
          // Convert tools to Responses API format (name at root level, not nested)
          const responsesTools = JARVIS_TOOLS.slice(0, 128).map(tool => ({
            type: 'function' as const,
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters
          }));
          
          // Build request - model is REQUIRED for Azure Responses API
          const requestBody = {
            model: 'gpt-5.2', // Required by Azure OpenAI Responses API
            input: responsesAPIInput,
            instructions: responsesAPIInstructions,
            tools: responsesTools,
            tool_choice: 'auto',
            max_output_tokens: 8000,
            reasoning: { effort: reasoningEffort as any },
            text: { verbosity: reasoningEffort === 'minimal' || reasoningEffort === 'low' ? 'low' as const : 'medium' as const }
          };
          
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-key': apiKey,
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(90000),
          });
          
          // Handle rate limit - FAST FAIL
          if (response.status === 429) {
            consecutiveRateLimits++;
            totalRateLimits++;
            console.log(`[JARVIS Brain] Rate limit hit (consecutive=${consecutiveRateLimits}, total=${totalRateLimits}/${MAX_TOTAL_RATE_LIMITS})`);
            
            // Global rate limit guard
            if (totalRateLimits >= MAX_TOTAL_RATE_LIMITS) {
              throw new Error('RATE_LIMITED: Le service IA est temporairement saturé. Réessayez dans 30 secondes.');
            }
            
            // After 2 consecutive rate limits on same model, try fallback
            if (consecutiveRateLimits >= 2) {
              // No further fallback from GPT-5.2 Responses API
              throw new Error('RATE_LIMITED: Le service IA est temporairement saturé. Réessayez dans 30 secondes.');
            }
            
            // Short backoff for first retry only (1s max)
            await new Promise(r => setTimeout(r, 1000));
            iteration--;
            continue;
          }
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[JARVIS Brain] GPT-5.2 Responses API error:`, response.status, errorText);
            throw new Error(`Azure GPT-5.2 Responses API error: ${response.status}`);
          }
          
          consecutiveRateLimits = 0;
          const responseData = await response.json();
          
          // Parse Responses API output
          const content = extractTextFromOutput(responseData.output || []);
          const toolCalls = parseToolCallsFromOutput(responseData.output || []);
          
          console.log(`[JARVIS Brain] Responses API: content=${content.length} chars, toolCalls=${toolCalls.length}`);
          
          // CRITICAL FIX: Add all function_call items from output to input BEFORE adding results
          // The Responses API requires the exact function_call items to be re-included
          if (responseData.output) {
            for (const outputItem of responseData.output) {
              if (outputItem.type === 'function_call') {
                // Add the function_call exactly as returned by the API
                responsesAPIInput.push({
                  type: 'function_call' as any,
                  id: outputItem.id,
                  call_id: outputItem.call_id || outputItem.id,
                  name: outputItem.name,
                  arguments: outputItem.arguments || '{}'
                });
                console.log(`[JARVIS Brain] Added function_call to input: ${outputItem.name} (${outputItem.id || outputItem.call_id})`);
              }
            }
          }
          
          // Handle tool calls from Responses API
          if (toolCalls.length > 0) {
            console.log(`[JARVIS Brain] ${toolCalls.length} tool calls from Responses API`);
            
            for (const toolCall of toolCalls) {
              const toolName = toolCall.name;
              const toolArgs = toolCall.parsedArgs || {};
              
              console.log(`[JARVIS Brain] Executing tool: ${toolName}`);
              
              // Check if confirmation is required
              if (requiresConfirmation(toolName, false, toolArgs)) {
                console.log(`[JARVIS Brain] Tool ${toolName} requires confirmation - saving context`);
                
                // Save action context - CRITICAL: Use authUserId to pass RLS policy (auth.uid() = user_id)
                const actionUserId = toolContext.authUserId || toolContext.userId;
                try {
                  const { data: existingAction } = await toolContext.supabase
                    .from('jarvis_action_context')
                    .select('id')
                    .eq('user_id', actionUserId)
                    .eq('action_type', toolName)
                    .in('status', ['in_progress', 'paused'])
                    .single();
                  
                  if (existingAction) {
                    await toolContext.supabase
                      .from('jarvis_action_context')
                      .update({
                        action_data: toolArgs,
                        original_message: messages[messages.length - 1]?.content || '',
                        conversation_id: toolContext.conversationId || null,
                        last_interaction_at: new Date().toISOString()
                      })
                      .eq('id', existingAction.id);
                  } else {
                    await toolContext.supabase
                      .from('jarvis_action_context')
                      .insert({
                        user_id: actionUserId,  // ✅ auth.uid() passes RLS policy
                        action_type: toolName,
                        action_data: toolArgs,
                        status: 'in_progress',
                        original_message: messages[messages.length - 1]?.content || '',
                        conversation_id: toolContext.conversationId || null,
                        last_interaction_at: new Date().toISOString()
                      });
                  }
                } catch (saveError) {
                  console.error('[JARVIS Brain] Failed to save action context:', saveError);
                }
                
                allToolCalls.push({
                  id: toolCall.id,
                  name: toolName,
                  arguments: toolArgs
                });
                
                allToolResults.push({
                  tool_call_id: toolCall.id,
                  name: toolName,
                  result: {
                    success: false,
                    error: 'REQUIRES_CONFIRMATION',
                    data: { 
                      pending_action: true, 
                      tool_name: toolName, 
                      arguments: toolArgs,
                      preview: formatToolPreview(toolName, toolArgs)
                    },
                    execution_time_ms: 0
                  }
                });
                
                const previewMessage = formatToolPreview(toolName, toolArgs);
                return {
                  content: content || `⏳ **Action prête à exécuter**\n\n${previewMessage}`,
                  toolCalls: allToolCalls,
                  toolResults: allToolResults
                };
              }
              
              // Execute the tool with smart retry & analytics
              const result = await executeWithSmartRetry(toolName, () => executeTool(toolContext, toolName, toolArgs));
              recordToolAnalytics(toolName, result.success, result.execution_time_ms);
              
              allToolCalls.push({
                id: toolCall.id,
                name: toolName,
                arguments: toolArgs
              });
              
              allToolResults.push({
                tool_call_id: toolCall.id,
                name: toolName,
                result
              });
              
              // Auto-report failures
              if (!result.success && result.error) {
                console.warn(`[JARVIS Brain] ⚠️ TOOL FAILED: ${toolName} - ${result.error}`);
                autoReportFailure(toolContext, toolName, result.error, toolArgs).catch(e => {
                  console.error('[JARVIS Brain] Auto-report failed:', e);
                });
              }
              
              // Build result for GPT-5 - prefix failures with strong marker so GPT-5 cannot hallucinate success
              const resultForGpt = (!result.success && result.error)
                ? { ...result, error: `[ECHEC OUTIL - NE DIS PAS QUE C'EST FAIT] ${result.error}` }
                : result;
              
              // Add tool result to Responses API input for next iteration
              // CRITICAL: Include toolName and arguments for proper Responses API format
              responsesAPIInput = buildToolResultInput(
                responsesAPIInput,
                toolCall.id,
                resultForGpt,
                toolName,  // Include tool name
                toolCall.arguments  // Include original arguments
              );
              
              // Log tool execution
              if (toolContext.conversationId) {
                await toolContext.supabase
                  .from('jarvis_tool_executions')
                  .insert({
                    conversation_id: toolContext.conversationId,
                    user_id: toolContext.userId,
                    tool_name: toolName,
                    tool_arguments: toolArgs,
                    execution_result: result.data,
                    execution_status: result.success ? 'completed' : 'failed',
                    execution_time_ms: result.execution_time_ms,
                    error_message: result.error
                  });
              }
            }
            
            // Continue loop to get final response
            continue;
          }
          
          // No tool calls, return final response
          if (content) {
            return {
              content,
              toolCalls: allToolCalls,
              toolResults: allToolResults
            };
          }
          
          throw new Error('No content from GPT-5.2 Responses API');
          
        } catch (responsesError) {
          console.error('[JARVIS Brain] Responses API error:', responsesError);
          throw responsesError;
        }
      }
      
      // Standard Chat Completions API for GPT-5.4 (primary) or GPT-5.2 without Responses API
      const requestBody = {
        messages: currentMessages,
        tools: JARVIS_TOOLS.slice(0, 128),
        tool_choice: "auto",
        max_completion_tokens: 8000,
        reasoning_effort: reasoningEffort,
        verbosity: reasoningEffort === 'minimal' || reasoningEffort === 'low' ? 'low' : 'medium',
      };
      
      const azureResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Retry on rate limit with fast-fail
      if (azureResponse.status === 429) {
        consecutiveRateLimits++;
        totalRateLimits++;
        console.log(`[JARVIS Brain] ${currentModel} rate limited (consecutive=${consecutiveRateLimits}, total=${totalRateLimits}/${MAX_TOTAL_RATE_LIMITS})`);
        
        // Global rate limit guard
        if (totalRateLimits >= MAX_TOTAL_RATE_LIMITS) {
          console.error(`[JARVIS Brain] Max total rate limits (${MAX_TOTAL_RATE_LIMITS}) exceeded`);
          throw new Error('RATE_LIMITED: Le service IA est temporairement saturé. Réessayez dans 30 secondes.');
        }
        
        // If we're on GPT-5.4 and hit rate limit multiple times, try fallback to GPT-5.2
        if (useGpt54 && hasGpt52 && consecutiveRateLimits >= 2) {
          console.log(`[JARVIS Brain] GPT-5.4 rate limited, falling back to GPT-5.2...`);
          useGpt54 = false;
          useGpt52AsResponses = isGpt52ResponsesAPI ?? false;
          currentModel = 'GPT-5.2';
          consecutiveRateLimits = 0;
          iteration--;
          continue;
        }
        
        if (consecutiveRateLimits > MAX_RATE_LIMIT_RETRIES) {
          console.error(`[JARVIS Brain] Max rate limit retries (${MAX_RATE_LIMIT_RETRIES}) exceeded`);
          throw new Error('RATE_LIMITED: Le service IA est temporairement saturé. Réessayez dans 30 secondes.');
        }
        // Backoff: 2s, 4s, 8s (max 10s)
        const backoffMs = Math.min(2000 * Math.pow(2, consecutiveRateLimits - 1), 10000);
        console.log(`[JARVIS Brain] ${currentModel} rate limited, waiting ${backoffMs}ms before retry ${consecutiveRateLimits}/${MAX_RATE_LIMIT_RETRIES}...`);
        await new Promise(r => setTimeout(r, backoffMs));
        iteration--;
        continue;
      }
      
      // Reset rate limit counter on successful request
      consecutiveRateLimits = 0;

      if (!azureResponse.ok) {
        const errorText = await azureResponse.text();
        console.error(`[JARVIS Brain] ${currentModel} error:`, azureResponse.status, errorText);
        
        // If GPT-5.4 fails with error, try fallback to GPT-5.2
        if (useGpt54 && hasGpt52) {
          console.log(`[JARVIS Brain] GPT-5.4 error, falling back to GPT-5.2...`);
          useGpt54 = false;
          useGpt52AsResponses = isGpt52ResponsesAPI ?? false;
          currentModel = 'GPT-5.2';
          iteration--;
          continue;
        }
        
        throw new Error(`Azure API error: ${azureResponse.status}`);
      }

      const responseData = await azureResponse.json();
      const choice = responseData.choices?.[0];
      const message = choice?.message;

      if (!message) {
        throw new Error('No message in AI response');
      }

      // Check if there are tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`[JARVIS Brain] ${message.tool_calls.length} tool calls requested`);

        // Add assistant message with tool calls
        currentMessages.push({
          role: "assistant",
          content: message.content || "",
          tool_calls: message.tool_calls
        } as { role: string; content: string });

        // Execute each tool
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown> = {};
          
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            console.error('[JARVIS Brain] Failed to parse tool args:', toolCall.function.arguments);
          }

          console.log(`[JARVIS Brain] Executing tool: ${toolName}`);
          
          // Check if confirmation is required (non-autonomous mode)
          if (requiresConfirmation(toolName, false, toolArgs)) {
            console.log(`[JARVIS Brain] Tool ${toolName} requires confirmation - saving context and returning`);
            
            // AUTO-SAVE: Store the action context for later resumption
            // Use update-or-insert pattern for reliability with partial unique index
            // CRITICAL: Use authUserId to pass RLS policy (auth.uid() = user_id)
            const actionUserId = toolContext.authUserId || toolContext.userId;
            
            try {
              // First try to update existing in_progress/paused action
              const { data: existingAction } = await toolContext.supabase
                .from('jarvis_action_context')
                .select('id')
                .eq('user_id', actionUserId)
                .eq('action_type', toolName)
                .in('status', ['in_progress', 'paused'])
                .single();
              
              if (existingAction) {
                // Update existing
                await toolContext.supabase
                  .from('jarvis_action_context')
                  .update({
                    action_data: toolArgs,
                    original_message: messages[messages.length - 1]?.content || '',
                    conversation_id: toolContext.conversationId || null,
                    last_interaction_at: new Date().toISOString()
                  })
                  .eq('id', existingAction.id);
                console.log(`[JARVIS Brain] Action context updated for ${toolName}`);
              } else {
                // Insert new
                await toolContext.supabase
                  .from('jarvis_action_context')
                  .insert({
                    user_id: actionUserId,  // ✅ auth.uid() passes RLS policy
                    action_type: toolName,
                    action_data: toolArgs,
                    status: 'in_progress',
                    original_message: messages[messages.length - 1]?.content || '',
                    conversation_id: toolContext.conversationId || null,
                    last_interaction_at: new Date().toISOString()
                  });
                console.log(`[JARVIS Brain] Action context created for ${toolName}`);
              }
            } catch (saveError) {
              console.error('[JARVIS Brain] Failed to save action context:', saveError);
            }
            
            // Collect all pending tool calls for this iteration
            allToolCalls.push({
              id: toolCall.id,
              name: toolName,
              arguments: toolArgs
            });
            
            allToolResults.push({
              tool_call_id: toolCall.id,
              name: toolName,
              result: {
                success: false,
                error: 'REQUIRES_CONFIRMATION',
                data: { 
                  pending_action: true, 
                  tool_name: toolName, 
                  arguments: toolArgs,
                  preview: formatToolPreview(toolName, toolArgs)
                },
                execution_time_ms: 0
              }
            });

            // CRITICAL FIX: Return immediately with pending action for UI button confirmation
            // Do NOT continue the loop - this prevents the "reasoning limit" error
            const previewMessage = formatToolPreview(toolName, toolArgs);
            return {
              content: message.content || `⏳ **Action prête à exécuter**\n\n${previewMessage}`,
              toolCalls: allToolCalls,
              toolResults: allToolResults
            };
          }

          // Execute the tool
          const result = await executeTool(toolContext, toolName, toolArgs);
          
          allToolCalls.push({
            id: toolCall.id,
            name: toolName,
            arguments: toolArgs
          });
          
          allToolResults.push({
            tool_call_id: toolCall.id,
            name: toolName,
            result
          });

          // On successful sensitive action, mark pending context as completed
          if (result.success && requiresConfirmation(toolName)) {
            try {
              await toolContext.supabase
                .from('jarvis_action_context')
                .update({ status: 'completed' })
                .eq('user_id', toolContext.userId)
                .eq('action_type', toolName)
                .in('status', ['in_progress', 'paused']);
              console.log(`[JARVIS Brain] Marked ${toolName} action context as completed`);
            } catch (updateError) {
              console.error('[JARVIS Brain] Failed to update action context:', updateError);
            }
          }

          // Auto-report failures to user_feedbacks (like the orange button)
          if (!result.success && result.error) {
            console.warn(`[JARVIS Brain] ⚠️ TOOL FAILED (fallback): ${toolName} - ${result.error}`);
            // Fire and forget - don't block the main flow
            autoReportFailure(toolContext, toolName, result.error, toolArgs).catch(e => {
              console.error('[JARVIS Brain] Auto-report failed:', e);
            });
          }

          // Build result for GPT-5 - prefix failures with strong marker so GPT-5 cannot hallucinate success
          const resultForGptFallback = (!result.success && result.error)
            ? { ...result, error: `[ECHEC OUTIL - NE DIS PAS QUE C'EST FAIT] ${result.error}` }
            : result;

          // Add tool result message
          currentMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(resultForGptFallback)
          } as unknown as { role: string; content: string });

          // Log tool execution
          if (toolContext.conversationId) {
            await toolContext.supabase
              .from('jarvis_tool_executions')
              .insert({
                conversation_id: toolContext.conversationId,
                user_id: toolContext.userId,
                tool_name: toolName,
                tool_arguments: toolArgs,
                execution_result: result.data,
                execution_status: result.success ? 'completed' : 'failed',
                execution_time_ms: result.execution_time_ms,
                error_message: result.error
              });
          }
        }

        // Continue loop to get final response from GPT-5
        continue;
      }

      // No more tool calls - return final response
      return {
        content: message.content || "Je n'ai pas pu générer de réponse.",
        toolCalls: allToolCalls,
        toolResults: allToolResults
      };

    } catch (error: unknown) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Azure request timeout (90s)');
      }
      throw error;
    }
  }

  // Max iterations reached - message explicite avec suggestions actionnables
  console.warn(`[JARVIS Brain] Max iterations (${maxIterations}) reached`);
  return {
    content: "⚠️ **Demande trop complexe**\n\n" +
             "J'ai besoin que vous décomposiez votre demande en étapes plus simples.\n\n" +
             "**Exemples de reformulation :**\n" +
             "• « Prépare un email pour X » → puis confirmez l'envoi avec le bouton\n" +
             "• « Liste mes tâches » → puis « crée une tâche pour Y »\n" +
             "• « Résume les emails » → puis « réponds à celui de Z »\n\n" +
             "💡 Une action à la fois fonctionne mieux !",
    toolCalls: allToolCalls,
    toolResults: allToolResults
  };
}
