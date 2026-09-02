import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

// Validation schema
const ResetPasswordSchema = z.object({
  userId: z.string().uuid("ID utilisateur invalide"),
  newPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères")
});

// Rate limiting map
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60000; // 1 minute

function checkRateLimit(adminId: string): boolean {
  const now = Date.now();
  const adminLimit = rateLimitMap.get(adminId);
  
  if (!adminLimit || now > adminLimit.resetAt) {
    rateLimitMap.set(adminId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (adminLimit.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  adminLimit.count++;
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get JWT token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentification requise' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token for permission check
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Get current admin user
    const { data: { user: adminUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !adminUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Utilisateur non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin with strict 2FA requirement
    const { data: isAdminStrict, error: adminCheckError } = await supabaseClient.rpc(
      'has_admin_role_strict',
      { _user_id: adminUser.id }
    );

    if (adminCheckError || !isAdminStrict) {
      console.error('Admin check failed:', adminCheckError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Accès refusé : privilèges admin avec 2FA requis',
          details: 'Vous devez être administrateur avec 2FA activé pour réinitialiser des mots de passe'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    if (!checkRateLimit(adminUser.id)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Trop de tentatives. Veuillez réessayer dans 1 minute.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = ResetPasswordSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Données invalides',
          details: validationResult.error.errors
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, newPassword } = validationResult.data;

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Vérifier que l'utilisateur cible existe
    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, email, prenom, nom')
      .eq('id', userId)
      .single();

    if (profileError || !targetProfile) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Utilisateur non trouvé',
          details: 'Aucun profil trouvé avec cet identifiant'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Empêcher un admin de réinitialiser son propre mot de passe via cette fonction
    if (targetProfile.user_id === adminUser.id) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Action non autorisée',
          details: 'Vous ne pouvez pas réinitialiser votre propre mot de passe via cette fonction. Utilisez la fonction de changement de mot de passe.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mettre à jour le mot de passe de l'utilisateur
    const { error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(
      targetProfile.user_id,
      { password: newPassword }
    );

    if (updatePasswordError) {
      console.error('Error updating password:', updatePasswordError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Erreur lors de la mise à jour du mot de passe',
          details: updatePasswordError.message
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Marquer le profil comme devant changer son mot de passe
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        must_change_password: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateProfileError) {
      console.error('Error updating profile must_change_password:', updateProfileError);
      // On continue quand même car le mot de passe a été changé
    }

    // Log l'action
    console.log(`Password reset by admin ${adminUser.email} for user ${targetProfile.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Mot de passe réinitialisé pour ${targetProfile.prenom} ${targetProfile.nom}. L'utilisateur devra changer son mot de passe à la prochaine connexion.`,
        user: {
          id: targetProfile.id,
          email: targetProfile.email,
          prenom: targetProfile.prenom,
          nom: targetProfile.nom
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Erreur serveur inattendue',
        details: sanitizeErrorForClient(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
