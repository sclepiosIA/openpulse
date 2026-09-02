import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "npm:resend@2.0.0";

const cleMessagerie = Deno.env.get("COURRIEL_SECRET_TRANSPORT") ?? Deno.env.get("RESEND_API_KEY") ?? "";
const messagerieConfiguree = cleMessagerie !== "";
if (!messagerieConfiguree) console.warn("[courriel] Transport non configure : les envois seront refuses, la fonction reste disponible.");
const resend = new Resend(messagerieConfiguree ? cleMessagerie : "transport-non-configure");

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://gestion-marque-ia.apercu.example.org",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// HTML escape function to prevent injection
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface TaskReminder {
  id: string;
  titre: string;
  description: string;
  echeance: string;
  priorite: string;
  statut: string;
  etablissement: {
    nom: string;
  };
  categorie: {
    nom: string;
  };
}

interface ResponsableReminder {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  tasks: TaskReminder[];
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Timing-safe CRON secret check (also accept `requireInternalSecret` standard)
    const cronSecret = req.headers.get("X-CRON-SECRET") ?? "";
    const expectedSecret = Deno.env.get("CRON_SECRET") ?? "";
    const internalSecret = Deno.env.get("INTERNAL_INVOCATION_SECRET") ?? "";
    const provided = cronSecret || (req.headers.get("x-internal-secret") ?? "");
    const expected = cronSecret ? expectedSecret : internalSecret;
    const eq = (a: string, b: string) => {
      if (!a || !b || a.length !== b.length) return false;
      let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
      return d === 0;
    };
    if (!eq(provided, expected)) {
      console.log("Unauthorized access attempt to daily-task-reminder");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Calculate date ranges
    const today = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(today.getDate() + 3);

    console.log(`Checking for tasks due between ${today.toISOString()} and ${threeDaysFromNow.toISOString()}`);

    // Get tasks that are overdue or due within 3 days
    const { data: tasks, error: tasksError } = await supabase
      .from('taches')
      .select(`
        id,
        titre,
        description,
        echeance,
        priorite,
        statut,
        responsable_id,
        etablissements!etablissement_id(nom),
        categories_taches!categorie_id(nom)
      `)
      .not('responsable_id', 'is', null)
      .not('echeance', 'is', null)
      .lte('echeance', threeDaysFromNow.toISOString().split('T')[0])
      .in('statut', ['A faire', 'En cours', 'Bloqué']);

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      throw tasksError;
    }

    if (!tasks || tasks.length === 0) {
      console.log('No tasks found requiring reminders');
      return new Response(
        JSON.stringify({ message: 'No tasks requiring reminders found' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${tasks.length} tasks requiring reminders`);

    // Get unique responsable IDs
    const responsableIds = [...new Set(tasks.map(task => task.responsable_id))];

    // Get responsables details
    const { data: responsables, error: responsablesError } = await supabase
      .from('profiles')
      .select('id, email, nom, prenom')
      .in('id', responsableIds);

    if (responsablesError) {
      console.error('Error fetching responsables:', responsablesError);
      throw responsablesError;
    }

    // Group tasks by responsable
    const remindersByResponsable: ResponsableReminder[] = responsables?.map(responsable => ({
      ...responsable,
      tasks: tasks.filter(task => task.responsable_id === responsable.id).map(task => ({
        id: task.id,
        titre: task.titre,
        description: task.description || '',
        echeance: task.echeance,
        priorite: task.priorite,
        statut: task.statut,
        etablissement: task.etablissements,
        categorie: task.categories_taches
      }))
    })) || [];

    console.log(`Sending reminders to ${remindersByResponsable.length} responsables`);

    // Send reminder emails
    const emailPromises = remindersByResponsable.map(async (reminder) => {
      const overdueTasks = reminder.tasks.filter(task => new Date(task.echeance) < today);
      const upcomingTasks = reminder.tasks.filter(task => new Date(task.echeance) >= today);

      const formatTaskList = (tasks: TaskReminder[]) => {
        return tasks.map(task => {
          const echeanceDate = new Date(task.echeance);
          const isOverdue = echeanceDate < today;
          const daysDiff = Math.ceil((echeanceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          let dateInfo = '';
          if (isOverdue) {
            const daysLate = Math.abs(daysDiff);
            dateInfo = '<span style="color: #dc2626; font-weight: bold;">En retard (' + daysLate + ' jour' + (daysLate > 1 ? 's' : '') + ')</span>';
          } else if (daysDiff === 0) {
            dateInfo = '<span style="color: #ea580c; font-weight: bold;">Aujourd\'hui</span>';
          } else {
            dateInfo = '<span style="color: #d97706;">Dans ' + daysDiff + ' jour' + (daysDiff > 1 ? 's' : '') + '</span>';
          }

          const priorityColor = task.priorite === 'high' ? '#dc2626' : task.priorite === 'medium' ? '#d97706' : '#059669';
          
          const taskRow = [
            '<tr style="border-bottom: 1px solid #e5e7eb;">',
            '  <td style="padding: 12px 8px; vertical-align: top;">',
            '    <strong>' + escapeHtml(task.titre) + '</strong><br>',
            '    <small style="color: #6b7280;">' + escapeHtml(task.etablissement.nom) + ' - ' + escapeHtml(task.categorie.nom) + '</small>',
            task.description ? '    <br><em style="color: #6b7280;">' + escapeHtml(task.description) + '</em>' : '',
            '  </td>',
            '  <td style="padding: 12px 8px; text-align: center;">',
            '    <span style="background-color: ' + priorityColor + '; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">',
            '      ' + task.priorite.toUpperCase(),
            '    </span>',
            '  </td>',
            '  <td style="padding: 12px 8px; text-align: center;">',
            '    ' + echeanceDate.toLocaleDateString('fr-FR'),
            '  </td>',
            '  <td style="padding: 12px 8px; text-align: center;">',
            '    ' + dateInfo,
            '  </td>',
            '</tr>'
          ].join('\n');
          
          return taskRow;
        }).join('');
      };

      // Construire l'HTML de l'email en évitant les template literals imbriquées
      let emailHtml = '<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background-color: #ffffff;">';
      
      // Header
      emailHtml += '<div style="background-color: #1f2937; color: white; padding: 20px; text-align: center;">';
      emailHtml += '<h1 style="margin: 0; font-size: 24px;">OpenPulse Manager</h1>';
      emailHtml += '<p style="margin: 10px 0 0 0; opacity: 0.9;">Rappel de tâches à échéance</p>';
      emailHtml += '</div>';
      
      // Body
      emailHtml += '<div style="padding: 20px;">';
      emailHtml += '<p>Bonjour ' + escapeHtml(reminder.prenom) + ' ' + escapeHtml(reminder.nom) + ',</p>';
      emailHtml += '<p>Voici le récapitulatif de vos tâches nécessitant votre attention :</p>';

      // Overdue tasks section
      if (overdueTasks.length > 0) {
        emailHtml += '<div style="margin: 20px 0;">';
        emailHtml += '<h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 5px;">';
        emailHtml += '⚠️ Tâches en retard (' + overdueTasks.length + ')';
        emailHtml += '</h2>';
        emailHtml += '<table style="width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid #e5e7eb;">';
        emailHtml += '<thead style="background-color: #f9fafb;"><tr>';
        emailHtml += '<th style="padding: 12px 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Tâche</th>';
        emailHtml += '<th style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e5e7eb;">Priorité</th>';
        emailHtml += '<th style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e5e7eb;">Échéance</th>';
        emailHtml += '<th style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e5e7eb;">Statut</th>';
        emailHtml += '</tr></thead>';
        emailHtml += '<tbody>' + formatTaskList(overdueTasks) + '</tbody>';
        emailHtml += '</table>';
        emailHtml += '</div>';
      }

      // Upcoming tasks section
      if (upcomingTasks.length > 0) {
        emailHtml += '<div style="margin: 20px 0;">';
        emailHtml += '<h2 style="color: #d97706; border-bottom: 2px solid #d97706; padding-bottom: 5px;">';
        emailHtml += '📅 Tâches à venir (' + upcomingTasks.length + ')';
        emailHtml += '</h2>';
        emailHtml += '<table style="width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid #e5e7eb;">';
        emailHtml += '<thead style="background-color: #f9fafb;"><tr>';
        emailHtml += '<th style="padding: 12px 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Tâche</th>';
        emailHtml += '<th style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e5e7eb;">Priorité</th>';
        emailHtml += '<th style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e5e7eb;">Échéance</th>';
        emailHtml += '<th style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e5e7eb;">Statut</th>';
        emailHtml += '</tr></thead>';
        emailHtml += '<tbody>' + formatTaskList(upcomingTasks) + '</tbody>';
        emailHtml += '</table>';
        emailHtml += '</div>';
      }

      // Tips section
      emailHtml += '<div style="margin-top: 30px; padding: 15px; background-color: #f3f4f6; border-radius: 8px;">';
      emailHtml += '<p style="margin: 0; color: #374151;">';
      emailHtml += '💡 <strong>Astuce :</strong> Connectez-vous à OpenPulse Manager pour mettre à jour le statut de vos tâches et ajouter des commentaires sur votre progression.';
      emailHtml += '</p>';
      emailHtml += '</div>';

      emailHtml += '<p style="margin-top: 20px;">';
      emailHtml += 'Cordialement,<br><strong>L\'équipe OpenPulse Manager</strong>';
      emailHtml += '</p>';
      emailHtml += '</div>';

      // Footer
      emailHtml += '<div style="background-color: #f9fafb; padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">';
      emailHtml += '<p style="margin: 0;">';
      emailHtml += 'Cet email est généré automatiquement. Si vous pensez l\'avoir reçu par erreur, veuillez contacter votre administrateur système.';
      emailHtml += '</p>';
      emailHtml += '</div>';
      emailHtml += '</div>';

      console.log(`Sending reminder to ${reminder.email} for ${reminder.tasks.length} tasks`);

      const { getEmailSenderConfig } = await import("../_shared/email-sender-config.ts");
      const senderConfig = await getEmailSenderConfig();

      return await resend.emails.send({
        from: senderConfig.notifications_from,
        to: [reminder.email],
        subject: "[OpenPulse Manager] Rappel de tâches à échéance",
        html: emailHtml,
      });
    });

    const emailResults = await Promise.allSettled(emailPromises);
    
    let successCount = 0;
    let errorCount = 0;

    emailResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
        console.log(`Email sent successfully to ${remindersByResponsable[index].email}`);
      } else {
        errorCount++;
        console.error(`Failed to send email to ${remindersByResponsable[index].email}:`, result.reason);
      }
    });

    console.log(`Email sending complete: ${successCount} sent, ${errorCount} failed`);

    return new Response(
      JSON.stringify({
        message: `Task reminders processed`,
        stats: {
          totalTasks: tasks.length,
          totalResponsables: remindersByResponsable.length,
          emailsSent: successCount,
          emailsFailed: errorCount
        }
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error("Error in daily-task-reminder function:", error);
    return new Response(
      JSON.stringify({ error: sanitizeErrorForClient(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);