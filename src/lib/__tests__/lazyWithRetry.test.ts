import { describe, it, expect, vi, beforeEach } from 'vitest';

const { safeReloadMock, isPreviewContextMock } = vi.hoisted(() => ({
  safeReloadMock: vi.fn(() => ({ reloaded: false as const })),
  isPreviewContextMock: vi.fn(() => true),
}));
vi.mock('@/lib/safeReload', () => ({ safeReload: safeReloadMock }));
vi.mock('@/lib/isPreviewContext', () => ({ isPreviewContext: isPreviewContextMock }));
vi.mock('@/lib/debug', () => ({ debug: { warn: vi.fn(), log: vi.fn(), error: vi.fn() } }));

// React.lazy stores the factory inside `_payload._result` while
// `_payload._status === -1` (uninitialized). We grab that factory to drive
// the retry logic deterministically without rendering React.
type LazyInternals = {
  _payload: { _status: number; _result: () => Promise<{ default: unknown }> };
};

describe('lazyWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPreviewContextMock.mockReturnValue(true);
  });

  it('resolves on the first attempt when import succeeds', async () => {
    const { lazyWithRetry } = await import('../lazyWithRetry');
    const Component = () => null;
    const importFn = vi.fn().mockResolvedValue({ default: Component });
    const lazy = lazyWithRetry(importFn) as unknown as LazyInternals;
    const result = await lazy._payload._result();
    expect(result.default).toBe(Component);
    expect(importFn).toHaveBeenCalledTimes(1);
    expect(safeReloadMock).not.toHaveBeenCalled();
  });

  it('retries on transient failure then succeeds', async () => {
    const { lazyWithRetry } = await import('../lazyWithRetry');
    const Component = () => null;
    let attempts = 0;
    const importFn = vi.fn(() => {
      attempts++;
      return attempts < 2
        ? Promise.reject(new Error('chunk load fail'))
        : Promise.resolve({ default: Component });
    });
    const lazy = lazyWithRetry(importFn, 2, 0) as unknown as LazyInternals;
    const result = await lazy._payload._result();
    expect(result.default).toBe(Component);
    expect(importFn).toHaveBeenCalledTimes(2);
    expect(safeReloadMock).not.toHaveBeenCalled();
  });

  it('triggers safeReload and throws when retries are exhausted', async () => {
    isPreviewContextMock.mockReturnValue(false);
    const { lazyWithRetry } = await import('../lazyWithRetry');
    const importFn = vi.fn().mockRejectedValue(new Error('chunk gone'));
    const lazy = lazyWithRetry(importFn, 1, 0) as unknown as LazyInternals;
    await expect(lazy._payload._result()).rejects.toThrow('chunk gone');
    // Initial call + 1 retry = 2 attempts before safeReload
    expect(importFn).toHaveBeenCalledTimes(2);
    expect(safeReloadMock).toHaveBeenCalledWith('lazyWithRetry');
  });

  it('returns a React lazy component (object with _payload)', async () => {
    const { lazyWithRetry } = await import('../lazyWithRetry');
    const importFn = vi.fn().mockResolvedValue({ default: () => null });
    const lazy = lazyWithRetry(importFn) as unknown as LazyInternals;
    expect(lazy).toBeDefined();
    expect(lazy._payload).toBeDefined();
    expect(typeof lazy._payload._result).toBe('function');
  });
});
