/**
 * JARVIS 6.0 - Enhanced Shared Memory System
 * 
 * Mémoire partagée inter-agents avec hiérarchie temporelle :
 * - Court terme : session courante (1h)
 * - Moyen terme : 7 derniers jours
 * - Long terme : faits permanents
 * - Mémoire partagée inter-agents (24h)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

type AgentId = 'sophia' | 'marcus' | 'olivia' | 'noah' | 'emma' | 'alex' | 'prime';
type MemoryType = 'short_term' | 'medium_term' | 'long_term' | 'shared' | 'broadcast';

interface SharedMemoryRequest {
  action: 'get' | 'set' | 'delete' | 'list' | 'broadcast' | 'retrieve_for_context' | 'share_between_agents' | 'cleanup_expired';
  user_id?: string;
  agent_id?: AgentId;
  memory_key?: string;
  memory_value?: Record<string, unknown>;
  context_type?: string;
  memory_type?: MemoryType;
  ttl_minutes?: number;
  broadcast_to?: AgentId[];
  conversation_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const request: SharedMemoryRequest = await req.json();
    const { action, agent_id, memory_key, memory_value, context_type, memory_type, ttl_minutes, broadcast_to, conversation_id } = request;
    const user_id = (!auth.isServiceCall && auth.userId) ? auth.userId : request.user_id;

    // Résoudre le profile_id si user_id fourni
    let profile_id: string | null = null;
    if (user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user_id)
        .single();
      profile_id = profile?.id || user_id;
    }

    switch (action) {
      case 'get': {
        if (!agent_id || !memory_key) {
          return new Response(JSON.stringify({ error: 'agent_id and memory_key required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let query = supabase
          .from('jarvis_agent_memory')
          .select('*')
          .eq('agent_id', agent_id)
          .eq('memory_key', memory_key);

        if (profile_id) {
          query = query.eq('user_id', profile_id);
        }

        const { data, error } = await query.single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        // Vérifier l'expiration
        if (data?.expires_at && new Date(data.expires_at) < new Date()) {
          await supabase
            .from('jarvis_agent_memory')
            .delete()
            .eq('id', data.id);
          return new Response(JSON.stringify({ success: true, data: null }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'set': {
        if (!agent_id || !memory_key || !memory_value) {
          return new Response(JSON.stringify({ error: 'agent_id, memory_key and memory_value required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const expiresAt = calculateExpiry(memory_type || context_type, ttl_minutes);

        const insertData: Record<string, unknown> = {
          agent_id,
          memory_key,
          memory_value,
          context_type: context_type || memory_type || 'general',
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
        };

        if (profile_id) {
          insertData.user_id = profile_id;
        }

        const { data, error } = await supabase
          .from('jarvis_agent_memory')
          .upsert(insertData, {
            onConflict: profile_id ? 'user_id,agent_id,memory_key' : 'agent_id,memory_key'
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'delete': {
        if (!agent_id || !memory_key) {
          return new Response(JSON.stringify({ error: 'agent_id and memory_key required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let query = supabase
          .from('jarvis_agent_memory')
          .delete()
          .eq('agent_id', agent_id)
          .eq('memory_key', memory_key);

        if (profile_id) {
          query = query.eq('user_id', profile_id);
        }

        const { error } = await query;

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'list': {
        let query = supabase
          .from('jarvis_agent_memory')
          .select('*')
          .order('created_at', { ascending: false });

        if (agent_id) {
          query = query.eq('agent_id', agent_id);
        }
        if (context_type) {
          query = query.eq('context_type', context_type);
        }
        if (profile_id) {
          query = query.eq('user_id', profile_id);
        }

        const { data, error } = await query.limit(100);

        if (error) throw error;

        // Filtrer les expirés
        const validEntries = (data || []).filter(entry => 
          !entry.expires_at || new Date(entry.expires_at) > new Date()
        );

        return new Response(JSON.stringify({ success: true, data: validEntries }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'broadcast': {
        // Broadcast une information à plusieurs agents
        if (!agent_id || !memory_key || !memory_value || !broadcast_to?.length) {
          return new Response(JSON.stringify({ error: 'agent_id, memory_key, memory_value and broadcast_to required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const expiresAt = calculateExpiry('broadcast', ttl_minutes);

        // Créer une entrée pour chaque agent destinataire
        const entries = broadcast_to.map(targetAgent => ({
          agent_id: targetAgent,
          memory_key: `broadcast_from_${agent_id}_${memory_key}`,
          memory_value: {
            ...memory_value,
            source_agent: agent_id,
            broadcast_at: new Date().toISOString(),
          },
          context_type: 'broadcast',
          expires_at: expiresAt,
          user_id: profile_id,
          created_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from('jarvis_agent_memory')
          .upsert(entries, {
            onConflict: 'user_id,agent_id,memory_key'
          });

        if (error) throw error;

        return new Response(JSON.stringify({ 
          success: true, 
          broadcasted_to: broadcast_to,
          entries_created: entries.length 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'retrieve_for_context': {
        // Récupérer toutes les mémoires pertinentes pour un contexte donné
        if (!profile_id) {
          return new Response(JSON.stringify({ error: 'user_id required for context retrieval' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const memories: Record<string, unknown[]> = {
          short_term: [],
          medium_term: [],
          long_term: [],
          shared: [],
        };

        // Court terme : session courante (dernière heure)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: shortTerm } = await supabase
          .from('jarvis_agent_memory')
          .select('*')
          .eq('user_id', profile_id)
          .gte('created_at', oneHourAgo)
          .order('created_at', { ascending: false })
          .limit(20);

        memories.short_term = shortTerm || [];

        // Moyen terme : 7 derniers jours
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: mediumTerm } = await supabase
          .from('jarvis_agent_memory')
          .select('*')
          .eq('user_id', profile_id)
          .eq('context_type', 'medium_term')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(30);

        memories.medium_term = mediumTerm || [];

        // Long terme : faits permanents
        const { data: longTerm } = await supabase
          .from('jarvis_agent_memory')
          .select('*')
          .eq('user_id', profile_id)
          .eq('context_type', 'long_term')
          .is('expires_at', null)
          .order('created_at', { ascending: false })
          .limit(50);

        memories.long_term = longTerm || [];

        // Mémoire partagée inter-agents (conversation courante)
        if (conversation_id) {
          const { data: shared } = await supabase
            .from('jarvis_agent_memory')
            .select('*')
            .eq('user_id', profile_id)
            .eq('context_type', 'shared')
            .ilike('memory_key', `%${conversation_id}%`)
            .order('created_at', { ascending: false })
            .limit(20);

          memories.shared = shared || [];
        }

        return new Response(JSON.stringify({ success: true, memories }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'share_between_agents': {
        // Partager une information entre agents spécifiques
        const { from_agent, to_agents, data: sharedData, purpose } = memory_value as {
          from_agent: string;
          to_agents: string[];
          data: unknown;
          purpose: string;
        };

        if (!from_agent || !to_agents?.length || !sharedData) {
          return new Response(JSON.stringify({ error: 'from_agent, to_agents and data required in memory_value' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const shareKey = `shared_${Date.now()}`;
        const entries = to_agents.map(targetAgent => ({
          user_id: profile_id,
          agent_id: targetAgent,
          memory_key: shareKey,
          memory_value: {
            from_agent,
            data: sharedData,
            purpose,
            shared_at: new Date().toISOString(),
          },
          context_type: 'shared',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from('jarvis_agent_memory')
          .insert(entries);

        if (error) throw error;

        return new Response(JSON.stringify({ 
          success: true, 
          share_key: shareKey,
          shared_with: to_agents 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'cleanup_expired': {
        // Nettoyer les mémoires expirées
        const { count } = await supabase
          .from('jarvis_agent_memory')
          .delete()
          .lt('expires_at', new Date().toISOString())
          .not('expires_at', 'is', null);

        return new Response(JSON.stringify({ success: true, deleted_count: count }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error: unknown) {
    console.error('[jarvis-shared-memory] Error:', error);
    return buildErrorResponse('jarvis-shared-memory', error, corsHeaders, 500);
  }
});

function calculateExpiry(memoryType: string | undefined, customTtlMinutes?: number): string | null {
  if (customTtlMinutes) {
    return new Date(Date.now() + customTtlMinutes * 60 * 1000).toISOString();
  }
  
  switch (memoryType) {
    case 'short_term':
      return new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 heure
    case 'medium_term':
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 jours
    case 'shared':
    case 'broadcast':
      return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
    case 'long_term':
    default:
      return null; // Permanent
  }
}
