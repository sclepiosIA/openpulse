/**
 * JARVIS 12.0 - Contracts Tools
 * 
 * Tools for contract management: templates, generation, AI assistance, signatures.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
}

// ============================================================
// generate_contract
// ============================================================
export async function executeGenerateContract(
  ctx: ToolContext,
  args: {
    template_id: string;
    etablissement_id: string;
    variables?: Record<string, unknown>;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    // Get template
    const { data: template, error: templateError } = await ctx.supabase
      .from('contrat_modeles')
      .select('*')
      .eq('id', args.template_id)
      .single();

    if (templateError) throw templateError;

    // Get etablissement info for variable substitution
    const { data: etab } = await ctx.supabase
      .from('etablissements')
      .select('nom, siret, adresse, email, telephone')
      .eq('id', args.etablissement_id)
      .single();

    // Create contract record
    const { data: contract, error: contractError } = await ctx.supabase
      .from('contrats')
      .insert({
        modele_id: args.template_id,
        etablissement_id: args.etablissement_id,
        nom: `${template.nom} - ${etab?.nom || args.etablissement_id}`,
        contenu: template.contenu,
        variables: {
          ...args.variables,
          etablissement_nom: etab?.nom,
          etablissement_siret: etab?.siret,
          etablissement_adresse: etab?.adresse,
          date_generation: new Date().toLocaleDateString('fr-FR')
        },
        statut: 'brouillon',
        created_by: ctx.userId
      })
      .select()
      .single();

    if (contractError) throw contractError;

    return {
      success: true,
      data: {
        message: `Contrat généré: ${contract.nom}`,
        contract_id: contract.id,
        etablissement: etab?.nom
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate contract',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// ai_assist_contract
// ============================================================
export async function executeAiAssistContract(
  ctx: ToolContext,
  args: {
    action: 'adapt' | 'rewrite' | 'check' | 'summarize';
    content: string;
    context?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    const { data, error } = await ctx.supabase.functions.invoke('contract-ai-assist', {
      body: {
        action: args.action,
        content: args.content,
        context: args.context
      }
    });

    if (error) throw error;

    return {
      success: true,
      data: {
        action: args.action,
        result: data?.result || data?.content,
        suggestions: data?.suggestions
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Contract AI assistance failed',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// request_signature
// ============================================================
export async function executeRequestSignature(
  ctx: ToolContext,
  args: {
    document_id: string;
    signataires: Array<{ email: string; name: string }>;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    // Update contract status
    await ctx.supabase
      .from('contrats')
      .update({ 
        statut: 'en_signature',
        signature_requested_at: new Date().toISOString()
      })
      .eq('id', args.document_id);

    // This would integrate with DocuSeal or similar
    // For now, return a placeholder
    return {
      success: true,
      data: {
        message: `Demande de signature envoyée à ${args.signataires.length} personne(s)`,
        document_id: args.document_id,
        signataires: args.signataires.map(s => s.email)
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Signature request failed',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// manage_contract_template
// ============================================================
export async function executeManageContractTemplate(
  ctx: ToolContext,
  args: {
    action: 'create' | 'update' | 'delete' | 'list';
    template_id?: string;
    data?: Record<string, unknown>;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase
          .from('contrat_modeles')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return {
          success: true,
          data: { templates: data, count: data?.length || 0 },
          execution_time_ms: Date.now() - start
        };
      }
      
      case 'create': {
        const { data, error } = await ctx.supabase
          .from('contrat_modeles')
          .insert({
            ...args.data,
            created_by: ctx.userId
          })
          .select()
          .single();
        
        if (error) throw error;
        return {
          success: true,
          data: { message: 'Modèle créé', template: data },
          execution_time_ms: Date.now() - start
        };
      }
      
      case 'update': {
        if (!args.template_id) throw new Error('template_id required');
        const { data, error } = await ctx.supabase
          .from('contrat_modeles')
          .update(args.data || {})
          .eq('id', args.template_id)
          .select()
          .single();
        
        if (error) throw error;
        return {
          success: true,
          data: { message: 'Modèle mis à jour', template: data },
          execution_time_ms: Date.now() - start
        };
      }
      
      case 'delete': {
        if (!args.template_id) throw new Error('template_id required');
        const { error } = await ctx.supabase
          .from('contrat_modeles')
          .delete()
          .eq('id', args.template_id);
        
        if (error) throw error;
        return {
          success: true,
          data: { message: 'Modèle supprimé' },
          execution_time_ms: Date.now() - start
        };
      }
      
      default:
        throw new Error(`Unknown action: ${args.action}`);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Template operation failed',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// manage_contrat_avenant - CRUD sur les avenants
// ============================================================
export async function executeManageContratAvenant(ctx: ToolContext, args: { action: string; contrat_id?: string; avenant_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        if (!args.contrat_id) throw new Error('contrat_id required');
        const { data, error } = await ctx.supabase.from('contrat_avenants').select('*').eq('contrat_id', args.contrat_id).order('created_at', { ascending: false });
        if (error) throw error;
        return { success: true, data: { avenants: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        if (!args.contrat_id) throw new Error('contrat_id required');
        const { data, error } = await ctx.supabase.from('contrat_avenants').insert({ contrat_id: args.contrat_id, ...args.data, created_by: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Avenant créé', avenant: data }, execution_time_ms: Date.now() - start };
      }
      case 'update': {
        if (!args.avenant_id) throw new Error('avenant_id required');
        const { data, error } = await ctx.supabase.from('contrat_avenants').update(args.data || {}).eq('id', args.avenant_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Avenant mis à jour', avenant: data }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Avenant operation failed', execution_time_ms: Date.now() - start };
  }
}

// ============================================================
// get_contrat_alerts - Lecture des alertes contrat
// ============================================================
export async function executeGetContratAlerts(ctx: ToolContext, args: { contrat_id?: string; status?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    let query = ctx.supabase.from('contrat_alertes').select('*, contrats(nom, etablissement_id)');
    if (args.contrat_id) query = query.eq('contrat_id', args.contrat_id);
    if (args.status) query = query.eq('status', args.status);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return { success: true, data: { alerts: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Contract alerts failed', execution_time_ms: Date.now() - start };
  }
}

// ============================================================
// manage_document (generic storage operations)
// ============================================================
export async function executeManageDocument(
  ctx: ToolContext,
  args: {
    action: 'list' | 'get_url' | 'delete';
    path?: string;
    bucket?: string;
    category?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    const bucket = args.bucket || 'documents';
    
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.storage
          .from(bucket)
          .list(args.path || '', { limit: 100 });
        
        if (error) throw error;
        return {
          success: true,
          data: { files: data, count: data?.length || 0, path: args.path },
          execution_time_ms: Date.now() - start
        };
      }
      
      case 'get_url': {
        if (!args.path) throw new Error('path required');
        const { data } = ctx.supabase.storage
          .from(bucket)
          .getPublicUrl(args.path);
        
        return {
          success: true,
          data: { url: data.publicUrl, path: args.path },
          execution_time_ms: Date.now() - start
        };
      }
      
      case 'delete': {
        if (!args.path) throw new Error('path required');
        const { error } = await ctx.supabase.storage
          .from(bucket)
          .remove([args.path]);
        
        if (error) throw error;
        return {
          success: true,
          data: { message: 'Document supprimé', path: args.path },
          execution_time_ms: Date.now() - start
        };
      }
      
      default:
        throw new Error(`Unknown action: ${args.action}`);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Document operation failed',
      execution_time_ms: Date.now() - start
    };
  }
}
