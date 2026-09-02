import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { toast } from 'sonner';
import { debug } from '@/lib/debug';

export type EntityType = 'etablissement' | 'contact' | 'groupe' | 'tache' | 'evenement' | 'partenaire' | 'todo' | 'poll';

export interface PulseEntityLink {
  id: string;
  message_id: string;
  conversation_id: string;
  entity_type: EntityType;
  entity_id: string;
  entity_name: string;
  created_by: string | null;
  created_at: string;
}

export interface PendingEntityLink {
  entity_type: EntityType;
  entity_id: string;
  entity_name: string;
}

// Query keys
export const pulseEntityLinkKeys = {
  all: ['pulse-entity-links'] as const,
  byMessage: (messageId: string) => [...pulseEntityLinkKeys.all, 'message', messageId] as const,
  byEntity: (entityType: EntityType, entityId: string) => 
    [...pulseEntityLinkKeys.all, 'entity', entityType, entityId] as const,
  byConversation: (conversationId: string) => 
    [...pulseEntityLinkKeys.all, 'conversation', conversationId] as const,
};

// Fetch entity links for a message
async function fetchEntityLinksByMessage(messageId: string): Promise<PulseEntityLink[]> {
  const { data, error } = await supabase
    .from('pulse_message_entity_links')
    .select('id, message_id, conversation_id, entity_type, entity_id, entity_name, created_by, created_at')
    .eq('message_id', messageId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as PulseEntityLink[];
}

// Fetch messages linked to an entity
async function fetchMessagesByEntity(
  entityType: EntityType, 
  entityId: string
): Promise<PulseEntityLink[]> {
  const { data, error } = await supabase
    .from('pulse_message_entity_links')
    .select('id, message_id, conversation_id, entity_type, entity_id, entity_name, created_by, created_at')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as PulseEntityLink[];
}

// Hook: Get entity links for a message
export function usePulseEntityLinksByMessage(messageId: string | undefined) {
  return useQuery({
    queryKey: pulseEntityLinkKeys.byMessage(messageId || ''),
    queryFn: () => fetchEntityLinksByMessage(messageId!),
    enabled: !!messageId,
    // Uses global staleTime from QueryClient (2 min)
  });
}

// Hook: Get messages linked to an entity
export function usePulseMessagesByEntity(entityType: EntityType, entityId: string | undefined) {
  return useQuery({
    queryKey: pulseEntityLinkKeys.byEntity(entityType, entityId || ''),
    queryFn: () => fetchMessagesByEntity(entityType, entityId!),
    enabled: !!entityId,
    // Uses global staleTime from QueryClient (2 min)
  });
}

// Hook: Create entity links for a message
export function useCreatePulseEntityLinks() {
  const queryClient = useQueryClient();
  const { data: currentProfile } = useCurrentProfile();

  return useMutation({
    mutationFn: async ({
      messageId,
      conversationId,
      entityLinks,
    }: {
      messageId: string;
      conversationId: string;
      entityLinks: PendingEntityLink[];
    }) => {
      if (!currentProfile?.id || entityLinks.length === 0) return [];

      const linksToInsert = entityLinks.map(link => ({
        message_id: messageId,
        conversation_id: conversationId,
        entity_type: link.entity_type,
        entity_id: link.entity_id,
        entity_name: link.entity_name,
        created_by: currentProfile.id,
      }));

      const { data, error } = await supabase
        .from('pulse_message_entity_links')
        .insert(linksToInsert)
        .select();

      if (error) throw error;
      return (data || []) as PulseEntityLink[];
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: pulseEntityLinkKeys.byMessage(variables.messageId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: pulseEntityLinkKeys.byConversation(variables.conversationId) 
      });
      // Invalidate entity-specific queries
      variables.entityLinks.forEach(link => {
        queryClient.invalidateQueries({ 
          queryKey: pulseEntityLinkKeys.byEntity(link.entity_type, link.entity_id) 
        });
      });
    },
    onError: (error: Error) => {
      debug.error('Error creating entity links:', error);
      toast.error('Erreur lors de la liaison des entités');
    },
  });
}

// Hook: Delete an entity link
export function useDeletePulseEntityLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from('pulse_message_entity_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pulseEntityLinkKeys.all });
      toast.success('Lien supprimé');
    },
    onError: (error: Error) => {
      debug.error('Error deleting entity link:', error);
      toast.error('Erreur lors de la suppression du lien');
    },
  });
}

// Helper: Extract pending entity links from message content
export function extractEntityLinksFromContent(content: string): PendingEntityLink[] {
  const regex = /#\[([^\]]+)\]\((\w+):([^)]+)\)/g;
  const links: PendingEntityLink[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const [, name, type, id] = match;
    if (['etablissement', 'contact', 'groupe', 'tache', 'evenement', 'partenaire', 'todo', 'poll'].includes(type)) {
      links.push({
        entity_type: type as EntityType,
        entity_id: id,
        entity_name: name,
      });
    }
  }

  return links;
}
