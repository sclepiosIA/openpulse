import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

export interface NotificationPreferences {
  email_notifications: {
    ai_suggestions: {
      enabled: boolean;
      frequency: 'daily' | 'weekly' | 'never';
    };
    task_reminders: {
      enabled: boolean;
      frequency: 'daily' | 'weekly' | 'never';
    };
    urgent_tasks: {
      enabled: boolean;
      threshold_days: number;
    };
    establishment_updates: {
      enabled: boolean;
    };
    team_mentions: {
      enabled: boolean;
    };
  };
  in_app_notifications: {
    ai_suggestions: boolean;
    task_assignments: boolean;
    task_completions: boolean;
    establishment_status_changes: boolean;
    comments_mentions: boolean;
  };
  quiet_hours: {
    enabled: boolean;
    start_time: string;
    end_time: string;
  };
}

const defaultPreferences: NotificationPreferences = {
  email_notifications: {
    ai_suggestions: {
      enabled: true,
      frequency: 'daily',
    },
    task_reminders: {
      enabled: true,
      frequency: 'daily',
    },
    urgent_tasks: {
      enabled: true,
      threshold_days: 7,
    },
    establishment_updates: {
      enabled: true,
    },
    team_mentions: {
      enabled: true,
    },
  },
  in_app_notifications: {
    ai_suggestions: true,
    task_assignments: true,
    task_completions: true,
    establishment_status_changes: true,
    comments_mentions: true,
  },
  quiet_hours: {
    enabled: false,
    start_time: '22:00',
    end_time: '08:00',
  },
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences = defaultPreferences, isLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return defaultPreferences;

      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      // Safely parse preferences (data may be null for brand-new accounts)
      const prefs = (data?.preferences ?? {}) as Record<string, unknown>;
      const notificationPrefs = (prefs.notifications ?? {}) as Partial<NotificationPreferences>;

      // Merge with defaults to ensure all properties exist
      return {
        ...defaultPreferences,
        ...notificationPrefs,
      } as NotificationPreferences;
    },
    enabled: !!user?.id,
  });

  const updatePreferences = useMutation({
    mutationFn: async (newPreferences: Partial<NotificationPreferences>) => {
      if (!user?.id) throw new Error("User not authenticated");

      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle();

      // Safely parse current preferences (currentProfile may be null)
      const currentPrefs = (currentProfile?.preferences ?? {}) as Record<string, unknown>;
      const currentNotifications = (currentPrefs.notifications ?? {}) as Partial<NotificationPreferences>;

      const updatedPreferences = {
        ...currentPrefs,
        notifications: {
          ...defaultPreferences,
          ...currentNotifications,
          ...newPreferences,
        },
      };

      const { error } = await supabase
        .from('profiles')
        .update({ preferences: updatedPreferences })
        .eq('user_id', user.id);

      if (error) throw error;

      return updatedPreferences.notifications;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['notification-preferences', user?.id], data);
      toast.success("Préférences de notification enregistrées");
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  return {
    preferences,
    isLoading,
    updatePreferences: updatePreferences.mutate,
    isUpdating: updatePreferences.isPending,
  };
}
