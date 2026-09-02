import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";
import { debug } from "@/lib/debug";

// Type strict pour les détails d'action de sécurité
export interface SecurityActionDetails {
  previous_value?: string | number | boolean | null;
  new_value?: string | number | boolean | null;
  affected_records?: number;
  ip_source?: string;
  reason?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export function useSecurityLog() {
  const logAction = useCallback(async (
    action: string,
    resource: string,
    details?: SecurityActionDetails,
    resourceId?: string
  ) => {
    try {
      // IP is resolved server-side (from request headers) to avoid third-party calls (ipify)
      // and GDPR concerns. The RPC reads request context server-side.
      await supabase.rpc('log_security_event' as never, {
        p_action: action,
        p_resource: resource,
        p_details: details ? JSON.parse(JSON.stringify(details)) : undefined,
        p_resource_id: resourceId || undefined,
        p_ip_address: undefined,
        p_user_agent: navigator.userAgent,
      } as never);
    } catch (error) {
      if (import.meta.env.DEV) {
        debug.error('Failed to log security action:', error);
      }
    }
  }, []);

  return { logAction };
}
