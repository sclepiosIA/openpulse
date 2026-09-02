import { supabase } from "@/integrations/supabase/client";

/**
 * Wrapper minimaliste pour `supabase.functions.invoke` afin de réduire les
 * imports directs de `@/integrations/supabase/client` côté composants
 * (cf. AUDIT_2026-06-02_PLAN_REMEDIATION — budget composants Supabase).
 */
export async function invokeEdge<TResponse = unknown, TBody = unknown>(
  name: string,
  body?: TBody,
): Promise<TResponse> {
  const { data, error } = await supabase.functions.invoke(name, {
    body: body ?? {},
  });
  if (error) throw error;
  return data as TResponse;
}
