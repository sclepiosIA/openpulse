/**
 * JARVIS - Pulse Tools
 * 
 * Outils pour interagir avec Pulse (messagerie interne).
 * Permet à Jarvis d'envoyer des messages, créer des conversations,
 * lister les conversations et rechercher dans les messages.
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface ToolExecutionContext {
  supabase: SupabaseClient;
  adminClient?: SupabaseClient;
  userId: string;
  authUserId?: string;
  conversationId?: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  execution_time_ms: number;
}

// ============================================================
// TOOL: send_pulse_message
// ============================================================
export async function executeSendPulseMessage(
  ctx: ToolExecutionContext,
  args: {
    conversation_id: string;
    content: string;
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    if (!args.conversation_id || !args.content) {
      return {
        success: false,
        error: 'Les paramètres "conversation_id" et "content" sont requis',
        execution_time_ms: Date.now() - start
      };
    }

    // Vérifier que l'utilisateur est membre de la conversation
    const { data: membership, error: memberError } = await ctx.supabase
      .from('pulse_conversation_members')
      .select('id')
      .eq('conversation_id', args.conversation_id)
      .eq('user_id', ctx.userId)
      .maybeSingle();

    if (memberError) {
      console.error('[send_pulse_message] Membership check error:', memberError.message);
      throw memberError;
    }

    if (!membership) {
      return {
        success: false,
        error: "Vous n'êtes pas membre de cette conversation Pulse",
        execution_time_ms: Date.now() - start
      };
    }

    // Insérer le message
    const { data: message, error: insertError } = await ctx.supabase
      .from('pulse_messages')
      .insert({
        conversation_id: args.conversation_id,
        user_id: ctx.userId,
        content: args.content,
      })
      .select('id, content, created_at')
      .single();

    if (insertError) {
      console.error('[send_pulse_message] Insert error:', insertError.message);
      throw insertError;
    }

    console.log(`[send_pulse_message] Message sent in conversation ${args.conversation_id}`);

    return {
      success: true,
      data: { message: 'Message Pulse envoyé avec succès', pulse_message: message },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Échec de l\'envoi du message Pulse',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// TOOL: create_pulse_conversation
// ============================================================
export async function executeCreatePulseConversation(
  ctx: ToolExecutionContext,
  args: {
    name: string;
    description?: string;
    member_ids: string[];
    visibility?: 'public' | 'private';
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    if (!args.name || !args.member_ids || args.member_ids.length === 0) {
      return {
        success: false,
        error: 'Les paramètres "name" et "member_ids" (non vide) sont requis',
        execution_time_ms: Date.now() - start
      };
    }

    // Créer la conversation
    const { data: conversation, error: convError } = await ctx.supabase
      .from('pulse_conversations')
      .insert({
        name: args.name,
        description: args.description || null,
        created_by: ctx.authUserId || ctx.userId,
        visibility: args.visibility || 'private',
      })
      .select('id, name')
      .single();

    if (convError) {
      console.error('[create_pulse_conversation] Create error:', convError.message);
      throw convError;
    }

    // Ajouter les membres (y compris l'utilisateur lui-même)
    const authId = ctx.authUserId || ctx.userId;
    const allMemberIds = [...new Set([authId, ...args.member_ids])];
    const membersToInsert = allMemberIds.map(uid => ({
      conversation_id: conversation.id,
      user_id: uid,
      role: uid === authId ? 'admin' : 'member',
    }));

    const { error: membersError } = await ctx.supabase
      .from('pulse_conversation_members')
      .insert(membersToInsert);

    if (membersError) {
      console.error('[create_pulse_conversation] Members insert error:', membersError.message);
      // Nettoyer la conversation créée
      await ctx.supabase.from('pulse_conversations').delete().eq('id', conversation.id);
      throw membersError;
    }

    console.log(`[create_pulse_conversation] Created "${args.name}" with ${allMemberIds.length} members`);

    return {
      success: true,
      data: {
        message: `Conversation Pulse "${args.name}" créée avec ${allMemberIds.length} membre(s)`,
        conversation,
        members_count: allMemberIds.length
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Échec de la création de la conversation Pulse',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// TOOL: list_pulse_conversations
// ============================================================
export async function executeListPulseConversations(
  ctx: ToolExecutionContext,
  args: {
    limit?: number;
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    const limit = Math.min(args.limit || 10, 50);

    // Récupérer les conversations dont l'utilisateur est membre
    const { data: memberships, error: memberError } = await ctx.supabase
      .from('pulse_conversation_members')
      .select('conversation_id')
      .eq('user_id', ctx.userId);

    if (memberError) {
      console.error('[list_pulse_conversations] Membership query error:', memberError.message);
      throw memberError;
    }

    if (!memberships || memberships.length === 0) {
      return {
        success: true,
        data: { conversations: [], count: 0, message: 'Aucune conversation Pulse trouvée' },
        execution_time_ms: Date.now() - start
      };
    }

    const conversationIds = memberships.map(m => m.conversation_id);

    const { data: conversations, error: convError } = await ctx.supabase
      .from('pulse_conversations')
      .select('id, name, description, visibility, created_at, updated_at')
      .in('id', conversationIds)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (convError) {
      console.error('[list_pulse_conversations] Conversations query error:', convError.message);
      throw convError;
    }

    console.log(`[list_pulse_conversations] Found ${conversations?.length || 0} conversations`);

    return {
      success: true,
      data: {
        conversations: conversations || [],
        count: conversations?.length || 0
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Échec de la liste des conversations Pulse',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// TOOL: search_pulse_messages
// ============================================================
export async function executeSearchPulseMessages(
  ctx: ToolExecutionContext,
  args: {
    query: string;
    conversation_id?: string;
    limit?: number;
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    if (!args.query || args.query.trim().length < 2) {
      return {
        success: false,
        error: 'Le paramètre "query" doit contenir au moins 2 caractères',
        execution_time_ms: Date.now() - start
      };
    }

    const limit = Math.min(args.limit || 20, 50);

    // Récupérer les conversations de l'utilisateur
    const { data: memberships, error: memberError } = await ctx.supabase
      .from('pulse_conversation_members')
      .select('conversation_id')
      .eq('user_id', ctx.userId);

    if (memberError) throw memberError;

    if (!memberships || memberships.length === 0) {
      return {
        success: true,
        data: { results: [], count: 0, query: args.query },
        execution_time_ms: Date.now() - start
      };
    }

    const userConversationIds = memberships.map(m => m.conversation_id);

    // Construire la requête de recherche
    let searchQuery = ctx.supabase
      .from('pulse_messages')
      .select('id, content, created_at, conversation_id')
      .is('deleted_at', null)
      .in('conversation_id', userConversationIds)
      .ilike('content', `%${args.query}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (args.conversation_id) {
      searchQuery = searchQuery.eq('conversation_id', args.conversation_id);
    }

    const { data: results, error: searchError } = await searchQuery;

    if (searchError) {
      console.error('[search_pulse_messages] Search error:', searchError.message);
      throw searchError;
    }

    console.log(`[search_pulse_messages] Found ${results?.length || 0} results for "${args.query}"`);

    return {
      success: true,
      data: {
        results: results || [],
        count: results?.length || 0,
        query: args.query
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Échec de la recherche dans Pulse',
      execution_time_ms: Date.now() - start
    };
  }
}
