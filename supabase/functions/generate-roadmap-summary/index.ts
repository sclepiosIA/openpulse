/**
 * Génère un résumé IA quotidien de la roadmap pour chaque DPI (hm, resurgences, transverse).
 * - Lit rd_projets visible_portail=true + epics + sprints + user_stories
 * - Appelle Azure GPT-5 pour produire un JSON structuré (themes, milestones, releases, signals)
 * - Upsert dans roadmap_ai_summaries (1 ligne / DPI)
 *
 * Modes d'invocation :
 *   POST { dpi: "hm" }            → un seul DPI
 *   POST { all: true }            → tous les DPIs (utilisé par le cron)
 *   POST {}                       → tous les DPIs (par défaut)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { requireInternalSecret } from "../_shared/internal-secret.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-internal-secret;

const AZURE_OPENAI_ENDPOINT = Deno.env.get("AZURE_OPENAI_ENDPOINT");
const AZURE_OPENAI_API_KEY = Deno.env.get("AZURE_OPENAI_API_KEY");

const DPIS = ["hm", "resurgences", "easily", "mediboard"] as const;
type Dpi = typeof DPIS[number];

interface RoadmapSourceData {
  dpi: Dpi;
  projets: any[];
  epics: any[];
  sprints: any[];
  stories: any[];
}

async function fetchSourceForDpi(supabase: any, dpi: Dpi): Promise<RoadmapSourceData> {
  // 1) Projets visibles portail pour ce DPI
  const { data: projets, error: projErr } = await supabase
    .from("rd_projets")
    .select("id, nom, description, statut, dpi, visible_portail, date_debut, date_fin_prevue, created_at, updated_at")
    .eq("dpi", dpi)
    .eq("visible_portail", true);
  if (projErr) throw projErr;

  const projetIds = (projets ?? []).map((p: any) => p.id);
  if (projetIds.length === 0) {
    return { dpi, projets: [], epics: [], sprints: [], stories: [] };
  }

  // 2) Epics
  const { data: epics, error: epicErr } = await supabase
    .from("rd_epics")
    .select("id, projet_id, titre, description, couleur, statut, ordre")
    .in("projet_id", projetIds);
  if (epicErr) throw epicErr;

  // 3) Sprints
  const { data: sprints, error: sprErr } = await supabase
    .from("rd_sprints")
    .select("id, projet_id, nom, numero, objectif, date_debut, date_fin, statut")
    .in("projet_id", projetIds);
  if (sprErr) throw sprErr;

  // 4) User stories (limitées aux 80 dernières par DPI pour rester sous le contexte)
  const { data: stories, error: storyErr } = await supabase
    .from("rd_user_stories")
    .select("id, projet_id, epic_id, sprint_id, titre, points, priorite, statut, date_fin, updated_at")
    .in("projet_id", projetIds)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (storyErr) throw storyErr;

  return {
    dpi,
    projets: projets ?? [],
    epics: epics ?? [],
    sprints: sprints ?? [],
    stories: stories ?? [],
  };
}

function buildPrompt(src: RoadmapSourceData) {
  const today = new Date().toISOString().slice(0, 10);
  const epicsCompact = src.epics.map((e: any) => ({
    id: e.id, titre: e.titre, statut: e.statut, couleur: e.couleur,
  }));
  const sprintsCompact = src.sprints.map((s: any) => ({
    id: s.id, nom: s.nom, numero: s.numero, statut: s.statut,
    date_debut: s.date_debut, date_fin: s.date_fin, objectif: s.objectif,
  }));
  const storiesCompact = src.stories.map((s: any) => ({
    id: s.id, titre: s.titre, statut: s.statut, priorite: s.priorite,
    points: s.points, epic_id: s.epic_id, sprint_id: s.sprint_id,
    date_fin: s.date_fin,
  }));

  const systemPrompt = `Tu es un rédacteur factuel qui DÉCRIT un Kanban R&D existant (epics, sprints, user stories).
Ton seul rôle : reformuler en langage clair les éléments présents dans les DONNÉES SOURCES, sans rien ajouter.

RÈGLES STRICTES ANTI-HALLUCINATION (obligatoires) :
- Tu n'as AUCUN savoir externe. Tu ne connais QUE ce qui est dans les DONNÉES SOURCES.
- INTERDICTION ABSOLUE d'inventer : pas de fonctionnalité, pas de bénéfice métier, pas d'impact, pas de promesse, pas de chiffre, pas de tendance, pas de "thème émergent" déduit, pas de date qui n'apparaît pas littéralement.
- INTERDICTION de paraphraser au-delà de la reformulation neutre. Reste collé au titre/description/statut/sprint/priorité fournis.
- Si une information manque (ex: pas de date, pas de description), n'invente rien : laisse \`null\` ou tableau vide.
- Si aucun élément ne correspond à un champ, retourne un tableau vide. Ne remplis JAMAIS pour "faire joli".
- Réponds UNIQUEMENT un JSON valide, conforme au schéma demandé. Aucun texte hors JSON.

INSTRUCTIONS PAR CHAMP :
- "headline" : phrase neutre et factuelle de 15-25 mots décrivant UNIQUEMENT le volume réel (ex: "X epics actifs, Y user stories en cours, Z livrées sur la période"). Aucune promesse, aucun adjectif marketing.
- "themes" : UN thème = UN epic réel présent dans \`epics\`. \`label\` = titre exact de l'epic (légèrement reformulé si besoin), \`id\` = id de l'epic, \`color\` = \`couleur\` de l'epic si fournie sinon "#6366f1", \`icon\` = un nom lucide-react générique ("layers","sparkles","plug","shield","users","chart-line","wrench","database"). \`summary\` = description factuelle des stories rattachées (statuts + nombre), sans bénéfice inventé.
- "milestones" dans chaque thème : UNIQUEMENT des stories réelles rattachées à cet epic. \`title\` = titre exact de la story. \`status\` mappé depuis \`statut\` story ("done"/"termine"→"livre", "in_progress"/"en_cours"→"en_cours", sinon "planifie"). \`eta\` = \`date_fin\` de la story si présente, sinon null. \`quarter\` = trimestre calculé depuis \`eta\` si non null, sinon null. \`story_ids\` = [id de la story].
- "next_releases" : UNIQUEMENT des sprints réels présents dans \`sprints\` avec statut "planned"/"planifie"/"active"/"en_cours". \`title\` = \`nom\` du sprint. \`eta\` = \`date_fin\` du sprint (ou null). \`status\` mappé depuis le statut sprint. \`highlights\` = titres exacts des stories rattachées à ce sprint (max 5), aucun ajout.
- "recently_shipped" : UNIQUEMENT des stories avec statut "done"/"termine" dont \`date_fin\` est dans les 30 derniers jours. \`title\` = titre exact. \`shipped_at\` = \`date_fin\`. \`impact\` = chaîne vide "" (ne jamais inventer un impact).
- "backlog_signals" : \`total\` = nombre total de stories fournies, \`high_priority\` = nombre de stories avec \`priorite\` "haute"/"high"/"critique"/"critical", \`themes_emerging\` = tableau VIDE [] (ne jamais déduire de tendance).
- Garde un ton neutre et descriptif. Pas de "nous", pas de "vous bénéficierez", pas de superlatif.`;

  const userPrompt = `DPI cible : ${src.dpi}
Date du jour : ${today}

DONNÉES SOURCES :
projets = ${JSON.stringify(src.projets.map((p: any) => ({ id: p.id, nom: p.nom, statut: p.statut })))}

epics = ${JSON.stringify(epicsCompact)}

sprints = ${JSON.stringify(sprintsCompact)}

user_stories = ${JSON.stringify(storiesCompact)}

SCHÉMA JSON DE SORTIE OBLIGATOIRE :
{
  "dpi": "${src.dpi}",
  "headline": "string",
  "themes": [
    {
      "id": "string",
      "label": "string",
      "icon": "string",
      "color": "#RRGGBB",
      "summary": "string",
      "milestones": [
        { "id": "string", "title": "string", "status": "en_cours|planifie|livre", "quarter": "Q? YYYY", "eta": "YYYY-MM-DD|null", "story_ids": ["string"] }
      ]
    }
  ],
  "next_releases": [
    { "title": "string", "eta": "YYYY-MM-DD|null", "highlights": ["string"], "status": "planifie|en_cours" }
  ],
  "recently_shipped": [
    { "title": "string", "shipped_at": "YYYY-MM-DD", "impact": "string" }
  ],
  "backlog_signals": {
    "total": 0,
    "high_priority": 0,
    "themes_emerging": ["string"]
  }
}`;

  return { systemPrompt, userPrompt };
}

async function callAzureGPT5(systemPrompt: string, userPrompt: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  const body = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 6000,
    reasoning_effort: "minimal",
    verbosity: "low",
    response_format: { type: "json_object" },
  };

  let azureResponse: Response;
  try {
    azureResponse = await fetch(AZURE_OPENAI_ENDPOINT!, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": AZURE_OPENAI_API_KEY! },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (azureResponse.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      azureResponse = await fetch(AZURE_OPENAI_ENDPOINT!, {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": AZURE_OPENAI_API_KEY! },
        body: JSON.stringify(body),
      });
    }
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") throw new Error("Azure timeout (90s)");
    throw err;
  }

  if (!azureResponse.ok) {
    const txt = await azureResponse.text();
    console.error("Azure error", azureResponse.status, txt);
    throw new Error(`Azure API error ${azureResponse.status}`);
  }

  const azureData = await azureResponse.json();
  const choice = azureData.choices?.[0];
  const content = choice?.message?.content;
  if (!content) {
    console.error("Azure empty content", JSON.stringify({
      finish_reason: choice?.finish_reason,
      usage: azureData.usage,
    }));
    throw new Error(`Empty Azure response (finish_reason=${choice?.finish_reason ?? "unknown"})`);
  }

  try {
    return JSON.parse(content);
  } catch {
    // tentative d'extraction du premier objet JSON dans le texte
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* fallthrough */ }
    }
    console.error("Azure invalid JSON, content sample:", content.slice(0, 500));
    throw new Error("Invalid JSON returned by Azure");
  }
}

function emptySummary(dpi: Dpi) {
  return {
    dpi,
    headline: "Aucune fonctionnalité publiée n'est encore disponible pour ce périmètre.",
    themes: [],
    next_releases: [],
    recently_shipped: [],
    backlog_signals: { total: 0, high_priority: 0, themes_emerging: [] },
  };
}

async function generateForDpi(supabase: any, dpi: Dpi) {
  const src = await fetchSourceForDpi(supabase, dpi);
  const sourceCount = src.projets.length + src.epics.length + src.sprints.length + src.stories.length;

  let summary: any;
  let model = "azure-gpt5";

  if (sourceCount === 0) {
    summary = emptySummary(dpi);
    model = "empty-fallback";
  } else {
    const { systemPrompt, userPrompt } = buildPrompt(src);
    try {
      summary = await callAzureGPT5(systemPrompt, userPrompt);
      summary.dpi = dpi;
      summary.generated_at = new Date().toISOString();
    } catch (err: any) {
      console.error(`[${dpi}] AI generation failed:`, err.message);
      summary = emptySummary(dpi);
      summary.headline = "Résumé IA temporairement indisponible. Données brutes affichées.";
      model = "error-fallback";
    }
  }

  const { error: upsertErr } = await supabase
    .from("roadmap_ai_summaries")
    .upsert(
      {
        dpi,
        summary_json: summary,
        model,
        source_count: sourceCount,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "dpi" }
    );
  if (upsertErr) throw upsertErr;

  return { dpi, source_count: sourceCount, model };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const denied = requireInternalSecret(req, corsHeaders);
  if (denied) return denied;

  try {
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      throw new Error("Azure OpenAI not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body ok */ }

    const targets: Dpi[] = body?.dpi
      ? [body.dpi as Dpi]
      : [...DPIS];

    const results: any[] = [];
    for (const dpi of targets) {
      try {
        const r = await generateForDpi(supabase, dpi);
        results.push({ ...r, success: true });
      } catch (err: any) {
        console.error(`[${dpi}] failed:`, err.message);
        results.push({ dpi, success: false, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    return buildErrorResponse('generate-roadmap-summary', error, corsHeaders, 500);
  }
});

