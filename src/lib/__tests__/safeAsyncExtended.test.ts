import { describe, it, expect, vi } from 'vitest';
import { safeAsync, safeAsyncNull, withTimeout, retryAsync } from '../safeAsync';

vi.mock('../debug', () => ({
  debug: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}));

describe('safeAsync', () => {
  describe('safeAsync', () => {
    it('success', async () => {
      const result = await safeAsync(Promise.resolve(42), 'test');
      expect(result).toEqual({ success: true, data: 42, error: null });
    });
    it('failure', async () => {
      const result = await safeAsync(Promise.reject(new Error('fail')), 'test');
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('fail');
    });
    it('non-Error rejection', async () => {
      const result = await safeAsync(Promise.reject('string error'), 'test');
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('string error');
    });
  });

  describe('safeAsyncNull', () => {
    it('success → data', async () => {
      expect(await safeAsyncNull(Promise.resolve('ok'), 'test')).toBe('ok');
    });
    it('failure → null', async () => {
      expect(await safeAsyncNull(Promise.reject(new Error('x')), 'test')).toBeNull();
    });
  });

  describe('withTimeout', () => {
    it('resolves before timeout', async () => {
      const result = await withTimeout(Promise.resolve('fast'), 1000, 'test');
      expect(result).toBe('fast');
    });
    it('rejects on timeout', async () => {
      const slow = new Promise(resolve => setTimeout(resolve, 5000));
      await expect(withTimeout(slow, 50, 'test')).rejects.toThrow('Timeout');
    });
  });

  describe('retryAsync', () => {
    it('succeeds first try', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      expect(await retryAsync(fn, { maxRetries: 2, context: 'test' })).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });
    it('retries then succeeds', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail1'))
        .mockResolvedValueOnce('ok');
      const result = await retryAsync(fn, { maxRetries: 2, initialDelayMs: 10, context: 'test' });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });
    it('exhausts retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));
      await expect(retryAsync(fn, { maxRetries: 1, initialDelayMs: 10, context: 'test' })).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
