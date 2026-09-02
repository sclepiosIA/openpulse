/**
 * JARVIS Email Analytics Tools
 * Analyse avancée des emails par expéditeur (statistiques horaires, amplitude, hors-horaires)
 */

import type { ToolExecutionContext, ToolResult } from "./core-tools.ts";

export async function executeAnalyzeSenderEmails(
  ctx: ToolExecutionContext,
  args: {
    sender_pattern: string;
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    if (!args.sender_pattern || args.sender_pattern.trim().length < 2) {
      return {
        success: false,
        error: 'Le pattern de recherche doit contenir au moins 2 caractères',
        execution_time_ms: Date.now() - start
      };
    }

    const { data, error } = await ctx.supabase.rpc(
      'jarvis_analyze_sender_emails' as never,
      {
        p_sender_pattern: args.sender_pattern.trim(),
        p_profile_id: ctx.userId
      } as never
    );

    if (error) {
      console.error('[analyzeEmails] RPC error:', error);
      return {
        success: false,
        error: `Erreur lors de l'analyse: ${error.message}`,
        execution_time_ms: Date.now() - start
      };
    }

    const result = data as Record<string, unknown>;

    if (result?.error) {
      return {
        success: false,
        error: String(result.error),
        execution_time_ms: Date.now() - start
      };
    }

    // Enrichir avec des labels lisibles pour le LLM
    const dowLabels: Record<number, string> = {
      0: 'Dimanche', 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi',
      4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi'
    };

    const dowDist = result.day_of_week_distribution as Array<{ dow: number; count: number }> | undefined;
    if (Array.isArray(dowDist)) {
      (result as Record<string, unknown>).day_of_week_distribution = dowDist.map(d => ({
        ...d,
        label: dowLabels[d.dow] || `Jour ${d.dow}`
      }));
    }

    return {
      success: true,
      data: {
        message: `Analyse de ${result.total || 0} emails correspondant à "${args.sender_pattern}"`,
        ...result
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    console.error('[analyzeEmails] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      execution_time_ms: Date.now() - start
    };
  }
}
