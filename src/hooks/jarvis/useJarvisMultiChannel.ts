/**
 * useJarvisMultiChannel - Hook pour les actions multi-canaux JARVIS 6.0
 * 
 * Permet d'envoyer des messages via différents canaux :
 * - Email, SMS, Slack, Teams, WhatsApp
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/shared/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

export type ChannelType = 'email' | 'sms' | 'slack' | 'teams' | 'whatsapp';

export interface ChannelConfig {
  id: ChannelType;
  name: string;
  enabled: boolean;
  configured: boolean;
  icon: string;
}

export interface ChannelMessage {
  channel: ChannelType;
  recipient: string;
  subject?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelActionHistory {
  id: string;
  agent_id: string;
  channel: ChannelType;
  recipient: string;
  message_preview: string;
  status: 'sent' | 'failed';
  error_message?: string;
  external_id?: string;
  created_at: string;
}

export function useJarvisMultiChannel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [history, setHistory] = useState<ChannelActionHistory[]>([]);

  // Récupérer les canaux disponibles
  const fetchChannels = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.functions.invoke('jarvis-multi-channel', {
        body: {
          action: 'get_channels',
          user_id: user.id,
        }
      });

      if (error) throw error;

      // Ajouter les icônes
      const channelsWithIcons = (data.channels || []).map((c: ChannelConfig) => ({
        ...c,
        icon: getChannelIcon(c.id),
      }));

      setChannels(channelsWithIcons);
    } catch (error) {
      debug.error('[useJarvisMultiChannel] Error fetching channels:', error);
    }
  }, [user?.id]);

  // Récupérer l'historique des actions
  const fetchHistory = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.functions.invoke('jarvis-multi-channel', {
        body: {
          action: 'get_history',
          user_id: user.id,
        }
      });

      if (error) throw error;
      setHistory(data.history || []);
    } catch (error) {
      debug.error('[useJarvisMultiChannel] Error fetching history:', error);
    }
  }, [user?.id]);

  // Envoyer un message
  const sendMessage = useCallback(async (
    message: ChannelMessage,
    agentId: string = 'prime'
  ): Promise<{ success: boolean; message_id?: string; error?: string }> => {
    if (!user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('jarvis-multi-channel', {
        body: {
          action: 'send',
          user_id: user.id,
          agent_id: agentId,
          channel_message: message,
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: `✅ Message envoyé via ${getChannelName(message.channel)}`,
          description: `À ${message.recipient}`,
        });
        
        // Rafraîchir l'historique
        await fetchHistory();
      } else {
        toast({
          title: `Échec de l'envoi`,
          description: data.error || 'Erreur inconnue',
          variant: 'destructive',
        });
      }

      return data;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      toast({
        title: 'Erreur',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      });
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, toast, fetchHistory]);

  // Vérifier si un canal est disponible
  const isChannelAvailable = useCallback((channelId: ChannelType): boolean => {
    const channel = channels.find(c => c.id === channelId);
    return channel?.enabled && channel?.configured || false;
  }, [channels]);

  return {
    channels,
    history,
    isLoading,
    fetchChannels,
    fetchHistory,
    sendMessage,
    isChannelAvailable,
    availableChannels: channels.filter(c => c.enabled && c.configured),
  };
}

function getChannelIcon(channelId: ChannelType): string {
  switch (channelId) {
    case 'email': return '📧';
    case 'sms': return '📱';
    case 'slack': return '💬';
    case 'teams': return '🟦';
    case 'whatsapp': return '💚';
    default: return '📨';
  }
}

function getChannelName(channelId: ChannelType): string {
  switch (channelId) {
    case 'email': return 'Email';
    case 'sms': return 'SMS';
    case 'slack': return 'Slack';
    case 'teams': return 'Teams';
    case 'whatsapp': return 'WhatsApp';
    default: return channelId;
  }
}
