import { uploadEmailTransferFile, invokeSendEmail } from './emailSendTransport';

const { mockUpload, mockStorageFrom, mockInvoke } = vi.hoisted(() => {
  const mockUpload = vi.fn();
  const mockStorageFrom = vi.fn(() => ({ upload: mockUpload }));
  const mockInvoke = vi.fn();
  return { mockUpload, mockStorageFrom, mockInvoke };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: { from: mockStorageFrom },
    functions: { invoke: mockInvoke },
  },
}));

describe('emailSendTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadEmailTransferFile', () => {
    it('uploade le blob dans le bucket email-transfers avec les bonnes options', async () => {
      mockUpload.mockResolvedValueOnce({ data: { path: 'dir/file.pdf' }, error: null });
      const blob = new Blob(['contenu'], { type: 'application/pdf' });

      await uploadEmailTransferFile('dir/file.pdf', blob, 'application/pdf');

      expect(mockStorageFrom).toHaveBeenCalledWith('email-transfers');
      expect(mockUpload).toHaveBeenCalledTimes(1);
      expect(mockUpload).toHaveBeenCalledWith('dir/file.pdf', blob, {
        contentType: 'application/pdf',
        upsert: false,
      });
    });

    it("lève l'erreur retournée par le storage", async () => {
      const storageError = { message: 'x' };
      mockUpload.mockResolvedValueOnce({ data: null, error: storageError });
      const blob = new Blob(['a'], { type: 'text/plain' });

      await expect(
        uploadEmailTransferFile('p/a.txt', blob, 'text/plain'),
      ).rejects.toEqual(storageError);
      expect(mockStorageFrom).toHaveBeenCalledWith('email-transfers');
    });
  });

  describe('invokeSendEmail', () => {
    const payload = {
      account_id: 'acc-1',
      user_id: 'u1',
      to: 'dest@example.com',
      cc: 'copie@example.com',
      subject: 'Sujet test',
      html_body: '<p>Bonjour</p>',
    };

    it('invoque la fonction send-email avec le payload et retourne le résultat', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { smtp_sent: true, db_stored: true },
        error: null,
      });

      const result = await invokeSendEmail(payload);

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('send-email', { body: payload });
      expect(result.smtp_sent).toBe(true);
      expect(result.db_stored).toBe(true);
    });

    it('retourne un objet vide si data est null et pas d\'erreur', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: null });

      const result = await invokeSendEmail(payload);

      expect(result).toEqual({});
    });

    it("lève l'erreur si error présent et smtp_sent absent", async () => {
      const fnError = { message: 'x' };
      mockInvoke.mockResolvedValueOnce({ data: null, error: fnError });

      await expect(invokeSendEmail(payload)).rejects.toEqual(fnError);
    });

    it("ne lève PAS si error présent mais smtp_sent=true (envoi SMTP réussi)", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { smtp_sent: true, db_stored: false },
        error: { message: 'db write failed' },
      });

      const result = await invokeSendEmail(payload);

      expect(result.smtp_sent).toBe(true);
      expect(result.db_stored).toBe(false);
    });

    it("lève si error présent et smtp_sent=false", async () => {
      const fnError = { message: 'smtp down' };
      mockInvoke.mockResolvedValueOnce({
        data: { smtp_sent: false },
        error: fnError,
      });

      await expect(invokeSendEmail(payload)).rejects.toEqual(fnError);
    });
  });
});