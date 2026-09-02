/**
 * Authorization helper: verify a user can mutate a given etablissement.
 * Returns { allowed: true } if user is admin/direction, or assigned as
 * commercial_id / csm_id / chef_projet_id on the etablissement.
 */
import { createClient } from "@supabase/supabase-js";

export async function assertEtablissementAccess(
  userId: string,
  etablissementId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (!userId || !etablissementId) {
    return { allowed: false, reason: "missing_params" };
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Admin / direction bypass
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roleSet = new Set((roles ?? []).map((r: any) => r.role));
  if (roleSet.has("admin") || roleSet.has("direction")) {
    return { allowed: true };
  }

  // Resolve profile id
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile?.id) return { allowed: false, reason: "no_profile" };

  const { data: et } = await admin
    .from("etablissements")
    .select("id, commercial_id, csm_id, chef_projet_id")
    .eq("id", etablissementId)
    .maybeSingle();
  if (!et) return { allowed: false, reason: "not_found" };

  const isAssigned =
    et.commercial_id === profile.id ||
    et.csm_id === profile.id ||
    et.chef_projet_id === profile.id;

  return isAssigned ? { allowed: true } : { allowed: false, reason: "not_assigned" };
}
