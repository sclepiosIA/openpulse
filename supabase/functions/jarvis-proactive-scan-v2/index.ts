/**
 * jarvis-proactive-scan V2 - Scan proactif amélioré avec scoring intelligent
 * 
 * - Scoring de priorité pondéré
 * - Déduplication intelligente
 * - Analyse de patterns temporels
 * - Suggestions d'actions exécutables
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";


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
  score?: number; // Score de pertinence 0-100
  category?: string;
}

// Calcul du score de priorité pondéré
function calculatePriorityScore(factors: {
  daysOverdue?: number;
  amount?: number;
  isUrgent?: boolean;
  hasMultipleSignals?: boolean;
  recentActivity?: boolean;
  isHighValue?: boolean;
}): number {
  let score = 50; // Base

  if (factors.daysOverdue) {
    score += Math.min(factors.daysOverdue * 2, 30); // Max +30
  }
  if (factors.amount && factors.amount > 10000) {
    score += 20;
  } else if (factors.amount && factors.amount > 5000) {
    score += 10;
  }
  if (factors.isUrgent) score += 25;
  if (factors.hasMultipleSignals) score += 15;
  if (factors.recentActivity) score -= 10; // Moins urgent si activité récente
  if (factors.isHighValue) score += 20;

  return Math.min(Math.max(score, 0), 100);
}

function getPriorityFromScore(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Dual auth: authenticated user OR internal CRON (service_role Bearer / x-internal-secret)
  const auth = await validateServiceOrUser(req);
  if (!auth.authorized) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const startTime = Date.now();

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
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Récupérer les admins une seule fois
    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    const adminIds = (admins || []).map(a => a.user_id);

    // ================================================================
    // 1. TÂCHES EN RETARD (scoring amélioré)
    // ================================================================
    const { data: overdueTasks } = await supabase
      .from('taches')
      .select('id, titre, echeance, responsable_id, etablissement_id, priorite')
      .in('statut', ['A faire', 'En cours'])
      .lt('echeance', now.toISOString())
      .not('responsable_id', 'is', null)
      .limit(50);

    for (const task of overdueTasks || []) {
      const daysOverdue = Math.ceil((now.getTime() - new Date(task.echeance).getTime()) / (1000 * 60 * 60 * 24));
      const isHighPriority = task.priorite === 'haute' || task.priorite === 'urgente';
      
      const score = calculatePriorityScore({
        daysOverdue,
        isUrgent: isHighPriority,
      });

      alerts.push({
        user_id: task.responsable_id,
        type: 'overdue_task',
        priority: getPriorityFromScore(score),
        score,
        category: 'productivity',
        title: `⏰ Tâche en retard${daysOverdue > 7 ? ' (critique)' : ''}`,
        message: `"${task.titre}" - ${daysOverdue} jour${daysOverdue > 1 ? 's' : ''} de retard`,
        action_type: 'navigate',
        action_data: { 
          path: task.etablissement_id 
            ? `/etablissements/${task.etablissement_id}?tab=taches` 
            : '/taches',
          taskId: task.id,
          executable: true
        },
      });
    }

    // ================================================================
    // 2. EMAILS NON TRAITÉS (> 24h)
    // ================================================================
    const { data: pendingThreads } = await supabase
      .from('email_threads')
      .select('id, subject, last_message_date, email_account_id, unread_count')
      .eq('is_archived', false)
      .eq('is_deleted', false)
      .gt('unread_count', 0)
      .lt('last_message_date', yesterday)
      .limit(30);

    if (pendingThreads && pendingThreads.length > 0) {
      const accountIds = [...new Set(pendingThreads.map(t => t.email_account_id).filter(Boolean))];
      
      if (accountIds.length > 0) {
        const { data: accounts } = await supabase
          .from('user_email_accounts')
          .select('id, profile_id')
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
          const score = calculatePriorityScore({
            daysOverdue: 1,
            hasMultipleSignals: count > 5,
          });

          alerts.push({
            user_id: userId,
            type: 'pending_emails',
            priority: getPriorityFromScore(score),
            score,
            category: 'communication',
            title: '📧 Emails en attente',
            message: `${count} email${count > 1 ? 's' : ''} non lu${count > 1 ? 's' : ''} depuis +24h`,
            action_type: 'open_jarvis',
            action_data: { 
              command: 'Résume mes emails non lus les plus importants et suggère des réponses',
              executable: true
            },
          });
        }
      }
    }

    // ================================================================
    // 3. PROSPECTS FROIDS (14+ jours)
    // ================================================================
    const { data: coldProspects } = await supabase
      .from('etablissements')
      .select('id, nom, commercial_id, dernier_contact, valeur_estimee')
      .eq('statut', 'Prospect')
      .not('dernier_contact', 'is', null)
      .lt('dernier_contact', twoWeeksAgo)
      .not('commercial_id', 'is', null)
      .order('valeur_estimee', { ascending: false, nullsFirst: false })
      .limit(30);

    for (const prospect of coldProspects || []) {
      if (!prospect.dernier_contact) continue;
      
      const daysSinceContact = Math.ceil(
        (now.getTime() - new Date(prospect.dernier_contact).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      const isHighValue = prospect.valeur_estimee && prospect.valeur_estimee > 10000;
      const score = calculatePriorityScore({
        daysOverdue: daysSinceContact - 14, // Jours au-delà du seuil
        isHighValue,
        amount: prospect.valeur_estimee,
      });

      // Seulement prospects 14-45 jours (pas trop froids)
      if (daysSinceContact <= 45) {
        alerts.push({
          user_id: prospect.commercial_id!,
          type: 'cold_prospect',
          priority: getPriorityFromScore(score),
          score,
          category: 'sales',
          title: isHighValue ? '🔥 Prospect HV à relancer' : '📞 Prospect froid',
          message: `${prospect.nom} - ${daysSinceContact}j${isHighValue ? ` - ${prospect.valeur_estimee?.toLocaleString('fr-FR')}€` : ''}`,
          action_type: 'open_jarvis',
          action_data: { 
            command: `Rédige un email de relance commercial personnalisé pour ${prospect.nom}. Dernier contact: ${daysSinceContact} jours.`,
            executable: true,
            etablissement_id: prospect.id
          },
        });
      }
    }

    // ================================================================
    // 4. FACTURES IMPAYÉES (> 30 jours)
    // ================================================================
    const { data: unpaidInvoices } = await supabase
      .from('factures')
      .select('id, numero, montant_ttc, date_echeance, etablissement_id, client_nom')
      .in('statut', ['Envoyée', 'En retard'])
      .lt('date_echeance', thirtyDaysAgo)
      .limit(20);

    if (unpaidInvoices && unpaidInvoices.length > 0) {
      const totalAmount = unpaidInvoices.reduce((sum, inv) => sum + (inv.montant_ttc || 0), 0);
      
      // Une alerte groupée pour les admins
      for (const adminId of adminIds) {
        const score = calculatePriorityScore({
          amount: totalAmount,
          isUrgent: totalAmount > 20000,
          hasMultipleSignals: unpaidInvoices.length > 3,
        });

        alerts.push({
          user_id: adminId,
          type: 'unpaid_invoices_summary',
          priority: getPriorityFromScore(score),
          score,
          category: 'finance',
          title: '💰 Factures impayées',
          message: `${unpaidInvoices.length} facture${unpaidInvoices.length > 1 ? 's' : ''} - ${totalAmount.toLocaleString('fr-FR')}€`,
          action_type: 'open_jarvis',
          action_data: { 
            command: 'Liste les factures impayées de plus de 30 jours et prépare des emails de relance',
            executable: true
          },
        });
      }

      // Alertes individuelles pour les grosses factures
      for (const invoice of unpaidInvoices.filter(i => i.montant_ttc > 5000)) {
        for (const adminId of adminIds) {
          const daysOverdue = Math.ceil(
            (now.getTime() - new Date(invoice.date_echeance).getTime()) / (1000 * 60 * 60 * 24)
          );

          alerts.push({
            user_id: adminId,
            type: 'unpaid_invoice_high',
            priority: 'high',
            score: 75,
            category: 'finance',
            title: '🚨 Facture importante impayée',
            message: `${invoice.numero}: ${invoice.montant_ttc.toLocaleString('fr-FR')}€ (${daysOverdue}j)`,
            action_type: 'open_jarvis',
            action_data: { 
              command: `Prépare un email de relance ferme pour la facture ${invoice.numero} de ${invoice.client_nom}`,
              executable: true,
              invoice_id: invoice.id
            },
          });
        }
      }
    }

    // ================================================================
    // 5. OPPORTUNITÉS CHAUDES (activité récente + haute valeur)
    // ================================================================
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
          score: 80,
          category: 'sales',
          title: '🔥 Opportunité chaude',
          message: `${prospect.nom} - ${prospect.valeur_estimee?.toLocaleString('fr-FR')}€ - momentum positif`,
          action_type: 'open_jarvis',
          action_data: { 
            command: `Prépare un email de suivi commercial pour ${prospect.nom} avec proposition concrète`,
            executable: true,
            etablissement_id: prospect.id
          },
        });
      }
    }

    // ================================================================
    // 6. RISQUE DE CHURN (clients avec signaux négatifs)
    // ================================================================
    const { data: activeClients } = await supabase
      .from('etablissements')
      .select('id, nom, csm_id, commercial_id, dernier_contact')
      .in('statut', ['Production', 'Contractuel'])
      .limit(100);

    for (const client of activeClients || []) {
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
      } else {
        churnScore += 1;
        churnReasons.push('Aucun contact enregistré');
      }

      // Signal 2: Tickets support récents (batch pour performance)
      const { count: recentTickets } = await supabase
        .from('support_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('etablissement_id', client.id)
        .gte('created_at', thirtyDaysAgo);

      if (recentTickets && recentTickets >= 3) {
        churnScore += 2;
        churnReasons.push(`${recentTickets} tickets récents`);
      }

      if (churnScore >= 3) {
        const targetUser = client.csm_id || client.commercial_id;
        if (targetUser) {
          alerts.push({
            user_id: targetUser,
            type: 'churn_risk',
            priority: churnScore >= 4 ? 'critical' : 'high',
            score: 60 + churnScore * 10,
            category: 'retention',
            title: '⚠️ Risque de départ client',
            message: `${client.nom} - ${churnReasons.join(', ')}`,
            action_type: 'open_jarvis',
            action_data: { 
              command: `Analyse le risque de churn pour ${client.nom} et propose un plan de rétention personnalisé`,
              executable: true,
              etablissement_id: client.id
            },
          });
        }
      }
    }

    // ================================================================
    // 7. ÉVÉNEMENTS DEMAIN (briefing suggéré)
    // ================================================================
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
      .not('etablissement_id', 'is', null)
      .limit(20);

    for (const event of tomorrowEvents || []) {
      if (event.created_by) {
        alerts.push({
          user_id: event.created_by,
          type: 'upcoming_event',
          priority: 'low',
          score: 40,
          category: 'preparation',
          title: '📅 Réunion demain',
          message: event.title,
          action_type: 'open_jarvis',
          action_data: { 
            command: `Prépare-moi un briefing complet pour mon rendez-vous "${event.title}" prévu demain`,
            executable: true,
            event_id: event.id,
            etablissement_id: event.etablissement_id
          },
        });
      }
    }

    // ================================================================
    // 8. FIN DE PÉRIODE FACTURATION (< 7 jours)
    // ================================================================
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: endingPeriods } = await supabase
      .from('csm_facturation_suivi')
      .select('etablissement_id, date_fin_periode, facturation_effectuee')
      .gte('date_fin_periode', now.toISOString())
      .lte('date_fin_periode', sevenDaysFromNow);

    if (endingPeriods && endingPeriods.length > 0) {
      const etabIds = endingPeriods.map(p => p.etablissement_id);
      const { data: etabs } = await supabase
        .from('etablissements')
        .select('id, nom, csm_id')
        .in('id', etabIds);

      const etabMap = new Map(etabs?.map(e => [e.id, e]) || []);

      for (const period of endingPeriods) {
        const etab = etabMap.get(period.etablissement_id);
        if (!etab) continue;

        const daysLeft = Math.ceil(
          (new Date(period.date_fin_periode!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        const targetUsers = [...new Set([
          ...(etab.csm_id ? [etab.csm_id] : []),
          ...adminIds
        ])];

        for (const userId of targetUsers) {
          // Alerte KPIs trimestriels
          alerts.push({
            user_id: userId,
            type: 'kpi_completion_reminder',
            priority: daysLeft <= 2 ? 'high' : 'medium',
            score: calculatePriorityScore({ daysOverdue: 7 - daysLeft, isUrgent: daysLeft <= 2 }),
            category: 'csm',
            title: '📊 KPIs trimestriels à compléter',
            message: `${etab.nom} - fin de période dans ${daysLeft}j - Vérifier les KPIs`,
            action_type: 'navigate',
            action_data: {
              path: `/etablissements/${etab.id}?tab=csm-kpis`,
              etablissement_id: etab.id,
              executable: true
            },
          });

          // Alerte facturation (sauf si déjà faite)
          if (period.facturation_effectuee !== 'OUI') {
            alerts.push({
              user_id: userId,
              type: 'billing_reminder',
              priority: daysLeft <= 2 ? 'high' : 'medium',
              score: calculatePriorityScore({ daysOverdue: 7 - daysLeft, isUrgent: daysLeft <= 2 }),
              category: 'finance',
              title: '🧾 Facturation à effectuer',
              message: `${etab.nom} - fin de période dans ${daysLeft}j - Facture à émettre`,
              action_type: 'navigate',
              action_data: {
                path: `/etablissements/${etab.id}?tab=csm-facturation`,
                etablissement_id: etab.id,
                executable: true
              },
            });
          }
        }
      }
    }

    // ================================================================
    // SAUVEGARDE AVEC DÉDUPLICATION INTELLIGENTE
    // ================================================================
    
    // Supprimer les anciennes alertes (> 24h)
    await supabase
      .from('jarvis_proactive_alerts')
      .delete()
      .lt('created_at', yesterday);

    // Trier par score et limiter
    alerts.sort((a, b) => (b.score || 50) - (a.score || 50));
    const topAlerts = alerts.slice(0, 100); // Max 100 alertes

    // Insérer avec déduplication
    for (const alert of topAlerts) {
      const uniqueKey = `${alert.user_id}-${alert.type}-${JSON.stringify(alert.action_data).slice(0, 80)}`;
      const id = uniqueKey.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 200);
      
      const { error } = await supabase
        .from('jarvis_proactive_alerts')
        .upsert({
          id,
          ...alert,
          read: false,
          dismissed: false,
        }, { 
          onConflict: 'id',
          ignoreDuplicates: true 
        });

      if (error) {
        console.error('[proactive-scan] Insert error:', error.message);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[proactive-scan] Completed in ${duration}ms - ${topAlerts.length} alerts generated`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      alerts_count: topAlerts.length,
      categories: {
        productivity: topAlerts.filter(a => a.category === 'productivity').length,
        communication: topAlerts.filter(a => a.category === 'communication').length,
        sales: topAlerts.filter(a => a.category === 'sales').length,
        finance: topAlerts.filter(a => a.category === 'finance').length,
        retention: topAlerts.filter(a => a.category === 'retention').length,
        preparation: topAlerts.filter(a => a.category === 'preparation').length,
        csm: topAlerts.filter(a => a.category === 'csm').length,
      },
      priorities: {
        critical: topAlerts.filter(a => a.priority === 'critical').length,
        high: topAlerts.filter(a => a.priority === 'high').length,
        medium: topAlerts.filter(a => a.priority === 'medium').length,
        low: topAlerts.filter(a => a.priority === 'low').length,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[proactive-scan] Error:', error);
    return buildErrorResponse('jarvis-proactive-scan-v2', error, corsHeaders, 500);
  }
});
