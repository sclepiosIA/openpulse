const { mockRpc, successResponse, errorResponse } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  successResponse: { data: null, error: null },
  errorResponse: { data: null, error: { message: 'x' } },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

import { setSipCredentials, type SipCredentialsPayload } from './sipCredentials';

describe('setSipCredentials', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('appelle la fonction RPC avec les champs SIP mappés et résout en succès', async () => {
    mockRpc.mockResolvedValueOnce(successResponse);

    const payload: SipCredentialsPayload = {
      sip_uri: 'sip:u@d.t',
      sip_username: 'u1',
      sip_password: 'pwd',
      sip_domain: 'd.t',
      sip_transport: 'wss',
      sip_proxy: 'wss://p.t',
      caller_id: '100',
      record_calls: true,
    };

    await expect(setSipCredentials(payload)).resolves.toBeUndefined();

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('set_sip_credentials', {
      p_sip_uri: 'sip:u@d.t',
      p_sip_username: 'u1',
      p_sip_password: 'pwd',
      p_sip_domain: 'd.t',
      p_sip_transport: 'wss',
      p_sip_proxy: 'wss://p.t',
      p_caller_id: '100',
      p_record_calls: true,
    });
  });

  it('transmet les champs optionnels absents comme undefined', async () => {
    mockRpc.mockResolvedValueOnce(successResponse);

    const payload: SipCredentialsPayload = {
      sip_uri: 'sip:a@b.c',
      sip_username: 'agent',
      sip_password: 'pw',
      sip_domain: 'b.c',
      sip_transport: 'tcp',
      record_calls: false,
    };

    await setSipCredentials(payload);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('set_sip_credentials', {
      p_sip_uri: 'sip:a@b.c',
      p_sip_username: 'agent',
      p_sip_password: 'pw',
      p_sip_domain: 'b.c',
      p_sip_transport: 'tcp',
      p_sip_proxy: undefined,
      p_caller_id: undefined,
      p_record_calls: false,
    });
  });

  it('rejette avec l’erreur renvoyée par Supabase', async () => {
    mockRpc.mockResolvedValueOnce(errorResponse);

    const payload: SipCredentialsPayload = {
      sip_uri: 'sip:e@r.t',
      sip_username: 'err',
      sip_password: 'no',
      sip_domain: 'r.t',
      sip_transport: 'udp',
      sip_proxy: 'udp://p.t',
      caller_id: '200',
      record_calls: false,
    };

    await expect(setSipCredentials(payload)).rejects.toEqual({ message: 'x' });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('set_sip_credentials', {
      p_sip_uri: 'sip:e@r.t',
      p_sip_username: 'err',
      p_sip_password: 'no',
      p_sip_domain: 'r.t',
      p_sip_transport: 'udp',
      p_sip_proxy: 'udp://p.t',
      p_caller_id: '200',
      p_record_calls: false,
    });
  });
});