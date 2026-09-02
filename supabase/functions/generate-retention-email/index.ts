// Edge Function : génère un email de rétention via Azure GPT-5
// Pattern Azure OpenAI standard (cf. _shared/azure-gpt5-config.md)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { requireInternalSecret } from "../_shared/internal-secret.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-internal-secret;

const AZURE_OPENAI_ENDPOINT = Deno.env.get("AZURE_OPENAI_ENDPOINT");
const AZURE_OPENAI_API_KEY = Deno.env.get("AZURE_OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const denied = requireInternalSecret(req, corsHeaders);
  if (denied) return denied;

  try {
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      throw new Error("Configuration Azure OpenAI manquante");
    }

    const { etablissement_id } = await req.json();
    if (!etablissement_id) throw new Error("etablissement_id requis");

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Contexte établissement + churn
    const [{ data: etab }, { data: churn }] = await Promise.all([
      supa.from("etablissements").select("nom, ville, type_offre, statut, csm_id").eq("id", etablissement_id).maybeSingle(),
      supa.from("churn_predictions").select("score, risk_level, factors, recommendations").eq("etablissement_id", etablissement_id).maybeSingle(),
    ]);

    if (!etab) throw new Error("Établissement introuvable");

    const factors = (churn?.factors ?? {}) as Record<string, number>;
    const recos = (churn?.recommendations ?? []) as string[];

    const systemPrompt = `Tu es un Customer Success Manager senior chez OpenPulse. Tu rédiges des emails de rétention personnalisés, professionnels, chaleureux, en français, à destination de directeurs d'établissements de santé. Pas de blabla marketing, pas de promesses commerciales. Sois concret, propose un échange. Format de sortie : objet en première ligne, puis ligne vide, puis le corps du mail (max 180 mots).`;

    const userPrompt = `Établissement : ${etab.nom}${etab.ville ? ` (${etab.ville})` : ""}
Type d'offre : ${etab.type_offre ?? "non renseigné"}
Score de churn : ${churn?.score ?? "?"} / 100 (niveau ${churn?.risk_level ?? "?"})

Signaux détectés :
- Tickets support ouverts : ${factors.open_tickets ?? 0}
- Échanges email sur 30j : ${factors.emails_30d ?? 0}
- Factures impayées (>30j) : ${factors.unpaid_invoices ?? 0}
- Jours sans interaction : ${factors.days_since_last_interaction ?? "?"}

Recommandations internes :
${recos.map(r => `- ${r}`).join("\n") || "(aucune)"}

Rédige un email de reprise de contact qui :
1. Reconnait l'absence d'échanges récents sans culpabiliser
2. Propose un point de 15 min cette semaine
3. Mentionne un signal concret si pertinent (factures, tickets…)
4. Termine par une signature simple "L'équipe OpenPulse"`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const azureResp = await fetch(AZURE_OPENAI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": AZURE_OPENAI_API_KEY },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_completion_tokens: 2000,
        reasoning_effort: "low",
        verbosity: "medium",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!azureResp.ok) {
      const errText = await azureResp.text();
      console.error("Azure error", azureResp.status, errText);
      throw new Error(`Azure GPT-5 error ${azureResp.status}`);
    }

    const azureData = await azureResp.json();
    const content: string = azureData.choices?.[0]?.message?.content ?? "";

    // Parse "Objet: ...\n\nCorps..."
    const lines = content.trim().split(/\r?\n/);
    let subject = "Reprise de contact";
    let body = content.trim();
    const firstLine = lines[0].trim();
    const match = firstLine.match(/^(?:objet\s*:?\s*)?(.+)$/i);
    if (match && lines.length > 1) {
      subject = match[1].replace(/^["«]|["»]$/g, "").trim();
      body = lines.slice(1).join("\n").trim();
    }

    return new Response(JSON.stringify({ subject, body }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("generate-retention-email error:", e);
    return buildErrorResponse('generate-retention-email', e, corsHeaders, 500);
  }
});
