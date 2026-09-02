/**
 * Shared authentication helpers for Edge Functions
 * Validates callers via JWT or internal service role key
 */
import { createClient } from "@supabase/supabase-js";

/**
 * Validate that the request comes from an authenticated user.
 * Returns the user ID or null if unauthorized.
 */
export async function validateUserAuth(req: Request): Promise<{ userId: string; error?: never } | { userId?: never; error: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing authorization header' };
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    return { error: 'Invalid or expired token' };
  }

  return { userId: data.claims.sub as string };
}

/**
 * Validate that the request comes from either:
 * - An authenticated user (JWT - actually verified via getClaims)
 * - An internal service call (service_role key or x-function-secret)
 *
 * IMPORTANT: This is now async because user JWT validation requires a network call.
 */
export async function validateServiceOrUser(req: Request): Promise<{ authorized: boolean; isServiceCall: boolean; userId?: string }> {
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
  const providedSecret = req.headers.get('x-function-secret');

  // Check internal function secret
  if (internalSecret && providedSecret && providedSecret === internalSecret) {
    return { authorized: true, isServiceCall: true };
  }

  // Check service role key in Authorization header
  if (authHeader && serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) {
    return { authorized: true, isServiceCall: true };
  }

  // Validate user JWT with actual signature verification
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data, error } = await supabase.auth.getClaims(token);
      if (!error && data?.claims?.sub) {
        return { authorized: true, isServiceCall: false, userId: data.claims.sub as string };
      }
    } catch {
      // JWT validation failed
    }
    return { authorized: false, isServiceCall: false };
  }

  return { authorized: false, isServiceCall: false };
}
