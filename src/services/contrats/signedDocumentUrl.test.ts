/// <reference types="vitest" />
import { describe, it, expect, vi } from 'vitest';
import { createContratSignedUrl } from './signedDocumentUrl';

const {
  SIGNED_URL,
  stableSupabase,
  mockStorageFrom,
  mockCreateSignedUrl,
} = vi.hoisted(() => {
  const SIGNED_URL = 'https://example.test/signed-url';

  const mockCreateSignedUrl = vi.fn<
    (path: string, expiresInSec: number) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>
  >();

  const mockStorageFrom = vi.fn((bucket: string) => ({
    createSignedUrl: mockCreateSignedUrl,
    bucket,
  }));

  const stableSupabase = {
    storage: {
      from: mockStorageFrom,
    },
  };

  return { SIGNED_URL, stableSupabase, mockStorageFrom, mockCreateSignedUrl };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: stableSupabase,
}));

describe('signedDocumentUrl.ts - createContratSignedUrl', () => {
  it('appelle supabase.storage.from("contrats").createSignedUrl avec les args et retourne signedUrl (succès)', async () => {
    mockCreateSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: SIGNED_URL },
      error: null,
    });

    const path = 'docs/contrat-1.pdf';
    const result = await createContratSignedUrl(path);

    expect(mockStorageFrom).toHaveBeenCalledTimes(1);
    expect(mockStorageFrom).toHaveBeenCalledWith('contrats');

    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(path, 300);

    expect(result).toBe(SIGNED_URL);
  });

  it('utilise expiresInSec fourni', async () => {
    mockCreateSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: SIGNED_URL },
      error: null,
    });

    const path = 'docs/contrat-2.pdf';
    const expiresInSec = 120;

    const result = await createContratSignedUrl(path, expiresInSec);

    expect(mockStorageFrom).toHaveBeenCalledWith('contrats');
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(path, expiresInSec);
    expect(result).toBe(SIGNED_URL);
  });

  it("rejette quand supabase renvoie une erreur ({ data:null, error:{ message:'x' } })", async () => {
    const err = { message: 'x' };
    mockCreateSignedUrl.mockResolvedValueOnce({
      data: null,
      error: err,
    });

    await expect(createContratSignedUrl('docs/contrat-err.pdf')).rejects.toEqual(err);
  });
});