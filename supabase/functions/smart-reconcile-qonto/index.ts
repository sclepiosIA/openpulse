import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

interface Transaction {
  id: string;
  label: string;
  amount: number;
  side: 'credit' | 'debit';
  emitted_at: string;
  settled_at: string | null;
  counterparty_name?: string;
  category?: string;
}

interface MatchSuggestion {
  transaction_id: string;
  match_type: 'revenu' | 'depense' | 'new';
  match_id: string | null;
  confidence: number;
  reason: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transaction_ids, auto_apply = false } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Récupérer les transactions Qonto non rapprochées
    let query = supabase
      .from('qonto_transactions')
      .select('*')
      .is('reconciled_at', null);

    if (transaction_ids && transaction_ids.length > 0) {
      query = query.in('id', transaction_ids);
    } else {
      query = query.limit(50);
    }

    const { data: transactions, error: txError } = await query;

    if (txError) {
      throw new Error(`Erreur récupération transactions: ${txError.message}`);
    }

    if (!transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Aucune transaction à réconcilier", matches: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Récupérer les revenus non réconciliés
    const { data: revenus } = await supabase
      .from('tresorerie_revenus')
      .select('id, etablissement_nom, montant_ht, montant_ttc, date_facturation, date_echeance, statut')
      .in('statut', ['en_attente', 'a_relancer'])
      .order('date_echeance', { ascending: true });

    // 3. Récupérer les dépenses non réconciliées
    const { data: depenses } = await supabase
      .from('tresorerie_depenses')
      .select('id, libelle, montant, date_paiement, categorie, fournisseur')
      .is('qonto_transaction_id', null)
      .order('date_paiement', { ascending: true });

    // 4. Préparer le contexte pour GPT-5
    const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
    const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');

    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Configuration Azure OpenAI manquante" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `Tu es un assistant comptable expert en réconciliation bancaire.
Tu dois analyser des transactions bancaires et les matcher avec des revenus ou dépenses existants.

Règles de matching:
1. Pour les crédits (entrées d'argent): chercher dans les revenus (factures en attente)
2. Pour les débits (sorties d'argent): chercher dans les dépenses
3. Le montant doit correspondre à ±2% près
4. Le nom du payeur/bénéficiaire doit avoir une correspondance logique
5. La date doit être cohérente (pas plus de 30 jours d'écart)

Retourne un JSON avec exactement ce format:
{
  "matches": [
    {
      "transaction_id": "uuid de la transaction",
      "match_type": "revenu|depense|new",
      "match_id": "uuid du revenu/dépense correspondant ou null si nouveau",
      "confidence": 0.0-1.0,
      "reason": "Explication courte du matching"
    }
  ]
}

Si aucun match trouvé, match_type="new" et match_id=null.
Score de confiance: 0.9+ = match certain, 0.7-0.9 = probable, <0.7 = incertain`;

    const transactionsForAI = transactions.map(t => ({
      id: t.id,
      label: t.label,
      amount: t.amount_cents / 100,
      type: t.side === 'credit' ? 'CREDIT' : 'DEBIT',
      date: t.emitted_at,
      counterparty: t.counterparty_name,
    }));

    const revenusForAI = (revenus || []).map(r => ({
      id: r.id,
      client: r.etablissement_nom,
      montant: r.montant_ttc || r.montant_ht,
      date_facture: r.date_facturation,
      date_echeance: r.date_echeance,
    }));

    const depensesForAI = (depenses || []).map(d => ({
      id: d.id,
      libelle: d.libelle,
      montant: d.montant,
      date: d.date_paiement,
      fournisseur: d.fournisseur,
      categorie: d.categorie,
    }));

    const userPrompt = `Analyse et match les transactions suivantes:

**Transactions bancaires à réconcilier:**
${JSON.stringify(transactionsForAI, null, 2)}

**Revenus en attente (factures non payées):**
${JSON.stringify(revenusForAI, null, 2)}

**Dépenses non réconciliées:**
${JSON.stringify(depensesForAI, null, 2)}

Pour chaque transaction, trouve le meilleur match possible.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    let azureResponse: Response;
    try {
      azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_completion_tokens: 3000,
          reasoning_effort: "medium",
          verbosity: "low",
          response_format: { type: "json_object" }
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (azureResponse.status === 429) {
        await new Promise(r => setTimeout(r, 1000));
        azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": AZURE_OPENAI_API_KEY,
          },
          body: JSON.stringify({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            max_completion_tokens: 3000,
            reasoning_effort: "medium",
            verbosity: "low",
            response_format: { type: "json_object" }
          }),
        });
      }

    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: "Timeout Azure OpenAI (90s)" }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error("Azure error:", azureResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erreur Azure OpenAI", details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const azureData = await azureResponse.json();
    const content = azureData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Pas de contenu dans la réponse IA" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = JSON.parse(content);
    const matches: MatchSuggestion[] = result.matches || [];

    // 5. Si auto_apply, appliquer les matchs avec confidence >= 0.9
    let applied = 0;
    if (auto_apply) {
      for (const match of matches) {
        if (match.confidence >= 0.9 && match.match_id) {
          if (match.match_type === 'revenu') {
            await supabase
              .from('tresorerie_revenus')
              .update({ 
                statut: 'paye',
                date_paiement: new Date().toISOString().split('T')[0],
                qonto_transaction_id: match.transaction_id,
              })
              .eq('id', match.match_id);
          } else if (match.match_type === 'depense') {
            await supabase
              .from('tresorerie_depenses')
              .update({ 
                qonto_transaction_id: match.transaction_id,
              })
              .eq('id', match.match_id);
          }

          await supabase
            .from('qonto_transactions')
            .update({ reconciled_at: new Date().toISOString() })
            .eq('id', match.transaction_id);

          applied++;
        }
      }
    }

    // Log pour audit
    await supabase.from('ai_processing_log').insert({
      processing_type: 'smart_reconcile_qonto',
      model_used: 'gpt-5',
      success: true,
      context_type: 'tresorerie',
      prompt_tokens: azureData.usage?.prompt_tokens,
      completion_tokens: azureData.usage?.completion_tokens,
      total_tokens: azureData.usage?.total_tokens,
      result: { matches_count: matches.length, applied },
    });

    return new Response(
      JSON.stringify({
        success: true,
        transactions_analyzed: transactions.length,
        matches: matches,
        auto_applied: applied,
        high_confidence: matches.filter(m => m.confidence >= 0.9).length,
        needs_review: matches.filter(m => m.confidence < 0.9 && m.confidence >= 0.7).length,
        no_match: matches.filter(m => m.match_type === 'new').length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('smart-reconcile-qonto', error, corsHeaders, 500);
  }
});

