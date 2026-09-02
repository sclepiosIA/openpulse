import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { debug } from '@/lib/debug';

export type VisioProvider = 'marque_meet' | 'google_meet' | 'nextcloud_talk';

interface VisioResult {
  link: string;
  provider: VisioProvider;
  eventId?: string;
  roomCode?: string;
}

export function usePulseVisio() {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const createVisioLink = useCallback(async (
    provider: VisioProvider,
    title: string,
    conversationId?: string
  ): Promise<VisioResult | null> => {
    setIsCreating(true);

    try {
      // Handle internal OpenPulse Meet
      if (provider === 'marque_meet') {
        const { data, error } = await supabase.functions.invoke('webrtc-signaling', {
          body: { 
            action: 'create-room', 
            name: title,
            conversationId,
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        toast({
          title: 'Visio créée',
          description: 'Salle OpenPulse Meet créée avec succès',
        });

        return {
          link: data.room.link,
          provider,
          roomCode: data.room.roomCode,
        };
      }

      // Handle external providers
      const functionName = provider === 'google_meet' 
        ? 'create-google-meet-link' 
        : 'create-nextcloud-talk-link';

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { title },
      });

      if (error) throw error;

      const link = provider === 'google_meet' 
        ? data.meetLink 
        : data.talkLink;

      if (!link) {
        throw new Error('No link returned from server');
      }

      toast({
        title: 'Visio créée',
        description: `Lien ${provider === 'google_meet' ? 'Google Meet' : 'Nextcloud Talk'} généré`,
      });

      return { link, provider, eventId: data.eventId };
    } catch (error: unknown) {
      debug.error('Visio creation error:', error);
      toast({
        title: 'Erreur',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [toast]);

  return { isCreating, createVisioLink };
}
