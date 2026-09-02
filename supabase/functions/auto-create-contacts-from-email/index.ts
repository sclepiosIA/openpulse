import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { assertEtablissementAccess } from "../_shared/etablissement-authz.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const isServiceRole = auth.isServiceCall;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { thread_id, etablissement_id, groupe_id, contacts } = await req.json();

    // Validation : soit etablissement_id, soit groupe_id
    if ((!etablissement_id && !groupe_id) || !contacts || !Array.isArray(contacts)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: etablissement_id or groupe_id and contacts" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller owns the etablissement (skip for service-role / cron callers)
    if (!isServiceRole && auth.userId && etablissement_id) {
      const access = await assertEtablissementAccess(auth.userId, etablissement_id);
      if (!access.allowed) {
        return new Response(
          JSON.stringify({ error: "Forbidden: no access to this etablissement" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const entityType = etablissement_id ? 'etablissement' : 'groupe';
    const entityId = etablissement_id || groupe_id;
    console.log(`📇 Processing ${contacts.length} contacts for ${entityType} ${entityId}`);

    const created: any[] = [];
    const updated: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];

    for (const contact of contacts) {
      // Validation de base
      if (!contact.nom || !contact.prenom) {
        skipped.push({ contact, reason: "Missing nom or prenom" });
        continue;
      }

      // Validation email si présent
      if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
        skipped.push({ contact, reason: "Invalid email format" });
        continue;
      }

      try {
        // Vérifier si contact existe déjà
        let existingContact = null;
        
        // Vérifier doublon par email
        if (contact.email) {
          let query = supabaseAdmin
            .from('contacts')
            .select('id, nom, prenom, fonction, email, telephone, type_contact')
            .eq('email', contact.email);

          if (etablissement_id) {
            query = query.eq('etablissement_id', etablissement_id);
          } else if (groupe_id) {
            query = query.eq('groupe_id', groupe_id).eq('niveau_contact', 'groupe');
          }

          const { data: existingByEmail } = await query.maybeSingle();

          if (existingByEmail) {
            existingContact = existingByEmail;
          }
        }

        // Si pas trouvé par email, vérifier par nom + prénom
        if (!existingContact) {
          let query = supabaseAdmin
            .from('contacts')
            .select('id, nom, prenom, fonction, email, telephone, type_contact')
            .eq('nom', contact.nom)
            .eq('prenom', contact.prenom);

          if (etablissement_id) {
            query = query.eq('etablissement_id', etablissement_id);
          } else if (groupe_id) {
            query = query.eq('groupe_id', groupe_id).eq('niveau_contact', 'groupe');
          }

          const { data: existingByName } = await query.maybeSingle();

          if (existingByName) {
            existingContact = existingByName;
          }
        }

        // Si le contact existe, essayer de l'enrichir
        if (existingContact) {
          console.log(`🔄 Contact exists, attempting enrichment: ${contact.prenom} ${contact.nom}`);
          
        // Utiliser le type_contact fourni par l'IA, sinon fallback sur déduction manuelle
          let type_contact = contact.type_contact || null;
          
          // Fallback si l'IA n'a pas fourni de type ou a mis "autre"
          if (!type_contact || type_contact === 'autre') {
            const fonctionLower = contact.fonction?.toLowerCase() || '';
            if (fonctionLower.includes('médecin') || fonctionLower.includes('docteur') || 
                fonctionLower.includes('praticien') || fonctionLower.includes('urgentiste') ||
                fonctionLower.includes('chef de service') || fonctionLower.includes('infirmier')) {
              type_contact = 'cliniciens';
            } else if (fonctionLower.includes('directeur') || fonctionLower.includes('daf') || 
                       fonctionLower.includes('drh') || fonctionLower.includes('administratif')) {
              type_contact = 'administration';
            } else if (fonctionLower.includes('dim') || fonctionLower.includes('information médicale') ||
                       fonctionLower.includes('codeur')) {
              type_contact = 'dim';
            } else if (fonctionLower.includes('informatique') || fonctionLower.includes('dsi') || 
                       fonctionLower.includes('système') || fonctionLower.includes('technicien it')) {
              type_contact = 'informatique';
            } else if (fonctionLower.includes('secrétaire') || fonctionLower.includes('secretariat') ||
                       fonctionLower.includes('assistant')) {
              type_contact = 'secretariat';
            } else {
              type_contact = 'autre';
            }
          }
          
          console.log(`📋 Type contact déterminé: ${type_contact} (fonction: ${contact.fonction})`)

          // Appeler la fonction d'enrichissement
          const { data: enrichResult, error: enrichError } = await supabaseAdmin.functions.invoke(
            'enrich-contact-from-email',
            {
              body: {
                contact_id: existingContact.id,
                new_data: {
                  nom: contact.nom,
                  prenom: contact.prenom,
                  fonction: contact.fonction,
                  email: contact.email,
                  telephone: contact.telephone,
                  type_contact: type_contact,
                },
                source: 'email',
                source_reference: thread_id,
                confidence: contact.confidence || 0.8,
              }
            }
          );

          if (enrichError) {
            console.error(`❌ Error enriching contact:`, enrichError);
            errors.push({ contact, error: `Enrichment failed: ${enrichError.message}` });
          } else if (enrichResult?.updated) {
            console.log(`✅ Contact enriched: ${enrichResult.changed_fields.join(', ')}`);
            updated.push({
              contact_id: existingContact.id,
              changed_fields: enrichResult.changed_fields,
              old_values: enrichResult.old_values,
              new_values: enrichResult.new_values
            });
          } else {
            console.log(`⏭️ Contact exists but no enrichment needed`);
            skipped.push({ contact, reason: "No enrichment needed", existing_id: existingContact.id });
          }
          continue;
        }

        // Utiliser le type_contact fourni par l'IA, sinon fallback sur déduction manuelle
        let type_contact = contact.type_contact || null;
        
        // Fallback si l'IA n'a pas fourni de type ou a mis "autre"
        if (!type_contact || type_contact === 'autre') {
          const fonctionLower = contact.fonction?.toLowerCase() || '';
          if (fonctionLower.includes('médecin') || fonctionLower.includes('docteur') || 
              fonctionLower.includes('praticien') || fonctionLower.includes('urgentiste') ||
              fonctionLower.includes('chef de service') || fonctionLower.includes('infirmier')) {
            type_contact = 'cliniciens';
          } else if (fonctionLower.includes('directeur') || fonctionLower.includes('daf') || 
                     fonctionLower.includes('drh') || fonctionLower.includes('administratif')) {
            type_contact = 'administration';
          } else if (fonctionLower.includes('dim') || fonctionLower.includes('information médicale') ||
                     fonctionLower.includes('codeur')) {
            type_contact = 'dim';
          } else if (fonctionLower.includes('informatique') || fonctionLower.includes('dsi') || 
                     fonctionLower.includes('système') || fonctionLower.includes('technicien it')) {
            type_contact = 'informatique';
          } else if (fonctionLower.includes('secrétaire') || fonctionLower.includes('secretariat') ||
                     fonctionLower.includes('assistant')) {
            type_contact = 'secretariat';
          } else {
            type_contact = 'autre';
          }
        }
        
        console.log(`📋 Type contact déterminé: ${type_contact} (fonction: ${contact.fonction})`)

        // Vérifier le niveau de confiance
        const confidence = contact.confidence || 0.75;
        const CONFIDENCE_THRESHOLD = 0.85;  // Harmonisé avec le prompt IA
        const MIN_CONFIDENCE = 0.65;  // Seuil minimum pour pending_contacts

        // Rejeter si confiance trop faible
        if (confidence < MIN_CONFIDENCE) {
          console.log(`❌ Confidence too low (${confidence.toFixed(2)}) - rejecting contact: ${contact.prenom} ${contact.nom}`);
          skipped.push({ contact, reason: `Confidence too low (${confidence.toFixed(2)})` });
          continue;
        }

      if (confidence < CONFIDENCE_THRESHOLD) {
        console.log(`⏸️ Medium confidence (${confidence.toFixed(2)}) - requires manual validation: ${contact.prenom} ${contact.nom}`);
        
        // 🆕 Check for duplicates in pending_contacts before inserting
        let existingPending = null;
        
        if (contact.email) {
          const { data: pendingByEmail } = await supabaseAdmin
            .from('pending_contacts')
            .select('id, status')
            .eq('status', 'pending')
            .eq('etablissement_id', etablissement_id || null)
            .eq('groupe_id', groupe_id || null)
            .eq('extracted_data->>email', contact.email)
            .maybeSingle();
          
          existingPending = pendingByEmail;
        }
        
        if (!existingPending && contact.nom && contact.prenom) {
          const { data: pendingByName } = await supabaseAdmin
            .from('pending_contacts')
            .select('id, status')
            .eq('status', 'pending')
            .eq('etablissement_id', etablissement_id || null)
            .eq('groupe_id', groupe_id || null)
            .eq('extracted_data->>nom', contact.nom)
            .eq('extracted_data->>prenom', contact.prenom)
            .maybeSingle();
          
          existingPending = pendingByName;
        }
        
        if (existingPending) {
          console.log(`⏭️ Pending contact already exists: ${contact.prenom} ${contact.nom} (ID: ${existingPending.id})`);
          skipped.push({ 
            contact, 
            reason: "Already pending validation", 
            pending_id: existingPending.id 
          });
          continue;
        }
        
        const { error: pendingError } = await supabaseAdmin
          .from('pending_contacts')
          .insert({
            email_thread_id: thread_id || null,
            etablissement_id: etablissement_id || null,
            groupe_id: groupe_id || null,
            extracted_data: {
              nom: contact.nom,
              prenom: contact.prenom,
              fonction: contact.fonction,
              email: contact.email,
              telephone: contact.telephone,
            },
            confidence: confidence,
            status: 'pending',
          });

          if (pendingError) {
            console.error(`❌ Error creating pending contact:`, pendingError);
            errors.push({ contact, error: pendingError.message });
          } else {
            console.log(`✅ Pending contact created for validation: ${contact.prenom} ${contact.nom}`);
            skipped.push({ contact, reason: "Low confidence - pending validation", confidence });
          }
        } else {
          // ✅ Vérifier si un contact avec cet email existe déjà
          let existingContact = null;
          
          if (contact.email) {
            const { data: contactByEmail } = await supabaseAdmin
              .from('contacts')
              .select('id, nom, prenom, fonction, email, telephone, type_contact, etablissement_id, groupe_id')
              .eq('email', contact.email)
              .or(`etablissement_id.eq.${etablissement_id},groupe_id.eq.${groupe_id}`)
              .maybeSingle();
            
            existingContact = contactByEmail;
          }
          
          if (existingContact) {
            // 🔄 Mettre à jour le contact existant avec les nouvelles infos
            console.log(`🔄 Contact with email ${contact.email} already exists (ID: ${existingContact.id}), updating...`);
            
            const { data: updatedContact, error: updateError } = await supabaseAdmin
              .from('contacts')
              .update({
                // Mettre à jour uniquement les champs non vides et différents
                prenom: contact.prenom || existingContact.prenom,
                nom: contact.nom || existingContact.nom,
                fonction: contact.fonction || existingContact.fonction,
                telephone: contact.telephone || existingContact.telephone,
                type_contact: type_contact || existingContact.type_contact,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingContact.id)
              .select()
              .single();
            
            if (updateError) {
              console.error(`❌ Error updating contact ${contact.email}:`, updateError);
              errors.push({ contact, error: updateError.message });
            } else {
              console.log(`✅ High confidence (${confidence.toFixed(2)}) - updated existing contact: ${updatedContact.prenom} ${updatedContact.nom} (${type_contact})`);
              updated.push(updatedContact);
            }
          } else {
            // ➕ Créer un nouveau contact si aucun email correspondant
            const { data: newContact, error: insertError } = await supabaseAdmin
              .from('contacts')
              .insert({
                etablissement_id: etablissement_id || null,
                groupe_id: groupe_id || null,
                niveau_contact: groupe_id ? 'groupe' : 'etablissement',
                nom: contact.nom,
                prenom: contact.prenom,
                fonction: contact.fonction || 'Non spécifiée',
                email: contact.email || null,
                telephone: contact.telephone || null,
                type_contact,
                created_source: 'email_ai',
                created_metadata: {
                  email_thread_id: thread_id,
                  confidence: confidence,
                  model_used: 'gpt-5',
                  extraction_date: new Date().toISOString()
                }
              })
              .select()
              .single();

            if (insertError) {
              console.error(`❌ Error creating contact ${contact.prenom} ${contact.nom}:`, insertError);
              errors.push({ contact, error: insertError.message });
            } else {
              console.log(`✅ High confidence (${confidence.toFixed(2)}) - created contact automatically: ${newContact.prenom} ${newContact.nom} (${type_contact})`);
              created.push(newContact);
            }
          }
        }

      } catch (err) {
        console.error(`❌ Exception creating contact ${contact.prenom} ${contact.nom}:`, err);
        errors.push({ contact, error: err.message });
      }
    }

    console.log(`📊 Results: ${created.length} created, ${updated.length} updated, ${skipped.length} skipped, ${errors.length} errors`);

    // Calculer la confiance moyenne des contacts traités
    const avgConfidence = contacts.length > 0
      ? contacts.reduce((sum, c) => sum + (c.confidence || 0.75), 0) / contacts.length
      : 0;

    return new Response(
      JSON.stringify({
        success: true,
        created_count: created.length,
        updated_count: updated.length,
        skipped_count: skipped.length,
        error_count: errors.length,
        average_confidence: parseFloat(avgConfidence.toFixed(2)),
        created,
        updated,
        skipped,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('auto-create-contacts-from-email', error, corsHeaders, 500);
  }
});
