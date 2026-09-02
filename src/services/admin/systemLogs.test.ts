const { AI_ROWS, EMAIL_ROWS, mockFrom, createBuilder } = vi.hoisted(() => {
  const AI_ROWS = [
    {
      id: 'ai-1',
      processed_at: '2024-06-01T10:00:00Z',
      processing_type: 'summary',
      error_message: 'timeout',
      processing_duration_ms: 1200,
      model_used: 'gpt-4o',
      success: false,
      processed_by: 'worker-1',
      context_type: 'email',
    },
    {
      id: 'ai-2',
      processed_at: '2024-06-01T09:00:00Z',
      processing_type: 'classification',
      error_message: 'rate limit',
      processing_duration_ms: 300,
      model_used: 'gpt-4o-mini',
      success: false,
      processed_by: null,
      context_type: null,
    },
  ];
  const EMAIL_ROWS = [
    {
      id: 'sync-1',
      execution_start: '2024-06-02T08:00:00Z',
      execution_end: '2024-06-02T08:01:00Z',
      error_details: { code: 'IMAP_FAIL' },
      status: 'error',
      emails_fetched: 0,
    },
  ];
  const createBuilder = (result: { data: unknown; error: unknown }) => {
    const builder: Record<string, unknown> = {};
    const methods = [
      'select',
      'eq',
      'neq',
      'gte',
      'lte',
      'in',
      'order',
      'limit',
      'insert',
      'update',
      'delete',
      'range',
    ];
    for (const m of methods) {
      builder[m] = vi.fn(() => builder);
    }
    builder.single = vi.fn(() => Promise.resolve(result));
    builder.maybeSingle = vi.fn(() => Promise.resolve(result));
    builder.then = (
      onFulfilled?: (value: typeof result) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    builder.catch = (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected);
    return builder;
  };
  const mockFrom = vi.fn();
  return { AI_ROWS, EMAIL_ROWS, mockFrom, createBuilder };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: { from: mockFrom },
}));

import { fetchAiProcessingErrors, fetchEmailSyncErrors } from './systemLogs';

describe('systemLogs', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  describe('fetchAiProcessingErrors', () => {
    it('retourne les erreurs IA avec les bons filtres', async () => {
      const builder = createBuilder({ data: AI_ROWS, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await fetchAiProcessingErrors('2024-06-01T00:00:00Z');

      expect(mockFrom).toHaveBeenCalledWith('ai_processing_log');
      expect(builder.select).toHaveBeenCalledWith(
        'id, processed_at, processing_type, error_message, processing_duration_ms, model_used, success, processed_by, context_type',
      );
      expect(builder.eq).toHaveBeenCalledWith('success', false);
      expect(builder.gte).toHaveBeenCalledWith('processed_at', '2024-06-01T00:00:00Z');
      expect(builder.order).toHaveBeenCalledWith('processed_at', { ascending: false });
      expect(builder.limit).toHaveBeenCalledWith(300);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('ai-1');
      expect(result[0].error_message).toBe('timeout');
      expect(result[0].model_used).toBe('gpt-4o');
      expect(result[1].processing_type).toBe('classification');
      expect(result[1].processed_by).toBeNull();
    });

    it('retourne un tableau vide quand data est null', async () => {
      mockFrom.mockReturnValue(createBuilder({ data: null, error: null }));

      const result = await fetchAiProcessingErrors('2024-06-01T00:00:00Z');

      expect(result).toEqual([]);
    });

    it('lève une erreur quand supabase renvoie une erreur', async () => {
      mockFrom.mockReturnValue(createBuilder({ data: null, error: { message: 'x' } }));

      await expect(fetchAiProcessingErrors('2024-06-01T00:00:00Z')).rejects.toEqual({
        message: 'x',
      });
    });
  });

  describe('fetchEmailSyncErrors', () => {
    it('retourne les erreurs de sync email avec les bons filtres', async () => {
      const builder = createBuilder({ data: EMAIL_ROWS, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await fetchEmailSyncErrors('2024-06-02T00:00:00Z');

      expect(mockFrom).toHaveBeenCalledWith('email_sync_logs');
      expect(builder.select).toHaveBeenCalledWith(
        'id, execution_start, execution_end, error_details, status, emails_fetched',
      );
      expect(builder.eq).toHaveBeenCalledWith('status', 'error');
      expect(builder.gte).toHaveBeenCalledWith('execution_start', '2024-06-02T00:00:00Z');
      expect(builder.order).toHaveBeenCalledWith('execution_start', { ascending: false });
      expect(builder.limit).toHaveBeenCalledWith(300);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sync-1');
      expect(result[0].status).toBe('error');
      expect(result[0].emails_fetched).toBe(0);
      expect(result[0].error_details).toEqual({ code: 'IMAP_FAIL' });
    });

    it('retourne un tableau vide quand data est null', async () => {
      mockFrom.mockReturnValue(createBuilder({ data: null, error: null }));

      const result = await fetchEmailSyncErrors('2024-06-02T00:00:00Z');

      expect(result).toEqual([]);
    });

    it('lève une erreur quand supabase renvoie une erreur', async () => {
      mockFrom.mockReturnValue(createBuilder({ data: null, error: { message: 'x' } }));

      await expect(fetchEmailSyncErrors('2024-06-02T00:00:00Z')).rejects.toEqual({
        message: 'x',
      });
    });
  });
});