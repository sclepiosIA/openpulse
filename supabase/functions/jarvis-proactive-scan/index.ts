/**
 * jarvis-proactive-scan - Scan proactif pour alertes JARVIS
 * 
 * Analyse les tâches en retard, emails non traités, prospects froids,
 * factures impayées et génère des alertes proactives.
 * 
 * Peut être appelé manuellement ou via CRON (toutes les 5 minutes)
 * 
 * PHASE 3 FIX: Correction des noms de colonnes et filtres
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { requireInternalSecret } from "../_shared/internal-secret.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

interface ProactiveAlert {
  user_id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  action_type: string;
  action_data: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // CRON-only — accepts x-internal-secret OR service_role Bearer (timing-safe).
  // Legacy: also accept x-function-secret (= INTERNAL_FUNCTION_SECRET) for back-compat
  // with existing pg_cron jobs. Will be removed once all CRONs migrated.
  const legacySecret = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';
  const providedLegacy = req.headers.get('x-function-secret') ?? '';
  const legacyMatch = legacySecret && providedLegacy && legacySecret.length === providedLegacy.length
    && (() => { let d = 0; for (let i = 0; i < legacySecret.length; i++) d |= legacySecret.charCodeAt(i) ^ providedLegacy.charCodeAt(i); return d === 0; })();
  if (!legacyMatch) {
    const denied = requireInternalSecret(req, corsHeaders);
    if (denied) return denied;
  }


  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const alerts: ProactiveAlert[] = [];
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Tâches en retard - FIX: utiliser responsable_id au lieu de assigne_a
    // FIX: utiliser les vrais statuts (minuscule snake_case)
    const { data: overdueTasks } = await supabase
      .from('taches')
      .select('id, titre, echeance, responsable_id, etablissement_id')
      .in('statut', ['A faire', 'En cours'])  // FIX: valeurs réelles de la DB (avec majuscules et espaces)
      .lt('echeance', now.toISOString())
      .not('responsable_id', 'is', null)  // FIX: nom de colonne correct
      .limit(50);

    for (const task of overdueTasks || []) {
      const daysOverdue = Math.ceil((now.getTime() - new Date(task.echeance).getTime()) / (1000 * 60 * 60 * 24));
      
      alerts.push({
        user_id: task.responsable_id,  // FIX: nom de colonne correct
        type: 'overdue_task',
        priority: daysOverdue > 7 ? 'critical' : daysOverdue > 3 ? 'high' : 'medium',
        title: 'Tâche en retard',
        message: `"${task.titre}" - ${daysOverdue} jour${daysOverdue > 1 ? 's' : ''} de retard`,
        action_type: 'navigate',
        action_data: { 
          path: task.etablissement_id 
            ? `/etablissements/${task.etablissement_id}?tab=taches` 
            : '/taches',
          taskId: task.id
        },
      });
    }

    // 2. Emails non traités depuis > 24h
    // FIX: email_threads n'a pas de colonne 'status', on utilise unread_count > 0 et last_message_date
    const { data: pendingThreads } = await supabase
      .from('email_threads')
      .select('id, subject, last_message_date, email_account_id, unread_count')
      .eq('is_archived', false)
      .eq('is_deleted', false)
      .gt('unread_count', 0)
      .lt('last_message_date', yesterday)
      .limit(30);

    if (pendingThreads && pendingThreads.length > 0) {
      // Grouper par compte email pour cibler le bon utilisateur
      const accountIds = [...new Set(pendingThreads.map(t => t.email_account_id).filter(Boolean))];
      
      if (accountIds.length > 0) {
        const { data: accounts } = await supabase
          .from('user_email_accounts')
          .select('id, profile_id')  // FIX: profile_id au lieu de user_id
          .in('id', accountIds);

        const accountUserMap = new Map(accounts?.map(a => [a.id, a.profile_id]) || []);
        const userThreadCounts = new Map<string, number>();

        for (const thread of pendingThreads) {
          const userId = accountUserMap.get(thread.email_account_id);
          if (userId) {
            userThreadCounts.set(userId, (userThreadCounts.get(userId) || 0) + 1);
          }
        }

        for (const [userId, count] of userThreadCounts) {
          alerts.push({
            user_id: userId,
            type: 'pending_emails',
            priority: count > 10 ? 'high' : 'medium',
            title: 'Emails en attente',
            message: `${count} email${count > 1 ? 's' : ''} non lu${count > 1 ? 's' : ''} depuis +24h`,
            action_type: 'open_jarvis',
            action_data: { command: 'Montre-moi les emails en attente depuis plus de 24h' },
          });
        }
      }
    }

    // 3. Prospects froids (aucune activité > 14 jours)
    const { data: coldProspects } = await supabase
      .from('etablissements')
      .select('id, nom, commercial_id, dernier_contact')
      .eq('statut', 'Prospect')
      .not('dernier_contact', 'is', null)  // FIX: Vérifier que dernier_contact existe avant de comparer
      .lt('dernier_contact', twoWeeksAgo)
      .not('commercial_id', 'is', null)
      .limit(30);

    for (const prospect of coldProspects || []) {
      if (!prospect.dernier_contact) continue;  // Skip si pas de date
      
      const daysSinceContact = Math.ceil(
        (now.getTime() - new Date(prospect.dernier_contact).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      alerts.push({
        user_id: prospect.commercial_id!,
        type: 'cold_prospect',
        priority: daysSinceContact > 30 ? 'high' : 'medium',
        title: 'Prospect froid',
        message: `${prospect.nom} - ${daysSinceContact} jours sans contact`,
        action_type: 'navigate',
        action_data: { path: `/etablissements/${prospect.id}` },
      });
    }

    // 4. Factures impayées > 30 jours
    const { data: unpaidInvoices } = await supabase
      .from('factures')
      .select('id, numero, montant_total, date_echeance, etablissement_id')
      .in('statut', ['Envoyée', 'En retard'])  // FIX: inclure aussi 'En retard'
      .lt('date_echeance', thirtyDaysAgo)
      .limit(20);

    if (unpaidInvoices && unpaidInvoices.length > 0) {
      // Notifier les admins
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      
      const totalAmount = unpaidInvoices.reduce((sum, inv) => sum + (inv.montant_total || 0), 0);
      
      for (const admin of admins || []) {
        alerts.push({
          user_id: admin.user_id,
          type: 'unpaid_invoices',
          priority: 'critical',
          title: 'Factures impayées',
          message: `${unpaidInvoices.length} facture${unpaidInvoices.length > 1 ? 's' : ''} impayée${unpaidInvoices.length > 1 ? 's' : ''} - ${totalAmount.toLocaleString('fr-FR')}€`,
          action_type: 'open_jarvis',
          action_data: { command: 'Liste les factures impayées de plus de 30 jours' },
        });
      }
    }

    // 5. Tickets support non résolus depuis > 48h
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    
    const { data: openTickets } = await supabase
      .from('support_tickets')
      .select('id, subject, created_at, assigned_to')
      .in('status', ['open', 'in_progress'])
      .lt('created_at', fortyEightHoursAgo)
      .not('assigned_to', 'is', null)
      .limit(20);

    for (const ticket of openTickets || []) {
      alerts.push({
        user_id: ticket.assigned_to!,
        type: 'pending_ticket',
        priority: 'high',
        title: 'Ticket support en attente',
        message: `"${ticket.subject}" ouvert depuis +48h`,
        action_type: 'navigate',
        action_data: { path: `/support?ticket=${ticket.id}` },
      });
    }

    // 6. NOUVEAU: Contrats arrivant à échéance (30/15/7 jours)
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: expiringContracts } = await supabase
      .from('contrats')
      .select('id, titre, date_fin, etablissement_id, etablissement:etablissements(nom)')
      .gte('date_fin', now.toISOString())
      .lte('date_fin', thirtyDaysFromNow)
      .eq('statut', 'actif')
      .limit(20);

    for (const contract of expiringContracts || []) {
      const daysUntilExpiry = Math.ceil(
        (new Date(contract.date_fin).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Notifier les admins
      for (const admin of admins || []) {
        alerts.push({
          user_id: admin.user_id,
          type: 'expiring_contract',
          priority: daysUntilExpiry <= 7 ? 'critical' : daysUntilExpiry <= 15 ? 'high' : 'medium',
          title: 'Contrat bientôt expiré',
          message: `"${contract.titre}" expire dans ${daysUntilExpiry} jours`,
          action_type: 'navigate',
          action_data: { path: `/etablissements/${contract.etablissement_id}?tab=contrats` },
        });
      }
    }

    // 7. NOUVEAU: Sessions de formation sans émargement complet
    const yesterday2 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    
    const { data: recentSessions } = await supabase
      .from('sessions_formation')
      .select('id, titre, date_debut, etablissement_id')
      .lte('date_debut', yesterday2)
      .gte('date_debut', thirtyDaysAgo.slice(0, 10))
      .limit(30);

    for (const session of recentSessions || []) {
      // Vérifier si émargement complet
      const { count: emargementCount } = await supabase
        .from('emargements')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session.id);

      if (!emargementCount || emargementCount === 0) {
        // Notifier les admins
        for (const admin of admins || []) {
          alerts.push({
            user_id: admin.user_id,
            type: 'incomplete_emargement',
            priority: 'medium',
            title: 'Émargement manquant',
            message: `Session "${session.titre}" sans émargement`,
            action_type: 'navigate',
            action_data: { path: `/formations/gestion/${session.etablissement_id}` },
          });
        }
      }
    }

    // 8. NOUVEAU: Objectifs CA non atteints à mi-mois
    const dayOfMonth = now.getDate();
    if (dayOfMonth >= 15) {
      const currentMonth = now.toISOString().slice(0, 7);
      
      const { data: caObjectifs } = await supabase
        .from('ca_forecasts')
        .select('commercial_id, montant_prevu, montant_realise')
        .eq('periode', currentMonth)
        .eq('type_periode', 'month');

      for (const obj of caObjectifs || []) {
        if (obj.commercial_id && obj.montant_prevu && obj.montant_realise) {
          const progressPercent = (obj.montant_realise / obj.montant_prevu) * 100;
          const expectedProgress = (dayOfMonth / 30) * 100;
          
          if (progressPercent < expectedProgress * 0.7) { // Moins de 70% de l'objectif attendu
            alerts.push({
              user_id: obj.commercial_id,
              type: 'ca_behind_target',
              priority: 'high',
              title: 'Objectif CA en retard',
              message: `${Math.round(progressPercent)}% réalisé vs ${Math.round(expectedProgress)}% attendu`,
              action_type: 'open_jarvis',
              action_data: { command: 'Montre-moi mon objectif CA et les prospects à relancer' },
            });
          }
        }
      }
    }

    // 9. NOUVEAU: Sprints R&D à risque (vélocité < 70% prévue)
    const { data: activeSprint } = await supabase
      .from('rd_sprints')
      .select('id, nom, date_debut, date_fin')
      .lte('date_debut', now.toISOString().slice(0, 10))
      .gte('date_fin', now.toISOString().slice(0, 10))
      .single();

    if (activeSprint) {
      const { data: stories } = await supabase
        .from('rd_user_stories')
        .select('points, statut')
        .eq('sprint_id', activeSprint.id);

      const totalPoints = (stories || []).reduce((sum, s) => sum + (s.points || 0), 0);
      const donePoints = (stories || [])
        .filter(s => s.statut === 'done')
        .reduce((sum, s) => sum + (s.points || 0), 0);

      const sprintStart = new Date(activeSprint.date_debut).getTime();
      const sprintEnd = new Date(activeSprint.date_fin).getTime();
      const sprintProgress = (now.getTime() - sprintStart) / (sprintEnd - sprintStart);
      const expectedVelocity = totalPoints * sprintProgress;

      if (donePoints < expectedVelocity * 0.7 && totalPoints > 0) {
        // Notifier les admins et chefs de projet
        for (const admin of admins || []) {
          alerts.push({
            user_id: admin.user_id,
            type: 'sprint_at_risk',
            priority: 'high',
            title: 'Sprint R&D à risque',
            message: `"${activeSprint.nom}": ${donePoints}/${totalPoints} pts (${Math.round(sprintProgress * 100)}% du temps écoulé)`,
            action_type: 'navigate',
            action_data: { path: '/rd?tab=board' },
          });
        }
      }
    }

    // 10. NOUVEAU: Candidats en attente de réponse > 5 jours
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: waitingCandidates } = await supabase
      .from('candidates')
      .select('id, nom, prenom, statut, updated_at')
      .in('statut', ['en_attente', 'entretien_planifie'])
      .lt('updated_at', fiveDaysAgo)
      .limit(20);

    for (const candidate of waitingCandidates || []) {
      const daysSinceUpdate = Math.ceil(
        (now.getTime() - new Date(candidate.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Notifier les RH
      const { data: rhUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['rh', 'admin']);

      for (const rh of rhUsers || []) {
        alerts.push({
          user_id: rh.user_id,
          type: 'candidate_waiting',
          priority: daysSinceUpdate > 10 ? 'high' : 'medium',
          title: 'Candidat en attente',
          message: `${candidate.prenom} ${candidate.nom} - ${daysSinceUpdate} jours sans réponse`,
          action_type: 'navigate',
          action_data: { path: `/recrutement?candidate=${candidate.id}` },
        });
      }
    }

    // ================================================================
    // JARVIS 8.0: Nouvelles alertes intelligentes
    // ================================================================

    // 11. Détection d'anomalies CA (baisse > 20% vs mois précédent)
    const currentMonth = now.toISOString().slice(0, 7);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.toISOString().slice(0, 7);

    const { data: currentMonthRevenue } = await supabase
      .from('tresorerie_revenus')
      .select('montant')
      .gte('date_reception', `${currentMonth}-01`)
      .lt('date_reception', `${currentMonth}-32`);

    const { data: lastMonthRevenue } = await supabase
      .from('tresorerie_revenus')
      .select('montant')
      .gte('date_reception', `${lastMonth}-01`)
      .lt('date_reception', `${lastMonth}-32`);

    const currentCA = (currentMonthRevenue || []).reduce((sum, r) => sum + (r.montant || 0), 0);
    const lastCA = (lastMonthRevenue || []).reduce((sum, r) => sum + (r.montant || 0), 0);

    if (lastCA > 0 && currentCA < lastCA * 0.8) {
      const dropPercent = Math.round((1 - currentCA / lastCA) * 100);
      for (const admin of admins || []) {
        alerts.push({
          user_id: admin.user_id,
          type: 'ca_anomaly',
          priority: dropPercent > 30 ? 'critical' : 'high',
          title: '📉 Alerte CA',
          message: `CA en baisse de ${dropPercent}% ce mois (${currentCA.toLocaleString('fr-FR')}€ vs ${lastCA.toLocaleString('fr-FR')}€)`,
          action_type: 'open_jarvis',
          action_data: { 
            command: 'Analyse la baisse de CA ce mois et identifie les causes possibles',
            executable: true
          },
        });
      }
    }

    // 12. Opportunités de vente chaudes (prospects avec activité récente)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: hotProspects } = await supabase
      .from('etablissements')
      .select('id, nom, commercial_id, dernier_contact, valeur_estimee')
      .eq('statut', 'Prospect')
      .gte('dernier_contact', sevenDaysAgo)
      .not('commercial_id', 'is', null)
      .order('valeur_estimee', { ascending: false })
      .limit(10);

    for (const prospect of hotProspects || []) {
      if (prospect.commercial_id && prospect.valeur_estimee && prospect.valeur_estimee > 5000) {
        alerts.push({
          user_id: prospect.commercial_id,
          type: 'hot_opportunity',
          priority: 'high',
          title: '🔥 Opportunité chaude',
          message: `${prospect.nom} - ${prospect.valeur_estimee?.toLocaleString('fr-FR')}€ - activité récente`,
          action_type: 'open_jarvis',
          action_data: { 
            command: `Prépare un email de suivi commercial pour ${prospect.nom} et suggère les prochaines étapes`,
            executable: true,
            etablissement_id: prospect.id
          },
        });
      }
    }

    // 13. Risque de churn (clients avec signaux négatifs)
    const { data: activeClients } = await supabase
      .from('etablissements')
      .select(`
        id, nom, csm_id, commercial_id,
        dernier_contact
      `)
      .in('statut', ['Production', 'Contractuel'])
      .limit(100);

    for (const client of activeClients || []) {
      // Vérifier les signaux de churn
      let churnScore = 0;
      const churnReasons: string[] = [];

      // Signal 1: Pas de contact depuis 30+ jours
      if (client.dernier_contact) {
        const daysSinceContact = Math.ceil(
          (now.getTime() - new Date(client.dernier_contact).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceContact > 30) {
          churnScore += 2;
          churnReasons.push(`${daysSinceContact}j sans contact`);
        }
      }

      // Signal 2: Tickets support récents
      const { count: recentTickets } = await supabase
        .from('support_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('etablissement_id', client.id)
        .gte('created_at', thirtyDaysAgo);

      if (recentTickets && recentTickets >= 3) {
        churnScore += 2;
        churnReasons.push(`${recentTickets} tickets récents`);
      }

      // Signal 3: Satisfaction basse (si disponible)
      const { data: recentSatisfaction } = await supabase
        .from('enquetes_satisfaction_solution')
        .select('note_globale')
        .eq('etablissement_id', client.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (recentSatisfaction?.note_globale && recentSatisfaction.note_globale <= 2) {
        churnScore += 3;
        churnReasons.push(`satisfaction ${recentSatisfaction.note_globale}/5`);
      }

      // Générer alerte si score de churn élevé
      if (churnScore >= 3) {
        const targetUser = client.csm_id || client.commercial_id;
        if (targetUser) {
          alerts.push({
            user_id: targetUser,
            type: 'churn_risk',
            priority: churnScore >= 5 ? 'critical' : 'high',
            title: '⚠️ Risque de départ client',
            message: `${client.nom} - Signaux: ${churnReasons.join(', ')}`,
            action_type: 'open_jarvis',
            action_data: { 
              command: `Analyse le risque de churn pour ${client.nom} et propose un plan de rétention`,
              executable: true,
              etablissement_id: client.id
            },
          });
        }
      }
    }

    // 14. Suggestions de relance email automatique
    for (const prospect of coldProspects || []) {
      if (!prospect.dernier_contact || !prospect.commercial_id) continue;
      
      const daysSinceContact = Math.ceil(
        (now.getTime() - new Date(prospect.dernier_contact).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Ne suggérer que pour les prospects 14-30 jours (pas trop froids)
      if (daysSinceContact >= 14 && daysSinceContact <= 30) {
        alerts.push({
          user_id: prospect.commercial_id,
          type: 'suggested_followup_email',
          priority: 'medium',
          title: '✉️ Relance suggérée',
          message: `${prospect.nom} - ${daysSinceContact} jours sans contact`,
          action_type: 'open_jarvis',
          action_data: { 
            command: `Rédige un email de relance professionnel et personnalisé pour ${prospect.nom}. Dernier contact il y a ${daysSinceContact} jours.`,
            executable: true,
            pre_filled: true,
            etablissement_id: prospect.id
          },
        });
      }
    }

    // 15. Événements calendrier importants demain
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const { data: tomorrowEvents } = await supabase
      .from('calendar_events')
      .select('id, title, start_time, etablissement_id, created_by')
      .gte('start_time', tomorrowStart.toISOString())
      .lt('start_time', tomorrowEnd.toISOString())
      .not('created_by', 'is', null)
      .limit(20);

    for (const event of tomorrowEvents || []) {
      if (event.created_by) {
        alerts.push({
          user_id: event.created_by,
          type: 'upcoming_event',
          priority: 'low',
          title: '📅 Demain',
          message: event.title,
          action_type: 'open_jarvis',
          action_data: { 
            command: `Prépare-moi un brief pour mon rendez-vous "${event.title}" prévu demain`,
            executable: true
          },
        });
      }
    }

    // Insert alerts (avec déduplication)
    if (alerts.length > 0) {
      // Supprimer les anciennes alertes (garder seulement les 24 dernières heures)
      await supabase
        .from('jarvis_proactive_alerts')
        .delete()
        .lt('created_at', yesterday);

      // Générer des IDs uniques basés sur user + type + contexte (avec crypto hash pour éviter les doublons)
      const alertsWithIds = alerts.map((a, index) => {
        // Utiliser un hash plus granulaire incluant l'index pour éviter les conflits
        const contextHash = `${a.user_id}-${a.type}-${JSON.stringify(a.action_data).slice(0, 100)}-${index}`;
        const id = contextHash.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 200);
        return {
          ...a,
          id,
          read: false,
          dismissed: false,
        };
      });

      // Insérer un par un pour éviter les conflits ON CONFLICT
      for (const alert of alertsWithIds) {
        const { error } = await supabase
          .from('jarvis_proactive_alerts')
          .upsert(alert, { 
            onConflict: 'id',
            ignoreDuplicates: true 
          });

        if (error) {
          console.error('[proactive-scan] Insert error for alert:', alert.id, error.message);
        }
      }
    }

    console.log(`[proactive-scan] Generated ${alerts.length} alerts`);

    return new Response(JSON.stringify({
      success: true,
      alerts_count: alerts.length,
      breakdown: {
        overdue_tasks: overdueTasks?.length || 0,
        pending_emails: pendingThreads?.length || 0,
        cold_prospects: coldProspects?.length || 0,
        unpaid_invoices: unpaidInvoices?.length || 0,
        pending_tickets: openTickets?.length || 0,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[proactive-scan] Error:', error);
    return buildErrorResponse('jarvis-proactive-scan', error, corsHeaders, 500);
  }
});
