import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { origineAutorisee } from '../_shared/cors.ts'
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateTicketRequest {
  email_thread_id?: string;
  email_message_id?: string;
  etablissement_id?: string;
  partenaire_id?: string;
  titre: string;
  description?: string;
  type_probleme?: string;
  priorite?: string;
  contact_nom?: string;
  contact_email?: string;
  ai_summary?: string;
  ai_suggested_solution?: string;
  ai_urgency_score?: number;
  create_task?: boolean;
  skip_if_duplicate?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    
    // SECURITY: Require either internal secret or valid user JWT
    const providedSecret = req.headers.get("x-internal-secret");
    const authHeader = req.headers.get("Authorization");
    
    let isInternalCall = false;
    let authenticatedUserId: string | null = null;
    
    // Check internal secret first (for calls from other edge functions)
    if (providedSecret && internalSecret && providedSecret === internalSecret) {
      isInternalCall = true;
      console.log("Internal call authenticated via secret");
    } else if (authHeader?.startsWith("Bearer ")) {
      // Validate user JWT
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      
      if (authError || !user) {
        console.error("Unauthorized access attempt:", authError?.message);
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      authenticatedUserId = user.id;
      console.log("User authenticated:", user.email);
    } else {
      console.error("Unauthorized access attempt - no auth provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreateTicketRequest = await req.json();
    console.log("Creating support ticket:", body.titre, isInternalCall ? "(internal)" : `(user: ${authenticatedUserId})`);

    // Check for duplicate if Message-ID provided
    if (body.skip_if_duplicate && body.email_message_id) {
      const { data: existing } = await supabase
        .from("email_message_id_registry")
        .select("processed_for_support")
        .eq("message_id", body.email_message_id)
        .single();

      if (existing?.processed_for_support) {
        console.log("Ticket already exists for this Message-ID, skipping");
        return new Response(
          JSON.stringify({ 
            success: true, 
            skipped: true, 
            reason: "Ticket already exists for this email" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get support category ID for tasks
    const { data: supportCategory } = await supabase
      .from("categories_taches")
      .select("id")
      .eq("nom", "Support")
      .single();

    let tacheId: string | null = null;

    // Create linked task if requested and we have an establishment
    if (body.create_task !== false && body.etablissement_id) {
      const { data: newTask, error: taskError } = await supabase
        .from("taches")
        .insert({
          etablissement_id: body.etablissement_id,
          categorie_id: supportCategory?.id,
          titre: `[SUPPORT] ${body.titre}`,
          description: body.description || body.ai_summary || "Ticket support créé automatiquement depuis un email",
          priorite: body.priorite === "critique" ? "Critique" : 
                   body.priorite === "haute" ? "Haute" : 
                   body.priorite === "basse" ? "Basse" : "Moyenne",
          statut: "À faire",
        })
        .select("id")
        .single();

      if (taskError) {
        console.error("Error creating task:", taskError);
      } else {
        tacheId = newTask?.id;
        console.log("Created linked task:", tacheId);
      }
    }

    // Create the support ticket
    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .insert({
        email_thread_id: body.email_thread_id || null,
        email_message_id: body.email_message_id || null,
        etablissement_id: body.etablissement_id || null,
        partenaire_id: body.partenaire_id || null,
        tache_id: tacheId,
        titre: body.titre,
        description: body.description,
        type_probleme: body.type_probleme || "autre",
        priorite: body.priorite || "moyenne",
        contact_nom: body.contact_nom,
        contact_email: body.contact_email,
        ai_summary: body.ai_summary,
        ai_suggested_solution: body.ai_suggested_solution,
        ai_urgency_score: body.ai_urgency_score,
        // Set SLA deadline based on priority
        sla_deadline: body.priorite === "critique" ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() :
                      body.priorite === "haute" ? new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() :
                      body.priorite === "moyenne" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() :
                      new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (ticketError) {
      console.error("Error creating ticket:", ticketError);
      throw ticketError;
    }

    console.log("Created support ticket:", ticket.numero_ticket);

    // Mark Message-ID as processed for support
    if (body.email_message_id) {
      await supabase
        .from("email_message_id_registry")
        .upsert({
          message_id: body.email_message_id,
          processed_for_support: true,
          source_thread_id: body.email_thread_id || null,
        }, { onConflict: "message_id" });
    }

    // Send push notification to support team
    try {
      // Get all users with support/admin role
      const { data: supportUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'support']);
      
      if (supportUsers && supportUsers.length > 0) {
        const userIds = supportUsers.map(u => u.user_id);
        
        await fetch(
          `${supabaseUrl}/functions/v1/send-push-notification`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              user_ids: userIds,
              title: '🎫 Nouveau ticket support',
              body: body.titre,
              url: '/support',
              type: 'task',
              related_id: ticket.id,
              tag: `ticket-${ticket.numero_ticket}`
            }),
          }
        );
        console.log('Push notification sent to support team');
      }
    } catch (pushErr) {
      console.error('Push notification failed:', pushErr);
    }

    // Update email thread with ticket link (add to tags)
    if (body.email_thread_id) {
      const { data: thread } = await supabase
        .from("email_threads")
        .select("tags")
        .eq("id", body.email_thread_id)
        .single();

      const existingTags = thread?.tags || [];
      if (!existingTags.includes("ticket-support")) {
        await supabase
          .from("email_threads")
          .update({ 
            tags: [...existingTags, "ticket-support"],
            category: "Support"
          })
          .eq("id", body.email_thread_id);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        ticket: {
          id: ticket.id,
          numero_ticket: ticket.numero_ticket,
          tache_id: tacheId,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in create-support-ticket:", error);
    return new Response(
      JSON.stringify({ error: sanitizeErrorForClient(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
