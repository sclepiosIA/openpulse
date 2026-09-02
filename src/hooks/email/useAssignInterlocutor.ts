import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { debug } from "@/lib/debug";

export type EntityType = "etablissement" | "partenaire" | "groupe";

export interface AssignInterlocutorParams {
  threadId: string;
  entityType: EntityType;
  entityId: string;
  entityName: string;
  senderEmail: string;
  senderName: string | null;
}

const GENERIC_DOMAINS = [
  'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.fr', 'yahoo.com',
  'orange.fr', 'free.fr', 'laposte.net', 'wanadoo.fr', 'sfr.fr',
  'bbox.fr', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com',
  'protonmail.com', 'hotmail.fr', 'live.fr'
];

const INTERNAL_MARQUE_DOMAINS = ['marque.ai', 'exploitant.example.org'];

interface EmailParticipant {
  email?: string;
  name?: string;
  type?: string;
}

export const useAssignInterlocutor = () => {
  const [isAssigning, setIsAssigning] = useState(false);
  const queryClient = useQueryClient();

  const assignInterlocutor = async ({
    threadId,
    entityType,
    entityId,
    entityName,
    senderEmail,
    senderName,
  }: AssignInterlocutorParams) => {
    setIsAssigning(true);

    try {
      // 1. Update email thread with entity ID
      const threadUpdate: Record<string, unknown> = {
        etablissement_id: entityType === "etablissement" ? entityId : null,
        partenaire_id: entityType === "partenaire" ? entityId : null,
        groupe_id: entityType === "groupe" ? entityId : null,
        needs_manual_review: false,
        is_hors_etablissement: false,
      };

      const { data: threadData, error: threadError } = await supabase
        .from("email_threads")
        .update(threadUpdate as never)
        .eq("id", threadId)
        .select("id, ai_extracted_data")
        // safe: guaranteed-row
        .single();

      if (threadError) throw threadError;

      // 1b. Créer automatiquement les tâches détectées par l'IA si disponibles
      let tasksCreated = 0;
      if (threadData?.ai_extracted_data && (entityType === "etablissement" || entityType === "partenaire")) {
        const aiData = threadData.ai_extracted_data as { new_tasks_needed?: Array<{ title: string; category?: string; priority?: string; deadline_days?: number }> };
        const newTasksNeeded = aiData?.new_tasks_needed;
        
        if (newTasksNeeded && Array.isArray(newTasksNeeded) && newTasksNeeded.length > 0) {
          debug.log(`🤖 ${newTasksNeeded.length} tâches IA détectées, création automatique...`);
          
          try {
            const { data: functionData, error: functionError } = await supabase.functions.invoke('create-tasks-from-email', {
              body: {
                thread_id: threadId,
                etablissement_id: entityType === "etablissement" ? entityId : undefined,
                partenaire_id: entityType === "partenaire" ? entityId : undefined,
                new_tasks_needed: newTasksNeeded.map(task => ({
                  task_title: task.title,
                  task_category: task.category || "Suivi",
                  priority: task.priority || "medium",
                  deadline_days: task.deadline_days || 7
                }))
              }
            });
            
            if (functionError) {
              debug.error("Erreur création tâches IA:", functionError);
            } else {
              tasksCreated = functionData?.tasks_created || 0;
              debug.log(`✅ ${tasksCreated} tâches créées depuis l'IA`);
            }
          } catch (taskError) {
            debug.error("Erreur appel create-tasks-from-email:", taskError);
          }
        }
      }

      // 2. Récupérer TOUS les messages du thread pour avoir tous les participants
      const { data: messages } = await supabase
        .from("email_messages")
        .select("from_address, from_name, to_addresses, cc_addresses")
        .eq("thread_id", threadId);

      // 3. Collecter tous les participants uniques
      const allParticipants = new Map<string, { email: string; name: string | null }>();
      
      // Toujours ajouter l'expéditeur principal
      allParticipants.set(senderEmail.toLowerCase(), { 
        email: senderEmail.toLowerCase(), 
        name: senderName 
      });

      // Parcourir tous les messages pour collecter les participants
      messages?.forEach(msg => {
        if (msg.from_address) {
          const email = msg.from_address.toLowerCase();
          if (!allParticipants.has(email)) {
            allParticipants.set(email, { email, name: msg.from_name || null });
          }
        }

        // Traiter to_addresses et cc_addresses (peuvent être des tableaux d'objets ou de strings)
        const processAddresses = (addresses: unknown) => {
          if (!addresses) return;
          const addrArray = Array.isArray(addresses) ? addresses : [];
          addrArray.forEach((addr: unknown) => {
            let email: string | null = null;
            let name: string | null = null;
            
            if (typeof addr === 'string') {
              email = addr.toLowerCase();
            } else if (addr && typeof addr === 'object') {
              const addrObj = addr as EmailParticipant;
              email = addrObj.email?.toLowerCase() || null;
              name = addrObj.name || null;
            }
            
            if (email && !allParticipants.has(email)) {
              allParticipants.set(email, { email, name });
            }
          });
        };

        processAddresses(msg.to_addresses);
        processAddresses(msg.cc_addresses);
      });

      debug.log(`📧 ${allParticipants.size} participants uniques trouvés pour le thread`);

      // 4. Créer des mappings email spécifiques pour TOUS les participants externes
      let mappingsCreated = 0;
      let contactsCreated = 0;
      let contactsUpdated = 0;
      let domainMappingCreated = false;

      for (const [email, participant] of allParticipants) {
        const domain = email.split('@')[1];
        if (!domain) continue;

        // Ignorer les emails internes OpenPulse
        if (INTERNAL_MARQUE_DOMAINS.includes(domain)) continue;

        // Créer le mapping email spécifique
        const { error: mappingError } = await supabase
          .from("email_specific_mappings")
          .upsert({
            email_address: email,
            etablissement_id: entityType === "etablissement" ? entityId : null,
            partenaire_id: entityType === "partenaire" ? entityId : null,
            groupe_id: entityType === "groupe" ? entityId : null,
            niveau_mapping: entityType,
            verified: true,
            confidence_level: GENERIC_DOMAINS.includes(domain) ? "high" : "medium",
          }, {
            onConflict: "email_address",
          });

        if (!mappingError) {
          mappingsCreated++;
        } else {
          debug.warn(`Erreur mapping email ${email}:`, mappingError);
        }

        // 5. Créer ou METTRE À JOUR des contacts pour les domaines NON génériques
        if (!GENERIC_DOMAINS.includes(domain)) {
          // Parse name into nom/prenom
          const nameParts = (participant.name || email.split("@")[0]).split(" ");
          const prenom = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : null;
          const nom = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];

          if (entityType === "etablissement" || entityType === "groupe") {
            // Vérifier si le contact existe déjà
            const { data: existingContact } = await supabase
              .from("contacts")
              .select("id, etablissement_id, groupe_id")
              .eq("email", email)
              .maybeSingle();

            if (!existingContact) {
              // Créer le nouveau contact
              const { error: contactError } = await supabase
                .from("contacts")
                .insert({
                  email,
                  nom: nom || "Inconnu",
                  prenom,
                  fonction: "Contact email",
                  created_source: "email_attribution",
                  niveau_contact: entityType,
                  etablissement_id: entityType === "etablissement" ? entityId : null,
                  groupe_id: entityType === "groupe" ? entityId : null,
                });

              if (!contactError) {
                contactsCreated++;
              } else {
                debug.warn(`Erreur création contact ${email}:`, contactError);
              }
            } else if (!existingContact.etablissement_id && !existingContact.groupe_id) {
              // Mettre à jour le contact existant s'il n'a pas d'attribution
              const { error: updateError } = await supabase
                .from("contacts")
                .update({
                  etablissement_id: entityType === "etablissement" ? entityId : null,
                  groupe_id: entityType === "groupe" ? entityId : null,
                  niveau_contact: entityType,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existingContact.id);

              if (!updateError) {
                contactsUpdated++;
                debug.log(`📝 Contact mis à jour: ${email}`);
              } else {
                debug.warn(`Erreur mise à jour contact ${email}:`, updateError);
              }
            }
          } else if (entityType === "partenaire") {
            // Vérifier si le contact partenaire existe déjà
            const { data: existingContact } = await supabase
              .from("partenaires_contacts")
              .select("id, partenaire_id")
              .eq("email", email)
              .maybeSingle();

            if (!existingContact) {
              const { error: contactError } = await supabase
                .from("partenaires_contacts")
                .insert({
                  partenaire_id: entityId,
                  email,
                  nom: nom || "Inconnu",
                  prenom,
                  fonction: "Contact email",
                });

              if (!contactError) {
                contactsCreated++;
              } else {
                debug.warn(`Erreur création contact partenaire ${email}:`, contactError);
              }
            } else if (!existingContact.partenaire_id) {
              // Mettre à jour le contact partenaire existant s'il n'a pas d'attribution
              const { error: updateError } = await supabase
                .from("partenaires_contacts")
                .update({
                  partenaire_id: entityId,
                })
                .eq("id", existingContact.id);

              if (!updateError) {
                contactsUpdated++;
                debug.log(`📝 Contact partenaire mis à jour: ${email}`);
              }
            }
          }

          // 6. Propager le mapping domaine si c'est un domaine professionnel
          if (!domainMappingCreated) {
            const { data: existingDomainMapping } = await supabase
              .from("email_domain_mappings")
              .select("id")
              .eq("domain", domain)
              .maybeSingle();

            if (!existingDomainMapping) {
              const { error: domainMappingError } = await supabase
                .from("email_domain_mappings")
                .insert({
                  domain,
                  etablissement_id: entityType === "etablissement" ? entityId : null,
                  partenaire_id: entityType === "partenaire" ? entityId : null,
                  groupe_id: entityType === "groupe" ? entityId : null,
                  niveau_mapping: entityType === "groupe" ? "groupe" : "etablissement",
                  verified: true,
                  confidence_level: "high",
                  is_excluded: false,
                });

              if (!domainMappingError) {
                domainMappingCreated = true;
                debug.log(`📧 Mapping domaine créé: ${domain}`);
              } else {
                debug.warn(`Erreur création mapping domaine ${domain}:`, domainMappingError);
              }
            }
          }
        }
      }

      debug.log(`✅ Attribution terminée: ${mappingsCreated} mappings email, ${contactsCreated} contacts créés, ${contactsUpdated} contacts mis à jour`);

      // 7. Associer tous les threads PASSÉS avec ces participants
      let pastThreadsUpdated = 0;
      try {
        const participantEmails = Array.from(allParticipants.keys())
          .filter(email => {
            const domain = email.split('@')[1];
            return domain && !INTERNAL_MARQUE_DOMAINS.includes(domain);
          });

        if (participantEmails.length > 0) {
          // Trouver tous les messages avec ces expéditeurs (passés et futurs)
          const { data: relatedPastMessages } = await supabase
            .from("email_messages")
            .select("thread_id")
            .in("from_address", participantEmails);

          const pastThreadIds = [...new Set(relatedPastMessages?.map(m => m.thread_id) || [])]
            .filter(id => id !== threadId); // Exclure le thread courant

          if (pastThreadIds.length > 0) {
            // Chunking pour éviter les erreurs 400 (limite PostgREST de ~50 IDs)
            const CHUNK_SIZE = 50;
            let totalUpdated = 0;
            
            for (let i = 0; i < pastThreadIds.length; i += CHUNK_SIZE) {
              const chunk = pastThreadIds.slice(i, i + CHUNK_SIZE);
              
              const { data: updatedPastThreads, error: pastError } = await supabase
                .from("email_threads")
                .update({
                  etablissement_id: entityType === "etablissement" ? entityId : null,
                  partenaire_id: entityType === "partenaire" ? entityId : null,
                  groupe_id: entityType === "groupe" ? entityId : null,
                  is_hors_etablissement: false,
                })
                .in("id", chunk)
                .is("etablissement_id", null)
                .is("partenaire_id", null)
                .is("groupe_id", null)
                .select("id");

              if (!pastError) {
                totalUpdated += updatedPastThreads?.length || 0;
              }
            }
            
            pastThreadsUpdated = totalUpdated;
            if (pastThreadsUpdated > 0) {
              debug.log(`📧 ${pastThreadsUpdated} threads passés associés à ${entityName}`);
            }
          }
        }
      } catch (pastError) {
        debug.warn("Erreur association threads passés:", pastError);
      }

      // 7. Propager l'association aux threads liés (même conversation sur d'autres comptes)
      let propagatedCount = 0;
      try {
        // Collecter tous les identifiants de messages liés
        const relatedIds = new Set<string>();
        
        // Récupérer les messages du thread actuel
        const { data: threadMessages } = await supabase
          .from("email_messages")
          .select("message_id, reference_headers, in_reply_to")
          .eq("thread_id", threadId);

        threadMessages?.forEach(m => {
          if (m.message_id) relatedIds.add(m.message_id);
          if (m.in_reply_to) relatedIds.add(m.in_reply_to);
          if (m.reference_headers) {
            m.reference_headers.forEach((ref: string) => relatedIds.add(ref));
          }
        });

        if (relatedIds.size > 0) {
          // Trouver les threads sur d'autres comptes avec les mêmes messages
          const { data: relatedMessages } = await supabase
            .from("email_messages")
            .select("thread_id")
            .in("message_id", Array.from(relatedIds))
            .neq("thread_id", threadId);

          const relatedThreadIds = [...new Set(relatedMessages?.map(m => m.thread_id) || [])];

          if (relatedThreadIds.length > 0) {
            const updates: Record<string, string | null> = {
              etablissement_id: entityType === "etablissement" ? entityId : null,
              partenaire_id: entityType === "partenaire" ? entityId : null,
              groupe_id: entityType === "groupe" ? entityId : null,
            };

            const { data: updatedThreads } = await supabase
              .from("email_threads")
              .update({
                ...updates,
                is_hors_etablissement: false,
              })
              .in("id", relatedThreadIds.slice(0, 50)) // Limiter à 50 pour éviter erreurs 400
              .select("id");

            propagatedCount = updatedThreads?.length || 0;
            if (propagatedCount > 0) {
              debug.log(`📢 Association propagée à ${propagatedCount} thread(s) sur d'autres comptes`);
            }
          }
        }
      } catch (propError) {
        debug.warn("Erreur propagation threads liés:", propError);
      }

      // Invalidate React Query cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      queryClient.invalidateQueries({ queryKey: ['email-threads-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['threads-enriched-data'] });
      queryClient.invalidateQueries({ queryKey: ['email-domain-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['email-specific-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });

      // Trigger refresh event for other components
      window.dispatchEvent(new CustomEvent("email-thread-updated", { detail: { threadId } }));

      const propagatedMsg = propagatedCount > 0 ? `, propagé à ${propagatedCount} autres comptes` : '';
      const pastThreadsMsg = pastThreadsUpdated > 0 ? `, ${pastThreadsUpdated} emails passés associés` : '';
      const contactsUpdatedMsg = contactsUpdated > 0 ? `, ${contactsUpdated} contacts mis à jour` : '';
      const tasksCreatedMsg = tasksCreated > 0 ? `, ${tasksCreated} tâches IA créées` : '';
      toast.success(`Attribué à ${entityName}`, {
        description: `${mappingsCreated} mappings email, ${contactsCreated} contacts créés${contactsUpdatedMsg}${tasksCreatedMsg}${pastThreadsMsg}${propagatedMsg}`
      });
      return true;
    } catch (error) {
      debug.error("Erreur attribution:", error);
      toast.error("Erreur lors de l'attribution");
      return false;
    } finally {
      setIsAssigning(false);
    }
  };

  return { assignInterlocutor, isAssigning };
};
