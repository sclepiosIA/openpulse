import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { safeRealtimeChannel } from '@/lib/realtimeMonitor';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { queryPresets } from '@/lib/queryPresets';
import type {
  LiveChatConversation,
  LiveChatMessage,
  LiveChatAgent,
  LiveChatSettings,
  LiveChatQuickReply,
  LiveChatKPIs,
  ConversationStatus,
} from '@/types/live-chat';

// ==================== CONVERSATIONS ====================

export function useLiveChatConversations(filters?: { status?: ConversationStatus; assigned_to?: string }) {
  const queryClient = useQueryClient();

  // Set up Realtime subscription for conversations
  React.useEffect(() => {
    // NOTE: This channel is intentionally NOT scoped with user.id
    // because LiveChat is a shared module — all agents need to see all conversation updates.
    const handle = safeRealtimeChannel('live-chat-conversations-realtime', (channel) =>
      channel.on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'live_chat_conversations',
        } as never,
        (() => {
          queryClient.invalidateQueries({ queryKey: ['live-chat-conversations'] });
        }) as never
      )
    );
    return () => { handle.dispose(); };
  }, [queryClient]);

  return useQuery({
    queryKey: ['live-chat-conversations', filters],
    queryFn: async () => {
      let query = supabase
        .from('live_chat_conversations')
        .select(`
          id, etablissement_id, visitor_id, visitor_name, visitor_email, visitor_metadata,
          assigned_to, status, priority, source, tags, satisfaction_rating, satisfaction_comment,
          escalated_at, escalated_reason, ticket_id, resolved_at, first_response_at,
          created_at, updated_at,
          etablissement:etablissements(id, nom),
          assigned_agent:profiles!live_chat_conversations_assigned_to_fkey(id, nom, prenom)
        `)
        .order('updated_at', { ascending: false })
        .limit(500);

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as LiveChatConversation[];
    },
    ...queryPresets.frequent, // 30 seconds - Realtime handles updates
  });
}

export function useLiveChatConversation(conversationId: string | null) {
  return useQuery({
    queryKey: ['live-chat-conversation', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      
      const { data, error } = await supabase
        .from('live_chat_conversations')
        .select(`
          id, etablissement_id, visitor_id, visitor_name, visitor_email, visitor_metadata,
          assigned_to, status, priority, source, tags, satisfaction_rating, satisfaction_comment,
          escalated_at, escalated_reason, ticket_id, resolved_at, first_response_at,
          created_at, updated_at,
          etablissement:etablissements(id, nom),
          assigned_agent:profiles!live_chat_conversations_assigned_to_fkey(id, nom, prenom)
        `)
        .eq('id', conversationId)
        .maybeSingle();

      if (error) throw error;
      return data ? (data as unknown as LiveChatConversation) : null;
    },
    enabled: !!conversationId,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Partial<LiveChatConversation>) => {
      const { data: result, error } = await supabase
        .from('live_chat_conversations')
        .insert({
          visitor_id: data.visitor_id || crypto.randomUUID(),
          visitor_name: data.visitor_name,
          visitor_email: data.visitor_email,
          etablissement_id: data.etablissement_id,
          source: data.source || 'widget',
          status: 'waiting' as const,
        })
        .select('id, etablissement_id, visitor_id, visitor_name, visitor_email, assigned_to, status, priority, source, tags, created_at, updated_at')
        // safe: guaranteed-row
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-chat-conversations'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    },
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LiveChatConversation> & { id: string }) => {
      // Remove fields that don't exist in DB or need type conversion
      const { etablissement, assigned_agent, messages, last_message, unread_count, visitor_metadata, ...dbUpdates } = updates;
      const { error } = await supabase
        .from('live_chat_conversations')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['live-chat-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['live-chat-conversation', variables.id] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    },
  });
}

export function useAssignConversation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentProfile } = useCurrentProfile();

  return useMutation({
    mutationFn: async ({ conversationId, agentId }: { conversationId: string; agentId: string | null }) => {
      const updates: Record<string, unknown> = {
        assigned_to: agentId,
        status: agentId ? 'active' : 'waiting',
      };

      if (agentId && !updates.first_response_at) {
        updates.first_response_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('live_chat_conversations')
        .update(updates as never)
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['live-chat-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['live-chat-conversation', variables.conversationId] });
      toast({ title: 'Conversation assignée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    },
  });
}

export function useResolveConversation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('live_chat_conversations')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['live-chat-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['live-chat-conversation', conversationId] });
      toast({ title: 'Conversation résolue' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    },
  });
}

export function useEscalateConversation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ conversationId, reason }: { conversationId: string; reason: string }) => {
      const { error } = await supabase
        .from('live_chat_conversations')
        .update({
          status: 'escalated',
          escalated_at: new Date().toISOString(),
          escalated_reason: reason,
        })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['live-chat-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['live-chat-conversation', conversationId] });
      toast({ title: 'Conversation escaladée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    },
  });
}

export function useCreateTicketFromChat() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ conversationId, subject, description }: { conversationId: string; subject: string; description: string }) => {
      // Get conversation details
      const { data: conversation, error: convError } = await supabase
        .from('live_chat_conversations')
        .select('id, etablissement_id, priority, status, ticket_id')
        .eq('id', conversationId)
        .maybeSingle();

      if (convError) throw convError;
      if (!conversation) throw new Error('Conversation introuvable ou supprimée');

      // Create support ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert([{
          titre: subject,
          description,
          etablissement_id: conversation.etablissement_id,
          statut: 'open',
          priorite: conversation.priority === 'urgent' ? 'high' : 'medium',
        }])
        .select()
        // safe: guaranteed-row
        .single();

      if (ticketError) throw ticketError;

      // Update conversation with ticket reference
      const { error: updateError } = await supabase
        .from('live_chat_conversations')
        .update({
          status: 'ticket_created',
          ticket_id: ticket.id,
        })
        .eq('id', conversationId);

      if (updateError) throw updateError;

      return ticket;
    },
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['live-chat-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['live-chat-conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast({ title: 'Ticket créé avec succès' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    },
  });
}

// ==================== MESSAGES ====================

export function useLiveChatMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  // Set up Realtime subscription for messages
  React.useEffect(() => {
    if (!conversationId) return;

    const handle = safeRealtimeChannel(`live-chat-messages-${conversationId}`, (channel) =>
      channel.on(
        'postgres_changes' as never,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        } as never,
        (() => {
          queryClient.invalidateQueries({ queryKey: ['live-chat-messages', conversationId] });
        }) as never
      )
    );
    return () => { handle.dispose(); };
  }, [conversationId, queryClient]);

  return useQuery({
    queryKey: ['live-chat-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('live_chat_messages')
        .select(`
          id, session_id, sender_type, sender_id, sender_name, content, read_at, created_at,
          sender:profiles(id, nom, prenom)
        `)
        .eq('conversation_id' as never, conversationId)
        .order('created_at', { ascending: true })
        .limit(1000);

      if (error) throw error;
      return data as unknown as LiveChatMessage[];
    },
    enabled: !!conversationId,
    ...queryPresets.frequent, // 30 seconds - Realtime handles updates
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { data: currentProfile } = useCurrentProfile();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
      contentType = 'text',
      isInternal = false,
      senderType = 'agent',
    }: {
      conversationId: string;
      content: string;
      contentType?: string;
      isInternal?: boolean;
      senderType?: 'visitor' | 'agent' | 'bot' | 'system';
    }) => {
      const { data, error } = await supabase
        .from('live_chat_messages')
        .insert({
          session_id: conversationId,
          content,
          sender_type: senderType,
          sender_id: senderType === 'agent' ? currentProfile?.id : null,
        })
        .select('id, session_id, sender_type, sender_id, sender_name, content, read_at, created_at')
        // safe: guaranteed-row
        .single();

      if (error) throw error;

      // Update conversation updated_at
      await supabase
        .from('live_chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['live-chat-messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['live-chat-conversations'] });
    },
  });
}

// ==================== AGENTS ====================

export function useLiveChatAgents() {
  return useQuery({
    queryKey: ['live-chat-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_chat_agents')
        .select(`
          id, profile_id, is_available, max_concurrent_chats, current_chat_count,
          specialties, last_active_at, created_at, updated_at,
          profile:profiles(id, nom, prenom, avatar_url)
        `)
        .order('is_available', { ascending: false });

      if (error) throw error;
      return data as unknown as LiveChatAgent[];
    },
  });
}

export function useToggleAgentAvailability() {
  const queryClient = useQueryClient();
  const { data: currentProfile } = useCurrentProfile();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (isAvailable: boolean) => {
      if (!currentProfile?.id) throw new Error('Non authentifié');

      // Upsert agent record
      const { error } = await supabase
        .from('live_chat_agents')
        .upsert({
          profile_id: currentProfile.id,
          is_available: isAvailable,
          last_active_at: new Date().toISOString(),
        }, {
          onConflict: 'profile_id',
        });

      if (error) throw error;
    },
    onSuccess: (_, isAvailable) => {
      queryClient.invalidateQueries({ queryKey: ['live-chat-agents'] });
      toast({ 
        title: isAvailable ? 'Vous êtes maintenant disponible' : 'Vous êtes hors ligne',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    },
  });
}

// ==================== SETTINGS ====================

export function useLiveChatSettings() {
  return useQuery({
    queryKey: ['live-chat-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_chat_settings')
        .select('id, etablissement_id, is_global, is_enabled, welcome_message, offline_message, business_hours, auto_reply_enabled, auto_reply_delay_seconds, max_queue_size, widget_color, widget_position, created_at, updated_at')
        .eq('is_global', true)
        .maybeSingle();

      if (error) throw error;
      return data as LiveChatSettings | null;
    },
  });
}

export function useUpdateLiveChatSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: Partial<LiveChatSettings>) => {
      const { id, business_hours, ...rest } = settings;
      // Cast business_hours to Json type for Supabase
      const updateData = business_hours 
        ? { ...rest, business_hours: JSON.parse(JSON.stringify(business_hours)) }
        : rest;
      const { error } = await supabase
        .from('live_chat_settings')
        .update(updateData)
        .eq('is_global', true);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-chat-settings'] });
      toast({ title: 'Paramètres mis à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    },
  });
}

// ==================== QUICK REPLIES ====================

export function useLiveChatQuickReplies() {
  return useQuery({
    queryKey: ['live-chat-quick-replies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_chat_quick_replies')
        .select('id, title, content, category, shortcut, usage_count, is_active, created_by, created_at, updated_at')
        .eq('is_active', true)
        .order('usage_count', { ascending: false });

      if (error) throw error;
      return data as LiveChatQuickReply[];
    },
  });
}

export function useCreateQuickReply() {
  const queryClient = useQueryClient();
  const { data: currentProfile } = useCurrentProfile();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Partial<LiveChatQuickReply>) => {
      const { error } = await supabase
        .from('live_chat_quick_replies')
        .insert([{
          title: data.title || '',
          content: data.content || '',
          category: data.category || null,
          shortcut: data.shortcut || null,
          created_by: currentProfile?.id || null,
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-chat-quick-replies'] });
      toast({ title: 'Réponse rapide créée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    },
  });
}

// ==================== KPIs ====================

export function useLiveChatKPIs() {
  return useQuery({
    queryKey: ['live-chat-kpis'],
    queryFn: async (): Promise<LiveChatKPIs> => {
      // RPC server-side: agrégation 30j (évite fetch 5000 conversations)
      const { data, error } = await (supabase as any).rpc('get_live_chat_kpis');
      if (error) throw error;

      const k = (data || {}) as Partial<LiveChatKPIs>;
      return {
        total_conversations: Number(k.total_conversations) || 0,
        active_conversations: Number(k.active_conversations) || 0,
        waiting_conversations: Number(k.waiting_conversations) || 0,
        resolved_today: Number(k.resolved_today) || 0,
        avg_response_time_minutes: Number(k.avg_response_time_minutes) || 0,
        avg_resolution_time_minutes: Number(k.avg_resolution_time_minutes) || 0,
        satisfaction_avg: Number(k.satisfaction_avg) || 0,
        escalation_rate: Number(k.escalation_rate) || 0,
        agents_online: Number(k.agents_online) || 0,
      };
    },
    refetchInterval: 120000,
    refetchOnWindowFocus: false,
  });
}
