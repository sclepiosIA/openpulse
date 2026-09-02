import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sanitizeForAI, wrapUserContent, logSecurityEvent } from "../_shared/security-utils.ts";
import { logAICall, extractUsage, createTimer } from "../_shared/ai-logging.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { titre, description } = await req.json();

    if (!titre) {
      return new Response(
        JSON.stringify({ error: "Titre requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      console.error("Azure OpenAI credentials not configured");
      return new Response(
        JSON.stringify({ error: "Configuration Azure manquante" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Tu es un assistant de rédaction pour la gestion de projet agile.

TON RÔLE : Restructurer et clarifier l'information fournie, PAS inventer du contenu.

RÈGLES STRICTES :
1. NE JAMAIS inventer de fonctionnalités, tâches ou critères non mentionnés dans la description
2. Restructurer et reformuler pour améliorer la lisibilité UNIQUEMENT
3. Si l'information est vague, la laisser vague mais mieux formulée
4. Déduire les tâches UNIQUEMENT à partir des actions explicitement ou implicitement décrites

POUR LA DESCRIPTION AMÉLIORÉE :
- Reformuler de manière claire et professionnelle
- Structurer en HTML (<p>, <ul>, <li>, <strong>)
- Conserver 100% du sens original
- Ne pas ajouter de contexte ou d'exigences non mentionnées

POUR LES TÂCHES :
- Extraire UNIQUEMENT les actions logiques de la description
- Si "créer un bouton" est mentionné → tâche "Créer le bouton [nom]"
- Si rien de technique n'est décrit, générer 0 à 2 tâches très génériques
- Estimations réalistes en heures (0.5, 1, 2, 4, 8)

POUR LES CRITÈRES :
- Transformer les exigences décrites en critères vérifiables
- Si "l'utilisateur doit pouvoir..." → critère correspondant
- Ne PAS ajouter de critères comme "performances" ou "sécurité" si non mentionnés

Format JSON strict:
{
  "improved_description": "<p>Description restructurée en HTML...</p>",
  "tasks": [{ "titre": "Tâche déduite", "estimation_heures": 2 }],
  "criteres": ["Critère basé sur la description"]
}

Retourne UNIQUEMENT le JSON, sans texte avant ou après.`;

    // Sanitize inputs for security
    const sanitizedTitre = sanitizeForAI(titre, { maxLength: 200, functionName: 'rd-ai-assist' });
    const sanitizedDescription = sanitizeForAI(description || "Aucune description fournie", { maxLength: 5000, functionName: 'rd-ai-assist' });

    const userPrompt = `Titre de la user story: ${wrapUserContent(sanitizedTitre, "TITRE")}

Description actuelle: ${wrapUserContent(sanitizedDescription, "DESCRIPTION")}

Analyse cette user story et génère la description améliorée, les tâches et les critères.`;

    console.log("Calling Azure GPT-5 for R&D AI assist...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    const azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
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
        max_completion_tokens: 2000,
        reasoning_effort: "low",
        verbosity: "low",
        response_format: { type: "json_object" }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error("Azure OpenAI error:", azureResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Erreur Azure: ${azureResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const azureData = await azureResponse.json();
    const content = azureData.choices?.[0]?.message?.content;
    const usage = extractUsage(azureData);

    if (!content || typeof content !== "string") {
      console.error("Unexpected Azure response:", JSON.stringify(azureData, null, 2));
      return new Response(
        JSON.stringify({ error: "Réponse Azure invalide" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(content);

    // Log to ai_processing_log for dashboard
    await logAICall({
      processing_type: 'rd_assist',
      model_used: 'gpt-5',
      ...usage,
      success: true,
      result: {
        tasksCount: result.tasks?.length || 0,
        criteresCount: result.criteres?.length || 0,
      },
    });

    console.log("R&D AI assist completed:", {
      tasksCount: result.tasks?.length || 0,
      criteresCount: result.criteres?.length || 0,
      descriptionLength: result.improved_description?.length || 0
    });

    return new Response(
      JSON.stringify({
        improved_description: result.improved_description || "",
        tasks: result.tasks || [],
        criteres: result.criteres || [],
        usage: azureData.usage
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('rd-ai-assist', error, corsHeaders, 500);
  }
});
