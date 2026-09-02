import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useEffect, useId } from 'react';
import { toast } from 'sonner';

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'ai_suggestion' | 'task_assignment' | 'task_completion' | 'establishment_update' | 'mention' | 'other';
  related_id: string | null;
  related_type: 'etablissement' | 'tache' | 'ai_suggestion' | 'email' | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export function useInAppNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['in-app-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('in_app_notifications')
        .select('id, user_id, title, message, type, related_id, related_type, is_read, created_at, read_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as InAppNotification[];
    },
    enabled: !!user?.id,
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Identifiant propre à chaque instance du hook : le nom du canal doit être
  // unique. Ce hook est monté simultanément par le badge du layout, la cloche
  // du header et la page Centre de notifications ; avec un nom partagé,
  // Supabase renvoyait le canal déjà souscrit et l'ajout d'un écouteur levait
  // « cannot add postgres_changes callbacks after subscribe() », capté par
  // l'ErrorBoundary — /notifications affichait « Une erreur est survenue ».
  const instanceId = useId();

  // Set up realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`in_app_notifications_changes-${user.id}-${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['in-app-notifications', user.id] });
          
          // Show toast for new notification
          const newNotif = payload.new as InAppNotification;
          toast.info(newNotif.title, {
            description: newNotif.message,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['in-app-notifications', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, instanceId]);

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('in_app_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-app-notifications', user?.id] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;

      const { error } = await supabase
        .from('in_app_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-app-notifications', user?.id] });
      toast.success('Toutes les notifications ont été marquées comme lues');
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('in_app_notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-app-notifications', user?.id] });
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    deleteNotification: deleteNotification.mutate,
  };
}
