import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { addMonths, startOfMonth } from "https://esm.sh/date-fns@3.6.0";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

interface Etablissement {
  id: string;
  nom: string;
  type_offre: string;
  modele_detaille: string | null;
  periodicite_paiement: string | null;
  paiement_initial: number | null;
  date_premier_paiement: string | null;
  date_signature: string | null;
  montant_mensuel: number | null;
  montant_annuel: number | null;
  statut: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Internal CRON only: require shared secret OR service_role
    const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    const providedSecret = req.headers.get("x-function-secret");
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isInternal = (!!internalSecret && providedSecret === internalSecret) ||
                       (!!authHeader && authHeader === `Bearer ${serviceKey}`);
    if (!isInternal) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🔄 Génération des recettes futures...");

    // 1. Récupérer tous les établissements en production
    const { data: etablissements, error: etabError } = await supabase
      .from("etablissements")
      .select("*")
      .eq("statut", "Production");

    if (etabError) throw etabError;

    console.log(`📊 ${etablissements.length} établissements en production`);

    // 2. Générer les recettes pour les 36 prochains mois
    const dateDebut = startOfMonth(new Date());
    const nombreMois = 36;
    const recettesACreer: any[] = [];

    for (const etab of etablissements as Etablissement[]) {
      const dateReference = etab.date_premier_paiement
        ? new Date(etab.date_premier_paiement)
        : etab.date_signature
        ? new Date(etab.date_signature)
        : dateDebut;

      const periodicite = (etab.periodicite_paiement as "mensuel" | "trimestriel" | "annuel") || "mensuel";
      const increment = periodicite === "mensuel" ? 1 : periodicite === "trimestriel" ? 3 : 12;

      // Calculer le montant mensuel
      let montantMensuel = 0;
      if (etab.type_offre === "Au succès" && etab.montant_mensuel) {
        montantMensuel = etab.montant_mensuel;
      } else if (etab.montant_annuel) {
        montantMensuel = etab.montant_annuel / 12;
      }

      // Générer les recettes selon la périodicité
      for (let i = 0; i < nombreMois; i += increment) {
        const mois = addMonths(dateDebut, i);
        
        // Vérifier si mois correspond à un mois de paiement selon la date de référence
        const moisDepuisReference = Math.floor(
          (mois.getTime() - dateReference.getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
        
        if (moisDepuisReference % increment === 0 && moisDepuisReference >= 0) {
          let montant = montantMensuel;
          
          // Paiement initial pour le premier mois
          if (i === 0 && etab.paiement_initial) {
            montant += etab.paiement_initial;
          }

          if (montant > 0) {
            recettesACreer.push({
              etablissement_id: etab.id,
              mois: mois.toISOString().split('T')[0],
              montant_prevu: montant,
              statut: "prevue",
              est_previsionnel: true,
              genere_automatiquement: true,
              date_paiement_prevue: mois.toISOString().split('T')[0],
            });
          }
        }
      }
    }

    console.log(`💰 ${recettesACreer.length} recettes à créer`);

    // 3. Supprimer les anciennes recettes générées automatiquement
    const { error: deleteError } = await supabase
      .from("tresorerie_recettes_mensuelles")
      .delete()
      .eq("genere_automatiquement", true);

    if (deleteError) {
      console.error("Erreur suppression:", deleteError);
    }

    // 4. Insérer les nouvelles recettes
    if (recettesACreer.length > 0) {
      // Insérer par batch de 500
      const batchSize = 500;
      for (let i = 0; i < recettesACreer.length; i += batchSize) {
        const batch = recettesACreer.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("tresorerie_recettes_mensuelles")
          .insert(batch);

        if (insertError) {
          console.error(`Erreur insertion batch ${i / batchSize + 1}:`, insertError);
        } else {
          console.log(`✅ Batch ${i / batchSize + 1} inséré (${batch.length} recettes)`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        etablissements: etablissements.length,
        recettes_creees: recettesACreer.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("❌ Erreur:", error);
    return buildErrorResponse('generate-future-revenues', error, corsHeaders, 500);
  }
});
