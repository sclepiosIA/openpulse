const { mockFrom, mockUpsert, mockDelete, mockEq } = vi.hoisted(() => {
  const mockUpsert = vi.fn();
  const mockEq = vi.fn();
  const mockDelete = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ upsert: mockUpsert, delete: mockDelete }));
  return { mockFrom, mockUpsert, mockDelete, mockEq };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: { from: mockFrom },
}));

import { upsertEmailDraft, deleteEmailDraft, type EmailDraftUpsertPayload } from './emailDrafts';

describe('emailDrafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ data: null, error: null });
    mockEq.mockResolvedValue({ data: null, error: null });
  });

  describe('upsertEmailDraft', () => {
    const payload: EmailDraftUpsertPayload = {
      id: 'draft-1',
      account_id: 'acc-1',
      to: 'dest@example.com',
      cc: null,
      subject: 'Sujet test',
      body: 'Corps du brouillon',
      user_id: 'u1',
    };

    it('appelle supabase.from("email_drafts").upsert avec le payload complet', async () => {
      await upsertEmailDraft(payload);

      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('email_drafts');
      expect(mockUpsert).toHaveBeenCalledTimes(1);
      expect(mockUpsert).toHaveBeenCalledWith(payload);
    });

    it('résout sans valeur en cas de succès', async () => {
      await expect(upsertEmailDraft(payload)).resolves.toBeUndefined();
    });

    it('lève l\'erreur retournée par supabase', async () => {
      mockUpsert.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

      await expect(upsertEmailDraft(payload)).rejects.toEqual({ message: 'x' });
      expect(mockUpsert).toHaveBeenCalledWith(payload);
    });

    it('accepte un payload minimal sans id ni destinataires', async () => {
      const minimal: EmailDraftUpsertPayload = {
        account_id: 'acc-2',
        subject: null,
        body: null,
        user_id: 'u2',
      };

      await upsertEmailDraft(minimal);

      expect(mockUpsert).toHaveBeenCalledWith(minimal);
      expect(mockUpsert.mock.calls[0][0]).not.toHaveProperty('id');
    });
  });

  describe('deleteEmailDraft', () => {
    it('appelle delete().eq("id", id) sur la table email_drafts', async () => {
      await deleteEmailDraft('draft-42');

      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('email_drafts');
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockEq).toHaveBeenCalledTimes(1);
      expect(mockEq).toHaveBeenCalledWith('id', 'draft-42');
    });

    it('résout sans valeur en cas de succès', async () => {
      await expect(deleteEmailDraft('draft-1')).resolves.toBeUndefined();
    });

    it('ne lève pas même si supabase renvoie une erreur (erreur ignorée par le module)', async () => {
      mockEq.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

      await expect(deleteEmailDraft('draft-err')).resolves.toBeUndefined();
      expect(mockEq).toHaveBeenCalledWith('id', 'draft-err');
    });
  });
});