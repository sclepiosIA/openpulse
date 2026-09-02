import { describe, it, expect, vi } from 'vitest';
import { fetchEmailAzureSyncStatus } from './emailAzureApi';
import type { EmailAzureSyncStatusResponse } from '@/types/emailAzure';

const validPayload: EmailAzureSyncStatusResponse = {
  backend: 'azure',
  generated_at: '2026-07-07T12:00:00Z',
  accounts: [
    {
      account_id: 'acc-1',
      email_address: 'contact@exploitant.example.org',
      provider: 'imap_smtp',
      sync_enabled: true,
      last_sync_at: '2026-07-07T11:55:00Z',
      last_error: null,
      error_count: 0,
      pending_messages: 3,
      health: 'healthy',
    },
  ],
  queue: { ai_pending: 5, unclassified: 12 },
};

function makeFetch(status: number, body: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('fetchEmailAzureSyncStatus', () => {
  it("retourne 'unconfigured' sans appel réseau si baseUrl absente", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const result = await fetchEmailAzureSyncStatus({ baseUrl: null, fetchImpl });
    expect(result).toEqual({ state: 'unconfigured' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('appelle GET {base}/api/email/sync/status et parse la réponse', async () => {
    const fetchImpl = makeFetch(200, validPayload);
    const result = await fetchEmailAzureSyncStatus({
      baseUrl: 'https://openpulse-email-api.azure.example',
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://openpulse-email-api.azure.example/api/email/sync/status',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.state).toBe('ok');
    if (result.state === 'ok') {
      expect(result.data.accounts).toHaveLength(1);
      expect(result.data.queue.ai_pending).toBe(5);
    }
  });

  it('ajoute le Bearer token uniquement si fourni', async () => {
    const fetchImpl = makeFetch(200, validPayload);
    await fetchEmailAzureSyncStatus({
      baseUrl: 'https://api.example',
      fetchImpl,
      accessToken: 'jwt-123',
    });
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-123');

    const fetchNoAuth = makeFetch(200, validPayload);
    await fetchEmailAzureSyncStatus({ baseUrl: 'https://api.example', fetchImpl: fetchNoAuth });
    const [, initNoAuth] = (fetchNoAuth as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((initNoAuth.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("retourne 'error' avec le code HTTP en cas d'échec serveur", async () => {
    const fetchImpl = makeFetch(503, { error: 'unavailable' });
    const result = await fetchEmailAzureSyncStatus({
      baseUrl: 'https://api.example',
      fetchImpl,
    });
    expect(result).toEqual({ state: 'error', message: 'HTTP 503' });
  });

  it("retourne 'error' si le payload n'a pas la forme attendue", async () => {
    const fetchImpl = makeFetch(200, { backend: 'supabase', accounts: null });
    const result = await fetchEmailAzureSyncStatus({
      baseUrl: 'https://api.example',
      fetchImpl,
    });
    expect(result.state).toBe('error');
  });

  it("retourne 'error' (sans jeter) sur une panne réseau", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const result = await fetchEmailAzureSyncStatus({
      baseUrl: 'https://api.example',
      fetchImpl,
    });
    expect(result).toEqual({ state: 'error', message: 'network down' });
  });
});
