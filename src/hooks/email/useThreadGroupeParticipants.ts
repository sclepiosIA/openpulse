import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { debug } from "@/lib/debug";

interface GroupeParticipantsResult {
  hasMultipleEtablissementsInGroupe: boolean;
  groupeNom: string | null;
  groupeId: string | null;
  etablissementNames: string[];
}

type EmailAddressEntry = string | { email?: string | null; name?: string | null } | null;

interface ThreadMessageLite {
  from_address?: string | null;
  to_addresses?: EmailAddressEntry[] | null;
  cc_addresses?: EmailAddressEntry[] | null;
  bcc_addresses?: EmailAddressEntry[] | null;
}

interface ThreadInput {
  id?: string | null;
  messages?: ThreadMessageLite[] | null;
}

interface DomainMappingRow {
  domain: string;
  etablissement_id: string | null;
  groupe_id: string | null;
  niveau_mapping: string | null;
  etablissements: { id: string; nom: string } | null;
  groupes_etablissements: { id: string; nom: string; type: string } | null;
}

interface EtabGroupeRow {
  groupe_id: string;
  etablissement_id: string;
  date_sortie: string | null;
  groupes_etablissements: { id: string; nom: string; type: string } | null;
  etablissements: { id: string; nom: string } | null;
}

interface GroupeEtabRow {
  groupe_id: string;
  etablissements: { id: string; nom: string } | null;
}

/**
 * Hook pour détecter si un thread email implique plusieurs établissements d'un même groupe (GHT)
 */
export function useThreadGroupeParticipants(thread: ThreadInput | null | undefined): GroupeParticipantsResult {
  const { data } = useQuery({
    queryKey: ['thread-groupe-participants', thread?.id],
    queryFn: async () => {
      if (!thread?.id) {
        return { hasMultipleEtablissementsInGroupe: false, groupeNom: null, groupeId: null, etablissementNames: [] };
      }

      // Si les messages ne sont pas chargés, les récupérer depuis Supabase
      let messages: ThreadMessageLite[] = thread.messages ?? [];
      if (messages.length === 0) {
        const { data: messagesData, error: messagesError } = await supabase
          .from('email_messages')
          .select('from_address, to_addresses, cc_addresses, bcc_addresses')
          .eq('thread_id', thread.id)
          .limit(50);

        if (messagesError) {
          debug.error('[GHT Debug] Erreur chargement messages:', messagesError);
          return { hasMultipleEtablissementsInGroupe: false, groupeNom: null, groupeId: null, etablissementNames: [] };
        }

        messages = (messagesData ?? []) as unknown as ThreadMessageLite[];
      }

      if (messages.length === 0) {
        return { hasMultipleEtablissementsInGroupe: false, groupeNom: null, groupeId: null, etablissementNames: [] };
      }

      // Extraire tous les domaines uniques des participants
      const domains = new Set<string>();

      messages.forEach((msg) => {
        // from_address (string)
        if (msg.from_address) {
          const fromDomain = msg.from_address.split('@')[1];
          if (fromDomain) domains.add(fromDomain.toLowerCase());
        }

        // to_addresses, cc_addresses, bcc_addresses (peuvent être des arrays d'objets {email} ou de strings)
        [msg.to_addresses, msg.cc_addresses, msg.bcc_addresses].forEach((addresses) => {
          if (Array.isArray(addresses)) {
            addresses.forEach((addr: EmailAddressEntry) => {
              let email: string | null = null;

              if (typeof addr === 'string') {
                email = addr;
              } else if (addr && typeof addr === 'object' && addr.email) {
                email = addr.email;
              }

              if (email) {
                const domain = email.split('@')[1];
                if (domain) domains.add(domain.toLowerCase());
              }
            });
          }
        });
      });

      if (domains.size === 0) {
        return { hasMultipleEtablissementsInGroupe: false, groupeNom: null, groupeId: null, etablissementNames: [] };
      }

      // Requête simplifiée - niveau 2 max pour éviter erreurs 500
      const { data: mappings, error } = await supabase
        .from('email_domain_mappings')
        .select(`
          domain,
          etablissement_id,
          groupe_id,
          niveau_mapping,
          etablissements(id, nom),
          groupes_etablissements(id, nom, type)
        `)
        .in('domain', Array.from(domains))
        .eq('is_excluded', false);

      if (error) debug.error('[GHT Debug] Erreur:', error);

      if (error || !mappings || mappings.length === 0) {
        return { hasMultipleEtablissementsInGroupe: false, groupeNom: null, groupeId: null, etablissementNames: [] };
      }

      // Regrouper par groupe_id
      const groupeMap = new Map<string, { nom: string; type: string; etablissements: Set<string> }>();
      const etablissementIds: string[] = [];
      
      mappings.forEach((mapping: DomainMappingRow) => {
        // CAS 1 : Mapping au niveau établissement - collecter les IDs
        if (mapping.etablissement_id && mapping.etablissements) {
          etablissementIds.push(mapping.etablissement_id);
        }
        
        // CAS 2 : Mapping au niveau groupe (AHNAC, etc.)
        if (mapping.groupe_id && mapping.groupes_etablissements && !mapping.etablissement_id) {
          const groupe = mapping.groupes_etablissements;
          if (!groupeMap.has(groupe.id)) {
            groupeMap.set(groupe.id, {
              nom: groupe.nom,
              type: groupe.type,
              etablissements: new Set()
            });
          }
        }
      });

      // Pour les établissements trouvés, récupérer leurs groupes (query séparée niveau 2)
      if (etablissementIds.length > 0) {
        const { data: etabGroupes } = await supabase
          .from('etablissements_groupes')
          .select(`
            groupe_id,
            etablissement_id,
            date_sortie,
            groupes_etablissements(id, nom, type),
            etablissements(id, nom)
          `)
          .in('etablissement_id', etablissementIds)
          .is('date_sortie', null);

        etabGroupes?.forEach((eg: EtabGroupeRow) => {
          const groupe = eg.groupes_etablissements;
          if (!groupe) return;
          if (!groupeMap.has(groupe.id)) {
            groupeMap.set(groupe.id, {
              nom: groupe.nom,
              type: groupe.type,
              etablissements: new Set()
            });
          }
          if (eg.etablissements) {
            groupeMap.get(groupe.id)!.etablissements.add(eg.etablissements.nom);
          }
        });
      }

      // Pour les groupes détectés via mapping niveau groupe, récupérer leurs établissements
      const groupeIdsToFetch = Array.from(groupeMap.entries())
        .filter(([_, info]) => info.etablissements.size === 0)
        .map(([id, _]) => id);

      if (groupeIdsToFetch.length > 0) {
        
        const { data: groupeEtabs } = await supabase
          .from('etablissements_groupes')
          .select(`
            groupe_id,
            etablissements(id, nom)
          `)
          .in('groupe_id', groupeIdsToFetch)
          .is('date_sortie', null);
          
        groupeEtabs?.forEach((ge: GroupeEtabRow) => {
          if (!groupeMap.has(ge.groupe_id)) return;
          if (ge.etablissements) {
            groupeMap.get(ge.groupe_id)!.etablissements.add(ge.etablissements.nom);
          }
        });
      }

      // Trouver un groupe avec au moins 2 établissements différents
      for (const [groupeId, groupeInfo] of groupeMap) {
        if (groupeInfo.etablissements.size >= 2) {
          
          return {
            hasMultipleEtablissementsInGroupe: true,
            groupeNom: groupeInfo.nom,
            groupeId: groupeId,
            etablissementNames: Array.from(groupeInfo.etablissements).sort()
          };
        }
      }

      
      return { hasMultipleEtablissementsInGroupe: false, groupeNom: null, groupeId: null, etablissementNames: [] };
    },
    enabled: !!thread?.id,
    staleTime: 10 * 60 * 1000, // Cache pendant 10 minutes
  });

  return data || { hasMultipleEtablissementsInGroupe: false, groupeNom: null, groupeId: null, etablissementNames: [] };
}
