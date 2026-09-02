import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UserPhoneSettings {
  sip_uri: string | null;
  sip_username: string | null;
  sip_domain: string | null;
  sip_proxy: string | null;
  sip_transport: string | null;
  caller_id: string | null;
  is_active: boolean | null;
  record_calls: boolean | null;
}

export function useUserPhoneSettings(userId: string | undefined) {
  return useQuery({
    queryKey: ['user_phone_settings', userId],
    queryFn: async (): Promise<UserPhoneSettings | null> => {
      if (!userId) return null;
      const { data } = await supabase
        .from('user_phone_settings')
        .select('sip_uri, sip_username, sip_domain, sip_proxy, sip_transport, caller_id, is_active, record_calls')
        .eq('user_id', userId)
        .maybeSingle();
      return (data as UserPhoneSettings | null) ?? null;
    },
    enabled: !!userId,
  });
}
