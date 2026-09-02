import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { debug } from "@/lib/debug";
import { filterValidUUIDs } from "@/lib/sanitize";

interface ThreadParticipant {
  email?: string | null;
  name?: string | null;
  [k: string]: unknown;
}
type ParticipantLike = ThreadParticipant | string;

// NOTE DEBT-01: ThreadLike volontairement `any` — les threads proviennent de
// Supabase avec un schéma JSON `participants` qui ne peut être contraint
// proprement sans casser EmailListPanel et EmailInboxWidget.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ThreadLike = any;

export interface ContactRow {
  id?: string;
  nom?: string | null;
  prenom?: string | null;
  email?: string | null;
  telephone?: string | null;
  fonction?: string | null;
  type_contact?: string | null;
  niveau_contact?: string | null;
  etablissement_id?: string | null;
  groupe_id?: string | null;
}

interface DomainMappingRow {
  domain: string | null;
  etablissement_id: string | null;
  groupe_id: string | null;
  etablissements?: { id: string; nom: string; logo_url: string | null } | null;
  groupes_etablissements?: { id: string; nom: string; type: string; logo_url: string | null } | null;
}

export interface ThreadEnrichedData {
  groupeInfo: {
    hasMultipleEtablissementsInGroupe: boolean;
    groupeNom: string | null;
    groupeId: string | null;
    etablissementNames: string[];
  };
  contact: ContactRow | null;
  contactRole: string | null; // type_contact du contact (ex: "Direction", "Informatique")
  internalRole: { title: string } | null;
  imageCount: number;
  entityLogoUrl: string | null;
  isInternalTeam: boolean; // True if sender is part of internal OpenPulse team
  internalProfileAvatarUrl: string | null; // Avatar URL du membre interne OpenPulse
  hasReply: boolean; // True if thread has at least one sent message (reply)
  // Nouvelles données pour l'affichage enrichi
  groupeFromDomain: {
    id: string;
    nom: string;
    type: string;
  } | null; // Groupe trouvé via domaine si pas de groupe_id direct
  externalEntityForInternal: {
    type: 'etablissement' | 'groupe' | 'partenaire';
    id: string;
    nom: string;
  } | null; // Pour les threads internes: l'entité avec qui on discutait
}

// Constantes pour éviter les URLs trop longues
const MAX_BATCH_SIZE = 100; // Maximum threads à traiter en une fois
const CHUNK_SIZE = 50; // Maximum d'IDs par requête IN

/**
 * Utilitaire pour diviser un tableau en chunks
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, (i + 1) * size)
  );
}

/**
 * Hook pour charger en batch toutes les données enrichies des threads visibles
 * Évite les N+1 queries en faisant des requêtes groupées
 */
export function useThreadsEnrichedData(threads: ThreadLike[]) {
  // Limiter aux MAX_BATCH_SIZE premiers threads pour éviter les URLs trop longues
  const threadsToProcess = threads.slice(0, MAX_BATCH_SIZE);
  
  return useQuery({
    // QueryKey stable basé sur le count et les bornes, pas tous les IDs
    // QueryKey stable basée sur un hash des IDs pour partager le cache entre composants
    queryKey: [
      'threads-enriched-data', 
      threadsToProcess.map(t => t.id).sort().join(',')
    ],
    // NE PAS bloquer le rendu initial
    placeholderData: (previousData) => previousData || new Map<string, ThreadEnrichedData>(),
    queryFn: async (): Promise<Map<string, ThreadEnrichedData>> => {
      const enrichedData = new Map<string, ThreadEnrichedData>();
      
      if (threadsToProcess.length === 0) {
        return enrichedData;
      }

      const threadIds = threadsToProcess.map(t => t.id);
      
      try {
        // 1. Récupérer tous les domaines email uniques de tous les threads
        const allDomains = new Set<string>();
        const allEmails = new Set<string>();
        
        threadsToProcess.forEach(thread => {
          const participants = thread.participants || [];
          participants.forEach((p: ParticipantLike) => {
            const email = ((typeof p === "string" ? p : p.email) || "");
            if (typeof email === 'string' && email.includes('@')) {
              allEmails.add(email.toLowerCase());
              const domain = email.split('@')[1];
              if (domain) allDomains.add(domain.toLowerCase());
            }
          });
        });

        // 2. Batch query: récupérer tous les domain mappings en chunks
        const domainChunks = chunkArray(Array.from(allDomains), CHUNK_SIZE);
        const allDomainMappings: DomainMappingRow[] = [];
        
        const domainResults = await Promise.all(domainChunks.map(async (chunk) => {
          const { data: domainMappings } = await supabase
            .from('email_domain_mappings')
            .select(`
              domain,
              etablissement_id,
              groupe_id,
              etablissements(id, nom, logo_url),
              groupes_etablissements(id, nom, type, logo_url)
            `)
            .in('domain', chunk)
            .eq('is_excluded', false);
          return domainMappings || [];
        }));
        domainResults.forEach(r => allDomainMappings.push(...r));
        
        // 2b. Récupérer les logos des établissements, groupes et partenaires EN PARALLÈLE
        const threadEtabIds = threadsToProcess.map(t => t.etablissement_id || t.etablissement?.id).filter(Boolean);
        const threadGroupeIds = threadsToProcess.map(t => t.groupe_id || t.groupe?.id).filter(Boolean);
        const threadPartenaireIds = threadsToProcess.map(t => t.partenaire_id || t.partenaire?.id).filter(Boolean);
        
        const entityLogos = new Map<string, string>();
        
        // Paralléliser les 3 requêtes de logos (indépendantes)
        const [etabLogosResult, groupeLogosResult, partenaireLogosResult] = await Promise.all([
          // Etablissements logos
          (async () => {
            if (threadEtabIds.length === 0) return [];
            const etabChunks = chunkArray(threadEtabIds, CHUNK_SIZE);
            const results = await Promise.all(etabChunks.map(async (chunk) => {
              const { data: etabs } = await supabase
                .from('etablissements')
                .select('id, logo_url')
                .in('id', chunk);
              return etabs || [];
            }));
            return results.flat();
          })(),
          // Groupes logos
          (async () => {
            if (threadGroupeIds.length === 0) return [];
            const groupeChunks = chunkArray(threadGroupeIds, CHUNK_SIZE);
            const results = await Promise.all(groupeChunks.map(async (chunk) => {
              const { data: groupes } = await supabase
                .from('groupes_etablissements')
                .select('id, logo_url')
                .in('id', chunk);
              return groupes || [];
            }));
            return results.flat();
          })(),
          // Partenaires logos
          (async () => {
            if (threadPartenaireIds.length === 0) return [];
            const partenaireChunks = chunkArray(threadPartenaireIds, CHUNK_SIZE);
            const results = await Promise.all(partenaireChunks.map(async (chunk) => {
              const { data: partenaires } = await supabase
                .from('partenaires')
                .select('id, logo_url')
                .in('id', chunk);
              return partenaires || [];
            }));
            return results.flat();
          })(),
        ]);
        
        // Process etab logos with groupe fallback
        const etabsWithoutLogo = etabLogosResult.filter(e => !e.logo_url).map(e => e.id);
        const etabGroupeLogos = new Map<string, string>();
        
        if (etabsWithoutLogo.length > 0) {
          const etabNoLogoChunks = chunkArray(etabsWithoutLogo, CHUNK_SIZE);
          const groupeLogoResults = await Promise.all(etabNoLogoChunks.map(async (chunk) => {
            const { data: etabGroupes } = await supabase
              .from('etablissements_groupes')
              .select('etablissement_id, groupe:groupes_etablissements(id, logo_url)')
              .in('etablissement_id', chunk)
              .is('date_sortie', null);
            return etabGroupes || [];
          }));
          groupeLogoResults.flat().forEach(eg => {
            const groupe = eg.groupe as { id: string; logo_url: string | null } | null;
            if (groupe?.logo_url && !etabGroupeLogos.has(eg.etablissement_id)) {
              etabGroupeLogos.set(eg.etablissement_id, groupe.logo_url);
            }
          });
        }
        
        etabLogosResult.forEach(e => { 
          const logoUrl = e.logo_url || etabGroupeLogos.get(e.id);
          if (logoUrl) entityLogos.set(`etab_${e.id}`, logoUrl); 
        });
        groupeLogosResult.forEach(g => { if (g.logo_url) entityLogos.set(`groupe_${g.id}`, g.logo_url); });
        partenaireLogosResult.forEach(p => { if (p.logo_url) entityLogos.set(`partenaire_${p.id}`, p.logo_url); });

        // 3. Batch query: récupérer tous les contacts
        // Inclure les contacts des établissements/groupes liés AUX threads
        // + les contacts correspondant aux emails des participants (pour fallback)
        const etablissementIds = threadsToProcess
          .map(t => t.etablissement?.id)
          .filter(Boolean);
        
        const groupeIds = threadsToProcess
          .map(t => t.groupe?.id)
          .filter(Boolean);

        let allContacts: ContactRow[] = [];
        
        // Validate UUIDs before using in query to prevent injection
        const validEtablissementIds = filterValidUUIDs(etablissementIds as string[]);
        const validGroupeIds = filterValidUUIDs(groupeIds as string[]);
        
        // Stratégie 1: Charger les contacts des entités liées aux threads
        if (validEtablissementIds.length > 0 || validGroupeIds.length > 0) {
          const orFilters: string[] = [];
          if (validEtablissementIds.length > 0) {
            orFilters.push(`etablissement_id.in.(${validEtablissementIds.join(',')})`);
          }
          if (validGroupeIds.length > 0) {
            orFilters.push(`groupe_id.in.(${validGroupeIds.join(',')})`);
          }
          
          const { data: contacts } = await supabase
            .from('contacts')
            .select('id, nom, prenom, email, telephone, fonction, type_contact, niveau_contact, etablissement_id, groupe_id')
            .or(orFilters.join(','))
            .limit(500);
          
          allContacts = contacts || [];
        }
        
        // Stratégie 2: Charger aussi les contacts par email (pour threads non affiliés)
        // Limiter aux emails externes uniques
        const externalEmails = Array.from(allEmails).filter(email => {
          const domain = email.split('@')[1];
          const internalDomains = ['exploitant.example.org', 'marque.ai'];
          return domain && !internalDomains.includes(domain);
        });
        
        if (externalEmails.length > 0) {
          const emailChunksForContacts = chunkArray(externalEmails, CHUNK_SIZE);
          
          const contactResults = await Promise.all(emailChunksForContacts.map(async (chunk) => {
            const { data: contactsByEmail } = await supabase
              .from('contacts')
              .select('id, nom, prenom, email, telephone, fonction, type_contact, niveau_contact, etablissement_id, groupe_id')
              .in('email', chunk)
              .limit(500);
            return contactsByEmail || [];
          }));
          
          const existingIds = new Set(allContacts.map(c => c.id));
          contactResults.flat().forEach(c => {
            if (!existingIds.has(c.id)) {
              allContacts.push(c);
              existingIds.add(c.id);
            }
          });
        }

        // 4. Batch query: compter les images et détecter les réponses pour tous les threads (en chunks)
        const threadIdChunks = chunkArray(threadIds, CHUNK_SIZE);
        const allImageCounts: Array<{ thread_id: string; attachments_count: number }> = [];
        const repliedThreadIds = new Set<string>();
        
        // Build a map of threadId -> account email for "replied" detection
        const accountEmailByThreadId = new Map<string, string>();
        threadsToProcess.forEach(thread => {
          const accountEmail = thread.account?.email_address?.toLowerCase();
          if (accountEmail) {
            accountEmailByThreadId.set(thread.id, accountEmail);
          }
        });
        
        // Internal domains for reply detection
        const internalDomainsForReply = ['exploitant.example.org', 'marque.ai'];
        const internalTeamEmails = new Set([
          'membre.equipe@example.invalid',
          'membre.equipe@example.invalid',
          'membre.equipe@example.invalid',
          'membre.equipe@example.invalid',
          'membre.equipe@example.invalid',
          'membre.equipe@example.invalid',
        ]);
        
        // 4b. Préparer emailChunks et récupérer les mappings internes AVANT utilisation dans isInternalSender
        const emailChunks = chunkArray(Array.from(allEmails), CHUNK_SIZE);
        const internalMappingSet = new Set<string>();
        
        const internalMappingResults = await Promise.all(emailChunks.map(async (chunk) => {
          const { data: internalMappings } = await supabase
            .from('email_specific_mappings')
            .select('email_address, profile_id, niveau_mapping')
            .in('email_address', chunk)
            .eq('niveau_mapping', 'equipe');
          return internalMappings || [];
        }));
        internalMappingResults.flat().forEach(mapping => {
          if (mapping.email_address) {
            internalMappingSet.add(mapping.email_address.toLowerCase());
          }
        });
        
        // Helper to check if email is from internal team
        const isInternalSender = (email: string): boolean => {
          const emailLower = email.toLowerCase();
          const domain = emailLower.split('@')[1];
          return (domain && internalDomainsForReply.includes(domain)) 
            || internalTeamEmails.has(emailLower)
            || internalMappingSet.has(emailLower);
        };
        
        const chunkResults = await Promise.all(threadIdChunks.map(async (chunk) => {
          const [imageResult, outgoingResult] = await Promise.all([
            supabase
              .from('email_messages')
              .select('thread_id, attachments_count')
              .in('thread_id', chunk)
              .gt('attachments_count', 0),
            supabase
              .from('email_messages')
              .select('thread_id, from_address, is_sent, subject, in_reply_to')
              .in('thread_id', chunk),
          ]);
          return { images: imageResult.data || [], outgoing: outgoingResult.data || [] };
        }));
        
        chunkResults.forEach(({ images, outgoing }) => {
          allImageCounts.push(...images);
          outgoing.forEach(msg => {
            if (msg.is_sent === true) {
              repliedThreadIds.add(msg.thread_id);
              return;
            }
            const accountEmail = accountEmailByThreadId.get(msg.thread_id);
            if (accountEmail && msg.from_address?.toLowerCase() === accountEmail) {
              repliedThreadIds.add(msg.thread_id);
              return;
            }
            const fromEmail = msg.from_address?.toLowerCase();
            if (fromEmail && isInternalSender(fromEmail)) {
              const subjectLower = (msg.subject || '').toLowerCase().trim();
              const isReplySubject = subjectLower.startsWith('re:') || 
                                     subjectLower.startsWith('tr:') || 
                                     subjectLower.startsWith('fw:') ||
                                     subjectLower.startsWith('fwd:');
              const hasInReplyTo = !!msg.in_reply_to;
              if (isReplySubject || hasInReplyTo) {
                repliedThreadIds.add(msg.thread_id);
              }
            }
          });
        });

        const imageCountMap = new Map<string, number>();
        allImageCounts.forEach(msg => {
          const current = imageCountMap.get(msg.thread_id) || 0;
          imageCountMap.set(msg.thread_id, current + msg.attachments_count);
        });

        // 5. Récupérer les profils internes (OpenPulse) pour tous les emails (en chunks)
        // Note: emailChunks est déjà défini plus haut (section 4b)
        const allInternalProfiles: Array<{ email: string | null; prenom: string | null; nom: string | null; fonction: string | null; avatar_url: string | null }> = [];
        
        const profileResults = await Promise.all(emailChunks.map(async (chunk) => {
          const { data: internalProfiles } = await supabase
            .from('profiles')
            .select('email, prenom, nom, fonction, avatar_url')
            .in('email', chunk);
          return internalProfiles || [];
        }));
        profileResults.forEach(r => allInternalProfiles.push(...r));

        interface InternalProfile {
          email: string | null;
          prenom: string | null;
          nom: string | null;
          fonction: string | null;
          avatar_url: string | null;
        }

        const internalProfileMap = new Map<string, InternalProfile>();
        allInternalProfiles.forEach(profile => {
          if (profile.email) {
            internalProfileMap.set(profile.email.toLowerCase(), profile);
          }
        });

        // 6. Construire le Map de données enrichies
        const internalDomains = ['exploitant.example.org', 'marque.ai'];
        
        // Membres internes OpenPulse connus (peuvent utiliser des adresses perso)
        const INTERNAL_TEAM_MEMBERS = new Set([
          // Camille Durand
          'membre.equipe@example.invalid',
          'membre.equipe@example.invalid',
          'membre.equipe@example.invalid',
          // Camille Durand
          'membre.equipe@example.invalid',
          'membre.equipe@example.invalid',
          'membre.equipe@example.invalid',
        ]);
        
        // Helper pour vérifier si un email est interne (domaine ou membre connu)
        const isInternalEmail = (email: string): boolean => {
          const emailLower = email.toLowerCase();
          const domain = emailLower.split('@')[1];
          return (domain && internalDomains.includes(domain)) 
            || internalMappingSet.has(emailLower)
            || INTERNAL_TEAM_MEMBERS.has(emailLower);
        };
        
        // Helper pour trouver le premier email externe (pas OpenPulse)
        const getExternalEmail = (participants: ParticipantLike[]): string | null => {
          for (const p of participants) {
            const email = ((typeof p === "string" ? p : p.email) || "")?.toString().toLowerCase();
            if (email && !isInternalEmail(email)) {
              return email;
            }
          }
          return null;
        };
        
        // Créer un map des domain mappings vers groupes
        const domainToGroupeMap = new Map<string, { id: string; nom: string; type: string }>();
        allDomainMappings.forEach(mapping => {
          if (mapping.groupes_etablissements && mapping.domain) {
            const groupe = mapping.groupes_etablissements as { id: string; nom: string; type: string | null };
            domainToGroupeMap.set(mapping.domain.toLowerCase(), {
              id: groupe.id,
              nom: groupe.nom,
              type: groupe.type || 'Autre'
            });
          }
        });

        threadsToProcess.forEach(thread => {
          const participants = thread.participants || [];
          
          // Trouver l'email externe pour la recherche de contact
          const externalEmail = getExternalEmail(participants);
          
          // Rechercher le contact correspondant à l'email externe
          // D'abord avec condition d'établissement/groupe, puis fallback par email seul
          let contact = externalEmail ? allContacts.find(c => 
            c.email?.toLowerCase() === externalEmail &&
            (c.etablissement_id === thread.etablissement?.id || c.groupe_id === thread.groupe?.id)
          ) : null;
          
          // Fallback: chercher le contact juste par email (sans condition établissement)
          // Utile quand le thread n'est pas encore affilié mais le contact existe
          if (!contact && externalEmail) {
            contact = allContacts.find(c => c.email?.toLowerCase() === externalEmail);
          }

          // Extraire le rôle du contact (type_contact)
          const contactRole = contact?.type_contact || null;

          // Rechercher le rôle interne (pour les emails internes)
          const mainEmail = participants[0]?.email || participants[0];
          const mainEmailLower = mainEmail?.toString().toLowerCase();
          const internalProfile = internalProfileMap.get(mainEmailLower);
          const internalRole = internalProfile ? {
            title: internalProfile.fonction || `${internalProfile.prenom} ${internalProfile.nom}`
          } : null;

          // Déterminer si tous les participants sont internes (équipe OpenPulse)
          const isInternalTeam = participants.every((p: ParticipantLike) => {
            const email = ((typeof p === "string" ? p : p.email) || "")?.toString().toLowerCase();
            if (!email) return false;
            return isInternalEmail(email);
          });

          // Compter les images
          const imageCount = imageCountMap.get(thread.id) || 0;

          // Calculer groupeInfo (version simplifiée)
          const groupeInfo = {
            hasMultipleEtablissementsInGroupe: false,
            groupeNom: null,
            groupeId: null,
            etablissementNames: []
          };

          // Chercher le groupe via domaine si pas de groupe_id direct
          let groupeFromDomain: { id: string; nom: string; type: string } | null = null;
          if (!thread.groupe_id && !thread.groupe?.id && externalEmail) {
            const domain = externalEmail.split('@')[1]?.toLowerCase();
            if (domain) {
              groupeFromDomain = domainToGroupeMap.get(domain) || null;
            }
          }

          // Pour les threads internes: trouver l'entité externe associée
          let externalEntityForInternal: { type: 'etablissement' | 'groupe' | 'partenaire'; id: string; nom: string } | null = null;
          if (isInternalTeam) {
            // Option 1: Entité directement liée au thread
            if (thread.etablissement?.id && thread.etablissement?.nom) {
              externalEntityForInternal = {
                type: 'etablissement',
                id: thread.etablissement.id,
                nom: thread.etablissement.nom
              };
            } else if (thread.groupe?.id && thread.groupe?.nom) {
              externalEntityForInternal = {
                type: 'groupe',
                id: thread.groupe.id,
                nom: thread.groupe.nom
              };
            } else if (thread.partenaire?.id && thread.partenaire?.nom) {
              externalEntityForInternal = {
                type: 'partenaire',
                id: thread.partenaire.id,
                nom: thread.partenaire.nom
              };
            }
            
            // Option 2: Si pas d'entité liée, chercher via le domaine des emails dans le sujet/conversation
            // On cherche dans tous les participants (même si tous internes, le thread peut avoir été classifié via domain mapping)
            if (!externalEntityForInternal) {
              // Chercher dans les domain mappings via le sujet ou d'autres indices
              // Fallback: utiliser groupeFromDomain s'il a été trouvé
              if (groupeFromDomain) {
                externalEntityForInternal = {
                  type: 'groupe',
                  id: groupeFromDomain.id,
                  nom: groupeFromDomain.nom
                };
              } else {
                // Dernière option: chercher dans les domain mappings des emails du thread (même si internes)
                // via le sujet du thread qui peut contenir un nom d'établissement
                for (const mapping of allDomainMappings) {
                  if (mapping.etablissements?.id && mapping.etablissements?.nom) {
                    // Vérifier si un des emails du thread utilise ce domaine
                    const matchingParticipant = participants.find((p: ParticipantLike) => {
                      const email = ((typeof p === "string" ? p : p.email) || "")?.toString().toLowerCase();
                      return email && email.endsWith(`@${mapping.domain?.toLowerCase()}`);
                    });
                    if (matchingParticipant) {
                      externalEntityForInternal = {
                        type: 'etablissement',
                        id: mapping.etablissements.id,
                        nom: mapping.etablissements.nom
                      };
                      break;
                    }
                  } else if (mapping.groupes_etablissements?.id && mapping.groupes_etablissements?.nom) {
                    const groupe = mapping.groupes_etablissements as { id: string; nom: string };
                    const matchingParticipant = participants.find((p: ParticipantLike) => {
                      const email = ((typeof p === "string" ? p : p.email) || "")?.toString().toLowerCase();
                      return email && email.endsWith(`@${mapping.domain?.toLowerCase()}`);
                    });
                    if (matchingParticipant) {
                      externalEntityForInternal = {
                        type: 'groupe',
                        id: groupe.id,
                        nom: groupe.nom
                      };
                      break;
                    }
                  }
                }
              }
            }
          }
          
          // Déterminer le logo de l'entité liée
          let entityLogoUrl: string | null = null;
          const etabId = thread.etablissement_id || thread.etablissement?.id;
          const groupeId = thread.groupe_id || thread.groupe?.id;
          const partenaireId = thread.partenaire_id || thread.partenaire?.id;
          
          if (etabId) {
            entityLogoUrl = entityLogos.get(`etab_${etabId}`) || null;
          } else if (groupeId) {
            entityLogoUrl = entityLogos.get(`groupe_${groupeId}`) || null;
          } else if (partenaireId) {
            entityLogoUrl = entityLogos.get(`partenaire_${partenaireId}`) || null;
          }

          // Check if thread has a reply
          const hasReply = repliedThreadIds.has(thread.id);

          // Récupérer l'avatar du profil interne si le PREMIER participant est un membre OpenPulse
          // (pas seulement si tous sont internes - on veut l'avatar de l'expéditeur principal)
          const firstParticipantEmail = (participants[0]?.email || participants[0])?.toString().toLowerCase();
          const isFirstParticipantInternal = firstParticipantEmail && isInternalEmail(firstParticipantEmail);
          const internalProfileAvatarUrl = isFirstParticipantInternal && internalProfile?.avatar_url 
            ? internalProfile.avatar_url 
            : null;

          enrichedData.set(thread.id, {
            groupeInfo,
            contact: contact ?? null,

            contactRole,
            internalRole,
            imageCount,
            entityLogoUrl,
            isInternalTeam,
            internalProfileAvatarUrl,
            hasReply,
            groupeFromDomain,
            externalEntityForInternal
          });
        });

        debug.log(`[Batch] Données enrichies chargées pour ${threadsToProcess.length} threads`);
        return enrichedData;
        
      } catch (error) {
        debug.error('[Batch] Erreur chargement données enrichies:', error);
        return enrichedData;
      }
    },
    enabled: threadsToProcess.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    // Important: ne pas bloquer le rendu
    refetchOnWindowFocus: false,
    retry: 1, // Un seul retry
    retryDelay: 1000,
  });
}
