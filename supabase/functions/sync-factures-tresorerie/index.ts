import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

/**
 * Sync Factures with Tresorerie Revenus
 * Automatically creates/updates tresorerie_revenus entries when invoices change
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { factureId, action } = await req.json();

    if (!factureId) {
      throw new Error("factureId is required");
    }

    console.log(`[sync-factures-tresorerie] Processing facture ${factureId}, action: ${action || 'auto'}`);

    // Fetch the invoice with establishment info
    const { data: facture, error: factureError } = await supabase
      .from("factures")
      .select(`
        *,
        etablissement:etablissements(id, nom, modele_statique_succes, periodicite_paiement, pallier_vise)
      `)
      .eq("id", factureId)
      .single();

    if (factureError) {
      console.error("[sync-factures-tresorerie] Error fetching facture:", factureError);
      throw factureError;
    }

    if (!facture) {
      throw new Error(`Facture ${factureId} not found`);
    }

    // Map invoice status to treasury status
    const mapStatut = (factureStatut: string): string => {
      switch (factureStatut) {
        case 'brouillon':
        case 'emise':
          return 'a_facturer';
        case 'envoyee':
        case 'en_attente':
          return 'en_attente';
        case 'partiellement_payee':
          return 'partiel';
        case 'payee':
          return 'paye';
        case 'annulee':
          return 'annule';
        default:
          return 'a_facturer';
      }
    };

    // Calculate the month from the invoice date
    const invoiceDate = new Date(facture.date_echeance || facture.date_emission);
    const mois = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}-01`;

    // Check if a revenue entry already exists for this invoice
    const { data: existingRevenu, error: searchError } = await supabase
      .from("tresorerie_revenus")
      .select("id")
      .eq("numero_facture", facture.numero)
      .maybeSingle();

    if (searchError) {
      console.error("[sync-factures-tresorerie] Error searching existing revenu:", searchError);
    }

    const revenuData = {
      etablissement_id: facture.etablissement_id,
      mois,
      montant_prevu: facture.montant_ttc || 0,
      montant_paye: facture.montant_paye || null,
      statut: mapStatut(facture.statut),
      type_revenu: 'facturation',
      date_facture: facture.date_emission,
      date_paiement_reel: facture.statut === 'payee' ? new Date().toISOString().split('T')[0] : null,
      numero_facture: facture.numero,
      notes: `Sync auto depuis facture ${facture.numero}`,
    };

    let result;

    if (existingRevenu?.id) {
      // Update existing entry
      const { data, error } = await supabase
        .from("tresorerie_revenus")
        .update(revenuData)
        .eq("id", existingRevenu.id)
        .select()
        .single();

      if (error) {
        console.error("[sync-factures-tresorerie] Error updating revenu:", error);
        throw error;
      }

      result = { action: 'updated', revenu: data };
      console.log(`[sync-factures-tresorerie] Updated revenu ${existingRevenu.id}`);
    } else {
      // Create new entry
      const { data, error } = await supabase
        .from("tresorerie_revenus")
        .insert(revenuData)
        .select()
        .single();

      if (error) {
        console.error("[sync-factures-tresorerie] Error creating revenu:", error);
        throw error;
      }

      result = { action: 'created', revenu: data };
      console.log(`[sync-factures-tresorerie] Created revenu ${data.id}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        facture_id: factureId,
        facture_numero: facture.numero,
        facture_statut: facture.statut,
        tresorerie_statut: revenuData.statut,
        ...result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('sync-factures-tresorerie', error, corsHeaders, 500);
  }

});
