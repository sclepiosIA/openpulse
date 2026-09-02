import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { debug } from '@/lib/debug';

export type OAuthProvider = 'google' | 'microsoft' | 'zoom' | 'nextcloud';

export interface ConnectionStatus {
  connected: boolean;
  email?: string;
  instanceUrl?: string;
  shared?: boolean;
}

export type ConnectionsMap = Record<OAuthProvider, ConnectionStatus>;

/**
 * Hook to get OAuth connection status
 * Since we now use shared admin accounts, Google and Nextcloud are always "connected"
 * via the shared Supabase secrets
 */
export function useOAuthConnections() {
  return useQuery({
    queryKey: ['oauth-connections'],
    queryFn: async (): Promise<ConnectionsMap> => {
      // With the shared account architecture, Google Meet and Nextcloud Talk
      // are always available for all authenticated users
      // The actual credentials are stored as Supabase Edge Function secrets
      
      return {
        google: { 
          connected: true, 
          email: 'Compte partagé', 
          shared: true 
        },
        nextcloud: { 
          connected: true, 
          instanceUrl: 'Compte partagé',
          shared: true 
        },
        microsoft: { connected: false },
        zoom: { connected: false }
      };
    },
    staleTime: Infinity, // Never stale since it's static
  });
}

/**
 * @deprecated - No longer needed with shared account architecture
 * Kept for backwards compatibility
 */
export function useInitGoogleOAuth() {
  return useMutation({
    mutationFn: async () => {
      toast({
        title: 'Google Meet disponible',
        description: 'Google Meet est déjà configuré via le compte partagé.',
      });
      return null;
    }
  });
}

/**
 * @deprecated - No longer needed with shared account architecture
 */
export function useDisconnectOAuth() {
  return useMutation({
    mutationFn: async (provider: OAuthProvider) => {
      toast({
        title: 'Action non disponible',
        description: 'Les services de visioconférence sont gérés par un compte partagé.',
      });
      return null;
    }
  });
}

/**
 * @deprecated - No longer needed with shared account architecture
 * Nextcloud config is now stored as Supabase secrets
 */
export function useSaveNextcloudConfig() {
  return useMutation({
    mutationFn: async (config: { instanceUrl: string; username: string; appPassword: string }) => {
      toast({
        title: 'Configuration Nextcloud',
        description: 'Nextcloud Talk est déjà configuré via le compte partagé.',
      });
      return null;
    }
  });
}

/**
 * Create a Google Meet link using the shared admin account
 */
export function useCreateGoogleMeetLink() {
  return useMutation({
    mutationFn: async ({ title, startTime, endTime }: { 
      title: string; 
      startTime?: string; 
      endTime?: string 
    }) => {
      const { data, error } = await supabase.functions.invoke('create-google-meet-link', {
        body: { title, startTime, endTime }
      });

      if (error) {
        debug.error('Error creating Google Meet link:', error);
        throw new Error(error.message || 'Erreur lors de la création du lien Meet');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erreur inconnue');
      }

      toast({
        title: 'Lien Google Meet créé',
        description: 'Le lien a été ajouté à l\'événement',
      });

      return data.meetLink;
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur Google Meet',
        description: sanitizeSupabaseError(error),
        variant: 'destructive'
      });
    }
  });
}

/**
 * Create a Nextcloud Talk room using the shared admin account
 */
export function useCreateNextcloudTalkLink() {
  return useMutation({
    mutationFn: async ({ title }: { title: string }) => {
      const { data, error } = await supabase.functions.invoke('create-nextcloud-talk-link', {
        body: { title }
      });

      if (error) {
        debug.error('Error creating Nextcloud Talk link:', error);
        throw new Error(error.message || 'Erreur lors de la création de la salle Talk');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erreur inconnue');
      }

      toast({
        title: 'Salle Nextcloud Talk créée',
        description: 'Le lien a été ajouté à l\'événement',
      });

      return data.talkLink;
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur Nextcloud Talk',
        description: sanitizeSupabaseError(error),
        variant: 'destructive'
      });
    }
  });
}
