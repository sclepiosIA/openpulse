import { describe, it, expect } from 'vitest';
import { safeAsync, safeAsyncNull, withTimeout, retryAsync } from '../safeAsync';

describe('safeAsync', () => {
  it('success returns data', async () => {
    const r = await safeAsync(Promise.resolve(42), 'T');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(42);
  });

  it('failure wraps error', async () => {
    const r = await safeAsync(Promise.reject(new Error('boom')), 'T');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.message).toBe('boom');
  });

  it('failure wraps non-Error', async () => {
    const r = await safeAsync(Promise.reject('str'), 'T');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBeInstanceOf(Error);
  });

  it('safeAsyncNull returns data or null', async () => {
    expect(await safeAsyncNull(Promise.resolve(1), 'T')).toBe(1);
    expect(await safeAsyncNull(Promise.reject('x'), 'T')).toBeNull();
  });
});

describe('withTimeout', () => {
  it('resolves before timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100, 'T')).resolves.toBe('ok');
  });

  it('rejects after timeout', async () => {
    const slow = new Promise(r => setTimeout(() => r('late'), 200));
    await expect(withTimeout(slow, 20, 'T')).rejects.toThrow(/Timeout/);
  });
});

describe('retryAsync', () => {
  it('returns on first success', async () => {
    let calls = 0;
    const out = await retryAsync(async () => { calls++; return 'ok'; });
    expect(out).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries then succeeds', async () => {
    let calls = 0;
    const out = await retryAsync(async () => {
      calls++;
      if (calls < 2) throw new Error('fail');
      return 'ok';
    }, { maxRetries: 3, initialDelayMs: 1 });
    expect(out).toBe('ok');
    expect(calls).toBe(2);
  });

  it('throws after exhausting retries', async () => {
    await expect(
      retryAsync(async () => { throw new Error('always'); }, { maxRetries: 1, initialDelayMs: 1 })
    ).rejects.toThrow('always');
  });
});
