/**
 * JARVIS 12.0 Brain - Tools Executor Module
 * 
 * Exécute les outils appelés par GPT-5 de manière sécurisée.
 * Architecture modulaire avec 60+ outils couvrant tous les modules métier.
 * Valide les permissions, logge les exécutions, et gère les erreurs.
 */

import { SupabaseClient } from "@supabase/supabase-js";

// Import core tools (improved versions with column aliases, contains fix, schedule_meeting fallback)
import { executeQueryDatabase as executeQueryDatabaseCore, executeScheduleMeeting as executeScheduleMeetingCore } from "./tools/core-tools.ts";

// Import modular tools
import { executeSyncQontoTransactions, executeGetBankBalance, executeCreateInvoice, executeForecastCashflow, executeManageExpense } from "./tools/treasury-tools.ts";
import { executeParsePayslip, executeManageAbsence, executeCalculatePayrollKpis, executeRecommendTraining, executeGetEmployeeCompetences } from "./tools/rh-tools.ts";
import { executeManageEpic, executeManageUserStory, executeManageSprint, executeMoveStoryToSprint, executeCalculateRdMetrics, executeAiAssistStory, executeManageRdComment, executeManageRdLabel } from "./tools/rd-tools.ts";
import { executeCreateSupportTicket, executeUpdateTicketStatus, executeAssignTicket, executeGetSupportKpis } from "./tools/support-tools.ts";
import { executeManageJobOffer, executeManageCandidate, executeScheduleInterview, executeEvaluateCandidate, executeParseCV, executeGetCandidateHistory } from "./tools/recruitment-tools.ts";
import { executeTranslateEmail, executeCorrectEmail, executeReformulateEmail, executeSuggestEmailResponse, executeCreateEmailTemplate } from "./tools/communication-tools.ts";
import { executeGetMyCalendar, executeCreateRecurringEvent, executeDetectCalendarConflicts, executeImportIcsCalendar, executeSyncExternalCalendar } from "./tools/calendar-tools.ts";
import { executeManageUser, executeManageUserRole, executeGetSystemLogs, executeExportDataRgpd, executeGetAiUsageStats } from "./tools/admin-tools.ts";
import { executeCreateTrainingSession, executeRegisterAttendance, executeGetSessionAttendance, executeGetTrainingAnalytics, executeManageCertification, executeSendSatisfactionSurvey, executeGetSatisfactionResults } from "./tools/training-tools.ts";
import { executeGenerateContract, executeAiAssistContract, executeRequestSignature, executeManageContractTemplate, executeManageDocument, executeManageContratAvenant, executeGetContratAlerts } from "./tools/contracts-tools.ts";

// Import analytics & batch tools
import { executeGetDashboardSummary, executeGetDailyDigest, executeGetPerformanceReport, executeAnalyzeTrends, executeGetSmartSuggestions, executeComparePeriods } from "./tools/analytics-tools.ts";
import { executeBatchUpdateTasks, executeBatchSendEmails, executeBatchCreateTasks, executeBatchAssignTasks, executeBatchCloseTickets, executeBulkEmailClassification, executeExportData, executeCleanupOldData } from "./tools/batch-tools.ts";

// Import notification & proactive tools
import { executeSendNotification, executeGetNotifications, executeMarkNotificationsRead, executeAutoFollowupCheck, executeGetTeamAvailability, executeCreateWorkflow } from "./tools/notification-tools.ts";

// Import tools (Jarvis 12.0 Extension)
import { executeWebSearch } from "./tools/web-search-tools.ts";
import { executeWebScrape, executeWebSearchFree } from "./tools/web-scrape-tools.ts";
import { executeManageEtablissement, executeManageContact, executeManageGroupe, executeManagePartenaire } from "./tools/crm-management-tools.ts";
import { executeSummarizeContent, executeAnalyzeWithAI, executeExtractData } from "./tools/document-ai-tools.ts";
import { executeGetWeather, executeCalculateDate, executeConvertUnits } from "./tools/utility-tools.ts";

// Import tools (Jarvis 12.0 Extension Phase 2)
import { executeGenerateReport, executeExportToExcel, executeCreateDashboardSnapshot, executeScheduleReport } from "./tools/reporting-tools.ts";
import { executeCreateAutomationRule, executeListAutomationRules, executeToggleAutomationRule, executeCreateScheduledTask, executeGetAutomationStats } from "./tools/automation-tools.ts";
import { executeListFiles, executeGetFileUrl, executeMoveFile, executeCopyFile, executeDeleteFile, executeSearchDocuments as executeSearchDocumentsFiles, executeGetStorageStats, executeCreateFolder } from "./tools/file-management-tools.ts";
import { executePredictTrend, executeDetectAnomalies, executeCorrelationAnalysis, executeGetPerformanceScore } from "./tools/advanced-analytics-tools.ts";
import { executeWorkflow, listAvailableWorkflows, getWorkflowHistory } from "./tools/workflow-tools.ts";

// Import Intelligence Tools (JARVIS 13.0)
import { executeGenerateBriefing, executeCompareAnalysis, executeSuggestActions, executeBulkAction } from "./tools/intelligence-tools.ts";

// Import Prospect Scoring
import { executeScoreProspects } from "./tools/prospect-scoring-tools.ts";

// Import Email Analytics
import { executeAnalyzeSenderEmails } from "./tools/email-analytics-tools.ts";

// === NEW: P6→P10 modules ===
import {
  executeListWorkflows,
  executeGetWorkflowRuns,
  executeCreateWorkflowFromPrompt,
  executeToggleWorkflow,
  executeRunWorkflowNow,
} from "./tools/automation-builder-tools.ts";
import {
  executeListCatalogueProduits,
  executeGetCatalogueStats,
  executeManageCatalogueProduit,
} from "./tools/catalogue-tools.ts";
import {
  executeListCustomReports,
  executeRunCustomReport,
  executeExportCustomReport,
} from "./tools/custom-reports-tools.ts";
import {
  executeGetActivityFeed,
  executePinActivityEvent,
} from "./tools/activity-feed-tools.ts";
import {
  executeGetChurnPredictionsList,
  executeRecomputeChurnPredictions,
  executeGetChurnAccountDetail,
} from "./tools/churn-tools.ts";
import {
  executeGetSalesForecast,
  executeCompareForecastVsActual,
} from "./tools/forecasting-tools.ts";
import {
  executeListSignatureRequests,
  executeRemindSignature,
  executeCancelSignature,
} from "./tools/signature-tools.ts";
import { executeGetAttributionAnalysis } from "./tools/attribution-tools.ts";

// Import Pulse Tools
import { executeSendPulseMessage, executeCreatePulseConversation, executeListPulseConversations, executeSearchPulseMessages } from "./tools/pulse-tools.ts";

// Import new tools (Phase complete)
import { executeUpdateTask, executeDeleteTask, executeManageSubtask, executeLogTimeEntry, executeManageTaskRecurrence } from "./tools/task-management-tools.ts";
import { executeManageDevis, executeAddDevisLigne, executeConvertDevisToInvoice } from "./tools/devis-tools.ts";
import { executeManageForumPost, executeManageForumComment, executeVoteForumPost, executeBookmarkForumPost } from "./tools/forum-tools.ts";
import { executeGetCsmHealthScore, executeGetCsmKpis, executeManageCsmMilestone, executeGetChurnPredictions, executeManageCsmBillingFollowup } from "./tools/csm-tools.ts";
import { executeUpdateCalendarEvent, executeDeleteCalendarEvent, executeManageEventAttendees, executeManageEventReminder, executeManageBooking } from "./tools/calendar-management-tools.ts";
import { executeManageAvoir, executeAddAvoirLigne } from "./tools/avoir-tools.ts";
import { executeManageEmailDraft, executeManageEmailFilter, executeManageEmailThread, executeClassifyEmailThread } from "./tools/email-management-tools.ts";
import { executeManageRevenue, executeManageBudget, executeGetTresorerieSummary } from "./tools/tresorerie-management-tools.ts";
import { executeManageInvoice } from "./tools/invoice-management-tools.ts";
import { executeGetEmployeeDossier, executeUpdateProfile } from "./tools/people-tools.ts";

// Import RAG tools (Phase 1.1 - Document RAG)
import { executeSearchDocuments as executeSearchDocumentsRAG, executeSearchKnowledgeBase as executeSearchKBSemantic, executeIndexDocument, executeGetIndexingStatus } from "./tools/document-rag-tools.ts";

// Import objectives tools (Phase 2.2 - Goal-driven orchestration)
import { createObjective, updateObjectiveProgress, listObjectives, analyzeObjectivesProgress, ObjectiveInput } from "./tools/objectives-tools.ts";

// Import security validator
import { validateToolPermission, requiresConfirmation as checkRequiresConfirmation, TOOL_RISK_LEVELS, RiskLevel } from "./security-validator.ts";
import { ALLOWED_TABLES } from "./tool-registry.ts";

// Import tool health for timeouts and metrics
import { getToolTimeout, recordToolExecution, isToolAvailable } from "./tool-health.ts";

// Types pour les outils
export interface ToolExecutionContext {
  supabase: SupabaseClient;      // User client - respects RLS (same permissions as user)
  adminClient?: SupabaseClient;  // Admin client - for system operations only (logs, context)
  userId: string;                // profileId (profiles.id) - pour les FK métier
  authUserId?: string;           // auth.users.id - pour les FK vers auth.users
  conversationId?: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  execution_time_ms: number;
}

// ============================================================
// TOOL: query_database — delegated to core-tools.ts (with column aliases, contains fix)
// ============================================================
export const executeQueryDatabase = executeQueryDatabaseCore;

// ============================================================
// TOOL: send_email (avec validation compte + signature auto)
// PHASE 1 FIX: Utilise HTTP fetch direct au lieu de functions.invoke
// ============================================================
export async function executeSendEmail(
  ctx: ToolExecutionContext,
  args: {
    to: string;
    subject?: string;
    body: string;
    thread_id?: string;
    cc?: string[];
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  console.log(`[executeSendEmail] ========================================`);
  console.log(`[executeSendEmail] 🚀 START - profileId: ${ctx.userId}`);
  console.log(`[executeSendEmail] Payload:`, JSON.stringify({ to: args.to, subject: args.subject }));
  
  try {
    // Vérifier d'abord si l'utilisateur a un compte email configuré
    console.log(`[executeSendEmail] Looking for email accounts with profile_id: ${ctx.userId}`);
    
    const { data: emailAccount, error: accountError } = await ctx.supabase
      .from('user_email_accounts')
      .select('id, email_address')
      .eq('profile_id', ctx.userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (accountError) {
      console.error('[executeSendEmail] Error checking email account:', accountError);
    }

    console.log(`[executeSendEmail] Email account found:`, emailAccount ? emailAccount.email_address : 'NONE');

    // Si pas de compte personnel, chercher un compte partagé
    let accountToUse = emailAccount;
    let isSharedAccount = false;
    
    if (!emailAccount) {
      const { data: sharedAccount } = await ctx.supabase
        .from('user_email_accounts')
        .select('id, email_address')
        .eq('is_active', true)
        .eq('is_shared', true)
        .limit(1)
        .maybeSingle();
      
      if (sharedAccount) {
        console.log(`[executeSendEmail] Using shared account: ${sharedAccount.email_address}`);
        accountToUse = sharedAccount;
        isSharedAccount = true;
      }
    }

    if (!accountToUse) {
      console.log(`[executeSendEmail] ❌ No email account found`);
      console.log(`[executeSendEmail] ========================================`);
      return {
        success: false,
        error: `❌ **Aucun compte email configuré**\n\nPour que je puisse envoyer des emails en votre nom, vous devez d'abord configurer un compte email dans **Paramètres > Comptes Email**.\n\n(user_id vérifié: ${ctx.userId})`,
        execution_time_ms: Date.now() - start
      };
    }

    // Récupérer la signature de l'utilisateur
    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('email_signature, prenom, nom')
      .eq('id', ctx.userId)
      .single();

    // Helper: detect if content is already HTML
    const isHtml = (text: string): boolean => /<\/?(?:p|div|br|h[1-6]|ul|ol|li|strong|em|a|table|tr|td|th|span|img|hr)\b/i.test(text);

    // Helper: ensure content is HTML (don't escape if already HTML)
    const ensureHtml = (text: string): string => {
      if (isHtml(text)) return text;
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    };

    // Helper: add inline styles to HTML elements for email clients
    const addInlineStyles = (html: string): string => {
      return html
        .replace(/<h3(?:\s|>)/g, '<h3 style="color:#1a1a2e;font-size:18px;font-weight:600;margin:20px 0 10px 0" ')
        .replace(/<h2(?:\s|>)/g, '<h2 style="color:#1a1a2e;font-size:20px;font-weight:700;margin:24px 0 12px 0" ')
        .replace(/<p(?:\s|>)/g, '<p style="margin:0 0 12px 0;line-height:1.6;color:#333" ')
        .replace(/<ul(?:\s|>)/g, '<ul style="margin:8px 0 16px 0;padding-left:24px" ')
        .replace(/<ol(?:\s|>)/g, '<ol style="margin:8px 0 16px 0;padding-left:24px" ')
        .replace(/<li(?:\s|>)/g, '<li style="margin:4px 0;line-height:1.5;color:#333" ')
        .replace(/<strong(?:\s|>)/g, '<strong style="color:#1a1a2e" ')
        .replace(/<em(?:\s|>)/g, '<em style="color:#555" ')
        .replace(/<hr\s*\/?>/g, '<hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0">');
    };

    // Helper: wrap in professional email template
    const wrapInEmailTemplate = (bodyContent: string, signature?: string): string => {
      const sigBlock = signature 
        ? `<tr><td style="padding:24px 32px 32px 32px"><hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 16px 0">${signature}</td></tr>`
        : '';
      return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;border:1px solid #e4e4e7;max-width:600px;width:100%">
<tr><td style="padding:32px 32px 24px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#333333">
${bodyContent}
</td></tr>
${sigBlock}
</table>
</td></tr>
</table>
</body></html>`;
    };

    // Helper: décoder la signature HTML (peut être doublement échappée)
    const decodeSignature = (sig: string): string => {
      let decoded = sig.replace(/<pre><code>/gi, '').replace(/<\/code><\/pre>/gi, '');
      decoded = decoded
        .replace(/&amp;lt;/g, '<')
        .replace(/&amp;gt;/g, '>')
        .replace(/&amp;amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      return decoded.trim();
    };

    // Construire le body HTML avec signature et template
    const styledBody = addInlineStyles(ensureHtml(args.body));
    let emailBody: string;
    
    if (profile?.email_signature) {
      const cleanSignature = decodeSignature(profile.email_signature);
      emailBody = wrapInEmailTemplate(styledBody, cleanSignature);
    } else if (profile?.prenom || profile?.nom) {
      const fullName = [profile.prenom, profile.nom].filter(Boolean).join(' ');
      emailBody = wrapInEmailTemplate(styledBody, `--<br>${fullName}`);
    } else {
      emailBody = wrapInEmailTemplate(styledBody);
    }

    // PHASE 1 FIX: Utiliser HTTP fetch direct au lieu de functions.invoke
    // L'invocation functions.invoke depuis une Edge Function ne fonctionne pas de manière fiable
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    console.log(`[executeSendEmail] 🚀 Using HTTP fetch to send-email function...`);
    console.log(`[executeSendEmail] Target URL: ${supabaseUrl}/functions/v1/send-email`);

    const fetchPayload = {
      to: args.to,
      subject: args.subject || 'Message de Jarvis',
      html_body: emailBody,
      thread_id: args.thread_id,
      cc: args.cc,
      user_id: ctx.userId,  // profileId - correct pour send-email
      account_id: accountToUse.id  // TOUJOURS passer l'account_id pour éviter incohérence
    };

    console.log(`[executeSendEmail] Fetch payload:`, JSON.stringify({ 
      to: fetchPayload.to, 
      subject: fetchPayload.subject,
      user_id: fetchPayload.user_id,
      account_id: fetchPayload.account_id 
    }));

    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(fetchPayload)
    });

    console.log(`[executeSendEmail] Response status: ${response.status}`);
    
    const data = await response.json();
    console.log(`[executeSendEmail] Response body:`, JSON.stringify(data));
    console.log(`[executeSendEmail] ========================================`);

    if (!response.ok || data.error) {
      return {
        success: false,
        error: `❌ **Échec de l'envoi**\n\n${data.error || `HTTP ${response.status}`}`,
        execution_time_ms: Date.now() - start
      };
    }

    return {
      success: true,
      data: { 
        message: `Email envoyé avec succès${isSharedAccount ? ' (compte partagé)' : ''}`,
        to: args.to,
        subject: args.subject,
        from: accountToUse.email_address,
        message_id: data.message_id,
        ...data 
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send email';
    console.error('[executeSendEmail] EXCEPTION:', errorMessage);
    console.log(`[executeSendEmail] ========================================`);
    return {
      success: false,
      error: `❌ **Échec de l'envoi**\n\n${errorMessage}`,
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// TOOL: manage_memory (Persistent user context)
// ============================================================
export async function executeManageMemory(
  ctx: ToolExecutionContext,
  args: {
    action: 'add' | 'get' | 'list' | 'delete';
    category?: 'preference' | 'fact' | 'instruction' | 'context';
    key?: string;
    value?: string;
    importance?: number;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    switch (args.action) {
      case 'add': {
        if (!args.key || !args.value) {
          return {
            success: false,
            error: 'Les paramètres "key" et "value" sont requis pour ajouter une mémoire',
            execution_time_ms: Date.now() - start
          };
        }
        
        const { data, error } = await ctx.supabase
          .from('jarvis_user_memory')
          .upsert({
            user_id: ctx.userId,
            category: args.category || 'fact',
            key: args.key,
            value: args.value,
            importance: args.importance || 3,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,category,key' })
          .select()
          .single();
        
        if (error) throw error;
        
        return {
          success: true,
          data: { message: `Mémorisé: "${args.key}" = "${args.value}"`, memory: data },
          execution_time_ms: Date.now() - start
        };
      }
      
      case 'get': {
        if (!args.key) {
          return {
            success: false,
            error: 'Le paramètre "key" est requis pour récupérer une mémoire',
            execution_time_ms: Date.now() - start
          };
        }
        
        const { data, error } = await ctx.supabase
          .from('jarvis_user_memory')
          .select('*')
          .eq('user_id', ctx.userId)
          .eq('key', args.key)
          .single();
        
        if (error || !data) {
          return {
            success: true,
            data: { message: `Aucune mémoire trouvée pour la clé "${args.key}"`, found: false },
            execution_time_ms: Date.now() - start
          };
        }
        
        return {
          success: true,
          data: { memory: data, found: true },
          execution_time_ms: Date.now() - start
        };
      }
      
      case 'list': {
        let query = ctx.supabase
          .from('jarvis_user_memory')
          .select('*')
          .eq('user_id', ctx.userId)
          .order('importance', { ascending: false })
          .order('updated_at', { ascending: false });
        
        if (args.category) {
          query = query.eq('category', args.category);
        }
        
        const { data, error } = await query.limit(50);
        
        if (error) throw error;
        
        return {
          success: true,
          data: { 
            memories: data || [], 
            count: data?.length || 0,
            message: data?.length 
              ? `${data.length} mémoire(s) trouvée(s)` 
              : 'Aucune mémoire enregistrée'
          },
          execution_time_ms: Date.now() - start
        };
      }
      
      case 'delete': {
        if (!args.key) {
          return {
            success: false,
            error: 'Le paramètre "key" est requis pour supprimer une mémoire',
            execution_time_ms: Date.now() - start
          };
        }
        
        const { error } = await ctx.supabase
          .from('jarvis_user_memory')
          .delete()
          .eq('user_id', ctx.userId)
          .eq('key', args.key);
        
        if (error) throw error;
        
        return {
          success: true,
          data: { message: `Oublié: "${args.key}"` },
          execution_time_ms: Date.now() - start
        };
      }
      
      default:
        return {
          success: false,
          error: `Action inconnue: ${args.action}`,
          execution_time_ms: Date.now() - start
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la gestion de la mémoire',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// HELPER: Get or create default "Jarvis" category for tasks
// ============================================================
async function getDefaultCategorieId(supabase: SupabaseClient): Promise<string> {
  // Try to find existing "Jarvis" category
  const { data: existing } = await supabase
    .from('tache_categories')
    .select('id')
    .eq('nom', 'Jarvis')
    .limit(1)
    .single();
    
  if (existing?.id) return existing.id;
  
  // Create if not exists
  const { data: created } = await supabase
    .from('tache_categories')
    .insert({ nom: 'Jarvis', couleur: '#6366f1', description: 'Tâches créées par Jarvis' })
    .select('id')
    .single();
    
  if (created?.id) return created.id;
  
  // Fallback: get any existing category
  const { data: fallback } = await supabase
    .from('tache_categories')
    .select('id')
    .limit(1)
    .single();
    
  return fallback?.id || '00000000-0000-0000-0000-000000000000';
}

// ============================================================
// TOOL: create_task
// ============================================================
export async function executeCreateTask(
  ctx: ToolExecutionContext,
  args: {
    titre: string;
    description?: string;
    priorite?: string;
    etablissement_id?: string;
    assignee_id?: string;
    date_echeance?: string;
    categorie_id?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    // Get or create default category if not provided
    const categorieId = args.categorie_id || await getDefaultCategorieId(ctx.supabase);
    
    const { data, error } = await ctx.supabase
      .from('taches')
      .insert({
        titre: args.titre,
        description: args.description,
        priorite: args.priorite || 'moyenne',
        etablissement_id: args.etablissement_id,
        responsable_id: args.assignee_id || ctx.userId,
        echeance: args.date_echeance,
        statut: 'A faire',
        categorie_id: categorieId
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: { message: 'Tâche créée avec succès', task: data },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create task',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// TOOL: schedule_meeting — delegated to core-tools.ts (with fallback calendar)
// ============================================================
export const executeScheduleMeeting = executeScheduleMeetingCore;

// ============================================================
// TOOL: update_entity_status
// ============================================================
export async function executeUpdateEntityStatus(
  ctx: ToolExecutionContext,
  args: {
    entity_type: string;
    entity_id: string;
    new_status: string;
    note?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    const tableMap: Record<string, { table: string; statusColumn: string }> = {
      'etablissement': { table: 'etablissements', statusColumn: 'statut' },
      'tache': { table: 'taches', statusColumn: 'statut' },
      'ticket': { table: 'support_tickets', statusColumn: 'status' }
    };

    const config = tableMap[args.entity_type];
    if (!config) {
      throw new Error(`Unknown entity type: ${args.entity_type}`);
    }

    const { data, error } = await ctx.supabase
      .from(config.table)
      .update({ [config.statusColumn]: args.new_status })
      .eq('id', args.entity_id)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: { message: `Statut mis à jour: ${args.new_status}`, entity: data },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Update failed',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// TOOL: get_user_context
// ============================================================
export async function executeGetUserContext(
  ctx: ToolExecutionContext,
  args: {
    include_emails?: boolean;
    include_tasks?: boolean;
    include_calendar?: boolean;
    include_tickets?: boolean;
    days_back?: number;
  }
): Promise<ToolResult> {
  const start = Date.now();
  const context: Record<string, unknown> = {};
  const daysBack = args.days_back || 7;
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - daysBack);

  try {
    // Emails récents
    if (args.include_emails !== false) {
      const { data: threads } = await ctx.supabase
        .from('email_threads')
        .select('id, subject, ai_generated_title, category, last_message_date')
        .gte('last_message_date', dateFrom.toISOString())
        .order('last_message_date', { ascending: false })
        .limit(10);
      context.recent_emails = threads || [];
    }

    // Tâches en cours
    if (args.include_tasks !== false) {
      const { data: tasks } = await ctx.supabase
        .from('taches')
        .select('id, titre, priorite, statut, echeance')
        .in('statut', ['en_attente', 'en_cours'])
        .order('echeance', { ascending: true })
        .limit(15);
      context.pending_tasks = tasks || [];
    }

    // Événements à venir
    if (args.include_calendar !== false) {
      const now = new Date().toISOString();
      const weekLater = new Date();
      weekLater.setDate(weekLater.getDate() + 7);
      
      const { data: events } = await ctx.supabase
        .from('calendar_events')
        .select('id, title, start_time, end_time, location')
        .gte('start_time', now)
        .lte('start_time', weekLater.toISOString())
        .order('start_time', { ascending: true })
        .limit(10);
      context.upcoming_events = events || [];
    }

    // Tickets support
    if (args.include_tickets !== false) {
      const { data: tickets } = await ctx.supabase
        .from('support_tickets')
        .select('id, titre, priority, status, created_at')
        .in('status', ['open', 'in_progress'])
        .order('priority', { ascending: true })
        .limit(10);
      context.open_tickets = tickets || [];
    }

    // Profil utilisateur
    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('id, nom, prenom, email')
      .eq('id', ctx.userId)
      .single();
    context.user = profile;

    return {
      success: true,
      data: context,
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get context',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// TOOL: calculate_metrics
// ============================================================
export async function executeCalculateMetrics(
  ctx: ToolExecutionContext,
  args: {
    metric_type: string;
    filters?: {
      date_from?: string;
      date_to?: string;
      team_member_id?: string;
      etablissement_statut?: string;
    };
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    const result: Record<string, unknown> = { metric_type: args.metric_type };

    switch (args.metric_type) {
      case 'pipeline_value': {
        const { data } = await ctx.supabase
          .from('etablissements')
          .select('statut, ca_previsionnel')
          .in('statut', ['prospect', 'qualification', 'proposition', 'negociation']);
        
        const byStatus = (data || []).reduce((acc: Record<string, number>, e) => {
          acc[e.statut] = (acc[e.statut] || 0) + (e.ca_previsionnel || 0);
          return acc;
        }, {});
        
        result.pipeline = byStatus;
        result.total = Object.values(byStatus).reduce((a, b) => a + b, 0);
        break;
      }

      case 'task_completion': {
        const { count: totalCount } = await ctx.supabase
          .from('taches')
          .select('id', { count: 'exact', head: true });
        
        const { count: completedCount } = await ctx.supabase
          .from('taches')
          .select('id', { count: 'exact', head: true })
          .eq('statut', 'terminee');
        
        const totalNum = totalCount || 0;
        const completedNum = completedCount || 0;
        result.total = totalNum;
        result.completed = completedNum;
        result.rate = totalNum > 0 ? (completedNum / totalNum * 100).toFixed(1) + '%' : '0%';
        break;
      }

      case 'team_workload': {
        const { data: tasks } = await ctx.supabase
          .from('taches')
          .select('responsable_id, statut')
          .in('statut', ['en_attente', 'en_cours']);
        
        const workload = (tasks || []).reduce((acc: Record<string, number>, t) => {
          if (t.responsable_id) {
            acc[t.responsable_id] = (acc[t.responsable_id] || 0) + 1;
          }
          return acc;
        }, {});
        
        result.workload_by_user = workload;
        result.total_pending = tasks?.length || 0;
        break;
      }

      default:
        result.message = `Metric type '${args.metric_type}' calculation pending implementation`;
    }

    return {
      success: true,
      data: result,
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Metric calculation failed',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// TOOL: generate_document
// ============================================================
export async function executeGenerateDocument(
  ctx: ToolExecutionContext,
  args: {
    document_type: string;
    context: string;
    format?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  // Pour la génération de documents, on retourne le contexte enrichi
  // Le contenu sera généré par GPT-5 dans le flux principal
  return {
    success: true,
    data: {
      document_type: args.document_type,
      context: args.context,
      format: args.format || 'markdown',
      message: `Document de type '${args.document_type}' préparé pour génération`
    },
    execution_time_ms: Date.now() - start
  };
}

// ============================================================
// TOOL: create_reminder
// ============================================================
export async function executeCreateReminder(
  ctx: ToolExecutionContext,
  args: {
    message: string;
    remind_at: string;
    related_entity_type?: string;
    related_entity_id?: string;
    priority?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    // Get default category for reminders
    const categorieId = await getDefaultCategorieId(ctx.supabase);
    
    // Créer une tâche de type rappel
    const { data, error } = await ctx.supabase
      .from('taches')
      .insert({
        titre: `🔔 Rappel: ${args.message.substring(0, 50)}`,
        description: args.message,
        priorite: args.priority || 'moyenne',
        echeance: args.remind_at,
        etablissement_id: args.related_entity_type === 'etablissement' ? args.related_entity_id : null,
        statut: 'en_attente',
        responsable_id: ctx.userId,
        categorie_id: categorieId
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: { message: 'Rappel créé avec succès', reminder: data },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create reminder',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// TOOL: execute_edge_function (Generic)
// ============================================================
export async function executeEdgeFunction(
  ctx: ToolExecutionContext,
  args: { function_name: string; payload: Record<string, unknown> }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    const { data, error } = await ctx.supabase.functions.invoke(args.function_name, {
      body: { ...args.payload, user_id: ctx.userId }
    });

    if (error) throw error;

    return {
      success: true,
      data,
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : `Failed to execute ${args.function_name}`,
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// Master executor function (JARVIS 10.5 - 90+ tools with timeouts)
// ============================================================
export async function executeTool(
  ctx: ToolExecutionContext,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const startTime = Date.now();
  console.log(`[JARVIS 10.5] Executing tool: ${toolName}`, JSON.stringify(args).substring(0, 200));

  // Check if tool is available (health-based)
  const availability = isToolAvailable(toolName);
  if (!availability.available) {
    console.warn(`[JARVIS 10.5] Tool ${toolName} is disabled: ${availability.reason}`);
    return {
      success: false,
      error: `Outil temporairement indisponible: ${availability.reason}`,
      execution_time_ms: Date.now() - startTime
    };
  }

  // Validate permissions first - use authUserId for role lookup (user_roles.user_id references auth.users.id)
  const validation = await validateToolPermission(ctx.supabase, ctx.authUserId || ctx.userId, toolName);
  if (!validation.allowed) {
    return {
      success: false,
      error: validation.reason || 'Permission denied',
      execution_time_ms: Date.now() - startTime
    };
  }

  const toolContext = { supabase: ctx.supabase, userId: ctx.userId };
  const timeout = getToolTimeout(toolName);

  try {
    // Execute with timeout wrapper
    const result = await executeWithTimeout(
      () => executeToolInternal(ctx, toolContext, toolName, args),
      timeout,
      toolName
    );

    // Record successful execution
    recordToolExecution(toolName, true, Date.now() - startTime);
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const executionTime = Date.now() - startTime;
    
    // Record failed execution
    recordToolExecution(toolName, false, executionTime, errorMessage);
    
    console.error(`[JARVIS 10.5] Tool ${toolName} failed after ${executionTime}ms:`, errorMessage);
    
    // Auto-report critical failures (non-blocking)
    if (!errorMessage.includes('timeout') && !errorMessage.includes('Permission')) {
      autoReportFailure(ctx, toolName, errorMessage, args).catch(() => {});
    }

    return {
      success: false,
      error: errorMessage,
      execution_time_ms: executionTime
    };
  }
}

// Timeout wrapper function
async function executeWithTimeout<T>(
  executor: () => Promise<T>,
  timeoutMs: number,
  toolName: string
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await Promise.race([
      executor(),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error(`Tool ${toolName} timed out after ${timeoutMs}ms`));
        });
      })
    ]);
    
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Internal tool execution (no timeout, called by wrapper)
async function executeToolInternal(
  ctx: ToolExecutionContext,
  toolContext: { supabase: typeof ctx.supabase; userId: string },
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const startTime = Date.now();
  
  switch (toolName) {
    // === CORE TOOLS ===
    case 'query_database':
      return executeQueryDatabase(ctx, args as Parameters<typeof executeQueryDatabase>[1]);
    case 'send_email':
      return executeSendEmail(ctx, args as Parameters<typeof executeSendEmail>[1]);
    case 'create_task':
      return executeCreateTask(ctx, args as Parameters<typeof executeCreateTask>[1]);
    case 'schedule_meeting':
      return executeScheduleMeeting(ctx, args as Parameters<typeof executeScheduleMeeting>[1]);
    case 'search_knowledge_base':
      return executeSearchKBSemantic(ctx, args as Parameters<typeof executeSearchKBSemantic>[1]);
    case 'search_documents':
      return executeSearchDocumentsRAG(ctx, args as Parameters<typeof executeSearchDocumentsRAG>[1]);
    case 'index_document':
      return executeIndexDocument(ctx, args as Parameters<typeof executeIndexDocument>[1]);
    case 'update_entity_status':
      return executeUpdateEntityStatus(ctx, args as Parameters<typeof executeUpdateEntityStatus>[1]);
    case 'get_user_context':
      return executeGetUserContext(ctx, args as Parameters<typeof executeGetUserContext>[1]);
    case 'calculate_metrics':
      return executeCalculateMetrics(ctx, args as Parameters<typeof executeCalculateMetrics>[1]);
    case 'generate_document':
      return executeGenerateDocumentLocal(ctx, args as Parameters<typeof executeGenerateDocumentLocal>[1]);
    case 'create_reminder':
      return executeCreateReminder(ctx, args as Parameters<typeof executeCreateReminder>[1]);
    case 'execute_edge_function':
      return executeEdgeFunction(ctx, args as Parameters<typeof executeEdgeFunction>[1]);

    // === TREASURY TOOLS ===
    case 'sync_qonto_transactions':
      return executeSyncQontoTransactions(toolContext, args as Parameters<typeof executeSyncQontoTransactions>[1]);
    case 'get_bank_balance':
      return executeGetBankBalance(toolContext);
    case 'create_invoice':
      return executeCreateInvoice(toolContext, args as Parameters<typeof executeCreateInvoice>[1]);
    case 'forecast_cashflow':
      return executeForecastCashflow(toolContext, args as Parameters<typeof executeForecastCashflow>[1]);
    case 'manage_expense':
      return executeManageExpense(toolContext, args as Parameters<typeof executeManageExpense>[1]);

    // === HR TOOLS ===
    case 'parse_payslip':
      return executeParsePayslip(toolContext, args as Parameters<typeof executeParsePayslip>[1]);
    case 'manage_absence':
      return executeManageAbsence(toolContext, args as Parameters<typeof executeManageAbsence>[1]);
    case 'calculate_payroll_kpis':
      return executeCalculatePayrollKpis(toolContext, args as Parameters<typeof executeCalculatePayrollKpis>[1]);
    case 'recommend_training':
      return executeRecommendTraining(toolContext, args as Parameters<typeof executeRecommendTraining>[1]);
    case 'get_employee_competences':
      return executeGetEmployeeCompetences(toolContext, args as Parameters<typeof executeGetEmployeeCompetences>[1]);

    // === R&D AGILE TOOLS ===
    case 'manage_epic':
      return executeManageEpic(toolContext, args as Parameters<typeof executeManageEpic>[1]);
    case 'manage_user_story':
      return executeManageUserStory(toolContext, args as Parameters<typeof executeManageUserStory>[1]);
    case 'manage_sprint':
      return executeManageSprint(toolContext, args as Parameters<typeof executeManageSprint>[1]);
    case 'move_story_to_sprint':
      return executeMoveStoryToSprint(toolContext, args as Parameters<typeof executeMoveStoryToSprint>[1]);
    case 'calculate_rd_metrics':
      return executeCalculateRdMetrics(toolContext, args as Parameters<typeof executeCalculateRdMetrics>[1]);
    case 'ai_assist_story':
      return executeAiAssistStory(toolContext, args as Parameters<typeof executeAiAssistStory>[1]);

    // === SUPPORT TOOLS ===
    case 'create_support_ticket':
      return executeCreateSupportTicket(toolContext, args as Parameters<typeof executeCreateSupportTicket>[1]);
    case 'update_ticket_status':
      return executeUpdateTicketStatus(toolContext, args as Parameters<typeof executeUpdateTicketStatus>[1]);
    case 'assign_ticket':
      return executeAssignTicket(toolContext, args as Parameters<typeof executeAssignTicket>[1]);
    case 'get_support_kpis':
      return executeGetSupportKpis(toolContext, args as Parameters<typeof executeGetSupportKpis>[1]);

    // === RECRUITMENT TOOLS ===
    case 'manage_job_offer':
      return executeManageJobOffer(toolContext, args as Parameters<typeof executeManageJobOffer>[1]);
    case 'manage_candidate':
      return executeManageCandidate(toolContext, args as Parameters<typeof executeManageCandidate>[1]);
    case 'schedule_interview':
      return executeScheduleInterview(toolContext, args as Parameters<typeof executeScheduleInterview>[1]);
    case 'evaluate_candidate':
      return executeEvaluateCandidate(toolContext, args as Parameters<typeof executeEvaluateCandidate>[1]);
    case 'parse_cv':
      return executeParseCV(toolContext, args as Parameters<typeof executeParseCV>[1]);

    // === COMMUNICATION TOOLS ===
    case 'translate_email':
      return executeTranslateEmail(toolContext, args as Parameters<typeof executeTranslateEmail>[1]);
    case 'correct_email':
      return executeCorrectEmail(toolContext, args as Parameters<typeof executeCorrectEmail>[1]);
    case 'reformulate_email':
      return executeReformulateEmail(toolContext, args as Parameters<typeof executeReformulateEmail>[1]);
    case 'suggest_email_response':
      return executeSuggestEmailResponse(toolContext, args as Parameters<typeof executeSuggestEmailResponse>[1]);
    case 'create_email_template':
      return executeCreateEmailTemplate(toolContext, args as Parameters<typeof executeCreateEmailTemplate>[1]);

    // === CALENDAR TOOLS ===
    case 'get_my_calendar':
      return executeGetMyCalendar(toolContext, args as Parameters<typeof executeGetMyCalendar>[1]);
    case 'create_recurring_event':
      return executeCreateRecurringEvent(toolContext, args as Parameters<typeof executeCreateRecurringEvent>[1]);
    case 'detect_calendar_conflicts':
      return executeDetectCalendarConflicts(toolContext, args as Parameters<typeof executeDetectCalendarConflicts>[1]);
    case 'import_ics_calendar':
      return executeImportIcsCalendar(toolContext, args as Parameters<typeof executeImportIcsCalendar>[1]);
    case 'sync_external_calendar':
      return executeSyncExternalCalendar(toolContext, args as Parameters<typeof executeSyncExternalCalendar>[1]);

    // === TRAINING TOOLS ===
    case 'create_training_session':
      return executeCreateTrainingSession(toolContext, args as Parameters<typeof executeCreateTrainingSession>[1]);
    case 'register_attendance':
      return executeRegisterAttendance(toolContext, args as Parameters<typeof executeRegisterAttendance>[1]);
    case 'get_session_attendance':
      return executeGetSessionAttendance(toolContext, args as Parameters<typeof executeGetSessionAttendance>[1]);
    case 'get_training_analytics':
      return executeGetTrainingAnalytics(toolContext, args as Parameters<typeof executeGetTrainingAnalytics>[1]);
    case 'manage_certification':
      return executeManageCertification(toolContext, args as Parameters<typeof executeManageCertification>[1]);

    // === CONTRACTS TOOLS ===
    case 'generate_contract':
      return executeGenerateContract(toolContext, args as Parameters<typeof executeGenerateContract>[1]);
    case 'ai_assist_contract':
      return executeAiAssistContract(toolContext, args as Parameters<typeof executeAiAssistContract>[1]);
    case 'request_signature':
      return executeRequestSignature(toolContext, args as Parameters<typeof executeRequestSignature>[1]);
    case 'manage_contract_template':
      return executeManageContractTemplate(toolContext, args as Parameters<typeof executeManageContractTemplate>[1]);
    case 'manage_document':
      return executeManageDocument(toolContext, args as Parameters<typeof executeManageDocument>[1]);

    // === ADMIN TOOLS ===
    case 'manage_user':
      return executeManageUser(toolContext, args as Parameters<typeof executeManageUser>[1]);
    case 'manage_user_role':
      return executeManageUserRole(toolContext, args as Parameters<typeof executeManageUserRole>[1]);
    case 'get_system_logs':
      return executeGetSystemLogs(toolContext, args as Parameters<typeof executeGetSystemLogs>[1]);
    case 'export_data_rgpd':
      return executeExportDataRgpd(toolContext, args as Parameters<typeof executeExportDataRgpd>[1]);
    case 'get_ai_usage_stats':
      return executeGetAiUsageStats(toolContext, args as Parameters<typeof executeGetAiUsageStats>[1]);

    // === ANALYTICS & INSIGHTS TOOLS ===
    case 'get_dashboard_summary':
      return executeGetDashboardSummary(toolContext, args as Parameters<typeof executeGetDashboardSummary>[1]);
    case 'get_daily_digest':
      return executeGetDailyDigest(toolContext, args as Parameters<typeof executeGetDailyDigest>[1]);
    case 'get_performance_report':
      return executeGetPerformanceReport(toolContext, args as Parameters<typeof executeGetPerformanceReport>[1]);
    case 'analyze_trends':
      return executeAnalyzeTrends(toolContext, args as Parameters<typeof executeAnalyzeTrends>[1]);
    case 'get_smart_suggestions':
      return executeGetSmartSuggestions(toolContext, args as Parameters<typeof executeGetSmartSuggestions>[1]);
    case 'compare_periods':
      return executeComparePeriods(toolContext, args as Parameters<typeof executeComparePeriods>[1]);

    // === BATCH OPERATIONS TOOLS ===
    case 'batch_update_tasks':
      return executeBatchUpdateTasks(toolContext, args as Parameters<typeof executeBatchUpdateTasks>[1]);
    case 'batch_send_emails':
      return executeBatchSendEmails(toolContext, args as Parameters<typeof executeBatchSendEmails>[1]);
    case 'batch_create_tasks':
      return executeBatchCreateTasks(toolContext, args as Parameters<typeof executeBatchCreateTasks>[1]);
    case 'batch_assign_tasks':
      return executeBatchAssignTasks(toolContext, args as Parameters<typeof executeBatchAssignTasks>[1]);
    case 'batch_close_tickets':
      return executeBatchCloseTickets(toolContext, args as Parameters<typeof executeBatchCloseTickets>[1]);
    case 'bulk_email_classification':
      return executeBulkEmailClassification(toolContext, args as Parameters<typeof executeBulkEmailClassification>[1]);
    case 'export_data':
      return executeExportData(toolContext, args as Parameters<typeof executeExportData>[1]);
    case 'cleanup_old_data':
      return executeCleanupOldData(toolContext, args as Parameters<typeof executeCleanupOldData>[1]);

    // === JARVIS SELF-REPORTING ===
    case 'report_jarvis_issue':
      return executeReportJarvisIssue(ctx, args as Parameters<typeof executeReportJarvisIssue>[1]);

    // === NOTIFICATION & PROACTIVE TOOLS ===
    case 'send_notification':
      return executeSendNotification(toolContext, args as Parameters<typeof executeSendNotification>[1]);
    case 'get_notifications':
      return executeGetNotifications(toolContext, args as Parameters<typeof executeGetNotifications>[1]);
    case 'mark_notifications_read':
      return executeMarkNotificationsRead(toolContext, args as Parameters<typeof executeMarkNotificationsRead>[1]);
    case 'auto_followup_check':
      return executeAutoFollowupCheck(toolContext, args as Parameters<typeof executeAutoFollowupCheck>[1]);
    case 'get_team_availability':
      return executeGetTeamAvailability(toolContext, args as Parameters<typeof executeGetTeamAvailability>[1]);
    case 'create_workflow':
      return executeCreateWorkflow(toolContext, args as Parameters<typeof executeCreateWorkflow>[1]);

    // === WEB SEARCH TOOLS (NEW) ===
    case 'web_search':
      return executeWebSearch(toolContext, args as Parameters<typeof executeWebSearch>[1]);

    // === CRM MANAGEMENT TOOLS (NEW) ===
    case 'manage_etablissement':
      return executeManageEtablissement(toolContext, args as Parameters<typeof executeManageEtablissement>[1]);
    case 'manage_contact':
      return executeManageContact(toolContext, args as Parameters<typeof executeManageContact>[1]);
    case 'manage_groupe':
      return executeManageGroupe(toolContext, args as Parameters<typeof executeManageGroupe>[1]);
    case 'manage_partenaire':
      return executeManagePartenaire(toolContext, args as Parameters<typeof executeManagePartenaire>[1]);

    // === DOCUMENT AI TOOLS (NEW) ===
    case 'summarize_content':
      return executeSummarizeContent(toolContext, args as Parameters<typeof executeSummarizeContent>[1]);
    case 'analyze_with_ai':
      return executeAnalyzeWithAI(toolContext, args as Parameters<typeof executeAnalyzeWithAI>[1]);
    case 'extract_data':
      return executeExtractData(toolContext, args as Parameters<typeof executeExtractData>[1]);

    // === UTILITY TOOLS (NEW) ===
    case 'get_weather':
      return executeGetWeather(toolContext, args as Parameters<typeof executeGetWeather>[1]);
    case 'calculate_date':
      return executeCalculateDate(toolContext, args as Parameters<typeof executeCalculateDate>[1]);
    case 'convert_units':
      return executeConvertUnits(toolContext, args as Parameters<typeof executeConvertUnits>[1]);

    // === REPORTING & EXPORT TOOLS (NEW PHASE 2) ===
    case 'generate_report':
      return executeGenerateReport(toolContext, args as unknown as Parameters<typeof executeGenerateReport>[1]);
    case 'export_to_excel':
      return executeExportToExcel(toolContext, args as unknown as Parameters<typeof executeExportToExcel>[1]);
    case 'create_dashboard_snapshot':
      return executeCreateDashboardSnapshot(toolContext, args as unknown as Parameters<typeof executeCreateDashboardSnapshot>[1]);
    case 'schedule_report':
      return executeScheduleReport(toolContext, args as Parameters<typeof executeScheduleReport>[1]);

    // === AUTOMATION & WORKFLOW TOOLS (NEW PHASE 2) ===
    // NOTE: create_reminder is handled above at line 765
    case 'create_automation_rule':
      return executeCreateAutomationRule(toolContext, args as Parameters<typeof executeCreateAutomationRule>[1]);
    case 'list_automation_rules':
      return executeListAutomationRules(toolContext, args as Parameters<typeof executeListAutomationRules>[1]);
    case 'toggle_automation_rule':
      return executeToggleAutomationRule(toolContext, args as Parameters<typeof executeToggleAutomationRule>[1]);
    case 'create_scheduled_task':
      return executeCreateScheduledTask(toolContext, args as Parameters<typeof executeCreateScheduledTask>[1]);
    case 'get_automation_stats':
      return executeGetAutomationStats(toolContext, args as Parameters<typeof executeGetAutomationStats>[1]);

    // === FILE MANAGEMENT TOOLS (NEW PHASE 2) ===
    case 'list_files':
      return executeListFiles(toolContext, args as Parameters<typeof executeListFiles>[1]);
    case 'get_file_url':
      return executeGetFileUrl(toolContext, args as Parameters<typeof executeGetFileUrl>[1]);
    case 'move_file':
      return executeMoveFile(toolContext, args as Parameters<typeof executeMoveFile>[1]);
    case 'copy_file':
      return executeCopyFile(toolContext, args as Parameters<typeof executeCopyFile>[1]);
    case 'delete_file':
      return executeDeleteFile(toolContext, args as Parameters<typeof executeDeleteFile>[1]);
    case 'search_files_storage':
      return executeSearchDocumentsFiles(toolContext, args as Parameters<typeof executeSearchDocumentsFiles>[1]);
    case 'get_storage_stats':
      return executeGetStorageStats(toolContext, args as Parameters<typeof executeGetStorageStats>[1]);
    case 'create_folder':
      return executeCreateFolder(toolContext, args as Parameters<typeof executeCreateFolder>[1]);

    // === ADVANCED ANALYTICS TOOLS (NEW PHASE 2) ===
    case 'predict_trend':
      return executePredictTrend(toolContext, args as Parameters<typeof executePredictTrend>[1]);
    case 'detect_anomalies':
      return executeDetectAnomalies(toolContext, args as Parameters<typeof executeDetectAnomalies>[1]);
    case 'correlation_analysis':
      return executeCorrelationAnalysis(toolContext, args as Parameters<typeof executeCorrelationAnalysis>[1]);
    case 'get_performance_score':
      return executeGetPerformanceScore(toolContext, args as Parameters<typeof executeGetPerformanceScore>[1]);

    // === MEMORY TOOLS (NEW - Persistent user context) ===
    case 'manage_memory':
      return executeManageMemory(ctx, args as Parameters<typeof executeManageMemory>[1]);

    // === WORKFLOW TOOLS (NEW - Automated processes) ===
    case 'execute_workflow':
      return executeWorkflow(toolContext, args as Parameters<typeof executeWorkflow>[1]);
    case 'list_workflows':
      return listAvailableWorkflows(toolContext, args as Parameters<typeof listAvailableWorkflows>[1]);
    case 'get_workflow_history':
      return getWorkflowHistory(toolContext, args as Parameters<typeof getWorkflowHistory>[1]);

    // === OBJECTIVES TOOLS (JARVIS 11.0 - Goal-driven orchestration) ===
    case 'create_objective': {
      const objectiveArgs = args as unknown as ObjectiveInput;
      const result = await createObjective(ctx.userId, objectiveArgs);
      return {
        success: result.success,
        data: result.objective,
        error: result.error,
        execution_time_ms: Date.now() - startTime
      };
    }
    case 'update_objective_progress': {
      const result = await updateObjectiveProgress(
        ctx.userId,
        args.objective_id as string,
        args.new_value as number,
        args.note as string | undefined
      );
      return {
        success: result.success,
        data: result.objective,
        error: result.error,
        execution_time_ms: Date.now() - startTime
      };
    }
    case 'list_objectives': {
      const result = await listObjectives(ctx.userId, args.status as string | undefined);
      return {
        success: result.success,
        data: result.objectives,
        error: result.error,
        execution_time_ms: Date.now() - startTime
      };
    }
    case 'analyze_objectives': {
      const result = await analyzeObjectivesProgress(ctx.userId);
      return {
        success: result.success,
        data: result.summary,
        error: result.error,
        execution_time_ms: Date.now() - startTime
      };
    }

    // === INTELLIGENCE TOOLS (JARVIS 13.0) ===
    case 'generate_briefing':
      return executeGenerateBriefing(ctx, args as Parameters<typeof executeGenerateBriefing>[1]);
    case 'compare_analysis':
      return executeCompareAnalysis(ctx, args as Parameters<typeof executeCompareAnalysis>[1]);
    case 'suggest_actions':
      return executeSuggestActions(ctx, args as Parameters<typeof executeSuggestActions>[1]);
    case 'bulk_action':
      return executeBulkAction(ctx, args as Parameters<typeof executeBulkAction>[1]);

    // === WEB TOOLS (Native, No External API) ===
    case 'web_scrape':
      return executeWebScrape(ctx, args as Parameters<typeof executeWebScrape>[1]);
    case 'web_search':
      // Utiliser la version gratuite native (DuckDuckGo)
      return executeWebSearchFree(ctx, args as Parameters<typeof executeWebSearchFree>[1]);

    // === TASK MANAGEMENT TOOLS ===
    case 'update_task':
      return executeUpdateTask(toolContext, args as Parameters<typeof executeUpdateTask>[1]);
    case 'delete_task':
      return executeDeleteTask(toolContext, args as Parameters<typeof executeDeleteTask>[1]);
    case 'manage_subtask':
      return executeManageSubtask(toolContext, args as Parameters<typeof executeManageSubtask>[1]);
    case 'log_time_entry':
      return executeLogTimeEntry(toolContext, args as Parameters<typeof executeLogTimeEntry>[1]);
    case 'manage_task_recurrence':
      return executeManageTaskRecurrence(toolContext, args as Parameters<typeof executeManageTaskRecurrence>[1]);

    // === DEVIS TOOLS ===
    case 'manage_devis':
      return executeManageDevis(toolContext, args as Parameters<typeof executeManageDevis>[1]);
    case 'add_devis_ligne':
      return executeAddDevisLigne(toolContext, args as Parameters<typeof executeAddDevisLigne>[1]);
    case 'convert_devis_to_invoice':
      return executeConvertDevisToInvoice(toolContext, args as Parameters<typeof executeConvertDevisToInvoice>[1]);

    // === FORUM TOOLS ===
    case 'manage_forum_post':
      return executeManageForumPost(toolContext, args as Parameters<typeof executeManageForumPost>[1]);
    case 'manage_forum_comment':
      return executeManageForumComment(toolContext, args as Parameters<typeof executeManageForumComment>[1]);
    case 'vote_forum_post':
      return executeVoteForumPost(toolContext, args as Parameters<typeof executeVoteForumPost>[1]);
    case 'bookmark_forum_post':
      return executeBookmarkForumPost(toolContext, args as Parameters<typeof executeBookmarkForumPost>[1]);

    // === CSM TOOLS ===
    case 'get_csm_health_score':
      return executeGetCsmHealthScore(toolContext, args as Parameters<typeof executeGetCsmHealthScore>[1]);
    case 'get_csm_kpis':
      return executeGetCsmKpis(toolContext, args as Parameters<typeof executeGetCsmKpis>[1]);
    case 'manage_csm_milestone':
      return executeManageCsmMilestone(toolContext, args as Parameters<typeof executeManageCsmMilestone>[1]);
    case 'get_churn_predictions':
      return executeGetChurnPredictions(toolContext, args as Parameters<typeof executeGetChurnPredictions>[1]);
    case 'manage_csm_billing_followup':
      return executeManageCsmBillingFollowup(toolContext, args as Parameters<typeof executeManageCsmBillingFollowup>[1]);

    // === CALENDAR MANAGEMENT TOOLS ===
    case 'update_calendar_event':
      return executeUpdateCalendarEvent(toolContext, args as Parameters<typeof executeUpdateCalendarEvent>[1]);
    case 'delete_calendar_event':
      return executeDeleteCalendarEvent(toolContext, args as Parameters<typeof executeDeleteCalendarEvent>[1]);
    case 'manage_event_attendees':
      return executeManageEventAttendees(toolContext, args as Parameters<typeof executeManageEventAttendees>[1]);
    case 'manage_event_reminder':
      return executeManageEventReminder(toolContext, args as Parameters<typeof executeManageEventReminder>[1]);
    case 'manage_booking':
      return executeManageBooking(toolContext, args as Parameters<typeof executeManageBooking>[1]);

    // === AVOIR TOOLS ===
    case 'manage_avoir':
      return executeManageAvoir(toolContext, args as Parameters<typeof executeManageAvoir>[1]);
    case 'add_avoir_ligne':
      return executeAddAvoirLigne(toolContext, args as Parameters<typeof executeAddAvoirLigne>[1]);

    // === EMAIL MANAGEMENT TOOLS ===
    case 'manage_email_draft':
      return executeManageEmailDraft(toolContext, args as Parameters<typeof executeManageEmailDraft>[1]);
    case 'manage_email_filter':
      return executeManageEmailFilter(toolContext, args as Parameters<typeof executeManageEmailFilter>[1]);
    case 'manage_email_thread':
      return executeManageEmailThread(toolContext, args as Parameters<typeof executeManageEmailThread>[1]);
    case 'classify_email_thread':
      return executeClassifyEmailThread(toolContext, args as Parameters<typeof executeClassifyEmailThread>[1]);

    // === TRESORERIE MANAGEMENT TOOLS ===
    case 'manage_revenue':
      return executeManageRevenue(toolContext, args as Parameters<typeof executeManageRevenue>[1]);
    case 'manage_budget':
      return executeManageBudget(toolContext, args as Parameters<typeof executeManageBudget>[1]);
    case 'get_tresorerie_summary':
      return executeGetTresorerieSummary(toolContext);

    // === INVOICE MANAGEMENT TOOLS ===
    case 'manage_invoice':
      return executeManageInvoice(toolContext, args as Parameters<typeof executeManageInvoice>[1]);

    // === PEOPLE / HR DOSSIER TOOLS ===
    case 'get_employee_dossier':
      return executeGetEmployeeDossier(toolContext, args as Parameters<typeof executeGetEmployeeDossier>[1]);
    case 'update_profile':
      return executeUpdateProfile(toolContext, args as Parameters<typeof executeUpdateProfile>[1]);

    // === R&D EXTENDED TOOLS ===
    case 'manage_rd_comment':
      return executeManageRdComment(toolContext, args as Parameters<typeof executeManageRdComment>[1]);
    case 'manage_rd_label':
      return executeManageRdLabel(toolContext, args as Parameters<typeof executeManageRdLabel>[1]);

    // === CONTRACTS EXTENDED TOOLS ===
    case 'manage_contrat_avenant':
      return executeManageContratAvenant(toolContext, args as Parameters<typeof executeManageContratAvenant>[1]);
    case 'get_contrat_alerts':
      return executeGetContratAlerts(toolContext, args as Parameters<typeof executeGetContratAlerts>[1]);

    // === RECRUITMENT EXTENDED TOOLS ===
    case 'get_candidate_history':
      return executeGetCandidateHistory(toolContext, args as Parameters<typeof executeGetCandidateHistory>[1]);

    // === TRAINING EXTENDED TOOLS ===
    case 'send_satisfaction_survey':
      return executeSendSatisfactionSurvey(toolContext, args as Parameters<typeof executeSendSatisfactionSurvey>[1]);
    case 'get_satisfaction_results':
      return executeGetSatisfactionResults(toolContext, args as Parameters<typeof executeGetSatisfactionResults>[1]);

    // === PULSE TOOLS ===
    case 'send_pulse_message':
      return executeSendPulseMessage(toolContext, args as Parameters<typeof executeSendPulseMessage>[1]);
    case 'create_pulse_conversation':
      return executeCreatePulseConversation(toolContext, args as Parameters<typeof executeCreatePulseConversation>[1]);
    case 'list_pulse_conversations':
      return executeListPulseConversations(toolContext, args as Parameters<typeof executeListPulseConversations>[1]);
    case 'search_pulse_messages':
      return executeSearchPulseMessages(toolContext, args as Parameters<typeof executeSearchPulseMessages>[1]);

    // === PROSPECT SCORING ===
    case 'score_prospects':
      return executeScoreProspects(toolContext, args as Parameters<typeof executeScoreProspects>[1]);

    // === EMAIL ANALYTICS ===
    case 'analyze_sender_emails':
      return executeAnalyzeSenderEmails(toolContext, args as Parameters<typeof executeAnalyzeSenderEmails>[1]);

    // === AUTOMATION / WORKFLOW BUILDER (P6) ===
    case 'list_workflows_v2':
      return executeListWorkflows(toolContext, args as Parameters<typeof executeListWorkflows>[1]);
    case 'get_workflow_runs':
      return executeGetWorkflowRuns(toolContext, args as Parameters<typeof executeGetWorkflowRuns>[1]);
    case 'create_workflow_from_prompt':
      return executeCreateWorkflowFromPrompt(toolContext, args as Parameters<typeof executeCreateWorkflowFromPrompt>[1]);
    case 'toggle_workflow':
      return executeToggleWorkflow(toolContext, args as Parameters<typeof executeToggleWorkflow>[1]);
    case 'run_workflow_now':
      return executeRunWorkflowNow(toolContext, args as Parameters<typeof executeRunWorkflowNow>[1]);

    // === CATALOGUE PRODUITS ===
    case 'list_catalogue_produits':
      return executeListCatalogueProduits(toolContext, args as Parameters<typeof executeListCatalogueProduits>[1]);
    case 'get_catalogue_stats':
      return executeGetCatalogueStats(toolContext, args as Parameters<typeof executeGetCatalogueStats>[1]);
    case 'manage_catalogue_produit':
      return executeManageCatalogueProduit(toolContext, args as Parameters<typeof executeManageCatalogueProduit>[1]);

    // === CUSTOM REPORTS ===
    case 'list_custom_reports':
      return executeListCustomReports(toolContext, args as Parameters<typeof executeListCustomReports>[1]);
    case 'run_custom_report':
      return executeRunCustomReport(toolContext, args as Parameters<typeof executeRunCustomReport>[1]);
    case 'export_custom_report':
      return executeExportCustomReport(toolContext, args as Parameters<typeof executeExportCustomReport>[1]);

    // === ACTIVITY FEED ===
    case 'get_activity_feed':
      return executeGetActivityFeed(toolContext, args as Parameters<typeof executeGetActivityFeed>[1]);
    case 'pin_activity_event':
      return executePinActivityEvent(toolContext, args as Parameters<typeof executePinActivityEvent>[1]);

    // === CHURN PREDICTOR (extended) ===
    case 'get_churn_risk_accounts':
      return executeGetChurnPredictionsList(toolContext, args as Parameters<typeof executeGetChurnPredictionsList>[1]);
    case 'recompute_churn_risk':
      return executeRecomputeChurnPredictions(toolContext, args as Parameters<typeof executeRecomputeChurnPredictions>[1]);
    case 'get_churn_account_detail':
      return executeGetChurnAccountDetail(toolContext, args as Parameters<typeof executeGetChurnAccountDetail>[1]);

    // === SALES FORECASTING ===
    case 'get_sales_forecast':
      return executeGetSalesForecast(toolContext, args as Parameters<typeof executeGetSalesForecast>[1]);
    case 'compare_forecast_vs_actual':
      return executeCompareForecastVsActual(toolContext, args as Parameters<typeof executeCompareForecastVsActual>[1]);

    // === SIGNATURES (DocuSeal) ===
    case 'list_signature_requests':
      return executeListSignatureRequests(toolContext, args as Parameters<typeof executeListSignatureRequests>[1]);
    case 'remind_signature':
      return executeRemindSignature(toolContext, args as Parameters<typeof executeRemindSignature>[1]);
    case 'cancel_signature':
      return executeCancelSignature(toolContext, args as Parameters<typeof executeCancelSignature>[1]);

    // === ATTRIBUTION (Scoring v2) ===
    case 'get_attribution_analysis':
      return executeGetAttributionAnalysis(toolContext, args as Parameters<typeof executeGetAttributionAnalysis>[1]);


    default:
      return {
        success: false,
        error: `Unknown tool: ${toolName}. Available tools: query_database, send_email, create_task, update_task, manage_devis, manage_forum_post, get_csm_health_score, manage_booking, manage_avoir, manage_email_draft, manage_revenue, etc. (135+ outils)`,
        execution_time_ms: 0
      };
  }
}

// Rename local generate_document to avoid conflict
const executeGenerateDocumentLocal = executeGenerateDocument_internal;

function executeGenerateDocument_internal(
  ctx: ToolExecutionContext,
  args: { document_type: string; context: string; format?: string }
): ToolResult {
  return {
    success: true,
    data: {
      document_type: args.document_type,
      context: args.context,
      format: args.format || 'markdown',
      message: `Document de type '${args.document_type}' préparé pour génération`
    },
    execution_time_ms: 0
  };
}

// ============================================================
// Requires confirmation helper (uses security-validator)
// ============================================================
export function requiresConfirmation(toolName: string, _autonomousMode: boolean = false, args?: Record<string, unknown>): boolean {
  // Read-only actions never require confirmation, even on sensitive tools
  const readOnlyActions = ['list', 'get', 'search', 'read', 'count', 'stats', 'kpis'];
  if (args?.action && readOnlyActions.includes(String(args.action).toLowerCase())) {
    return false;
  }
  return checkRequiresConfirmation(toolName);
}

// ============================================================
// TOOL: report_jarvis_issue (Auto-feedback on failures)
// ============================================================
export async function executeReportJarvisIssue(
  ctx: ToolExecutionContext,
  args: {
    tool_name: string;
    error_message: string;
    context?: Record<string, unknown>;
    severity?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    // Récupérer le profil utilisateur pour le contexte
    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('nom, prenom, email')
      .eq('id', ctx.userId)
      .single();

    // Construire les infos de contexte
    const browserInfo = {
      source: 'jarvis_auto_report',
      timestamp: new Date().toISOString(),
      conversation_id: ctx.conversationId || null,
    };

    // Insérer dans user_feedbacks (même table que le bouton orange)
    // CRITICAL: user_feedbacks FK pointe vers auth.users, pas profiles
    const feedbackUserId = ctx.authUserId || ctx.userId;
    
    const { data, error } = await ctx.supabase
      .from('user_feedbacks')
      .insert({
        user_id: feedbackUserId,
        type: 'bug',
        priority: args.severity || 'medium',
        title: `[JARVIS] Échec de l'outil: ${args.tool_name}`,
        description: `**Erreur automatiquement signalée par JARVIS**\n\n**Outil:** \`${args.tool_name}\`\n\n**Message d'erreur:**\n\`\`\`\n${args.error_message}\n\`\`\`\n\n**Contexte:**\n\`\`\`json\n${JSON.stringify(args.context || {}, null, 2)}\n\`\`\`\n\n**Utilisateur:** ${profile?.prenom || ''} ${profile?.nom || ''} (${profile?.email || ctx.userId})`,
        current_route: '/jarvis',
        browser_info: browserInfo,
        console_logs: [
          { level: 'error', message: args.error_message, timestamp: new Date().toISOString() }
        ]
      })
      .select('id')
      .single();

    if (error) throw error;

    console.log(`[JARVIS] Auto-feedback created: ${data?.id}`);

    return {
      success: true,
      data: {
        message: 'Problème signalé automatiquement pour analyse',
        feedback_id: data?.id
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    console.error('[JARVIS] Failed to create auto-feedback:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to report issue',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// Helper: Auto-report failures
// ============================================================
export async function autoReportFailure(
  ctx: ToolExecutionContext,
  toolName: string,
  errorMessage: string,
  args: Record<string, unknown>
): Promise<void> {
  try {
    // Ne pas reporter les erreurs de permission ou les confirmations requises
    if (errorMessage.includes('Permission denied') || 
        errorMessage.includes('REQUIRES_CONFIRMATION') ||
        errorMessage === 'Permission check failed') {
      return;
    }

    await executeReportJarvisIssue(ctx, {
      tool_name: toolName,
      error_message: errorMessage,
      context: {
        arguments: args,
        user_id: ctx.userId,
        timestamp: new Date().toISOString()
      },
      severity: determineSeverity(errorMessage)
    });
  } catch (e) {
    // Silently fail - don't break the main flow
    console.error('[JARVIS] Auto-report failed silently:', e);
  }
}

function determineSeverity(errorMessage: string): string {
  const lowercaseError = errorMessage.toLowerCase();
  if (lowercaseError.includes('timeout') || lowercaseError.includes('rate limit')) {
    return 'low';
  }
  if (lowercaseError.includes('not found') || lowercaseError.includes('invalid')) {
    return 'medium';
  }
  if (lowercaseError.includes('critical') || lowercaseError.includes('database')) {
    return 'high';
  }
  return 'medium';
}
