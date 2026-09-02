/**
 * useJarvisConversationPersistence - Persistance des conversations Jarvis
 * 
 * Sauvegarde et restaure les conversations depuis la base de données
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import type { JarvisChatMessage } from '@/types/jarvis';

interface SavedConversation {
  id: string;
  user_id: string;
  title: string | null;
  messages: JarvisChatMessage[];
  created_at: string;
  updated_at: string;
  is_archived: boolean;
}

interface UseJarvisConversationPersistenceReturn {
  conversations: SavedConversation[];
  currentConversationId: string | null;
  isLoading: boolean;
  
  // Actions
  createConversation: (title?: string) => Promise<string | null>;
  loadConversation: (id: string) => Promise<JarvisChatMessage[] | null>;
  saveMessages: (messages: JarvisChatMessage[], conversationId?: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  archiveConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  setCurrentConversation: (id: string | null) => void;
}

export function useJarvisConversationPersistence(): UseJarvisConversationPersistenceReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Fetch all conversations
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['jarvis-conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('jarvis_conversations')
        .select('id, user_id, title, messages, created_at, updated_at, is_archived')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      return (data || []).map(conv => ({
        ...conv,
        messages: Array.isArray(conv.messages) 
          ? (conv.messages as unknown as JarvisChatMessage[]).map(m => ({
              ...m,
              timestamp: new Date(m.timestamp)
            }))
          : []
      })) as SavedConversation[];
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000, // 1 minute
  });

  // Create new conversation
  const createMutation = useMutation({
    mutationFn: async (title?: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('jarvis_conversations')
        .insert({
          user_id: user.id,
          title: title || `Conversation ${new Date().toLocaleDateString('fr-FR')}`,
          messages: [],
          is_archived: false,
          is_autonomous: false,
          model_used: 'gpt-5',
          total_tokens: 0,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ['jarvis-conversations'] });
      setCurrentConversationId(newId);
    },
  });

  // Save messages - accepts conversationId as param to handle race conditions
  const saveMutation = useMutation({
    mutationFn: async ({ messages, conversationId }: { messages: JarvisChatMessage[]; conversationId: string }) => {
      if (!user?.id || !conversationId) return;

      // Serialize messages to JSON-compatible format
      const serializedMessages = messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
        toolCalls: m.toolCalls?.map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: JSON.parse(JSON.stringify(tc.arguments)),
          status: tc.status,
          result: tc.result ? {
            success: tc.result.success,
            data: tc.result.data,
            error: tc.result.error,
            execution_time_ms: tc.result.execution_time_ms,
          } : undefined,
        })),
      }));

      const { error } = await supabase
        .from('jarvis_conversations')
        .update({
          // Cast to Json type explicitly
          messages: JSON.parse(JSON.stringify(serializedMessages)),
          updated_at: new Date().toISOString(),
          // Auto-generate title from first message if none
          ...(messages.length === 1 && {
            title: messages[0].content.substring(0, 50) + (messages[0].content.length > 50 ? '...' : '')
          })
        })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jarvis-conversations'] });
    },
  });

  // Delete conversation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('jarvis_conversations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['jarvis-conversations'] });
      if (currentConversationId === deletedId) {
        setCurrentConversationId(null);
      }
    },
  });

  // Archive conversation
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('jarvis_conversations')
        .update({ is_archived: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jarvis-conversations'] });
    },
  });

  // Rename conversation
  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from('jarvis_conversations')
        .update({ title })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jarvis-conversations'] });
    },
  });

  // Load specific conversation
  const loadConversation = useCallback(async (id: string): Promise<JarvisChatMessage[] | null> => {
    const conversation = conversations.find(c => c.id === id);
    if (conversation) {
      setCurrentConversationId(id);
      return conversation.messages;
    }

    // Fetch from DB if not in cache
    const { data, error } = await supabase
      .from('jarvis_conversations')
      .select('messages')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    setCurrentConversationId(id);
    return Array.isArray(data.messages) 
      ? (data.messages as unknown as JarvisChatMessage[]).map(m => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }))
      : [];
  }, [conversations]);

  const saveMessagesStable = useCallback(async (messages: JarvisChatMessage[], conversationId?: string) => {
    const targetId = conversationId || currentConversationId;
    if (targetId) {
      await saveMutation.mutateAsync({ messages, conversationId: targetId });
    }
  }, [currentConversationId, saveMutation]);

  return {
    conversations,
    currentConversationId,
    isLoading,
    
    createConversation: async (title) => createMutation.mutateAsync(title),
    loadConversation,
    saveMessages: saveMessagesStable,
    deleteConversation: async (id) => deleteMutation.mutateAsync(id),
    archiveConversation: async (id) => archiveMutation.mutateAsync(id),
    renameConversation: async (id, title) => renameMutation.mutateAsync({ id, title }),
    setCurrentConversation: setCurrentConversationId,
  };
}
