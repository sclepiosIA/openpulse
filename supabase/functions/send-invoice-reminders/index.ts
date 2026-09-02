import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const AZURE_OPENAI_ENDPOINT = Deno.env.get("AZURE_OPENAI_ENDPOINT");
const AZURE_OPENAI_API_KEY = Deno.env.get("AZURE_OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
    const providedSecret = req.headers.get('x-function-secret');
    const authHeader = req.headers.get('authorization') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const isInternal = !!internalSecret && providedSecret === internalSecret;
    const isServiceRole = !!serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`;
    if (!isInternal && !isServiceRole) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log("[send-invoice-reminders] Starting invoice reminders check...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get overdue invoices that haven't been reminded recently
    const today = new Date();
    const j30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const j45 = new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000);
    const j60 = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Get invoiced but unpaid revenues
    const { data: overdueRevenus, error: revenusError } = await supabase
      .from("tresorerie_revenus")
      .select(`
        id,
        etablissement_id,
        mois,
        date_facture,
        montant_facture,
        montant_prevu,
        numero_facture,
        etablissements!tresorerie_revenus_etablissement_id_fkey (
          nom,
          contacts (
            email,
            nom,
            prenom,
            est_contact_principal
          )
        )
      `)
      .eq("statut", "facture")
      .not("date_facture", "is", null)
      .lte("date_facture", j30.toISOString().split("T")[0]);

    if (revenusError) {
      console.error("[send-invoice-reminders] Error fetching revenues:", revenusError);
      throw revenusError;
    }

    console.log(`[send-invoice-reminders] Found ${overdueRevenus?.length || 0} overdue invoices`);

    const remindersSent = [];

    for (const revenu of overdueRevenus || []) {
      const invoiceDate = new Date(revenu.date_facture);
      const daysOverdue = Math.floor((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Determine reminder type
      let typeRelance: string;
      if (daysOverdue >= 90) {
        typeRelance = "mise_en_demeure";
      } else if (daysOverdue >= 60) {
        typeRelance = "j60";
      } else if (daysOverdue >= 45) {
        typeRelance = "j45";
      } else {
        typeRelance = "j30";
      }

      // Check if this type of reminder was already sent
      const { data: existingRelance } = await supabase
        .from("tresorerie_relances")
        .select("id")
        .eq("revenu_id", revenu.id)
        .eq("type_relance", typeRelance)
        .single();

      if (existingRelance) {
        console.log(`[send-invoice-reminders] Reminder ${typeRelance} already sent for ${revenu.id}`);
        continue;
      }

      // Get principal contact email
      const etablissement = revenu.etablissements as any;
      const contacts = etablissement?.contacts || [];
      const principalContact = contacts.find((c: any) => c.est_contact_principal) || contacts[0];
      
      if (!principalContact?.email) {
        console.log(`[send-invoice-reminders] No contact email for ${etablissement?.nom}`);
        continue;
      }

      // Generate reminder email with GPT-5
      const montant = revenu.montant_facture || revenu.montant_prevu || 0;
      const emailContent = await generateReminderEmail(
        etablissement?.nom || "Client",
        principalContact.prenom || "",
        montant,
        daysOverdue,
        typeRelance,
        revenu.numero_facture || revenu.mois
      );

      // Log the reminder
      const { error: insertError } = await supabase.from("tresorerie_relances").insert({
        revenu_id: revenu.id,
        etablissement_id: revenu.etablissement_id,
        type_relance: typeRelance,
        email_envoye: true,
        contenu_email: emailContent,
        statut: "envoyee",
      });

      if (insertError) {
        console.error(`[send-invoice-reminders] Error logging reminder:`, insertError);
        continue;
      }

      remindersSent.push({
        etablissement: etablissement?.nom,
        type: typeRelance,
        montant,
        daysOverdue,
      });

      console.log(`[send-invoice-reminders] Reminder ${typeRelance} sent for ${etablissement?.nom}`);
    }

    console.log(`[send-invoice-reminders] Completed. ${remindersSent.length} reminders sent.`);

    return new Response(
      JSON.stringify({
        success: true,
        remindersSent: remindersSent.length,
        details: remindersSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    return buildErrorResponse('send-invoice-reminders', error, corsHeaders, 500);
  }
});

async function generateReminderEmail(
  etablissementName: string,
  contactPrenom: string,
  montant: number,
  daysOverdue: number,
  typeRelance: string,
  reference: string
): Promise<string> {
  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
    // Fallback template if no AI
    return `Bonjour ${contactPrenom || ""},\n\nNous vous rappelons que la facture ${reference} d'un montant de ${montant.toFixed(2)}€ est en attente de paiement depuis ${daysOverdue} jours.\n\nCordialement,\nL'équipe OpenPulse`;
  }

  const tonMap: Record<string, string> = {
    j30: "amical et rappel courtois",
    j45: "professionnel mais plus insistant",
    j60: "ferme mais respectueux",
    j90: "très formel avec mention des conséquences",
    mise_en_demeure: "officiel et juridique avec mise en demeure formelle",
  };

  const systemPrompt = `Tu es un assistant commercial de OpenPulse, une entreprise SaaS santé. 
Tu génères des emails de relance pour factures impayées. 
Le ton doit être ${tonMap[typeRelance] || "professionnel"}.
L'email doit être en français, concis (max 150 mots), et inclure:
- Salutation personnalisée
- Rappel du montant et de la référence
- Délai de retard
- Demande de régularisation
- Formule de politesse
Ne pas inclure de sujet, juste le corps de l'email.`;

  const userPrompt = `Génère un email de relance ${typeRelance} pour:
- Établissement: ${etablissementName}
- Contact: ${contactPrenom}
- Montant: ${montant.toFixed(2)}€
- Référence: ${reference}
- Jours de retard: ${daysOverdue}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(AZURE_OPENAI_ENDPOINT, {
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
        max_completion_tokens: 500,
        reasoning_effort: "low",
        verbosity: "low",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Azure API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || `Relance automatique pour facture ${reference}`;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("[generateReminderEmail] AI error:", error);
    return `Bonjour ${contactPrenom},\n\nNous vous rappelons que la facture ${reference} d'un montant de ${montant.toFixed(2)}€ est en attente depuis ${daysOverdue} jours.\n\nMerci de procéder au règlement.\n\nCordialement,\nOpenPulse`;
  }
}
