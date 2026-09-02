/**
 * jarvis-daily-briefing - Génère un briefing quotidien personnalisé
 * 
 * JARVIS 7.0 - Phase 3.3
 * 
 * Fonctionnalités:
 * - Résumé des priorités du jour
 * - Alertes sur les risques (retards, trésorerie, etc.)
 * - Opportunités identifiées
 * - Événements importants
 * - Métriques clés
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";

import { origineAutorisee } from '../_shared/cors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface BriefingSection {
  title: string;
  emoji: string;
  items: BriefingItem[];
  priority: 'high' | 'medium' | 'low';
}

interface BriefingItem {
  text: string;
  type: 'alert' | 'info' | 'opportunity' | 'task';
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
}

interface DailyBriefing {
  greeting: string;
  date: string;
  sections: BriefingSection[];
  summary: {
    tasksToday: number;
    overdueItems: number;
    unreadEmails: number;
    upcomingMeetings: number;
  };
  generatedAt: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require authenticated user OR internal service call (CRON)
    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let requestBody: { user_id?: string } = {};
    try {
      requestBody = await req.json();
    } catch {
      // CRON mode: no body
    }

    // For non-service callers, force user_id to the authenticated user
    if (!auth.isServiceCall) {
      requestBody.user_id = auth.userId;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === CRON MODE: no user_id → process all users with push subscriptions ===
    if (!requestBody.user_id) {
      console.log('[Daily Briefing] CRON mode: processing all users with push subscriptions');
      
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('user_id')
        .eq('is_active', true);

      const userIds = [...new Set((subs || []).map(s => s.user_id))];
      console.log(`[Daily Briefing] Found ${userIds.length} users`);

      let sent = 0;
      for (const uid of userIds) {
        try {
          // Call self with user_id to generate briefing
          const { data: briefingResult } = await supabase.functions.invoke('jarvis-daily-briefing', {
            body: { user_id: uid },
          });

          if (briefingResult?.success && briefingResult?.briefing) {
            const b = briefingResult.briefing;
            const summary = b.summary;
            const lines: string[] = [];
            if (summary.tasksToday > 0) lines.push(`📋 ${summary.tasksToday} tâche(s)`);
            if (summary.overdueItems > 0) lines.push(`⚠️ ${summary.overdueItems} en retard`);
            if (summary.unreadEmails > 0) lines.push(`📧 ${summary.unreadEmails} email(s) non lu(s)`);
            if (summary.upcomingMeetings > 0) lines.push(`📅 ${summary.upcomingMeetings} RDV`);

            if (lines.length > 0) {
              await supabase.functions.invoke('send-push-notification', {
                body: {
                  user_id: uid,
                  title: `☀️ ${b.greeting}`,
                  body: lines.join(' • '),
                  type: 'ai_suggestion',
                  url: '/',
                  tag: `daily-briefing-${b.date}`,
                },
              });
              sent++;
            }
          }
        } catch (e) {
          console.error(`[Daily Briefing] Error for ${uid}:`, e);
        }
      }

      return new Response(JSON.stringify({ success: true, briefings_sent: sent, total: userIds.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === SINGLE USER MODE ===
    const user_id = requestBody.user_id;
    console.log(`[Daily Briefing] Generating for user: ${user_id}`);

    // Récupérer le profil utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('prenom, nom, email')
      .eq('id', user_id)
      .single();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Exécuter toutes les requêtes en parallèle
    const [
      tasksTodayResult,
      overdueTasksResult,
      highPriorityTasksResult,
      unreadEmailsResult,
      urgentEmailsResult,
      upcomingMeetingsResult,
      overdueInvoicesResult,
      coldProspectsResult,
      openTicketsResult,
      expiringCertificatesResult,
      recentWinsResult,
    ] = await Promise.all([
      // Tâches pour aujourd'hui
      supabase
        .from('taches')
        .select('id, titre, priorite, echeance')
        .eq('responsable_id', user_id)
        .in('statut', ['A faire', 'En cours'])
        .gte('echeance', todayStart)
        .lte('echeance', todayEnd)
        .order('priorite', { ascending: false })
        .limit(10),

      // Tâches en retard
      supabase
        .from('taches')
        .select('id, titre, echeance, priorite, etablissement:etablissements(nom)')
        .eq('responsable_id', user_id)
        .in('statut', ['A faire', 'En cours'])
        .lt('echeance', todayStart)
        .order('echeance', { ascending: true })
        .limit(10),

      // Tâches haute priorité non terminées
      supabase
        .from('taches')
        .select('id, titre, echeance')
        .eq('responsable_id', user_id)
        .in('statut', ['A faire', 'En cours'])
        .eq('priorite', 'Haute')
        .order('echeance', { ascending: true, nullsFirst: false })
        .limit(5),

      // Emails non lus
      supabase
        .from('email_threads')
        .select('id, subject, ai_generated_title, category, unread_count')
        .gt('unread_count', 0)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .order('last_message_date', { ascending: false })
        .limit(20),

      // Emails urgents (catégorie support ou mots-clés)
      supabase
        .from('email_threads')
        .select('id, subject, ai_generated_title')
        .gt('unread_count', 0)
        .eq('is_deleted', false)
        .in('category', ['Support', 'Urgent', 'Commercial'])
        .limit(5),

      // Réunions aujourd'hui
      supabase
        .from('calendar_events')
        .select('id, title, start_time, end_time, location, etablissement:etablissements(nom)')
        .gte('start_time', todayStart)
        .lte('start_time', todayEnd)
        .order('start_time', { ascending: true })
        .limit(10),

      // Factures en retard (> 30 jours)
      supabase
        .from('factures')
        .select('id, numero, client_nom, montant_ttc, date_echeance')
        .eq('statut', 'Envoyée')
        .lt('date_echeance', todayStart)
        .order('date_echeance', { ascending: true })
        .limit(10),

      // Prospects froids (pas de contact > 14 jours)
      supabase
        .from('etablissements')
        .select('id, nom, ville, dernier_contact')
        .eq('statut', 'Prospect')
        .lt('dernier_contact', new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .order('dernier_contact', { ascending: true })
        .limit(10),

      // Tickets support ouverts priorité haute
      supabase
        .from('support_tickets')
        .select('id, titre, priority, status, created_at')
        .in('status', ['open', 'in_progress'])
        .in('priority', ['high', 'critical'])
        .order('created_at', { ascending: true })
        .limit(5),

      // Certifications qui expirent bientôt
      supabase
        .from('rh_certifications')
        .select('id, nom, date_expiration, employe:profiles(prenom, nom)')
        .gt('date_expiration', todayStart)
        .lt('date_expiration', in30Days)
        .order('date_expiration', { ascending: true })
        .limit(5),

      // Victoires récentes (établissements convertis cette semaine)
      supabase
        .from('etablissements')
        .select('id, nom, statut, updated_at')
        .eq('statut', 'Client')
        .gte('updated_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('updated_at', { ascending: false })
        .limit(3),
    ]);

    // Construire les sections du briefing
    const sections: BriefingSection[] = [];

    // Section PRIORITÉS DU JOUR
    const priorityItems: BriefingItem[] = [];
    
    // Tâches aujourd'hui
    (tasksTodayResult.data || []).forEach(task => {
      priorityItems.push({
        text: `${task.priorite === 'Haute' ? '🔴' : task.priorite === 'Moyenne' ? '🟡' : '🟢'} ${task.titre}`,
        type: 'task',
        entityType: 'tache',
        entityId: task.id,
      });
    });

    // Réunions
    (upcomingMeetingsResult.data || []).forEach(event => {
      const time = new Date(event.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const etabl = event.etablissement ? ` - ${(event.etablissement as any).nom}` : '';
      priorityItems.push({
        text: `📅 ${time} - ${event.title}${etabl}`,
        type: 'info',
        entityType: 'calendar_event',
        entityId: event.id,
      });
    });

    if (priorityItems.length > 0) {
      sections.push({
        title: 'PRIORITÉS DU JOUR',
        emoji: '📊',
        items: priorityItems,
        priority: 'high',
      });
    }

    // Section ALERTES (retards, urgences)
    const alertItems: BriefingItem[] = [];

    // Tâches en retard
    (overdueTasksResult.data || []).forEach(task => {
      const daysLate = Math.ceil((now.getTime() - new Date(task.echeance!).getTime()) / (1000 * 60 * 60 * 24));
      const etabl = task.etablissement ? ` (${(task.etablissement as any).nom})` : '';
      alertItems.push({
        text: `⚠️ "${task.titre}"${etabl} - ${daysLate} jour(s) de retard`,
        type: 'alert',
        entityType: 'tache',
        entityId: task.id,
      });
    });

    // Factures impayées
    (overdueInvoicesResult.data || []).forEach(facture => {
      const daysLate = Math.ceil((now.getTime() - new Date(facture.date_echeance!).getTime()) / (1000 * 60 * 60 * 24));
      alertItems.push({
        text: `💰 Facture ${facture.numero} - ${facture.client_nom} (${facture.montant_ttc}€) - ${daysLate}j de retard`,
        type: 'alert',
        entityType: 'facture',
        entityId: facture.id,
      });
    });

    // Tickets critiques
    (openTicketsResult.data || []).forEach(ticket => {
      alertItems.push({
        text: `🎫 [${ticket.priority?.toUpperCase()}] ${ticket.titre}`,
        type: 'alert',
        entityType: 'support_ticket',
        entityId: ticket.id,
      });
    });

    // Certificats expirants
    (expiringCertificatesResult.data || []).forEach(cert => {
      const daysUntil = Math.ceil((new Date(cert.date_expiration!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const employe = cert.employe ? `${(cert.employe as any).prenom} ${(cert.employe as any).nom}` : 'Employé';
      alertItems.push({
        text: `📜 ${cert.nom} de ${employe} expire dans ${daysUntil} jours`,
        type: 'alert',
        entityType: 'certification',
        entityId: cert.id,
      });
    });

    if (alertItems.length > 0) {
      sections.push({
        title: 'ALERTES',
        emoji: '⚠️',
        items: alertItems.slice(0, 8), // Limiter à 8 alertes
        priority: 'high',
      });
    }

    // Section OPPORTUNITÉS
    const opportunityItems: BriefingItem[] = [];

    // Prospects froids à relancer
    (coldProspectsResult.data || []).forEach(prospect => {
      const daysSinceContact = prospect.dernier_contact 
        ? Math.ceil((now.getTime() - new Date(prospect.dernier_contact).getTime()) / (1000 * 60 * 60 * 24))
        : 'N/A';
      opportunityItems.push({
        text: `📞 ${prospect.nom} (${prospect.ville || 'Ville inconnue'}) - Dernier contact: ${daysSinceContact} jours`,
        type: 'opportunity',
        entityType: 'etablissement',
        entityId: prospect.id,
      });
    });

    // Victoires récentes (motivation)
    (recentWinsResult.data || []).forEach(win => {
      opportunityItems.push({
        text: `🎉 Nouveau client: ${win.nom}`,
        type: 'info',
        entityType: 'etablissement',
        entityId: win.id,
      });
    });

    if (opportunityItems.length > 0) {
      sections.push({
        title: 'OPPORTUNITÉS',
        emoji: '💡',
        items: opportunityItems.slice(0, 6),
        priority: 'medium',
      });
    }

    // Section EMAILS
    const emailItems: BriefingItem[] = [];
    const urgentEmails = urgentEmailsResult.data || [];
    const allUnread = unreadEmailsResult.data || [];

    if (urgentEmails.length > 0) {
      urgentEmails.forEach(email => {
        emailItems.push({
          text: `📬 [URGENT] ${email.ai_generated_title || email.subject || 'Sans sujet'}`,
          type: 'alert',
          entityType: 'email_thread',
          entityId: email.id,
        });
      });
    }

    if (allUnread.length > urgentEmails.length) {
      emailItems.push({
        text: `📧 ${allUnread.length - urgentEmails.length} autres emails non lus`,
        type: 'info',
      });
    }

    if (emailItems.length > 0) {
      sections.push({
        title: 'EMAILS',
        emoji: '📧',
        items: emailItems,
        priority: 'medium',
      });
    }

    // Construire le greeting
    const hour = now.getHours();
    let timeGreeting = 'Bonjour';
    if (hour < 12) timeGreeting = 'Bonjour';
    else if (hour < 18) timeGreeting = 'Bon après-midi';
    else timeGreeting = 'Bonsoir';

    const userName = profile?.prenom || 'Utilisateur';

    const briefing: DailyBriefing = {
      greeting: `${timeGreeting} ${userName} ! 👋`,
      date: now.toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      }),
      sections,
      summary: {
        tasksToday: (tasksTodayResult.data || []).length + (highPriorityTasksResult.data || []).length,
        overdueItems: (overdueTasksResult.data || []).length + (overdueInvoicesResult.data || []).length,
        unreadEmails: allUnread.length,
        upcomingMeetings: (upcomingMeetingsResult.data || []).length,
      },
      generatedAt: now.toISOString(),
    };

    // Optionnel: Stocker le briefing pour historique
    await supabase
      .from('jarvis_daily_briefings')
      .upsert({
        user_id,
        briefing_date: todayStart.split('T')[0],
        briefing_data: briefing,
        generated_at: now.toISOString(),
      }, {
        onConflict: 'user_id,briefing_date'
      });

    console.log(`[Daily Briefing] Generated ${sections.length} sections for ${userName}`);

    return new Response(
      JSON.stringify({ success: true, briefing }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Daily Briefing] Error:', error);
    return buildErrorResponse('jarvis-daily-briefing', error, corsHeaders, 500);
  }
});
