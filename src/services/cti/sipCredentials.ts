import { supabase } from '@/integrations/supabase/client';

export interface SipCredentialsPayload {
  sip_uri: string;
  sip_username: string;
  sip_password: string;
  sip_domain: string;
  sip_transport: 'wss' | 'tls' | 'tcp' | 'udp';
  sip_proxy?: string;
  caller_id?: string;
  record_calls: boolean;
}

export async function setSipCredentials(payload: SipCredentialsPayload): Promise<void> {
  const { error } = await supabase.rpc('set_sip_credentials', {
    p_sip_uri: payload.sip_uri,
    p_sip_username: payload.sip_username,
    p_sip_password: payload.sip_password,
    p_sip_domain: payload.sip_domain,
    p_sip_transport: payload.sip_transport,
    p_sip_proxy: payload.sip_proxy,
    p_caller_id: payload.caller_id,
    p_record_calls: payload.record_calls,
  });
  if (error) throw error;
}
