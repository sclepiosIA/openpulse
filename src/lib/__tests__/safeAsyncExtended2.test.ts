import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeAsync, safeAsyncNull, withTimeout, retryAsync } from '../safeAsync';

vi.mock('../debug', () => ({
  debug: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}));

describe('safeAsync extended2', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  describe('safeAsync edge cases', () => {
    it('handles undefined resolution', async () => {
      vi.useRealTimers();
      const result = await safeAsync(Promise.resolve(undefined), 'test');
      expect(result).toEqual({ success: true, data: undefined, error: null });
    });

    it('handles null resolution', async () => {
      vi.useRealTimers();
      const result = await safeAsync(Promise.resolve(null), 'test');
      expect(result).toEqual({ success: true, data: null, error: null });
    });

    it('handles numeric rejection', async () => {
      vi.useRealTimers();
      const result = await safeAsync(Promise.reject(42), 'test');
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('42');
    });

    it('handles object rejection', async () => {
      vi.useRealTimers();
      const result = await safeAsync(Promise.reject({ code: 'ERR' }), 'test');
      expect(result.success).toBe(false);
    });
  });

  describe('safeAsyncNull edge cases', () => {
    it('resolves with falsy value', async () => {
      vi.useRealTimers();
      expect(await safeAsyncNull(Promise.resolve(0), 'test')).toBe(0);
    });

    it('resolves with empty string', async () => {
      vi.useRealTimers();
      expect(await safeAsyncNull(Promise.resolve(''), 'test')).toBe('');
    });
  });

  describe('retryAsync with exponential backoff', () => {
    it('respects maxDelayMs', async () => {
      vi.useRealTimers();
      let attempts = 0;
      const fn = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) throw new Error('fail');
        return 'ok';
      });

      const result = await retryAsync(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 20,
        context: 'test',
      });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('uses defaults when no options', async () => {
      vi.useRealTimers();
      const fn = vi.fn().mockResolvedValue('ok');
      const result = await retryAsync(fn);
      expect(result).toBe('ok');
    });
  });

  describe('withTimeout edge cases', () => {
    it('rejects on timeout with context', async () => {
      vi.useRealTimers();
      const slow = new Promise(resolve => setTimeout(resolve, 5000));
      await expect(withTimeout(slow, 10, 'MyOp')).rejects.toThrow('[MyOp] Timeout');
    });

    it('passes through rejection', async () => {
      vi.useRealTimers();
      const failing = Promise.reject(new Error('inner fail'));
      await expect(withTimeout(failing, 1000, 'test')).rejects.toThrow('inner fail');
    });
  });
});
