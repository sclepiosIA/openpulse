import { createClient } from "@supabase/supabase-js";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
import { GENERIC_DOMAINS, INTERNAL_MARQUE_DOMAINS } from "../_shared/generic-domains.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Interface standardisée pour les paramètres
    interface AutoMatchParams {
      batchSize?: number;      // Nombre d'emails par batch (default: 50)
      processAll?: boolean;    // Traiter tous les emails non classés
      domain?: string;         // Filtrer par domaine spécifique
    }

    const body: AutoMatchParams = await req.json();
    const batchSize = body?.batchSize || 50;
    const processAll = body?.processAll || false;
    const targetDomain = body?.domain || null;

    console.log(`🚀 Classification démarrée
      Mode: ${processAll ? 'COMPLET' : 'BATCH'}
      Taille batch: ${batchSize}
      ${targetDomain ? `Domaine ciblé: ${targetDomain}` : 'Tous domaines'}
    `);

    // Charger les mappings domaine actifs en mémoire
    const { data: domainMappings, error: mappingsError } = await supabase
      .from('email_domain_mappings')
      .select('id, domain, etablissement_id, groupe_id, partenaire_id, is_excluded')
      .eq('is_excluded', false);

    if (mappingsError) {
      console.error('Erreur chargement mappings domaine:', mappingsError);
      throw mappingsError;
    }

    console.log(`📋 ${domainMappings?.length || 0} mappings domaine actifs chargés`);

    // Charger les mappings email spécifiques (priorité sur les domaines)
    const { data: emailSpecificMappings, error: emailMappingsError } = await supabase
      .from('email_specific_mappings')
      .select('id, email_address, etablissement_id, groupe_id, partenaire_id, verified, is_unaffiliated')
      .eq('verified', true)
      .eq('is_unaffiliated', false);

    if (emailMappingsError) {
      console.error('Erreur chargement mappings email:', emailMappingsError);
      throw emailMappingsError;
    }

    console.log(`📧 ${emailSpecificMappings?.length || 0} mappings email spécifiques chargés`);

    // Charger les contacts avec email pour enrichir les mappings dynamiquement
    const { data: contactsWithEmail, error: contactsError } = await supabase
      .from('contacts')
      .select('email, etablissement_id, groupe_id')
      .not('email', 'is', null)
      .or('etablissement_id.not.is.null,groupe_id.not.is.null');

    if (contactsError) {
      console.error('Erreur chargement contacts:', contactsError);
    }

    // Charger les contacts partenaires
    const { data: partenaireContacts, error: partenaireContactsError } = await supabase
      .from('partenaires_contacts')
      .select('email, partenaire_id')
      .not('email', 'is', null)
      .not('partenaire_id', 'is', null);

    if (partenaireContactsError) {
      console.error('Erreur chargement contacts partenaires:', partenaireContactsError);
    }

    console.log(`👥 ${contactsWithEmail?.length || 0} contacts établissements, ${partenaireContacts?.length || 0} contacts partenaires chargés`);

    // Fonction pour trouver un mapping email spécifique OU depuis les contacts
    const findEmailSpecificMapping = (email: string) => {
      // 1. Chercher dans les mappings explicites
      const explicitMapping = (emailSpecificMappings || []).find(
        m => m.email_address?.toLowerCase() === email.toLowerCase() &&
        (m.etablissement_id || m.partenaire_id || m.groupe_id)
      );
      if (explicitMapping) return explicitMapping;

      // 2. Chercher dans les contacts établissements/groupes
      const contactMatch = (contactsWithEmail || []).find(
        c => c.email?.toLowerCase() === email.toLowerCase() &&
        (c.etablissement_id || c.groupe_id)
      );
      if (contactMatch) {
        return {
          email_address: email,
          etablissement_id: contactMatch.etablissement_id || null,
          groupe_id: contactMatch.groupe_id || null,
          partenaire_id: null,
          verified: true,
          confidence_level: 'high',
          source: 'contact'
        };
      }

      // 3. Chercher dans les contacts partenaires
      const partenaireMatch = (partenaireContacts || []).find(
        c => c.email?.toLowerCase() === email.toLowerCase()
      );
      if (partenaireMatch) {
        return {
          email_address: email,
          etablissement_id: null,
          groupe_id: null,
          partenaire_id: partenaireMatch.partenaire_id,
          verified: true,
          confidence_level: 'high',
          source: 'partenaire_contact'
        };
      }

      return null;
    };

    // Fonction pour propager l'attribution aux threads liés (même conversation sur d'autres comptes)
    const propagateToRelatedThreads = async (
      threadId: string,
      etablissementId: string | null,
      partenaireId: string | null,
      groupeId: string | null
    ): Promise<number> => {
      try {
        // Récupérer les messages du thread pour trouver les message_ids
        const { data: messages } = await supabase
          .from('email_messages')
          .select('message_id, reference_headers, in_reply_to')
          .eq('thread_id', threadId);

        if (!messages?.length) return 0;

        // Collecter tous les message_ids liés
        const relatedMessageIds = new Set<string>();
        messages.forEach(m => {
          if (m.message_id) relatedMessageIds.add(m.message_id);
          if (m.in_reply_to) relatedMessageIds.add(m.in_reply_to);
          if (m.reference_headers) {
            m.reference_headers.forEach((ref: string) => relatedMessageIds.add(ref));
          }
        });

        if (relatedMessageIds.size === 0) return 0;

        // Trouver les autres threads qui contiennent ces messages
        const { data: relatedMessages } = await supabase
          .from('email_messages')
          .select('thread_id')
          .in('message_id', Array.from(relatedMessageIds))
          .neq('thread_id', threadId);

        if (!relatedMessages?.length) return 0;

        const relatedThreadIds = [...new Set(relatedMessages.map(m => m.thread_id))];

        // Mettre à jour seulement les threads non attribués
        const { data: updatedThreads, error } = await supabase
          .from('email_threads')
          .update({
            etablissement_id: etablissementId,
            partenaire_id: partenaireId,
            groupe_id: groupeId,
            is_hors_etablissement: false,
          })
          .in('id', relatedThreadIds)
          .is('etablissement_id', null)
          .is('partenaire_id', null)
          .is('groupe_id', null)
          .select('id');

        if (error) {
          console.error('Erreur propagation threads liés:', error);
          return 0;
        }

        const count = updatedThreads?.length || 0;
        if (count > 0) {
          console.log(`   📢 Propagé à ${count} thread(s) lié(s)`);
        }
        return count;
      } catch (err) {
        console.error('Erreur propagation:', err);
        return 0;
      }
    };

    // Récupérer les threads non classés
    let query = supabase
      .from('email_threads')
      .select('id, participants, subject')
      .is('etablissement_id', null)
      .is('partenaire_id', null)
      .is('groupe_id', null)
      .eq('is_hors_etablissement', false)
      .eq('is_deleted', false)
      .or('category.is.null,category.neq.Interne OpenPulse')
      .order('created_at', { ascending: true });
    
    // En mode batch, limiter le nombre de threads
    if (!processAll) {
      query = query.limit(batchSize);
    }
    
    const { data: allThreads, error: threadsError } = await query;

    if (threadsError) {
      console.error('Erreur chargement threads:', threadsError);
      throw threadsError;
    }

    // Filtrer par domaine ciblé si spécifié
    let threads = allThreads;
    if (targetDomain) {
      threads = allThreads?.filter(thread => {
        const participants = Array.isArray(thread.participants) ? thread.participants : [];
        const emails = participants.filter(p => p?.email).map(p => String(p.email).trim().toLowerCase());
        const domains = [...new Set(emails.map(e => {
          const parts = e.split('@');
          return parts.length > 1 ? parts[1] : null;
        }).filter(Boolean))];
        
        return domains.includes(targetDomain.toLowerCase());
      }) || [];
      console.log(`🎯 Filtrage domaine: ${allThreads?.length || 0} → ${threads.length} threads pour ${targetDomain}`);
    }

    if (threadsError) {
      console.error('Erreur chargement threads:', threadsError);
      throw threadsError;
    }

    if (!threads || threads.length === 0) {
      console.log('✅ Aucun thread à classifier');
      return new Response(
        JSON.stringify({
          processed: 0,
          matched: 0,
          suggested: 0,
          hors: 0,
          interne: 0,
          completed: true,
          remaining: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📧 ${threads.length} threads à traiter`);

    let matched = 0, suggested = 0, hors = 0, interne = 0;

    for (const thread of threads) {
      try {
        // Normaliser les participants
        const participants = Array.isArray(thread.participants) ? thread.participants : [];
        const emails = participants
          .filter(p => p?.email)
          .map(p => String(p.email).trim().toLowerCase());

        if (emails.length === 0) {
          console.log(`⚠️ Thread ${thread.id}: aucun email valide, ignoré`);
          continue;
        }

        const domains = [...new Set(emails.map(e => {
          const parts = e.split('@');
          return parts.length > 1 ? parts[1] : null;
        }).filter(Boolean))];

        if (domains.length === 0) {
          console.log(`⚠️ Thread ${thread.id}: aucun domaine extrait`);
          continue;
        }

        console.log(`📨 Thread ${thread.id}: domaines [${domains.join(', ')}]`);

        // Séparer les emails par rôle pour priorisation intelligente
        const senderEmails = participants
          .filter(p => p?.type === 'from' && p?.email)
          .map(p => String(p.email).trim().toLowerCase());
        
        const recipientEmails = participants
          .filter(p => (p?.type === 'to' || p?.type === 'cc') && p?.email)
          .map(p => String(p.email).trim().toLowerCase());

        // Extraire les domaines par rôle
        const senderDomains = [...new Set(senderEmails.map(e => {
          const parts = e.split('@');
          return parts.length > 1 ? parts[1] : null;
        }).filter(Boolean))];

        const recipientDomains = [...new Set(recipientEmails.map(e => {
          const parts = e.split('@');
          return parts.length > 1 ? parts[1] : null;
        }).filter(Boolean))];

        console.log(`   📤 Expéditeurs: [${senderDomains.join(', ')}]`);
        console.log(`   📥 Destinataires: [${recipientDomains.join(', ')}]`);

        // 0. PRIORITÉ ABSOLUE: Chercher un mapping email spécifique
        let foundSpecificMapping = false;
        for (const email of emails) {
          const specificMapping = findEmailSpecificMapping(email);
          if (specificMapping) {
            const etabId = specificMapping.etablissement_id || null;
            const partId = specificMapping.partenaire_id || null;
            const grpId = specificMapping.groupe_id || null;

            await supabase
              .from('email_threads')
              .update({
                etablissement_id: etabId,
                partenaire_id: partId,
                groupe_id: grpId,
                is_hors_etablissement: false,
                category: null
              })
              .eq('id', thread.id);
            
            // Propager aux threads liés (même conversation sur d'autres comptes)
            await propagateToRelatedThreads(thread.id, etabId, partId, grpId);
            
            const entityType = specificMapping.etablissement_id ? 'Établissement' :
                              specificMapping.partenaire_id ? 'Partenaire' : 'Groupe';
            console.log(`🎯 Attribué via email spécifique (${email}) → ${entityType}`);
            matched++;
            foundSpecificMapping = true;
            break;
          }
        }
        
        if (foundSpecificMapping) continue;

        // 1. Cas TOUS génériques (sans mapping spécifique) → Hors établissement
        const allGeneric = domains.every(d => GENERIC_DOMAINS.includes(d));
        if (allGeneric) {
          await supabase
            .from('email_threads')
            .update({
              is_hors_etablissement: true,
              etablissement_id: null,
              partenaire_id: null,
              groupe_id: null,
              category: null
            })
            .eq('id', thread.id);
          
          console.log(`✅ Hors établissement: ${domains.join(', ')}`);
          hors++;
          continue;
        }

        // 1b. Cas INTERNE + GÉNÉRIQUES UNIQUEMENT → Hors établissement
        const nonInternal = domains.filter(d => !INTERNAL_MARQUE_DOMAINS.includes(d));
        if (nonInternal.length > 0 && nonInternal.every(d => GENERIC_DOMAINS.includes(d))) {
          await supabase
            .from('email_threads')
            .update({
              is_hors_etablissement: true,
              etablissement_id: null,
              partenaire_id: null,
              groupe_id: null,
              category: null
            })
            .eq('id', thread.id);
          
          console.log(`✅ Hors établissement (interne + génériques): ${domains.join(', ')}`);
          hors++;
          continue;
        }

        // 2. Cas TOUS internes OpenPulse → Interne
        const allInternal = domains.every(d => INTERNAL_MARQUE_DOMAINS.includes(d));
        if (allInternal) {
          await supabase
            .from('email_threads')
            .update({
              category: 'Interne OpenPulse',
              etablissement_id: null,
              partenaire_id: null,
              groupe_id: null,
              is_hors_etablissement: false
            })
            .eq('id', thread.id);
          
          console.log(`🏢 Interne OpenPulse: ${domains.join(', ')}`);
          interne++;
          continue;
        }

        // 3. PRIORISATION INTELLIGENTE : Si expéditeur = OpenPulse et destinataire = externe
        // → Classer vers le destinataire externe
        const senderIsInternal = senderDomains.every(d => INTERNAL_MARQUE_DOMAINS.includes(d));
        const hasExternalRecipient = recipientDomains.some(d => 
          !INTERNAL_MARQUE_DOMAINS.includes(d) && !GENERIC_DOMAINS.includes(d)
        );

        let relevantDomains = [];
        
        if (senderIsInternal && hasExternalRecipient) {
          // Cas : Camille@marque → client@chu-iles.example.org
          // → On priorise les domaines des DESTINATAIRES
          relevantDomains = recipientDomains.filter(
            d => !GENERIC_DOMAINS.includes(d) && !INTERNAL_MARQUE_DOMAINS.includes(d)
          );
          console.log(`   🎯 Priorisation destinataires externes: [${relevantDomains.join(', ')}]`);
        } else {
          // Cas normal : on considère tous les domaines pertinents
          relevantDomains = domains.filter(
            d => !GENERIC_DOMAINS.includes(d) && !INTERNAL_MARQUE_DOMAINS.includes(d)
          );
        }

        if (relevantDomains.length === 0) {
          await supabase
            .from('email_threads')
            .update({
              is_hors_etablissement: true,
              category: null
            })
            .eq('id', thread.id);
          hors++;
          console.log(`✅ Hors établissement (aucun domaine pertinent): ${domains.join(', ')}`);
          continue;
        }

        // 4. Collecter les mappings pour les domaines pertinents
        const mappingsForThread = relevantDomains.flatMap(domain =>
          (domainMappings || []).filter(m =>
            m.domain?.toLowerCase() === domain &&
            (m.etablissement_id || m.partenaire_id || m.groupe_id)
          )
        );

        if (mappingsForThread.length === 0) {
          console.log(`⚠️ Thread ${thread.id}: aucun mapping trouvé pour [${relevantDomains.join(', ')}]`);
          
          // Ne créer une suggestion unmapped_domain QUE si le domaine contient des mots-clés santé
          const healthKeywords = ['chu-', 'ch-', 'ght-', 'clinique', 'hopital', 'hospital',
            'ehpad', 'espic', 'polyclinique', 'sante', 'medical', 'medicale', 'samu',
            'urgences', 'aphp', 'aphm', 'ars-', 'has-sante', 'fhf', 'fehap'];
          
          const hasHealthDomain = relevantDomains.some(domain => 
            healthKeywords.some(kw => domain.toLowerCase().includes(kw))
          );
          
          if (hasHealthDomain) {
            // Créer une suggestion pour domaines santé non mappés
            await supabase
              .from('email_to_etablissement_suggestions')
              .insert({
                email_thread_id: thread.id,
                suggestion_type: 'unmapped_domain',
                status: 'pending',
                match_confidence: 0.65, // Confidence plus haute pour domaines santé
                match_reason: `Domaine santé non mappé: ${relevantDomains.join(', ')}`,
                extracted_data: { domains: relevantDomains, is_health_domain: true }
              });
            suggested++;
            console.log(`💡 Suggestion unmapped_domain (santé) créée pour [${relevantDomains.join(', ')}]`);
          } else {
            // Marquer comme hors établissement au lieu d'ignorer
            await supabase
              .from('email_threads')
              .update({
                is_hors_etablissement: true,
                category: null
              })
              .eq('id', thread.id);
            hors++;
            console.log(`✅ Hors établissement (non-santé): ${relevantDomains.join(', ')}`);
          }
          continue;
        }

        // 5. Dédupliquer par entité unique
        const uniqueEntities = new Map();
        for (const m of mappingsForThread) {
          const entityKey = m.etablissement_id || m.partenaire_id || m.groupe_id;
          if (!uniqueEntities.has(entityKey)) {
            uniqueEntities.set(entityKey, m);
          }
        }

        const uniqueMappings = Array.from(uniqueEntities.values());

        // 6. Une seule entité éligible → Attribution directe
        if (uniqueMappings.length === 1) {
          const mapping = uniqueMappings[0];
          
          if (
            mapping.verified &&
            (mapping.confidence_level === 'high' || mapping.confidence_level === 'medium') &&
            !mapping.prevent_auto
          ) {
            const etabId = mapping.etablissement_id || null;
            const partId = mapping.partenaire_id || null;
            const grpId = mapping.groupe_id || null;

            await supabase
              .from('email_threads')
              .update({
                etablissement_id: etabId,
                partenaire_id: partId,
                groupe_id: grpId,
                is_hors_etablissement: false,
                category: null
              })
              .eq('id', thread.id);
            
            // Propager aux threads liés (même conversation sur d'autres comptes)
            await propagateToRelatedThreads(thread.id, etabId, partId, grpId);
            
            const entityType = mapping.etablissement_id ? 'Établissement' :
                              mapping.partenaire_id ? 'Partenaire' : 'Groupe';
            console.log(`🎯 Attribué ${entityType}: ${mapping.domain}`);
            matched++;
          } else {
            // Créer une suggestion 'needs_review'
            await supabase.from('email_to_etablissement_suggestions').insert({
              email_thread_id: thread.id,
              suggested_etablissement_id: mapping.etablissement_id,
              suggestion_type: 'needs_review',
              status: 'pending',
              match_confidence: 0.7,
              match_reason: `Domaine ${mapping.domain} (verified=${mapping.verified}, confidence=${mapping.confidence_level}, prevent_auto=${mapping.prevent_auto})`
            });
            console.log(`💡 Suggestion needs_review: ${mapping.domain}`);
            suggested++;
          }
        } else {
          // 7. Plusieurs entités → Suggestions 'multi_entity'
          for (const mapping of uniqueMappings) {
            await supabase.from('email_to_etablissement_suggestions').insert({
              email_thread_id: thread.id,
              suggested_etablissement_id: mapping.etablissement_id,
              suggestion_type: 'multi_entity',
              status: 'pending',
              match_confidence: 0.65,
              match_reason: `Domaine ${mapping.domain} (${uniqueMappings.length} entités candidates)`
            });
          }
          console.log(`💡 ${uniqueMappings.length} suggestions multi_entity créées`);
          suggested++;
        }

      } catch (threadError) {
        console.error(`❌ Erreur thread ${thread.id}:`, threadError);
      }
    }

    // Compter les threads restants
    const { count: remaining } = await supabase
      .from('email_threads')
      .select('*', { count: 'exact', head: true })
      .is('etablissement_id', null)
      .is('partenaire_id', null)
      .is('groupe_id', null)
      .eq('is_hors_etablissement', false)
      .eq('is_deleted', false)
      .or('category.is.null,category.neq.Interne OpenPulse');

    const completed = (remaining || 0) === 0;

    console.log(`
✅ Pass terminé:
   - Traités: ${threads.length}
   - Attribués: ${matched}
   - Suggestions: ${suggested}
   - Hors établissement: ${hors}
   - Interne: ${interne}
   - Restants: ${remaining || 0}
   - Complété: ${completed}
    `);

    return new Response(
      JSON.stringify({
        processed: threads.length,
        matched,
        suggested,
        hors,
        interne,
        completed,
        remaining: remaining || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erreur globale:', error);
    return new Response(
      JSON.stringify({ error: sanitizeErrorForClient(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
