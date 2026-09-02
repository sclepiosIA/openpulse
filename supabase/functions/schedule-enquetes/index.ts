import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

/**
 * Déclencheur automatique des enquêtes — appelé par CRON quotidien.
 * Règles :
 *  - post_formation : J+0 après émargement (déjà déclenché par register-emargement-simple, ici filet de sécurité J+1)
 *  - ces            : J+21 après formation
 *  - satisfaction   : J+60 après go-live (etablissements.date_go_live), puis tous les 6 mois
 *  - suivi_csm      : 2x/an — déclenché si on est entre le 1er et le 7 mai, ou entre le 10 et le 17 novembre
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const stats = { post_formation: 0, ces: 0, satisfaction: 0, suivi_csm: 0, errors: [] as string[] };
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const callSend = async (body: Record<string, unknown>) => {
    try {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-enquete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ ...body, _system: true }),
      });
      if (!res.ok) {
        const t = await res.text();
        stats.errors.push(`${body.type}/${body.etablissement_id}: ${t.slice(0, 120)}`);
        return false;
      }
      return true;
    } catch (e) {
      stats.errors.push(`${body.type}: ${(e as Error).message}`);
      return false;
    }
  };

  // Helper: éviter doublons (campagne du même type créée dans les N jours)
  const alreadySent = async (type: string, etablissementId: string, userId: string | null, withinDays: number) => {
    const since = new Date(Date.now() - withinDays * 86400_000).toISOString();
    const q = supabase.from('enquetes_campagnes')
      .select('id', { count: 'exact', head: true })
      .eq('type', type)
      .eq('etablissement_id', etablissementId)
      .gte('created_at', since);
    if (userId) q.eq('user_id', userId);
    const { count } = await q;
    return (count ?? 0) > 0;
  };

  try {
    // 1. CES — J+21 après formation_emargements
    const j21 = new Date(Date.now() - 21 * 86400_000).toISOString().slice(0, 10);
    const { data: emargements } = await supabase
      .from('formation_emargements')
      .select('id, etablissement_id, user_id, created_at')
      .gte('created_at', `${j21}T00:00:00Z`)
      .lt('created_at', `${j21}T23:59:59Z`)
      .limit(500);
    for (const e of emargements ?? []) {
      if (!e.etablissement_id) continue;
      if (await alreadySent('ces', e.etablissement_id, e.user_id, 60)) continue;
      if (await callSend({ type: 'ces', etablissement_id: e.etablissement_id, user_id: e.user_id })) stats.ces++;
    }

    // 2. Satisfaction — J+60 après go-live + tous les 6 mois
    const { data: etabs } = await supabase
      .from('etablissements')
      .select('id, date_go_live, statut')
      .eq('statut', 'production')
      .not('date_go_live', 'is', null)
      .limit(500);
    for (const e of etabs ?? []) {
      if (!e.date_go_live) continue;
      const goLive = new Date(e.date_go_live);
      const daysSince = Math.floor((now.getTime() - goLive.getTime()) / 86400_000);
      // Déclenchement : J+60, puis tous les 180 jours
      const isTrigger = daysSince === 60 || (daysSince > 60 && (daysSince - 60) % 180 === 0);
      if (!isTrigger) continue;
      if (await alreadySent('satisfaction', e.id, null, 30)) continue;
      // Cibler les utilisateurs actifs de l'établissement
      const { data: users } = await supabase
        .from('etablissement_users')
        .select('id, email')
        .eq('etablissement_id', e.id)
        .eq('actif', true)
        .limit(50);
      for (const u of users ?? []) {
        if (!u.email) continue;
        if (await callSend({ type: 'satisfaction', etablissement_id: e.id, user_id: u.id })) stats.satisfaction++;
      }
    }

    // 3. Suivi CSM — 2x/an (mai 1-7, novembre 10-17)
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();
    const csmWindow = (month === 5 && day >= 1 && day <= 7) || (month === 11 && day >= 10 && day <= 17);
    if (csmWindow) {
      const { data: etabsCsm } = await supabase
        .from('etablissements')
        .select('id, csm_id')
        .eq('statut', 'production')
        .not('csm_id', 'is', null)
        .limit(500);
      for (const e of etabsCsm ?? []) {
        if (await alreadySent('suivi_csm', e.id, null, 90)) continue;
        const { data: users } = await supabase
          .from('etablissement_users')
          .select('id, email')
          .eq('etablissement_id', e.id)
          .eq('actif', true)
          .limit(20);
        for (const u of users ?? []) {
          if (!u.email) continue;
          if (await callSend({ type: 'suivi_csm', etablissement_id: e.id, user_id: u.id, csm_id: e.csm_id })) stats.suivi_csm++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, date: today, stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('schedule-enquetes error:', err);
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
