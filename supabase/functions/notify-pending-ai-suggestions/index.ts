import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "npm:resend@2.0.0";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

const cleMessagerie = Deno.env.get("COURRIEL_SECRET_TRANSPORT") ?? Deno.env.get("RESEND_API_KEY") ?? "";
const messagerieConfiguree = cleMessagerie !== "";
if (!messagerieConfiguree) console.warn("[courriel] Transport non configure : les envois seront refuses, la fonction reste disponible.");
const resend = new Resend(messagerieConfiguree ? cleMessagerie : "transport-non-configure");

import { origineAutorisee } from '../_shared/cors.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": origineAutorisee(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

// Simple rate limiting (in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20;

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // SECURITY: Validate service role key
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!authHeader || !authHeader.includes(serviceRoleKey)) {
      console.error("Unauthorized: Invalid service role key");
      return new Response(
        JSON.stringify({ error: "Unauthorized: Service role key required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Rate limiting
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(clientIp)) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    // Get all users with pending AI suggestions
    const { data: suggestionsGrouped } = await supabase
      .from("ai_suggested_actions")
      .select(`
        etablissement_id,
        etablissements!inner(
          nom,
          commercial_id,
          chef_projet_id,
          csm_id
        )
      `)
      .eq("status", "pending");

    if (!suggestionsGrouped || suggestionsGrouped.length === 0) {
      console.log("No pending suggestions found");
      return new Response(JSON.stringify({ message: "No pending suggestions" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Group suggestions by user
    const userSuggestions = new Map<string, { name: string; email: string; count: number; etablissements: Set<string> }>();

    for (const suggestion of suggestionsGrouped) {
      const userIds = [
        suggestion.etablissements.commercial_id,
        suggestion.etablissements.chef_projet_id,
        suggestion.etablissements.csm_id
      ].filter(Boolean);

      for (const userId of userIds) {
        if (!userSuggestions.has(userId)) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("prenom, nom, email")
            .eq("id", userId)
            .single();

          if (profile) {
            userSuggestions.set(userId, {
              name: `${profile.prenom} ${profile.nom}`,
              email: profile.email,
              count: 0,
              etablissements: new Set()
            });
          }
        }

        const userData = userSuggestions.get(userId);
        if (userData) {
          userData.count++;
          userData.etablissements.add(suggestion.etablissements.nom);
        }
      }
    }

    // Send emails
    let emailsSent = 0;
    for (const [userId, userData] of userSuggestions) {
      try {
        // Check user notification preferences
        const { data: profile } = await supabase
          .from("profiles")
          .select("preferences")
          .eq("id", userId)
          .single();

        const prefs = (profile?.preferences as any)?.notifications;
        const aiSuggestionsPrefs = prefs?.email_notifications?.ai_suggestions;

        // Skip if user has disabled AI suggestions notifications
        if (!aiSuggestionsPrefs?.enabled || aiSuggestionsPrefs?.frequency === 'never') {
          console.log(`Skipping notification for ${userData.email} - AI suggestions disabled`);
          continue;
        }

        const { getEmailSenderConfig } = await import("../_shared/email-sender-config.ts");
        const senderConfig = await getEmailSenderConfig();

        await resend.emails.send({
          from: senderConfig.notifications_from,
          to: [userData.email],
          subject: `${userData.count} suggestion${userData.count > 1 ? 's' : ''} IA en attente`,
          html: `
            <h2>Bonjour ${userData.name},</h2>
            <p>Vous avez <strong>${userData.count} suggestion${userData.count > 1 ? 's' : ''} IA</strong> en attente de validation.</p>
            <p>Établissements concernés :</p>
            <ul>
              ${Array.from(userData.etablissements).map(nom => `<li>${nom}</li>`).join('')}
            </ul>
            <p>L'IA a détecté des actions potentielles basées sur les emails récents :</p>
            <ul>
              <li>Mises à jour de tâches</li>
              <li>Créations de nouvelles tâches</li>
              <li>Changements de statut</li>
              <li>Mises à jour de résumés</li>
            </ul>
            <p><a href="https://gestion-marque-ia.apercu.example.org/etablissements" style="background-color: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Traiter les suggestions</a></p>
            <p>Cordialement,<br>L'équipe Marque CRM</p>
          `,
        });

        emailsSent++;
        console.log(`Email sent to ${userData.email}`);
      } catch (emailError: unknown) {
        console.error(`Failed to send email to ${userData.email}:`, emailError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      emails_sent: emailsSent,
      total_suggestions: suggestionsGrouped.length
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in notify-pending-ai-suggestions:", error);
    return buildErrorResponse('notify-pending-ai-suggestions', error, corsHeaders, 500);
  }
});