import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "npm:resend@2.0.0";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

const cleMessagerie = Deno.env.get("COURRIEL_SECRET_TRANSPORT") ?? Deno.env.get("RESEND_API_KEY") ?? "";
const messagerieConfiguree = cleMessagerie !== "";
if (!messagerieConfiguree) console.warn("[courriel] Transport non configure : les envois seront refuses, la fonction reste disponible.");
const resend = new Resend(messagerieConfiguree ? cleMessagerie : "transport-non-configure");

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://gestion-marque-ia.apercu.example.org",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  recipient: string;
  subject?: string;
  content?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get JWT token from authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Unauthorized - Missing or invalid authorization header"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client with service role for admin verification  
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify JWT and get user
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Unauthorized - Invalid token"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if user is admin with 2FA using proper role system
    const { data: isStrictAdmin, error: roleError } = await supabase
      .rpc('has_admin_role_strict', { _user_id: user.id });
      
    if (roleError || !isStrictAdmin) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Unauthorized - Admin access with 2FA required"
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    const { recipient, subject, content }: TestEmailRequest = await req.json();

    console.log("Sending test email to recipient"); // Remove PII from logs

    const { getEmailSenderConfig } = await import("../_shared/email-sender-config.ts");
    const senderConfig = await getEmailSenderConfig();

    const emailResponse = await resend.emails.send({
      from: senderConfig.default_from,
      to: [recipient],
      subject: subject || "Test de configuration email - Marque",
      html: content || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Test de configuration email</h1>
          <p>Cet email de test a été envoyé avec succès depuis votre application Marque.</p>
          <p>La configuration des notifications par email fonctionne correctement.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            Envoyé le ${new Date().toLocaleString('fr-FR')} depuis Marque
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully with ID:", emailResponse?.data?.id); // Only log non-PII data

    return new Response(JSON.stringify({
      success: true,
      messageId: emailResponse.data?.id,
      message: "Email de test envoyé avec succès"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    return buildErrorResponse('send-test-email', error, corsHeaders, 500);
  }
};

serve(handler);