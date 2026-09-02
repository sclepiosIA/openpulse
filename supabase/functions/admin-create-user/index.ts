import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

// Validation schema - password requis
const CreateUserSchema = z.object({
  email: z.string().email("Email invalide"),
  prenom: z.string().min(1, "Prénom requis"),
  nom: z.string().min(1, "Nom requis"),
  role: z.enum(['admin', 'direction', 'copil', 'commercial', 'chef_projet', 'csm', 'rh', 'user'], {
    errorMap: () => ({ message: "Rôle invalide" })
  }).default('user'),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères")
});

// Rate limiting map
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  userLimit.count++;
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
        JSON.stringify({ error: 'Authentification requise' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token for permission check
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Utilisateur non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin with strict 2FA requirement
    const { data: isAdminStrict, error: adminCheckError } = await supabaseClient.rpc(
      'has_admin_role_strict',
      { _user_id: user.id }
    );

    if (adminCheckError || !isAdminStrict) {
      console.error('Admin check failed:', adminCheckError);
      return new Response(
        JSON.stringify({ 
          error: 'Accès refusé : privilèges admin avec 2FA requis',
          details: 'Vous devez être administrateur avec 2FA activé pour créer des utilisateurs'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Trop de tentatives. Veuillez réessayer dans 1 minute.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = CreateUserSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Données invalides',
          details: validationResult.error.errors
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, prenom, nom, role, password } = validationResult.data;

    // Create admin client for user creation
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Vérifier d'abord si un utilisateur existe dans auth.users
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing auth users:', listError);
    }

    const existingAuthUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    // Récupérer TOUS les profils avec cet email (pour détecter les doublons)
    const { data: profilesByEmail, error: profilesByEmailError } = await supabaseAdmin
      .from('profiles')
      .select('id, actif, user_id, email, prenom, nom')
      .eq('email', email);

    if (profilesByEmailError) {
      console.error('Error fetching profiles by email:', profilesByEmailError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Erreur lors de la vérification des profils existants',
          details: profilesByEmailError.message
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Trouver le profil lié à l'auth user (si existe)
    const profileForAuthUser = existingAuthUser 
      ? profilesByEmail?.find(p => p.user_id === existingAuthUser.id)
      : null;

    // Trouver les autres profils (actifs ou inactifs)
    const activeProfilesForEmail = profilesByEmail?.filter(p => p.actif && p.user_id !== existingAuthUser?.id) || [];
    const inactiveProfilesForEmail = profilesByEmail?.filter(p => !p.actif && p.user_id !== existingAuthUser?.id) || [];

    // Cas A: Profil existe déjà pour ce user_id (mise à jour seulement)
    if (existingAuthUser && profileForAuthUser) {
      console.log('Profile already exists for auth user - updating:', existingAuthUser.id);
      
      // Mettre à jour le mot de passe de l'utilisateur
      const { error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(
        existingAuthUser.id,
        { password }
      );

      if (updatePasswordError) {
        console.error('Error updating password:', updatePasswordError);
      }
      
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          email,
          prenom,
          nom,
          actif: true,
          must_change_password: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', existingAuthUser.id);

      if (updateError) {
        console.error('Error updating existing profile:', updateError);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Erreur lors de la mise à jour du profil',
            details: updateError.message
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Assigner le rôle si spécifié
      if (role) {
        await supabaseAdmin
          .from('user_roles')
          .upsert({
            user_id: existingAuthUser.id,
            role: role
          }, {
            onConflict: 'user_id,role'
          });
      }

      return new Response(
        JSON.stringify({
          success: true,
          synchronized: true,
          message: 'Profil existant mis à jour avec nouveau mot de passe',
          user: {
            id: existingAuthUser.id,
            email
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cas B: Plusieurs profils actifs avec cet email (problème de données)
    if (activeProfilesForEmail.length > 0) {
      console.warn('Multiple active profiles found for email:', email, activeProfilesForEmail.length);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Plusieurs profils existent pour cet email',
          details: 'Nettoyez les doublons de profils pour cet email avant de créer un nouvel utilisateur.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cas C: Profil inactif existe (sans profil pour ce user_id)
    if (inactiveProfilesForEmail.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Profil inactif existant',
          details: 'Un profil inactif existe avec cet email. Veuillez contacter un administrateur pour le réactiver.',
          profileId: inactiveProfilesForEmail[0].id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cas D: Vraie désynchronisation - auth user existe sans aucun profil
    if (existingAuthUser && !profileForAuthUser && activeProfilesForEmail.length === 0) {
      console.log('Detected auth user without profile - creating missing profile:', existingAuthUser.id);
      
      // Mettre à jour le mot de passe
      await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, { password });
      
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: existingAuthUser.id,
          email: email,
          prenom: prenom,
          nom: nom,
          actif: true,
          must_change_password: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        console.error('Error creating missing profile:', profileError);
        if (profileError.code === '23505') {
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Conflit de profil détecté',
              details: 'Un profil existe déjà pour cet utilisateur. Veuillez rafraîchir et réessayer.'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Erreur lors de la synchronisation du profil',
            details: profileError.message
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Assigner le rôle si spécifié
      if (role) {
        await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: existingAuthUser.id,
            role: role
          });
      }

      console.log('Profile synchronized successfully for user:', existingAuthUser.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Utilisateur synchronisé avec succès',
          details: 'Le profil manquant a été créé automatiquement',
          user: {
            id: existingAuthUser.id,
            email: email
          },
          synchronized: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NOUVEAU: Créer l'utilisateur directement avec mot de passe (pas d'email d'invitation)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Email confirmé automatiquement, pas de vérification
      user_metadata: {
        prenom,
        nom,
        role
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      console.log('Error details - status:', (createError as any).status, 'code:', (createError as any).code);
      
      const errorMessage = createError.message?.toLowerCase() || '';
      const errorCode = (createError as any).code?.toLowerCase() || '';
      const errorStatus = (createError as any).status;
      
      const isEmailExists = errorMessage.includes('already registered') || 
                           errorMessage.includes('email exists') ||
                           errorCode === 'email_exists' ||
                           errorStatus === 422;
      
      console.log('Checking if email exists:', { isEmailExists, errorMessage, errorCode, errorStatus });
      
      if (isEmailExists) {
        const errorResponse = { 
          success: false,
          error: 'Cet email est déjà utilisé',
          details: 'Un compte existe déjà avec cette adresse email.'
        };
        console.log('Returning error response:', errorResponse);
        return new Response(
          JSON.stringify(errorResponse),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Erreur lors de la création de l\'utilisateur',
          details: createError.message
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: 'Erreur: utilisateur non créé' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Attendre la création du profil par le trigger
    await new Promise(resolve => setTimeout(resolve, 500));

    // Marquer le profil comme devant changer son mot de passe
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        must_change_password: true,
        prenom,
        nom
      })
      .eq('user_id', newUser.user.id);

    if (updateProfileError) {
      console.error('Error updating profile must_change_password:', updateProfileError);
    }

    // Assign specific role if not 'user' (default role is created by trigger)
    if (role !== 'user') {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .upsert({
          user_id: newUser.user.id,
          role: role
        }, {
          onConflict: 'user_id,role'
        });

      if (roleError) {
        console.error('Error assigning role:', roleError);
      }
    }

    // Log successful creation
    console.log(`User created successfully: ${email} by admin ${user.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          prenom,
          nom,
          role
        },
        message: 'Utilisateur créé avec succès. L\'utilisateur devra changer son mot de passe à la première connexion.'
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
        error: 'Erreur serveur inattendue',
        details: sanitizeErrorForClient(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
