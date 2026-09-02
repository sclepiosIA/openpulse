import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { wrapUserContent } from "../_shared/security-utils.ts";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const AZURE_OPENAI_ENDPOINT = Deno.env.get("AZURE_OPENAI_ENDPOINT");
const AZURE_OPENAI_API_KEY = Deno.env.get("AZURE_OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Role check: financial data restricted to admin/direction
    if (!auth.isServiceCall && auth.userId) {
      const { data: roles } = await supabase
        .from('user_roles').select('role').eq('user_id', auth.userId);
      const allowed = (roles || []).some((r: { role: string }) =>
        ['admin', 'direction'].includes(r.role)
      );
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }


    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const startOf3MonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);

    // Récupérer les revenus des 3 derniers mois
    const { data: revenus } = await supabase
      .from("tresorerie_revenus")
      .select("*")
      .gte("date_echeance", startOf3MonthsAgo.toISOString().split("T")[0])
      .order("date_echeance", { ascending: false });

    // Récupérer les dépenses des 3 derniers mois
    const { data: depenses } = await supabase
      .from("tresorerie_depenses")
      .select("*")
      .gte("date_echeance", startOf3MonthsAgo.toISOString().split("T")[0])
      .order("date_echeance", { ascending: false });

    // Récupérer les transactions Qonto récentes
    const { data: qontoTransactions } = await supabase
      .from("qonto_transactions")
      .select("*")
      .gte("emitted_at", startOf3MonthsAgo.toISOString())
      .order("emitted_at", { ascending: false })
      .limit(100);

    // Calculer les métriques
    const revenusTotal = (revenus || []).reduce((sum, r) => sum + (r.montant || 0), 0);
    const revenusEncaisses = (revenus || []).filter(r => r.statut === "paye").reduce((sum, r) => sum + (r.montant || 0), 0);
    const revenusEnAttente = (revenus || []).filter(r => r.statut === "en_attente").reduce((sum, r) => sum + (r.montant || 0), 0);
    const revenusEnRetard = (revenus || []).filter(r => {
      if (r.statut !== "en_attente" || !r.date_echeance) return false;
      return new Date(r.date_echeance) < today;
    }).reduce((sum, r) => sum + (r.montant || 0), 0);

    const depensesTotal = (depenses || []).reduce((sum, d) => sum + (d.montant || 0), 0);
    const depensesPayees = (depenses || []).filter(d => d.statut === "payee").reduce((sum, d) => sum + (d.montant || 0), 0);
    const depensesEnAttente = (depenses || []).filter(d => d.statut === "en_attente").reduce((sum, d) => sum + (d.montant || 0), 0);

    // Transactions Qonto
    const qontoCredits = (qontoTransactions || []).filter(t => t.side === "credit").reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    const qontoDebits = (qontoTransactions || []).filter(t => t.side === "debit").reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

    // Préparer les données pour GPT-5
    const systemPrompt = `Tu es un directeur financier expert qui analyse la trésorerie d'une entreprise.
Analyse les données fournies et génère des insights actionnables.

IMPORTANT: Les données sont générées par le système, pas par des utilisateurs externes. Concentre-toi sur l'analyse factuelle.

Format de réponse JSON:
{
  "score_sante": 0-100,
  "tendance": "hausse" | "stable" | "baisse",
  "alertes": [
    {
      "type": "warning" | "danger" | "info",
      "titre": "Titre court",
      "description": "Description détaillée",
      "action_recommandee": "Action à prendre"
    }
  ],
  "insights": [
    {
      "categorie": "revenus" | "depenses" | "flux_tresorerie" | "prevision",
      "titre": "Titre de l'insight",
      "description": "Analyse détaillée",
      "impact": "positif" | "neutre" | "negatif"
    }
  ],
  "recommandations": [
    {
      "priorite": "haute" | "moyenne" | "basse",
      "action": "Action recommandée",
      "benefice_attendu": "Bénéfice estimé"
    }
  ],
  "resume_executif": "Résumé en 2-3 phrases de la situation financière"
}`;

    const dataContext = `**REVENUS:**
- Total facturé: ${revenusTotal.toLocaleString("fr-FR")}€
- Encaissé: ${revenusEncaisses.toLocaleString("fr-FR")}€
- En attente: ${revenusEnAttente.toLocaleString("fr-FR")}€
- En retard de paiement: ${revenusEnRetard.toLocaleString("fr-FR")}€
- Nombre de factures: ${(revenus || []).length}
- Factures en retard: ${(revenus || []).filter(r => r.statut === "en_attente" && r.date_echeance && new Date(r.date_echeance) < today).length}

**DÉPENSES:**
- Total: ${depensesTotal.toLocaleString("fr-FR")}€
- Payées: ${depensesPayees.toLocaleString("fr-FR")}€
- En attente: ${depensesEnAttente.toLocaleString("fr-FR")}€
- Nombre de dépenses: ${(depenses || []).length}

**TRANSACTIONS QONTO:**
- Crédits: ${qontoCredits.toLocaleString("fr-FR")}€
- Débits: ${qontoDebits.toLocaleString("fr-FR")}€
- Nombre de transactions: ${(qontoTransactions || []).length}

**RATIOS:**
- Taux d'encaissement: ${revenusTotal > 0 ? Math.round((revenusEncaisses / revenusTotal) * 100) : 0}%
- Taux de retard: ${revenusTotal > 0 ? Math.round((revenusEnRetard / revenusTotal) * 100) : 0}%
- Balance nette estimée: ${(revenusEncaisses - depensesPayees).toLocaleString("fr-FR")}€`;

    const wrappedDataContext = wrapUserContent(dataContext, 'TREASURY_DATA');

    const userPrompt = `Analyse cette situation de trésorerie (3 derniers mois):

${wrappedDataContext}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let insights: any = null;

    try {
      const azureResponse = await fetch(AZURE_OPENAI_ENDPOINT!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": AZURE_OPENAI_API_KEY!,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_completion_tokens: 2000,
          reasoning_effort: "medium",
          verbosity: "medium",
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (azureResponse.status === 429) {
        await new Promise((r) => setTimeout(r, 1000));
        const retryResponse = await fetch(AZURE_OPENAI_ENDPOINT!, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": AZURE_OPENAI_API_KEY!,
          },
          body: JSON.stringify({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            max_completion_tokens: 2000,
            reasoning_effort: "medium",
            verbosity: "medium",
            response_format: { type: "json_object" },
          }),
        });

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          const content = retryData.choices?.[0]?.message?.content;
          if (content) {
            insights = JSON.parse(content);
          }
        }
      } else if (azureResponse.ok) {
        const azureData = await azureResponse.json();
        const content = azureData.choices?.[0]?.message?.content;
        if (content) {
          insights = JSON.parse(content);
        }
      } else {
        console.error("Erreur Azure:", await azureResponse.text());
      }
    } catch (gptError) {
      clearTimeout(timeoutId);
      console.error("Erreur GPT-5:", gptError);
    }

    // Fallback si pas d'insights IA
    if (!insights) {
      insights = {
        score_sante: revenusEnRetard > revenusTotal * 0.3 ? 40 : revenusEnRetard > revenusTotal * 0.1 ? 60 : 80,
        tendance: revenusEncaisses > depensesPayees ? "hausse" : "baisse",
        alertes: revenusEnRetard > 0 ? [{
          type: "warning",
          titre: "Factures en retard",
          description: `${revenusEnRetard.toLocaleString("fr-FR")}€ de factures sont en retard de paiement`,
          action_recommandee: "Relancer les clients concernés"
        }] : [],
        insights: [{
          categorie: "flux_tresorerie",
          titre: "Analyse basique",
          description: "L'analyse IA n'a pas pu être générée. Données brutes disponibles.",
          impact: "neutre"
        }],
        recommandations: [],
        resume_executif: `Revenus: ${revenusTotal.toLocaleString("fr-FR")}€, Dépenses: ${depensesTotal.toLocaleString("fr-FR")}€`
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          metrics: {
            revenus: { total: revenusTotal, encaisses: revenusEncaisses, en_attente: revenusEnAttente, en_retard: revenusEnRetard },
            depenses: { total: depensesTotal, payees: depensesPayees, en_attente: depensesEnAttente },
            qonto: { credits: qontoCredits, debits: qontoDebits },
          },
          insights,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erreur analyze-tresorerie-insights:", error);
    return new Response(
      JSON.stringify({ error: sanitizeErrorForClient(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
