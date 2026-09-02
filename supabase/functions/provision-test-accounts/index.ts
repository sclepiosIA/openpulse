import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { origineAutorisee } from '../_shared/cors.ts'
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";


const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLES = ["admin", "direction", "commercial", "chef_projet", "csm", "rh", "copil"] as const;
type ProvisionRole = typeof ROLES[number];

type ProvisionResult = {
  email: string;
  status: "ok" | "error";
  user_id?: string;
  role?: ProvisionRole;
  error?: string;
};

type AdminClient = ReturnType<typeof createClient>;

async function findSandboxProfileUserIdByEmail(admin: AdminClient, email: string): Promise<string | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", email)
    .eq("is_sandbox", true)
    .maybeSingle();

  if (error) throw error;
  return data?.user_id ?? null;
}

async function findAuthUserIdByEmail(admin: AdminClient, email: string): Promise<string | null> {
  const perPage = 1000;
  try {
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;

      const existing = data?.users?.find((u) => u.email === email);
      if (existing) return existing.id;
      if ((data?.users?.length ?? 0) < perPage) return await findSandboxProfileUserIdByEmail(admin, email);
    }
  } catch (_) {
    return await findSandboxProfileUserIdByEmail(admin, email);
  }

  throw new Error(`Unable to find ${email}: auth user pagination limit exceeded`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Service-role only — provisioning privileged accounts must never be public.
  const auth = await validateServiceOrUser(req);
  if (!auth.authorized || !auth.isServiceCall) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }



  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PASSWORD = Deno.env.get("TEST_ACCOUNTS_PASSWORD");
    if (!PASSWORD) {
      return new Response(JSON.stringify({ error: "TEST_ACCOUNTS_PASSWORD not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Auth: open endpoint (idempotent — only creates fixed test-*@exploitant.example.org accounts)
    // Password is in TEST_ACCOUNTS_PASSWORD secret, only known by admin.

    const results: ProvisionResult[] = [];
    for (const role of ROLES) {
      const email = `test-${role}@exploitant.example.org`;
      try {
        // Try create
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { prenom: "Test", nom: role.toUpperCase(), is_sandbox: true },
        });

        let userId: string | null = created?.user?.id ?? null;

        if (createErr) {
          // Already exists -> find and reset password
          userId = await findAuthUserIdByEmail(admin, email);
          if (userId) {
            await admin.auth.admin.updateUserById(userId, {
              password: PASSWORD,
              email_confirm: true,
            });
          } else {
            results.push({ email, status: "error", error: createErr.message });
            continue;
          }
        }

        if (!userId) {
          results.push({ email, status: "error", error: "no user id" });
          continue;
        }

        // Upsert profile is_sandbox
        const { error: profileError } = await admin.from("profiles").upsert({
          user_id: userId,
          email,
          prenom: "Test",
          nom: role.toUpperCase(),
          is_sandbox: true,
        }, { onConflict: "user_id" });

        if (profileError) {
          results.push({ email, status: "error", error: profileError.message });
          continue;
        }

        // Assign role — un seul rôle par compte de test sandbox.
        // On supprime toutes les lignes existantes pour ce user_id puis on
        // réinsère le rôle attendu. La table protège aussi ce cas par trigger.
        const { error: deleteRolesError } = await admin
          .from("user_roles")
          .delete()
          .eq("user_id", userId);

        if (deleteRolesError) {
          results.push({ email, status: "error", error: deleteRolesError.message });
          continue;
        }

        const { error: insertRoleError } = await admin.from("user_roles").insert({
          user_id: userId,
          role,
        });

        if (insertRoleError) {
          results.push({ email, status: "error", error: insertRoleError.message });
          continue;
        }


        results.push({ email, status: "ok", user_id: userId, role });
      } catch (e: unknown) {
        results.push({ email, status: "error", error: e instanceof Error ? e.message : "Unknown error" });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    return buildErrorResponse('provision-test-accounts', e, corsHeaders, 500);
  }
});
