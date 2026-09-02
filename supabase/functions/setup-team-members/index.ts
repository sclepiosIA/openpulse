import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth + RBAC: admin/direction only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const { data: roleRows, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .in("role", ["admin", "direction"]);
    if (roleErr || !roleRows || roleRows.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden — admin/direction only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const teamMembers = [
      {
        email: "membre.equipe@example.invalid",
        prenom: "Camille",
        nom: "Durand",
        title: "Responsable Marketing",
      },
      {
        email: "membre.equipe@example.invalid",
        prenom: "Camille",
        nom: "Durand",
        title: "Directeur de la Stratégie",
      },
      {
        email: "membre.equipe@example.invalid",
        prenom: "Camille",
        nom: "Bègne",
        title: "CTO",
      },
    ];

    const results = [];

    for (const member of teamMembers) {
      console.log(`Processing ${member.email}...`);

      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users.find(u => u.email === member.email);

      let userId: string;
      let profileId: string;

      if (existingUser) {
        console.log(`User ${member.email} already exists`);
        userId = existingUser.id;

        // Get profile
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (profile) {
          profileId = profile.id;
        } else {
          // Create profile if doesn't exist
          const { data: newProfile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .insert({
              user_id: userId,
              prenom: member.prenom,
              nom: member.nom,
              email: member.email,
              actif: true,
              preferences: { title: member.title },
            })
            .select("id")
            .single();

          if (profileError) throw profileError;
          profileId = newProfile.id;
        }
      } else {
        // Create new user with random password (they can reset it later)
        const randomPassword = crypto.randomUUID();
        
        const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
          email: member.email,
          password: randomPassword,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            prenom: member.prenom,
            nom: member.nom,
          },
        });

        if (userError) {
          console.error(`Error creating user ${member.email}:`, userError);
          throw userError;
        }

        userId = newUser.user.id;
        console.log(`Created user ${member.email} with ID ${userId}`);

        // Create profile
        const { data: newProfile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .insert({
            user_id: userId,
            prenom: member.prenom,
            nom: member.nom,
            email: member.email,
            actif: true,
            preferences: { title: member.title },
          })
          .select("id")
          .single();

        if (profileError) {
          console.error(`Error creating profile for ${member.email}:`, profileError);
          throw profileError;
        }

        profileId = newProfile.id;
        console.log(`Created profile for ${member.email} with ID ${profileId}`);
      }

      // Upsert email mapping for team member
      const { error: mappingError } = await supabaseAdmin
        .from("email_specific_mappings")
        .upsert({
          email_address: member.email.toLowerCase(),
          profile_id: profileId,
          niveau_mapping: "equipe",
          verified: true,
          confidence_level: "high",
        }, {
          onConflict: "email_address",
        });

      if (mappingError) {
        console.error(`Error creating mapping for ${member.email}:`, mappingError);
        throw mappingError;
      }

      console.log(`Created/updated email mapping for ${member.email}`);

      results.push({
        email: member.email,
        userId,
        profileId,
        status: existingUser ? "updated" : "created",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Team members setup completed",
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    return buildErrorResponse('setup-team-members', error, corsHeaders, 500);
  }
});
