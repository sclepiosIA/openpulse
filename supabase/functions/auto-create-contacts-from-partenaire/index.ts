import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const apiKey = req.headers.get("apikey");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const isServiceRole = authHeader?.includes(serviceRoleKey) || apiKey === serviceRoleKey;

    if (!isServiceRole) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: service role required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("🔑 Service role authentication verified");
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    const { thread_id, partenaire_id, contacts } = await req.json();

    if (!partenaire_id || !contacts || !Array.isArray(contacts)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: partenaire_id and contacts" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📇 Processing ${contacts.length} contacts for partenaire ${partenaire_id}`);

    const created: any[] = [];
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
          const { data: existingByEmail } = await supabaseAdmin
            .from('partenaires_contacts')
            .select('id, nom, prenom, fonction, email, telephone')
            .eq('partenaire_id', partenaire_id)
            .eq('email', contact.email)
            .maybeSingle();

          if (existingByEmail) {
            existingContact = existingByEmail;
          }
        }

        // Si pas trouvé par email, vérifier par nom + prénom
        if (!existingContact) {
          const { data: existingByName } = await supabaseAdmin
            .from('partenaires_contacts')
            .select('id, nom, prenom, fonction, email, telephone')
            .eq('partenaire_id', partenaire_id)
            .eq('nom', contact.nom)
            .eq('prenom', contact.prenom)
            .maybeSingle();

          if (existingByName) {
            existingContact = existingByName;
          }
        }

        // Si le contact existe, on le skip (pas d'enrichissement pour l'instant)
        if (existingContact) {
          console.log(`⏭️ Contact already exists: ${contact.prenom} ${contact.nom}`);
          skipped.push({ contact, reason: "Contact already exists", existing_id: existingContact.id });
          continue;
        }

        // Créer le contact
        const { data: newContact, error: insertError } = await supabaseAdmin
          .from('partenaires_contacts')
          .insert({
            partenaire_id,
            nom: contact.nom,
            prenom: contact.prenom,
            fonction: contact.fonction || null,
            email: contact.email || null,
            telephone: contact.telephone || null,
            est_contact_principal: false,
            notes: thread_id ? `Créé automatiquement depuis l'email thread ${thread_id}` : null,
          })
          .select()
          .single();

        if (insertError) {
          console.error(`❌ Error creating partenaire contact ${contact.prenom} ${contact.nom}:`, insertError);
          errors.push({ contact, error: insertError.message });
        } else {
          console.log(`✅ Created partenaire contact: ${newContact.prenom} ${newContact.nom}`);
          created.push(newContact);
        }

      } catch (err) {
        console.error(`❌ Exception creating partenaire contact ${contact.prenom} ${contact.nom}:`, err);
        errors.push({ contact, error: err.message });
      }
    }

    console.log(`📊 Results: ${created.length} created, ${skipped.length} skipped, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        created_count: created.length,
        skipped_count: skipped.length,
        error_count: errors.length,
        created,
        skipped,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('auto-create-contacts-from-partenaire', error, corsHeaders, 500);
  }
});
