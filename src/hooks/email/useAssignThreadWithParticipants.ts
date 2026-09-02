import { useState } from 'react';
import { debug } from '@/lib/debug';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { EntityType } from '../search/useMultiEntitySearch';

export interface Participant {
  email: string;
  name?: string | null;
}

export interface AssignThreadParams {
  threadId: string;
  entityType: EntityType;
  entityId: string;
  entityName: string;
  participants: Participant[];
  selectedParticipantEmails: string[]; // Emails sélectionnés pour créer des contacts
}

/**
 * Hook pour associer un thread email à une entité (établissement/groupe/partenaire)
 * et optionnellement créer des contacts pour les participants sélectionnés
 */
export function useAssignThreadWithParticipants() {
  const [isAssigning, setIsAssigning] = useState(false);
  const queryClient = useQueryClient();

  const assignThread = async ({
    threadId,
    entityType,
    entityId,
    entityName,
    participants,
    selectedParticipantEmails,
  }: AssignThreadParams): Promise<boolean> => {
    setIsAssigning(true);

    try {
      // 1. Préparer les colonnes à mettre à jour selon le type d'entité
      const threadUpdate: Record<string, string | null> = {
        etablissement_id: null,
        groupe_id: null,
        partenaire_id: null,
      };

      if (entityType === 'etablissement') {
        threadUpdate.etablissement_id = entityId;
      } else if (entityType === 'groupe') {
        threadUpdate.groupe_id = entityId;
      } else if (entityType === 'partenaire') {
        threadUpdate.partenaire_id = entityId;
      }

      // 2. Mettre à jour le thread
      const { error: threadError } = await supabase
        .from('email_threads')
        .update(threadUpdate as never)
        .eq('id', threadId);

      if (threadError) throw threadError;

      // 3. Pour chaque participant sélectionné, créer contact + mapping
      const selectedParticipants = participants.filter(p => 
        selectedParticipantEmails.includes(p.email.toLowerCase())
      );

      for (const participant of selectedParticipants) {
        const normalizedEmail = participant.email.toLowerCase().trim();
        
        // Extraire nom/prénom si possible
        const nameParts = (participant.name || '').split(' ').filter(Boolean);
        const prenom = nameParts[0] || null;
        const nom = nameParts.slice(1).join(' ') || nameParts[0] || normalizedEmail.split('@')[0];

        // Créer ou mettre à jour le contact selon le type d'entité
        if (entityType === 'etablissement' || entityType === 'groupe') {
          const contactData = {
            email: normalizedEmail,
            nom,
            prenom,
            fonction: 'Contact',
            ...(entityType === 'etablissement' 
              ? { etablissement_id: entityId, groupe_id: null }
              : { groupe_id: entityId, etablissement_id: null }
            ),
            created_source: 'manual_email_association',
          };

          // Upsert contact
          const { error: contactError } = await supabase
            .from('contacts')
            .upsert(contactData as never, {
              onConflict: 'email',
              ignoreDuplicates: false,
            });

          if (contactError) {
            debug.error('Error creating contact:', contactError);
          }
        } else if (entityType === 'partenaire') {
          // Pour les partenaires, utiliser partenaires_contacts
          const { error: partenaireContactError } = await supabase
            .from('partenaires_contacts')
            .upsert({
              partenaire_id: entityId,
              email: normalizedEmail,
              nom,
              prenom,
              fonction: 'Contact',
            }, {
              onConflict: 'email',
              ignoreDuplicates: false,
            });

          if (partenaireContactError) {
            debug.error('Error creating partenaire contact:', partenaireContactError);
          }
        }

        // Créer le mapping email spécifique pour auto-classification future
        const mappingData = {
          email_address: normalizedEmail,
          niveau_mapping: 'manuel',
          confidence_level: 'high',
          verified: true,
          ...(entityType === 'etablissement' && { etablissement_id: entityId }),
          ...(entityType === 'groupe' && { groupe_id: entityId }),
          ...(entityType === 'partenaire' && { partenaire_id: entityId }),
        };

        const { error: mappingError } = await supabase
          .from('email_specific_mappings')
          .upsert(mappingData, {
            onConflict: 'email_address',
            ignoreDuplicates: false,
          });

        if (mappingError) {
          debug.error('Error creating email mapping:', mappingError);
        }
      }

      // 4. Propager l'affiliation aux threads antérieurs des participants sélectionnés
      const participantEmails = selectedParticipants.map(p => p.email.toLowerCase());
      let pastThreadsUpdated = 0;
      
      if (participantEmails.length > 0) {
        // Trouver tous les messages des participants sélectionnés
        const { data: relatedMessages } = await supabase
          .from('email_messages')
          .select('thread_id')
          .in('from_address', participantEmails);

        // Récupérer les IDs uniques des threads (hors thread actuel)
        const pastThreadIds = [...new Set(relatedMessages?.map(m => m.thread_id) || [])]
          .filter(id => id !== threadId);

        if (pastThreadIds.length > 0) {
          // Chunking pour éviter les erreurs 400 (limite PostgREST de ~50 IDs)
          const CHUNK_SIZE = 50;
          let totalUpdated = 0;
          
          for (let i = 0; i < pastThreadIds.length; i += CHUNK_SIZE) {
            const chunk = pastThreadIds.slice(i, i + CHUNK_SIZE);
            
            const { data: updatedPastThreads } = await supabase
              .from('email_threads')
              .update(threadUpdate as never)
              .in('id', chunk)
              .is('etablissement_id', null)
              .is('partenaire_id', null)
              .is('groupe_id', null)
              .select('id');

            totalUpdated += updatedPastThreads?.length || 0;
          }
          
          pastThreadsUpdated = totalUpdated;
          if (pastThreadsUpdated > 0) {
            debug.log(`📧 ${pastThreadsUpdated} threads passés associés automatiquement à ${entityName}`);
          }
        }
      }

      // 5. Invalider les caches React Query
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['email-threads'] }),
        queryClient.invalidateQueries({ queryKey: ['contacts'] }),
        queryClient.invalidateQueries({ queryKey: ['email-specific-mappings'] }),
      ]);

      // 6. Dispatch event pour rafraîchir la UI
      window.dispatchEvent(new CustomEvent('email-thread-updated', { 
        detail: { threadId, entityType, entityId } 
      }));

      const contactCount = selectedParticipants.length;
      const contactMsg = contactCount > 0 
        ? ` et ${contactCount} contact${contactCount > 1 ? 's' : ''} créé${contactCount > 1 ? 's' : ''}`
        : '';
      const pastMsg = pastThreadsUpdated > 0 
        ? ` (+ ${pastThreadsUpdated} thread${pastThreadsUpdated > 1 ? 's' : ''} antérieur${pastThreadsUpdated > 1 ? 's' : ''})`
        : '';
      
      toast.success(`Thread associé à ${entityName}${contactMsg}${pastMsg}`);
      return true;
    } catch (error) {
      debug.error('Error assigning thread:', error);
      toast.error("Erreur lors de l'association du thread");
      return false;
    } finally {
      setIsAssigning(false);
    }
  };

  return { assignThread, isAssigning };
}
