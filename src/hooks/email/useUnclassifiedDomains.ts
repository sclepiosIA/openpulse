import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isGenericDomain } from "@/lib/emailUtils";
import { isInternalDomain, extractEmailDomain } from "@/lib/internalEmailConfig";

export interface UnclassifiedDomain {
  domain: string;
  threadCount: number;
  emailCount: number;
  exampleThreads: {
    id: string;
    subject: string;
    from_address: string;
    last_message_date: string;
  }[];
}

export function useUnclassifiedDomains() {
  return useQuery({
    queryKey: ['unclassified-domains'],
    queryFn: async () => {
      // 1. Récupérer tous les threads non classifiés
      const { data: threads, error: threadsError } = await supabase
        .from('email_threads')
        .select(`
          id,
          subject,
          last_message_date,
          email_messages!inner(from_address, to_addresses)
        `)
        .is('etablissement_id', null)
        .order('last_message_date', { ascending: false });

      if (threadsError) throw threadsError;

      // 2. Récupérer les domaines déjà mappés ou exclus
      const { data: existingMappings, error: mappingsError } = await supabase
        .from('email_domain_mappings')
        .select('domain, is_excluded, etablissement_id, groupe_id, partenaire_id, prevent_auto');

      if (mappingsError) throw mappingsError;

      // 2b. Récupérer les emails spécifiques déjà affiliés
      const { data: specificMappings, error: specificError } = await supabase
        .from('email_specific_mappings')
        .select('email_address');

      if (specificError) throw specificError;

      // Extraire les domaines des emails spécifiques affiliés
      const domainsWithSpecificMappings = new Set(
        specificMappings?.map(m => m.email_address.split('@')[1]?.toLowerCase()).filter(Boolean) || []
      );

      // Considérer un domaine comme "déjà traité" s'il est exclu, mappé ou marqué en "ignore"
      const processedDomains = new Set(
        existingMappings?.filter(m => 
          m.is_excluded || 
          m.etablissement_id !== null || 
          m.groupe_id !== null || 
          m.partenaire_id !== null ||
          m.prevent_auto === true
        ).map(m => m.domain) || []
      );

      // 3. Extraire et grouper les domaines
      const domainMap = new Map<string, UnclassifiedDomain>();

      threads?.forEach((thread) => {
        thread.email_messages?.forEach((message) => {
          if (!message.from_address) return;
          
          const fromDomain = extractEmailDomain(message.from_address);
          
          // Si l'email vient d'un domaine interne, extraire les domaines des destinataires
          if (isInternalDomain(fromDomain)) {
            // to_addresses peut être un tableau ou undefined
            const toAddresses = Array.isArray(message.to_addresses) ? message.to_addresses : [];
            
            toAddresses.forEach((recipient: unknown) => {
              // recipient peut être un objet {email, name} ou une string
              const recipientEmail = typeof recipient === 'string' 
                ? recipient 
                : (recipient as { email?: string })?.email;
              if (!recipientEmail) return;
              
              const toDomain = extractEmailDomain(recipientEmail);
              
              // N'ajouter que les domaines externes (pas OpenPulse) ET non génériques
              if (toDomain && !isInternalDomain(toDomain) && 
                  !processedDomains.has(toDomain) &&
                  !isGenericDomain(toDomain)) {
                
                if (!domainMap.has(toDomain)) {
                  domainMap.set(toDomain, {
                    domain: toDomain,
                    threadCount: 0,
                    emailCount: 0,
                    exampleThreads: []
                  });
                }
                
                const domainData = domainMap.get(toDomain)!;
                domainData.emailCount++;
                
                if (domainData.exampleThreads.length < 3) {
                  const existingThread = domainData.exampleThreads.find(t => t.id === thread.id);
                  if (!existingThread) {
                    domainData.threadCount++;
                    domainData.exampleThreads.push({
                      id: thread.id,
                      subject: thread.subject || 'Sans objet',
                      from_address: typeof recipient === 'string' 
                        ? recipient 
                        : ((recipient as { email?: string })?.email || ''),
                      last_message_date: thread.last_message_date
                    });
                  }
                } else if (!domainData.exampleThreads.find(t => t.id === thread.id)) {
                  domainData.threadCount++;
                }
              }
            });
          } else {
            // Email venant de l'extérieur, comportement normal
            if (fromDomain && !isInternalDomain(fromDomain) && 
                !processedDomains.has(fromDomain) &&
                !isGenericDomain(fromDomain)) {
              
              if (!domainMap.has(fromDomain)) {
                domainMap.set(fromDomain, {
                  domain: fromDomain,
                  threadCount: 0,
                  emailCount: 0,
                  exampleThreads: []
                });
              }
              
              const domainData = domainMap.get(fromDomain)!;
              domainData.emailCount++;
              
              if (domainData.exampleThreads.length < 3) {
                const existingThread = domainData.exampleThreads.find(t => t.id === thread.id);
                if (!existingThread) {
                  domainData.threadCount++;
                  domainData.exampleThreads.push({
                    id: thread.id,
                    subject: thread.subject || 'Sans objet',
                    from_address: message.from_address,
                    last_message_date: thread.last_message_date
                  });
                }
              } else if (!domainData.exampleThreads.find(t => t.id === thread.id)) {
                domainData.threadCount++;
              }
            }
          }
        });
      });

      // 4. Retourner la liste triée par nombre d'emails décroissant
      return Array.from(domainMap.values()).sort((a, b) => b.emailCount - a.emailCount);
    },
    // Uses global staleTime from QueryClient (2 min)
  });
}
