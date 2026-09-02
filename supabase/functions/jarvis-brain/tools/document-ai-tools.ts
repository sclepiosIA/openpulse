/**
 * JARVIS 12.0 - Document AI Tools
 * 
 * Outils IA pour la synthèse, l'analyse et l'extraction de données.
 * Utilise Azure GPT-5 pour le traitement intelligent.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
}

/**
 * Helper pour appeler GPT-5
 */
async function callGPT5(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; jsonOutput?: boolean }
): Promise<string> {
  const AZURE_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
  const AZURE_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');

  if (!AZURE_ENDPOINT || !AZURE_API_KEY) {
    throw new Error('Azure GPT-5 non configuré');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  const body: Record<string, unknown> = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_completion_tokens: options?.maxTokens || 2000,
    reasoning_effort: 'low',
    verbosity: 'low',
  };

  if (options?.jsonOutput) {
    body.response_format = { type: 'json_object' };
  }

  try {
    const response = await fetch(AZURE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_API_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      await new Promise(r => setTimeout(r, 1000));
      const retryResponse = await fetch(AZURE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_API_KEY,
        },
        body: JSON.stringify(body),
      });
      const retryData = await retryResponse.json();
      return retryData.choices?.[0]?.message?.content || '';
    }

    if (!response.ok) {
      throw new Error(`GPT-5 API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('GPT-5 request timeout (90s)');
    }
    throw error;
  }
}

/**
 * Synthèse intelligente de contenu
 */
export async function executeSummarizeContent(
  ctx: ToolContext,
  args: {
    content: string;
    content_type?: 'email_thread' | 'document' | 'meeting_notes' | 'general';
    max_length?: number;
    format?: 'bullet_points' | 'paragraph' | 'structured' | 'executive_summary';
    language?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    if (!args.content || args.content.trim().length < 50) {
      return {
        success: false,
        error: 'Le contenu est trop court pour être synthétisé (minimum 50 caractères)',
        execution_time_ms: Date.now() - start
      };
    }

    const contentType = args.content_type || 'general';
    const format = args.format || 'bullet_points';
    const maxLength = args.max_length || 300;
    const language = args.language || 'français';

    const formatInstructions: Record<string, string> = {
      'bullet_points': 'Utilise une liste à puces concise',
      'paragraph': 'Rédige un paragraphe fluide',
      'structured': 'Structure avec des sections: Contexte, Points clés, Actions suggérées',
      'executive_summary': 'Format synthèse exécutive: enjeux, conclusions, recommandations'
    };

    const typeContext: Record<string, string> = {
      'email_thread': 'Ce contenu est un fil d\'emails professionnels. Identifie les interlocuteurs, le sujet principal et les actions attendues.',
      'document': 'Ce contenu est un document. Extrais les informations essentielles.',
      'meeting_notes': 'Ce contenu représente des notes de réunion. Identifie les décisions prises et les actions à suivre.',
      'general': 'Synthétise ce contenu de manière générale.'
    };

    const systemPrompt = `Tu es un assistant expert en synthèse de documents. ${typeContext[contentType]}
${formatInstructions[format]}
Limite ta réponse à environ ${maxLength} mots.
Réponds en ${language}.`;

    const userPrompt = `Synthétise le contenu suivant:\n\n${args.content.substring(0, 10000)}`;

    const summary = await callGPT5(systemPrompt, userPrompt, { maxTokens: 1500 });

    return {
      success: true,
      data: {
        summary,
        content_type: contentType,
        format,
        original_length: args.content.length,
        summary_length: summary.length,
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Synthèse échouée',
      execution_time_ms: Date.now() - start
    };
  }
}

/**
 * Analyse contextuelle avec IA
 */
export async function executeAnalyzeWithAI(
  ctx: ToolContext,
  args: {
    content: string;
    analysis_type: 'sentiment' | 'key_topics' | 'action_items' | 'risks' | 'opportunities' | 'custom';
    custom_prompt?: string;
    output_format?: 'text' | 'json';
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    if (!args.content || args.content.trim().length < 20) {
      return {
        success: false,
        error: 'Contenu insuffisant pour l\'analyse',
        execution_time_ms: Date.now() - start
      };
    }

    const analysisType = args.analysis_type;
    const outputJson = args.output_format === 'json';

    const analysisPrompts: Record<string, string> = {
      'sentiment': 'Analyse le sentiment général de ce texte. Détermine s\'il est positif, négatif ou neutre, et explique pourquoi.',
      'key_topics': 'Identifie les 3-5 sujets/thèmes principaux abordés dans ce texte.',
      'action_items': 'Extrais toutes les actions à réaliser mentionnées dans ce texte. Pour chaque action, indique qui devrait la réaliser si mentionné.',
      'risks': 'Identifie les risques potentiels mentionnés ou implicites dans ce texte.',
      'opportunities': 'Identifie les opportunités commerciales ou stratégiques dans ce texte.',
      'custom': args.custom_prompt || 'Analyse ce texte.'
    };

    const systemPrompt = `Tu es un analyste expert. ${analysisPrompts[analysisType]}
${outputJson ? 'Retourne ta réponse en JSON valide.' : 'Réponds de manière claire et structurée.'}
Réponds en français.`;

    const userPrompt = `Contenu à analyser:\n\n${args.content.substring(0, 8000)}`;

    const analysis = await callGPT5(systemPrompt, userPrompt, { 
      maxTokens: 1500, 
      jsonOutput: outputJson 
    });

    let parsedAnalysis: unknown = analysis;
    if (outputJson) {
      try {
        parsedAnalysis = JSON.parse(analysis);
      } catch {
        parsedAnalysis = { raw: analysis };
      }
    }

    return {
      success: true,
      data: {
        analysis: parsedAnalysis,
        analysis_type: analysisType,
        output_format: args.output_format || 'text',
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Analyse échouée',
      execution_time_ms: Date.now() - start
    };
  }
}

/**
 * Extraction de données structurées
 */
export async function executeExtractData(
  ctx: ToolContext,
  args: {
    content: string;
    extraction_schema: {
      fields: Array<{
        name: string;
        type: 'string' | 'number' | 'date' | 'boolean' | 'array';
        description: string;
        required?: boolean;
      }>;
    };
    strict_mode?: boolean;
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    if (!args.content) {
      return {
        success: false,
        error: 'Contenu requis',
        execution_time_ms: Date.now() - start
      };
    }

    if (!args.extraction_schema?.fields?.length) {
      return {
        success: false,
        error: 'Schéma d\'extraction requis avec au moins un champ',
        execution_time_ms: Date.now() - start
      };
    }

    const schemaDescription = args.extraction_schema.fields.map(f => 
      `- ${f.name} (${f.type}${f.required ? ', requis' : ''}): ${f.description}`
    ).join('\n');

    const systemPrompt = `Tu es un expert en extraction de données. Extrais les informations demandées du texte fourni.
${args.strict_mode ? 'Mode strict: ne retourne que les valeurs explicitement présentes dans le texte.' : 'Tu peux inférer des valeurs si elles sont implicites.'}

Schéma d'extraction:
${schemaDescription}

Retourne un objet JSON avec ces champs. Utilise null pour les champs non trouvés.`;

    const userPrompt = `Texte à analyser:\n\n${args.content.substring(0, 8000)}`;

    const result = await callGPT5(systemPrompt, userPrompt, { 
      maxTokens: 2000, 
      jsonOutput: true 
    });

    let extractedData: Record<string, unknown>;
    try {
      extractedData = JSON.parse(result);
    } catch {
      return {
        success: false,
        error: 'Impossible de parser les données extraites',
        execution_time_ms: Date.now() - start
      };
    }

    // Valider les champs requis
    const missingRequired = args.extraction_schema.fields
      .filter(f => f.required && (extractedData[f.name] === null || extractedData[f.name] === undefined))
      .map(f => f.name);

    return {
      success: true,
      data: {
        extracted: extractedData,
        fields_found: Object.keys(extractedData).filter(k => extractedData[k] !== null).length,
        total_fields: args.extraction_schema.fields.length,
        missing_required: missingRequired.length > 0 ? missingRequired : undefined,
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Extraction échouée',
      execution_time_ms: Date.now() - start
    };
  }
}
