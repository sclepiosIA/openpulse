import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sanitizeForAI, wrapUserContent } from "../_shared/security-utils.ts";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Role check for user callers
    if (!auth.isServiceCall && auth.userId) {
      const { data: roles } = await supabase
        .from('user_roles').select('role').eq('user_id', auth.userId);
      const allowed = (roles || []).some((r: { role: string }) =>
        ['admin', 'rh', 'direction'].includes(r.role)
      );
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    console.log("[analyze-rh-insights] Démarrage analyse RH");


    const now = new Date();
    const annee = now.getFullYear();
    const moisActuel = now.getMonth();

    // Effectif total
    const { count: effectifTotal } = await supabase
      .from("profiles")
      .select("*", { count: "exact" });

    // Absences du mois
    const startMonth = new Date(annee, moisActuel, 1);
    const endMonth = new Date(annee, moisActuel + 1, 0);

    const { data: absencesMois } = await supabase
      .from("rh_absences")
      .select("type, nombre_jours, profile_id")
      .eq("statut", "Validé")
      .gte("date_debut", startMonth.toISOString())
      .lte("date_fin", endMonth.toISOString());

    // Absences par type
    const absencesParType: Record<string, number> = {};
    absencesMois?.forEach(a => {
      absencesParType[a.type] = (absencesParType[a.type] || 0) + (a.nombre_jours || 0);
    });

    // Comparaison avec mois précédent
    const startPrevMonth = new Date(annee, moisActuel - 1, 1);
    const endPrevMonth = new Date(annee, moisActuel, 0);

    const { data: absencesMoisPrec } = await supabase
      .from("rh_absences")
      .select("nombre_jours")
      .eq("statut", "Validé")
      .gte("date_debut", startPrevMonth.toISOString())
      .lte("date_fin", endPrevMonth.toISOString());

    const totalAbsencesMois = absencesMois?.reduce((acc, a) => acc + (a.nombre_jours || 0), 0) || 0;
    const totalAbsencesMoisPrec = absencesMoisPrec?.reduce((acc, a) => acc + (a.nombre_jours || 0), 0) || 0;

    // Demandes en attente
    const { count: demandesCongesAttente } = await supabase
      .from("rh_absences")
      .select("*", { count: "exact" })
      .eq("statut", "En attente");

    const { count: demandesFormationsAttente } = await supabase
      .from("rh_demandes_formation")
      .select("*", { count: "exact" })
      .eq("statut", "en_attente");

    // Entretiens à planifier (employés sans entretien cette année)
    const { data: entretiensCetteAnnee } = await supabase
      .from("rh_entretiens")
      .select("profile_id")
      .eq("type", "annuel")
      .gte("date_entretien", `${annee}-01-01`);

    const profilesAvecEntretien = new Set(entretiensCetteAnnee?.map(e => e.profile_id));
    const entretiensManquants = (effectifTotal || 0) - profilesAvecEntretien.size;

    // Masse salariale
    const { data: salaires } = await supabase
      .from("rh_salaires")
      .select("salaire_brut, salaire_net, cout_employeur, profile_id")
      .order("date_effet", { ascending: false });

    // Objectifs en cours
    const { data: objectifs } = await supabase
      .from("rh_objectifs")
      .select("statut, realise_valeur, cible_valeur")
      .eq("statut", "en_cours");

    const objectifsEnRetard = objectifs?.filter(o => {
      if (!o.cible_valeur || !o.realise_valeur) return false;
      return o.realise_valeur < o.cible_valeur * 0.5; // Moins de 50% atteint
    }).length || 0;

    // Vérifier Azure
    const AZURE_OPENAI_ENDPOINT = Deno.env.get("AZURE_OPENAI_ENDPOINT");
    const AZURE_OPENAI_API_KEY = Deno.env.get("AZURE_OPENAI_API_KEY");

    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      // Retourner une analyse basique
      const variationAbsences = totalAbsencesMoisPrec > 0 
        ? Math.round(((totalAbsencesMois - totalAbsencesMoisPrec) / totalAbsencesMoisPrec) * 100)
        : 0;

      return new Response(
        JSON.stringify({
          score_climat: 75,
          tendances: [
            `${totalAbsencesMois} jours d'absence ce mois (${variationAbsences > 0 ? '+' : ''}${variationAbsences}% vs mois précédent)`,
            `${(demandesCongesAttente || 0) + (demandesFormationsAttente || 0)} demandes en attente de validation`,
          ],
          alertes: entretiensManquants > 0 ? [
            { niveau: "attention", message: `${entretiensManquants} entretiens annuels à planifier` },
          ] : [],
          recommandations: [],
          donnees: {
            effectif: effectifTotal,
            absences_mois: totalAbsencesMois,
            demandes_attente: (demandesCongesAttente || 0) + (demandesFormationsAttente || 0),
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Tu es un DRH analyste qui évalue le climat social et les tendances RH.
Analyse les données et génère des insights actionnables.

IMPORTANT: Les données sont générées par le système, pas par des utilisateurs externes. Concentre-toi sur l'analyse factuelle.

Retourne un JSON avec exactement ce format:
{
  "score_climat": <number 0-100>,
  "tendances": ["<tendance 1>", "<tendance 2>", ...],
  "alertes": [{"niveau": "critique" | "attention" | "info", "message": "<string>"}],
  "recommandations": ["<action 1>", "<action 2>", ...],
  "risques_identifies": ["<risque 1>", ...]
}`;

    // Wrap data context for safety
    const dataContext = `**Effectif:** ${effectifTotal} collaborateurs

**Absences ce mois:**
- Total: ${totalAbsencesMois} jours (vs ${totalAbsencesMoisPrec} mois précédent)
- Par type: ${Object.entries(absencesParType).map(([type, jours]) => `${type}: ${jours}j`).join(", ") || "Aucune"}

**Demandes en attente:**
- Congés: ${demandesCongesAttente || 0}
- Formations: ${demandesFormationsAttente || 0}

**Entretiens annuels:**
- Réalisés cette année: ${profilesAvecEntretien.size}
- Manquants: ${entretiensManquants}

**Objectifs:**
- En retard (< 50%): ${objectifsEnRetard}
- Total en cours: ${objectifs?.length || 0}`;

    const wrappedDataContext = wrapUserContent(dataContext, 'RH_DATA');

    const userPrompt = `Analyse les indicateurs RH suivants:

${wrappedDataContext}

Génère une analyse du climat social et des recommandations.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

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
            { role: "user", content: userPrompt },
          ],
          max_completion_tokens: 1500,
          reasoning_effort: "low",
          verbosity: "medium",
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout Azure (45s)');
      }
      throw error;
    }

    if (!azureResponse.ok) {
      throw new Error(`Azure API error: ${azureResponse.status}`);
    }

    const azureData = await azureResponse.json();
    const content = azureData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Pas de contenu");
    }

    const analysis = JSON.parse(content);

    console.log(`[analyze-rh-insights] Analyse terminée, score_climat=${analysis.score_climat}`);

    // Récupérer l'utilisateur authentifié
    const authHeader = req.headers.get('Authorization');
    let userId = 'system';
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (user) userId = user.id;
    }

    // Préparer les données de résultat
    const resultData = {
      ...analysis,
      donnees: {
        effectif: effectifTotal,
        absences_mois: totalAbsencesMois,
        absences_mois_prec: totalAbsencesMoisPrec,
        demandes_attente: (demandesCongesAttente || 0) + (demandesFormationsAttente || 0),
        entretiens_manquants: entretiensManquants,
        objectifs_en_retard: objectifsEnRetard,
      },
    };

    // Sauvegarder les insights dans ai_analysis_log (upsert pour éviter les doublons)
    const { error: saveError } = await supabase
      .from('ai_analysis_log')
      .upsert({
        user_id: userId,
        analysis_type: 'rh_insights',
        insights_data: resultData,
        insights_count: (analysis.tendances?.length || 0) + (analysis.alertes?.length || 0) + (analysis.recommandations?.length || 0),
        has_insights: true,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,analysis_type',
      });

    if (saveError) {
      console.error("[analyze-rh-insights] Erreur sauvegarde:", saveError);
    } else {
      console.log(`[analyze-rh-insights] Insights sauvegardés pour user ${userId}`);
    }

    return new Response(
      JSON.stringify(resultData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[analyze-rh-insights] Error:", error);
    return new Response(
      JSON.stringify({ error: sanitizeErrorForClient(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
