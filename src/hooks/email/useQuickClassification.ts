import { useMutation, useQueryClient } from "@tanstack/react-query";
import { debug } from "@/lib/debug";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/shared/use-toast";
import { isMarqueEmail, isGenericEmailDomain, extractEmailDomain, normalizeEmail } from "@/lib/internalEmailConfig";
import type {
  ClassifyThreadParams,
  ThreadClassificationUpdate,
  ClassifyThreadResult,
} from "@/types/classification";

/**
 * Extracts unique external email addresses from thread messages
 */
async function getExternalParticipants(threadId: string): Promise<string[]> {
  const { data: messages } = await supabase
    .from("email_messages")
    .select("from_address, to_addresses, cc_addresses")
    .eq("thread_id", threadId);

  if (!messages) return [];

  const emails = new Set<string>();
  for (const msg of messages) {
    const fromEmail = normalizeEmail(msg.from_address);
    if (fromEmail && !isMarqueEmail(fromEmail)) {
      emails.add(fromEmail);
    }
    for (const addr of (msg.to_addresses as string[] || [])) {
      const email = normalizeEmail(addr as string | undefined);
      if (email && !isMarqueEmail(email)) {
        emails.add(email);
      }
    }
    for (const addr of (msg.cc_addresses as string[] || [])) {
      const email = normalizeEmail(addr as string | undefined);
      if (email && !isMarqueEmail(email)) {
        emails.add(email);
      }
    }
  }
  return Array.from(emails);
}

/**
 * Creates email-specific and domain mappings for persistence,
 * then propagates classification to past threads with the same participants.
 */
async function createMappingsAndPropagate(
  threadId: string,
  updates: ThreadClassificationUpdate
) {
  try {
    const externalEmails = await getExternalParticipants(threadId);
    if (externalEmails.length === 0) return;

    // Determine the entity type for mappings
    const entityData: { 
      etablissement_id?: string | null;
      groupe_id?: string | null;
      partenaire_id?: string | null;
      niveau_mapping: string;
    } = {
      etablissement_id: updates.etablissement_id || null,
      groupe_id: updates.groupe_id || null,
      partenaire_id: updates.partenaire_id || null,
      niveau_mapping: updates.etablissement_id ? 'etablissement' : updates.groupe_id ? 'groupe' : 'partenaire',
    };

    // 1. Create email_specific_mappings for each external participant
    for (const email of externalEmails) {
      try {
        await supabase
          .from("email_specific_mappings")
          .upsert({
            email_address: email,
            etablissement_id: entityData.etablissement_id,
            groupe_id: entityData.groupe_id,
            partenaire_id: entityData.partenaire_id,
            niveau_mapping: entityData.niveau_mapping,
            is_unaffiliated: false,
            source: 'manual_quick',
          } as never, { onConflict: 'email_address' });
      } catch (err) {
        debug.warn(`Failed to upsert email_specific_mapping for ${email}:`, err);
      }
    }

    // 2. Create email_domain_mapping for the first professional domain found
    const domainsProcessed = new Set<string>();
    for (const email of externalEmails) {
      const domain = extractEmailDomain(email);
      if (!domain || isGenericEmailDomain(domain) || domainsProcessed.has(domain)) continue;
      domainsProcessed.add(domain);

      try {
        // Check if mapping already exists
        const { data: existing } = await supabase
          .from("email_domain_mappings")
          .select("id")
          .eq("domain", domain)
          .maybeSingle();

        if (!existing) {
          await supabase
            .from("email_domain_mappings")
            .insert({
              domain,
              etablissement_id: entityData.etablissement_id,
              groupe_id: entityData.groupe_id,
              partenaire_id: entityData.partenaire_id,
              niveau_mapping: entityData.niveau_mapping,
              confidence_level: 'medium',
              verified: false,
              source: 'manual_quick',
            } as never);
        }
      } catch (err) {
        debug.warn(`Failed to create domain mapping for ${domain}:`, err);
      }
    }

    // 3. Propagate to past threads with the same participants
    if (externalEmails.length > 0) {
      try {
        // Find threads that have messages from the same external participants
        // and are not yet classified
        const CHUNK_SIZE = 50;
        const emailChunks: string[][] = [];
        for (let i = 0; i < externalEmails.length; i += CHUNK_SIZE) {
          emailChunks.push(externalEmails.slice(i, i + CHUNK_SIZE));
        }

        const relatedThreadIds = new Set<string>();

        for (const chunk of emailChunks) {
          const { data: relatedMessages } = await supabase
            .from("email_messages")
            .select("thread_id")
            .in("from_address", chunk)
            .neq("thread_id", threadId);

          if (relatedMessages) {
            for (const msg of relatedMessages) {
              relatedThreadIds.add(msg.thread_id);
            }
          }
        }

        if (relatedThreadIds.size > 0) {
          const threadIdsArray = Array.from(relatedThreadIds);
          // Update only unclassified threads
          for (let i = 0; i < threadIdsArray.length; i += CHUNK_SIZE) {
            const batch = threadIdsArray.slice(i, i + CHUNK_SIZE);
            
            const updatePayload: Record<string, string | null> = {};
            if (updates.etablissement_id !== undefined) updatePayload.etablissement_id = updates.etablissement_id;
            if (updates.partenaire_id !== undefined) updatePayload.partenaire_id = updates.partenaire_id;
            if (updates.groupe_id !== undefined) updatePayload.groupe_id = updates.groupe_id;

            await supabase
              .from("email_threads")
              .update(updatePayload as never)
              .in("id", batch)
              .is("etablissement_id", null)
              .is("partenaire_id", null)
              .is("groupe_id", null);
          }

          debug.log(`✅ Quick classification propagated to ${relatedThreadIds.size} related threads`);
        }
      } catch (err) {
        debug.warn("Failed to propagate classification to past threads:", err);
      }
    }
  } catch (err) {
    debug.error("Error in createMappingsAndPropagate:", err);
  }
}

export function useQuickClassification() {
  const queryClient = useQueryClient();

  const classifyThread = useMutation({
    mutationFn: async ({
      threadId,
      etablissementId,
      partenaireId,
      groupeId,
    }: ClassifyThreadParams): Promise<ClassifyThreadResult> => {
      const updates: ThreadClassificationUpdate = {};
      
      if (etablissementId !== undefined) updates.etablissement_id = etablissementId;
      if (partenaireId !== undefined) updates.partenaire_id = partenaireId;
      if (groupeId !== undefined) updates.groupe_id = groupeId;

      const { error } = await supabase
        .from("email_threads")
        .update(updates)
        .eq("id", threadId);

      if (error) throw error;

      // Create mappings and propagate to past threads (fire-and-forget)
      createMappingsAndPropagate(threadId, updates).catch(err => {
        debug.error("Background mapping creation failed:", err);
      });

      return { threadId, ...updates };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["email-threads"] });
      queryClient.invalidateQueries({ queryKey: ["email-thread", variables.threadId] });
      
      let message = "Thread classifié avec succès";
      if (variables.etablissementNom) {
        message = `Thread classifié dans ${variables.etablissementNom}`;
      } else if (variables.partenaireNom) {
        message = `Thread classifié comme partenaire ${variables.partenaireNom}`;
      } else if (variables.groupeNom) {
        message = `Thread classifié dans le groupe ${variables.groupeNom}`;
      }

      toast({
        title: "Classification réussie",
        description: message,
      });
    },
    onError: (error) => {
      debug.error("Erreur lors de la classification:", error);
      toast({
        title: "Erreur",
        description: "Impossible de classifier le thread",
        variant: "destructive",
      });
    },
  });

  return {
    classifyThread: classifyThread.mutate,
    isClassifying: classifyThread.isPending,
  };
}
