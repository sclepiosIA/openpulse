import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin with standard auth
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = userRoles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🧹 Starting cleanup of internal contacts and generic names...");

    const internalDomains = ['exploitant.example.org'];
    const genericDomains = ['gmail.com', 'outlook.com', 'outlook.fr', 'yahoo.fr', 'yahoo.com',
                           'hotmail.com', 'hotmail.fr', 'free.fr', 'orange.fr', 'wanadoo.fr', 'laposte.net'];
    const forbiddenDomains = [...internalDomains, ...genericDomains];

    let totalDeleted = 0;
    let genericDeleted = 0;
    let genericPartenaireDeleted = 0;
    const results: any[] = [];

    // Delete from `contacts` table
    for (const domain of forbiddenDomains) {
      const { data: toDelete } = await supabaseAdmin
        .from('contacts')
        .select('id, nom, prenom, email, etablissement_id')
        .ilike('email', `%@${domain}`);

      if (toDelete && toDelete.length > 0) {
        console.log(`🗑️ Deleting ${toDelete.length} contacts with domain ${domain}`);
        
        const { error: deleteError } = await supabaseAdmin
          .from('contacts')
          .delete()
          .ilike('email', `%@${domain}`);

        if (deleteError) {
          console.error(`❌ Error deleting contacts for ${domain}:`, deleteError);
          results.push({ domain, deleted: 0, error: deleteError.message });
        } else {
          totalDeleted += toDelete.length;
          results.push({ domain, deleted: toDelete.length, contacts: toDelete.map(c => c.email) });
        }
      } else {
        results.push({ domain, deleted: 0 });
      }
    }

    // Delete from `partenaires_contacts` table
    let partenaireContactsDeleted = 0;
    for (const domain of forbiddenDomains) {
      const { data: toDelete } = await supabaseAdmin
        .from('partenaires_contacts')
        .select('id, nom, prenom, email')
        .ilike('email', `%@${domain}`);

      if (toDelete && toDelete.length > 0) {
        console.log(`🗑️ Deleting ${toDelete.length} partenaire contacts with domain ${domain}`);
        
        const { error: deleteError } = await supabaseAdmin
          .from('partenaires_contacts')
          .delete()
          .ilike('email', `%@${domain}`);

        if (!deleteError) {
          partenaireContactsDeleted += toDelete.length;
        }
      }
    }

    // 2. Supprimer les contacts avec noms génériques de `contacts`
    const genericContactsQuery = `
      (nom ILIKE '%inconnu%' OR nom ILIKE '%non spécifié%' OR nom ILIKE '%a déterminer%' OR nom ILIKE '%non renseigné%' OR nom ILIKE '%n/a%')
      OR (prenom ILIKE '%inconnu%' OR prenom ILIKE '%non spécifié%' OR prenom ILIKE '%a déterminer%' OR prenom ILIKE '%non renseigné%' OR prenom ILIKE '%n/a%')
    `;

    const { data: genericContacts } = await supabaseAdmin
      .from('contacts')
      .select('id, nom, prenom, etablissement_id')
      .or(genericContactsQuery);

    if (genericContacts && genericContacts.length > 0) {
      console.log(`🗑️ Deleting ${genericContacts.length} contacts with generic names`);
      
      const { error: deleteGenericError } = await supabaseAdmin
        .from('contacts')
        .delete()
        .or(genericContactsQuery);

      if (!deleteGenericError) {
        genericDeleted = genericContacts.length;
      } else {
        console.error('❌ Error deleting generic contacts:', deleteGenericError);
      }
    }

    // 3. Supprimer les contacts avec noms génériques de `partenaires_contacts`
    const { data: genericPartenaireContacts } = await supabaseAdmin
      .from('partenaires_contacts')
      .select('id, nom, prenom')
      .or(genericContactsQuery);

    if (genericPartenaireContacts && genericPartenaireContacts.length > 0) {
      console.log(`🗑️ Deleting ${genericPartenaireContacts.length} partenaire contacts with generic names`);
      
      const { error: deleteGenericError } = await supabaseAdmin
        .from('partenaires_contacts')
        .delete()
        .or(genericContactsQuery);

      if (!deleteGenericError) {
        genericPartenaireDeleted = genericPartenaireContacts.length;
      } else {
        console.error('❌ Error deleting generic partenaire contacts:', deleteGenericError);
      }
    }

    // 4. Delete from `pending_contacts` (both forbidden domains and generic names)
    const { data: pendingToDelete } = await supabaseAdmin
      .from('pending_contacts')
      .select('id, extracted_data')
      .eq('status', 'pending');

    let pendingDeleted = 0;
    let pendingGenericDeleted = 0;
    if (pendingToDelete) {
      for (const pending of pendingToDelete) {
        const email = pending.extracted_data?.email;
        const nom = pending.extracted_data?.nom?.toLowerCase() || '';
        const prenom = pending.extracted_data?.prenom?.toLowerCase() || '';
        
        // Vérifier domaine interdit
        if (email) {
          const domain = email.split('@')[1]?.toLowerCase();
          if (domain && forbiddenDomains.includes(domain)) {
            await supabaseAdmin
              .from('pending_contacts')
              .delete()
              .eq('id', pending.id);
            pendingDeleted++;
            continue;
          }
        }
        
        // Vérifier nom générique
        const isGeneric = ['inconnu', 'non spécifié', 'a déterminer', 'n/a', 'non renseigné'].some(
          generic => nom.includes(generic) || prenom.includes(generic)
        );
        
        if (isGeneric) {
          await supabaseAdmin
            .from('pending_contacts')
            .delete()
            .eq('id', pending.id);
          pendingGenericDeleted++;
        }
      }
    }

    // 🔄 Fusionner les contacts avec emails en double
    console.log('🔍 Searching for duplicate emails...');

    const { data: duplicateEmails, error: dupError } = await supabaseAdmin.rpc('get_duplicate_emails');

    let mergedCount = 0;
    if (duplicateEmails && duplicateEmails.length > 0) {
      console.log(`Found ${duplicateEmails.length} emails with duplicates`);
      
      for (const dup of duplicateEmails) {
        // Récupérer tous les contacts avec cet email
        const { data: contactsWithEmail } = await supabaseAdmin
          .from('contacts')
          .select('*')
          .eq('email', dup.email)
          .order('created_at', { ascending: true });  // Garder le plus ancien
        
        if (contactsWithEmail && contactsWithEmail.length > 1) {
          const [keepContact, ...duplicates] = contactsWithEmail;
          
          console.log(`📧 Merging ${duplicates.length} duplicates for email: ${dup.email}`);
          
          // Mettre à jour le contact à garder avec les infos les plus complètes
          const mergedData = {
            prenom: duplicates.find(c => c.prenom)?.prenom || keepContact.prenom,
            nom: duplicates.find(c => c.nom)?.nom || keepContact.nom,
            fonction: duplicates.find(c => c.fonction)?.fonction || keepContact.fonction,
            telephone: duplicates.find(c => c.telephone)?.telephone || keepContact.telephone,
            type_contact: duplicates.find(c => c.type_contact)?.type_contact || keepContact.type_contact,
          };
          
          await supabaseAdmin
            .from('contacts')
            .update(mergedData)
            .eq('id', keepContact.id);
          
          // Supprimer les doublons
          for (const duplicate of duplicates) {
            await supabaseAdmin
              .from('contacts')
              .delete()
              .eq('id', duplicate.id);
            mergedCount++;
          }
        }
      }
    }

    console.log(`✅ Cleanup completed: ${totalDeleted} domain-based contacts, ${genericDeleted} generic contacts, ${genericPartenaireDeleted} generic partenaire contacts, ${partenaireContactsDeleted} partenaire domain-based, ${pendingDeleted} pending domain-based, ${pendingGenericDeleted} pending generic, ${mergedCount} duplicates merged`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleanup completed successfully`,
        contacts_deleted: totalDeleted,
        generic_contacts_deleted: genericDeleted,
        partenaire_contacts_deleted: partenaireContactsDeleted,
        generic_partenaire_contacts_deleted: genericPartenaireDeleted,
        pending_contacts_deleted: pendingDeleted,
        pending_generic_deleted: pendingGenericDeleted,
        duplicates_merged: mergedCount,
        details: results
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('cleanup-internal-contacts', error, corsHeaders, 500);
  }
});
