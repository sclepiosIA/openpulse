/**
 * Edge Function: qonto-reconcile
 * 
 * Rapproche automatiquement les transactions Qonto avec les revenus/dépenses existants.
 * Utilise le matching par montant, date et libellé.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { requireInternalSecret } from "../_shared/internal-secret.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-internal-secret;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const denied = requireInternalSecret(req, corsHeaders);
    if (denied) return denied;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json().catch(() => ({}));
    const { operation_id, recette_id, depense_id, mode = 'auto' } = body;

    const startTime = Date.now();
    let totalReconciled = 0;
    let errors: string[] = [];

    // Mode manuel : rapprochement d'une transaction spécifique
    if (mode === 'manual' && operation_id) {
      const { data: operation, error: opError } = await supabaseClient
        .from('tresorerie_operations_bancaires')
        .select('*')
        .eq('id', operation_id)
        .single();

      if (opError || !operation) {
        throw new Error('Opération bancaire non trouvée');
      }

      const updateData: Record<string, any> = { reconcilie: true };
      
      if (recette_id) {
        updateData.recette_id = recette_id;
      } else if (depense_id) {
        updateData.depense_id = depense_id;
      }

      const { error: updateError } = await supabaseClient
        .from('tresorerie_operations_bancaires')
        .update(updateData)
        .eq('id', operation_id);

      if (updateError) throw updateError;
      totalReconciled = 1;
    }

    // Mode auto : rapprochement automatique de toutes les transactions non rapprochées
    if (mode === 'auto') {
      // 1. Récupérer les crédits non rapprochés
      const { data: unlinkedCredits } = await supabaseClient
        .from('tresorerie_operations_bancaires')
        .select('*')
        .eq('type_operation', 'credit')
        .eq('reconcilie', false)
        .is('recette_id', null);

      console.log(`📥 ${unlinkedCredits?.length || 0} crédits à rapprocher`);

      // Rapprocher les crédits avec les revenus par montant et date
      for (const credit of unlinkedCredits || []) {
        const txDate = credit.date_valeur?.split('T')[0] || credit.date_operation?.split('T')[0];
        
        // Chercher un revenu correspondant (même montant, même date +/- 3 jours)
        const { data: matchingRevenu } = await supabaseClient
          .from('tresorerie_revenus')
          .select('id')
          .is('source_modele', null)
          .gte('montant_paye', credit.montant - 0.01)
          .lte('montant_paye', credit.montant + 0.01)
          .gte('date_paiement_reel', new Date(new Date(txDate).getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .lte('date_paiement_reel', new Date(new Date(txDate).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .limit(1)
          .maybeSingle();

        if (matchingRevenu) {
          const { error: linkError } = await supabaseClient
            .from('tresorerie_operations_bancaires')
            .update({ 
              recette_id: matchingRevenu.id, 
              reconcilie: true 
            })
            .eq('id', credit.id);

          if (!linkError) {
            totalReconciled++;
            console.log(`✅ Crédit rapproché: ${credit.libelle} - ${credit.montant}€`);
          } else {
            errors.push(`Erreur crédit ${credit.id}: ${linkError.message}`);
          }
        }
      }

      // 2. Récupérer les débits non rapprochés
      const { data: unlinkedDebits } = await supabaseClient
        .from('tresorerie_operations_bancaires')
        .select('*')
        .eq('type_operation', 'debit')
        .eq('reconcilie', false)
        .is('depense_id', null);

      console.log(`📤 ${unlinkedDebits?.length || 0} débits à rapprocher`);

      // Rapprocher les débits avec les dépenses par montant et date
      for (const debit of unlinkedDebits || []) {
        const txDate = debit.date_valeur?.split('T')[0] || debit.date_operation?.split('T')[0];
        
        // Chercher une dépense correspondante (même montant, même date +/- 3 jours)
        const { data: matchingDepense } = await supabaseClient
          .from('tresorerie_depenses')
          .select('id')
          .neq('source', 'qonto_sync')
          .gte('montant', debit.montant - 0.01)
          .lte('montant', debit.montant + 0.01)
          .gte('date_paiement_reel', new Date(new Date(txDate).getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .lte('date_paiement_reel', new Date(new Date(txDate).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .limit(1)
          .maybeSingle();

        if (matchingDepense) {
          const { error: linkError } = await supabaseClient
            .from('tresorerie_operations_bancaires')
            .update({ 
              depense_id: matchingDepense.id, 
              reconcilie: true 
            })
            .eq('id', debit.id);

          if (!linkError) {
            totalReconciled++;
            console.log(`✅ Débit rapproché: ${debit.libelle} - ${debit.montant}€`);
          } else {
            errors.push(`Erreur débit ${debit.id}: ${linkError.message}`);
          }
        }
      }
    }

    // 3. Statistiques de rapprochement
    const { data: stats } = await supabaseClient
      .from('tresorerie_operations_bancaires')
      .select('reconcilie')
      .then(({ data }) => {
        const total = data?.length || 0;
        const reconciled = data?.filter(op => op.reconcilie).length || 0;
        return { 
          data: { 
            total, 
            reconciled, 
            unreconciled: total - reconciled,
            rate: total > 0 ? Math.round((reconciled / total) * 100) : 0 
          } 
        };
      });

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        reconciled_count: totalReconciled,
        stats,
        errors: errors.length > 0 ? errors : undefined,
        duration_ms: duration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('qonto-reconcile', error, corsHeaders, 500);
  }
});
