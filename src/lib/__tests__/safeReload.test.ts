import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock safeStorage so we can drive the guards deterministically
vi.mock('@/lib/safeStorage', () => {
  const store = new Map<string, string>();
  return {
    safeStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      __store: store,
    },
  };
});

vi.mock('@/lib/debug', () => ({
  debug: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
}));

import { safeReload } from '../safeReload';
import { safeStorage } from '@/lib/safeStorage';

const store = (safeStorage as unknown as { __store: Map<string, string> }).__store;

describe('safeReload', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    store.clear();
    reloadSpy = vi.fn();
    originalLocation = window.location;
    // Replace location with a stub that captures reload() calls without actually reloading jsdom
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('reloads when no guards are active', () => {
    const result = safeReload('test');
    expect(result.reloaded).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('is blocked when an email compose is dirty', () => {
    store.set('email-compose-dirty', '1');
    const result = safeReload('test');
    expect(result.reloaded).toBe(false);
    expect(result.reason).toBe('email-dirty');
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('is blocked when a jarvis task is active', () => {
    store.set('jarvis-task-active', '1');
    const result = safeReload('test');
    expect(result.reloaded).toBe(false);
    expect(result.reason).toBe('jarvis-task');
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('is blocked when the user is editing (flag + recent input)', () => {
    store.set('app-editing-active', '1');
    store.set('app-last-input-at', String(Date.now()));
    const result = safeReload('test');
    expect(result.reloaded).toBe(false);
    expect(result.reason).toBe('editing');
  });

  it('is throttled when called twice in quick succession', () => {
    const first = safeReload('first');
    expect(first.reloaded).toBe(true);
    const second = safeReload('second');
    expect(second.reloaded).toBe(false);
    expect(second.reason).toBe('throttled');
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('force=true bypasses all guards', () => {
    store.set('email-compose-dirty', '1');
    store.set('jarvis-task-active', '1');
    const result = safeReload('forced', { force: true });
    expect(result.reloaded).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('records last-reload timestamp for throttle', () => {
    safeReload('test');
    expect(store.get('app-last-safe-reload-at')).toMatch(/^\d+$/);
  });
});
