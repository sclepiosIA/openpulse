import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/lib/safeStorage', () => ({
  safeStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));
vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), error: vi.fn() },
}));

import { useDraftRecovery, DraftSnapshot } from '@/hooks/email/useDraftRecovery';
import { safeStorage } from '@/lib/safeStorage';

describe('useDraftRecovery', () => {
  const defaultFields = { to: [], cc: [], bcc: [], subject: '', body: '', accountId: 'acc-1' };
  const defaultSetters = {
    setTo: vi.fn(),
    setCc: vi.fn(),
    setBcc: vi.fn(),
    setSubject: vi.fn(),
    setBody: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should restore snapshot from sessionStorage on mount', () => {
    const snap: DraftSnapshot = {
      to: ['test@example.com'],
      cc: [],
      bcc: [],
      subject: 'Test Subject',
      body: '<p>Hello</p>',
      accountId: 'acc-1',
      ts: Date.now() - 5000, // 5 seconds ago
    };
    sessionStorage.setItem('email-draft-backup', JSON.stringify(snap));

    renderHook(() => useDraftRecovery(defaultFields, defaultSetters, false));

    expect(defaultSetters.setTo).toHaveBeenCalledWith(['test@example.com']);
    expect(defaultSetters.setSubject).toHaveBeenCalledWith('Test Subject');
    expect(defaultSetters.setBody).toHaveBeenCalledWith('<p>Hello</p>');
  });

  it('should NOT restore if hasInitialData is true', () => {
    const snap: DraftSnapshot = {
      to: ['test@example.com'],
      cc: [],
      bcc: [],
      subject: 'Test',
      body: 'Hello',
      accountId: 'acc-1',
      ts: Date.now(),
    };
    sessionStorage.setItem('email-draft-backup', JSON.stringify(snap));

    renderHook(() => useDraftRecovery(defaultFields, defaultSetters, true));

    expect(defaultSetters.setTo).not.toHaveBeenCalled();
    // Should have cleared the snapshot
    expect(sessionStorage.getItem('email-draft-backup')).toBeNull();
  });

  it('should NOT restore if snapshot is older than 30 minutes', () => {
    const snap: DraftSnapshot = {
      to: ['test@example.com'],
      cc: [],
      bcc: [],
      subject: 'Old',
      body: 'Old body',
      accountId: 'acc-1',
      ts: Date.now() - 31 * 60 * 1000, // 31 min ago
    };
    sessionStorage.setItem('email-draft-backup', JSON.stringify(snap));

    renderHook(() => useDraftRecovery(defaultFields, defaultSetters, false));

    expect(defaultSetters.setTo).not.toHaveBeenCalled();
  });

  it('clearSnapshot removes sessionStorage and dirty flag', () => {
    const { result } = renderHook(() =>
      useDraftRecovery(defaultFields, defaultSetters, false)
    );

    sessionStorage.setItem('email-draft-backup', '{}');

    act(() => {
      result.current.clearSnapshot();
    });

    expect(sessionStorage.getItem('email-draft-backup')).toBeNull();
    expect(safeStorage.removeItem).toHaveBeenCalledWith('email-compose-dirty');
  });

  it('should save to sessionStorage when fields change', async () => {
    vi.useFakeTimers();

    const initialFields = { to: [] as string[], cc: [] as string[], bcc: [] as string[], subject: '', body: '', accountId: 'acc-1' };
    const updatedFields = { to: ['a@b.com'], cc: [] as string[], bcc: [] as string[], subject: 'Hi', body: 'World', accountId: 'acc-1' };

    // First render with empty fields (mountedRef becomes true)
    const { rerender } = renderHook(
      ({ fields }) => useDraftRecovery(fields, defaultSetters, false),
      { initialProps: { fields: initialFields } }
    );

    // Re-render with actual content (triggers the save effect)
    rerender({ fields: updatedFields });

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    const stored = sessionStorage.getItem('email-draft-backup');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.subject).toBe('Hi');
    expect(parsed.to).toEqual(['a@b.com']);

    vi.useRealTimers();
  });
});
