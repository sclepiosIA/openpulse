/**
 * Prospect Scoring Tool for JARVIS
 * Calculates conversion probability score (0-100) for prospects based on:
 * - Pipeline stage progression
 * - Interaction volume (emails, RDV, tasks)
 * - Establishment size (passages urgences)
 * - Recency of last interaction
 * - Age of prospect
 */

import type { ToolExecutionContext, ToolResult } from "./core-tools.ts";

interface ProspectScore {
  etablissement_id: string;
  nom: string;
  score: number;          // total (statique + comportemental, 0-100)
  static_score: number;   // 0-50 (la base des 7 facteurs ramenée à 50)
  behavioral_score: number; // 0-50
  engagement_velocity: number; // pts/sem
  factors: {
    label: string;
    points: number;
    detail: string;
  }[];
}

export async function executeScoreProspects(
  ctx: ToolExecutionContext,
  args: {
    etablissement_ids?: string[];
    scope?: 'all' | 'prospects_only';
    save?: boolean;
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    const scope = args.scope || 'prospects_only';

    // 1. Fetch etablissements
    let query = ctx.supabase
      .from('etablissements')
      .select('id, nom, statut, type_structure, nombre_passages_urgences_annuel, created_at, updated_at, commercial_id, chef_projet_id, csm_id');

    if (args.etablissement_ids?.length) {
      query = query.in('id', args.etablissement_ids);
    } else if (scope === 'prospects_only') {
      query = query.in('statut', ['Prospect', 'Rendez-vous pris', 'Négociation', 'Contractualisation']);
    }

    const { data: etablissements, error: etabError } = await query.limit(200);
    if (etabError) throw etabError;
    if (!etablissements?.length) {
      return { success: true, data: { scores: [], message: 'Aucun établissement trouvé' }, execution_time_ms: Date.now() - start };
    }

    const etabIds = etablissements.map(e => e.id);

    // 2. Batch fetch interaction data
    const [emailsRes, tasksRes, eventsRes] = await Promise.all([
      // Email threads linked to these establishments
      ctx.supabase
        .from('email_threads')
        .select('etablissement_id, last_message_at')
        .in('etablissement_id', etabIds)
        .order('last_message_at', { ascending: false }),
      // Tasks linked
      ctx.supabase
        .from('taches')
        .select('etablissement_id, statut, created_at')
        .in('etablissement_id', etabIds)
        .eq('archive', false),
      // Calendar events linked
      ctx.supabase
        .from('calendar_events')
        .select('etablissement_id, start_time')
        .in('etablissement_id', etabIds)
        .gte('start_time', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    // Build lookup maps
    const emailCounts: Record<string, number> = {};
    const lastEmailDate: Record<string, string> = {};
    for (const e of emailsRes.data || []) {
      if (!e.etablissement_id) continue;
      emailCounts[e.etablissement_id] = (emailCounts[e.etablissement_id] || 0) + 1;
      if (!lastEmailDate[e.etablissement_id] || e.last_message_at > lastEmailDate[e.etablissement_id]) {
        lastEmailDate[e.etablissement_id] = e.last_message_at;
      }
    }

    const taskCounts: Record<string, number> = {};
    for (const t of tasksRes.data || []) {
      if (!t.etablissement_id) continue;
      taskCounts[t.etablissement_id] = (taskCounts[t.etablissement_id] || 0) + 1;
    }

    const eventCounts: Record<string, number> = {};
    for (const ev of eventsRes.data || []) {
      if (!ev.etablissement_id) continue;
      eventCounts[ev.etablissement_id] = (eventCounts[ev.etablissement_id] || 0) + 1;
    }

    // 3. Score each establishment
    const scores: ProspectScore[] = [];

    for (const etab of etablissements) {
      const factors: ProspectScore['factors'] = [];
      let score = 0;

      // Factor 1: Pipeline stage (0-30 pts)
      const stageScores: Record<string, number> = {
        'Prospect': 5,
        'Rendez-vous pris': 15,
        'Négociation': 22,
        'Contractualisation': 28,
        'Déploiement': 30,
        'Production': 30,
      };
      const stagePts = stageScores[etab.statut] || 0;
      score += stagePts;
      factors.push({ label: 'Avancement pipeline', points: stagePts, detail: etab.statut });

      // Factor 2: Email interactions (0-20 pts)
      const emails = emailCounts[etab.id] || 0;
      const emailPts = Math.min(20, Math.round(emails * 2));
      score += emailPts;
      factors.push({ label: 'Volume emails', points: emailPts, detail: `${emails} thread(s)` });

      // Factor 3: RDV / Events (0-15 pts)
      const events = eventCounts[etab.id] || 0;
      const eventPts = Math.min(15, events * 5);
      score += eventPts;
      factors.push({ label: 'Rendez-vous', points: eventPts, detail: `${events} RDV (90j)` });

      // Factor 4: Tasks engagement (0-10 pts)
      const tasks = taskCounts[etab.id] || 0;
      const taskPts = Math.min(10, Math.round(tasks * 1.5));
      score += taskPts;
      factors.push({ label: 'Tâches liées', points: taskPts, detail: `${tasks} tâche(s)` });

      // Factor 5: Establishment size (0-10 pts)
      const passages = etab.nombre_passages_urgences_annuel || 0;
      let sizePts = 0;
      if (passages > 80000) sizePts = 10;
      else if (passages > 50000) sizePts = 8;
      else if (passages > 30000) sizePts = 6;
      else if (passages > 15000) sizePts = 4;
      else if (passages > 5000) sizePts = 2;
      score += sizePts;
      factors.push({ label: 'Taille établissement', points: sizePts, detail: `${passages.toLocaleString()} passages/an` });

      // Factor 6: Recency of last interaction (-10 to +10 pts)
      const lastInteraction = lastEmailDate[etab.id];
      let recencyPts = 0;
      if (lastInteraction) {
        const daysSince = Math.floor((Date.now() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince <= 3) recencyPts = 10;
        else if (daysSince <= 7) recencyPts = 7;
        else if (daysSince <= 14) recencyPts = 4;
        else if (daysSince <= 30) recencyPts = 0;
        else if (daysSince <= 60) recencyPts = -5;
        else recencyPts = -10;
        factors.push({ label: 'Dernière interaction', points: recencyPts, detail: `il y a ${daysSince}j` });
      } else {
        recencyPts = -5;
        factors.push({ label: 'Dernière interaction', points: recencyPts, detail: 'Aucun email' });
      }
      score += recencyPts;

      // Factor 7: Team assignment (0-5 pts)
      let teamPts = 0;
      if (etab.commercial_id) teamPts += 2;
      if (etab.chef_projet_id) teamPts += 1;
      if (etab.csm_id) teamPts += 2;
      score += teamPts;
      factors.push({ label: 'Équipe assignée', points: teamPts, detail: `${[etab.commercial_id, etab.chef_projet_id, etab.csm_id].filter(Boolean).length}/3 rôles` });

      // Clamp static score to 0-100, then ramène à 0-50 (la base statique)
      const staticRaw = Math.max(0, Math.min(100, score));
      const staticScore = Math.round(staticRaw / 2);

      // Récupère le score comportemental via la RPC
      let behavioralScore = 0;
      let velocity = 0;
      try {
        const { data: behavioral } = await ctx.supabase.rpc('compute_behavioral_score', {
          _etablissement_id: etab.id,
        });
        if (behavioral) {
          behavioralScore = Number(behavioral.behavioral_score) || 0;
          velocity = Number(behavioral.engagement_velocity) || 0;
        }
      } catch {
        // RPC indisponible → on garde 0
      }

      const total = Math.max(0, Math.min(100, staticScore + behavioralScore));

      factors.push({
        label: 'Score comportemental',
        points: behavioralScore,
        detail: `${behavioralScore}/50 (vélocité ${velocity > 0 ? '+' : ''}${velocity}/sem)`,
      });

      scores.push({
        etablissement_id: etab.id,
        nom: etab.nom,
        score: total,
        static_score: staticScore,
        behavioral_score: behavioralScore,
        engagement_velocity: velocity,
        factors,
      });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // 4. Optionally save scores
    if (args.save !== false) {
      for (const s of scores) {
        await ctx.supabase
          .from('etablissements')
          .update({
            score_conversion: s.score,
            score_conversion_factors: s.factors,
            score_conversion_updated_at: new Date().toISOString(),
            behavioral_score: s.behavioral_score,
            engagement_velocity: s.engagement_velocity,
          } as any)
          .eq('id', s.etablissement_id);

        // Snapshot historique
        await ctx.supabase.from('prospect_score_history' as any).insert({
          etablissement_id: s.etablissement_id,
          score: s.score,
          static_score: s.static_score,
          behavioral_score: s.behavioral_score,
          engagement_velocity: s.engagement_velocity,
          factors: s.factors,
        });
      }
    }

    return {
      success: true,
      data: {
        scores,
        total_scored: scores.length,
        average_score: Math.round(scores.reduce((s, x) => s + x.score, 0) / scores.length),
        average_behavioral: Math.round(scores.reduce((s, x) => s + x.behavioral_score, 0) / scores.length),
        top_3: scores.slice(0, 3).map(s => `${s.nom}: ${s.score}/100 (stat ${s.static_score} + comp ${s.behavioral_score})`),
        top_velocity: [...scores].sort((a, b) => b.engagement_velocity - a.engagement_velocity).slice(0, 3)
          .map(s => `${s.nom}: ${s.engagement_velocity > 0 ? '+' : ''}${s.engagement_velocity}/sem`),
      },
      execution_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Scoring failed',
      execution_time_ms: Date.now() - start,
    };
  }
}
