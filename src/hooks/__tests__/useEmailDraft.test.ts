import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { supabase } from '@/integrations/supabase/client';

const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'draft-1' }, error: null });
const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
const mockDeleteFn = vi.fn().mockReturnValue({ eq: mockDeleteEq });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDeleteFn,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'draft-1', subject: 'Test' }, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'draft-1', subject: 'Test' }, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
}));

describe('useEmailDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should initialize with null draftId and not saving', async () => {
    const { useEmailDraft } = await import('@/hooks/email/useEmailDraft');
    const { result } = renderHook(() => useEmailDraft('account-1'));

    expect(result.current.draftId).toBeNull();
    expect(result.current.isSaving).toBe(false);
  });

  it('should provide saveDraft, deleteDraft, loadDraft', async () => {
    const { useEmailDraft } = await import('@/hooks/email/useEmailDraft');
    const { result } = renderHook(() => useEmailDraft('account-1'));

    expect(typeof result.current.saveDraft).toBe('function');
    expect(typeof result.current.deleteDraft).toBe('function');
    expect(typeof result.current.loadDraft).toBe('function');
  });

  it('saveDraft should skip when all fields empty', async () => {
    const { useEmailDraft } = await import('@/hooks/email/useEmailDraft');
    const { result } = renderHook(() => useEmailDraft('account-1'));

    await act(async () => {
      await result.current.saveDraft({
        to_addresses: '',
        cc_addresses: '',
        bcc_addresses: '',
        subject: '',
        body: '',
        attachments: [],
      }, 'user-1');
    });

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('saveDraft should skip without userId', async () => {
    const { useEmailDraft } = await import('@/hooks/email/useEmailDraft');
    const { result } = renderHook(() => useEmailDraft('account-1'));

    await act(async () => {
      await result.current.saveDraft({
        to_addresses: 'test@test.com',
        cc_addresses: '',
        bcc_addresses: '',
        subject: 'Test',
        body: 'Body',
        attachments: [],
      });
    });

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('loadDraft should return data', async () => {
    const { useEmailDraft } = await import('@/hooks/email/useEmailDraft');
    const { result } = renderHook(() => useEmailDraft('account-1'));

    let data: any;
    await act(async () => {
      data = await result.current.loadDraft('draft-1');
    });

    expect(data).toBeDefined();
  });
});
