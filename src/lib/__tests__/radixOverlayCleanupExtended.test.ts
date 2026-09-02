import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hasOpenDialog,
  isBodyLocked,
  cleanupRadixUIState,
  cleanupRadixUIStateDelayed,
  createRadixWatchdog,
} from '../dom/radixOverlayCleanup';

describe('radixOverlayCleanup extended', () => {
  beforeEach(() => {
    document.body.removeAttribute('data-scroll-locked');
    document.body.style.pointerEvents = '';
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.documentElement.style.pointerEvents = '';
    // Clean portals
    document.querySelectorAll('[data-radix-portal]').forEach(el => el.remove());
    document.querySelectorAll('[data-radix-focus-guard]').forEach(el => el.remove());
  });

  it('isBodyLocked detects data-scroll-locked', () => {
    document.body.setAttribute('data-scroll-locked', '1');
    expect(isBodyLocked()).toBe(true);
  });

  it('isBodyLocked detects pointerEvents none', () => {
    document.body.style.pointerEvents = 'none';
    expect(isBodyLocked()).toBe(true);
  });

  it('isBodyLocked detects overflow hidden on body', () => {
    document.body.style.overflow = 'hidden';
    expect(isBodyLocked()).toBe(true);
  });

  it('isBodyLocked detects overflow hidden on html', () => {
    document.documentElement.style.overflow = 'hidden';
    expect(isBodyLocked()).toBe(true);
  });

  it('cleanupRadixUIState removes scroll lock', () => {
    document.body.setAttribute('data-scroll-locked', '1');
    cleanupRadixUIState();
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
  });

  it('cleanupRadixUIState removes pointerEvents', () => {
    document.body.style.pointerEvents = 'none';
    cleanupRadixUIState();
    expect(document.body.style.pointerEvents).toBe('');
  });

  it('cleanupRadixUIState removes overflow', () => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    cleanupRadixUIState();
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('cleanupRadixUIState skips when dialog is open', () => {
    const div = document.createElement('div');
    div.setAttribute('role', 'dialog');
    div.setAttribute('data-state', 'open');
    document.body.appendChild(div);
    document.body.setAttribute('data-scroll-locked', '1');
    cleanupRadixUIState();
    // Should NOT clean because dialog is open
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(true);
    div.remove();
  });

  it('cleanupRadixUIState aggressive cleans even with dialog', () => {
    const div = document.createElement('div');
    div.setAttribute('role', 'dialog');
    div.setAttribute('data-state', 'open');
    document.body.appendChild(div);
    document.body.setAttribute('data-scroll-locked', '1');
    cleanupRadixUIState({ aggressive: true });
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
    div.remove();
  });

  it('aggressive mode removes orphan portals', () => {
    const portal = document.createElement('div');
    portal.setAttribute('data-radix-portal', '');
    document.body.appendChild(portal);
    cleanupRadixUIState({ aggressive: true });
    expect(document.querySelectorAll('[data-radix-portal]').length).toBe(0);
  });

  it('aggressive mode removes focus guards', () => {
    const guard = document.createElement('span');
    guard.setAttribute('data-radix-focus-guard', '');
    document.body.appendChild(guard);
    cleanupRadixUIState({ aggressive: true });
    expect(document.querySelectorAll('[data-radix-focus-guard]').length).toBe(0);
  });

  it('cleanupRadixUIStateDelayed runs cleanup', () => {
    document.body.setAttribute('data-scroll-locked', '1');
    cleanupRadixUIStateDelayed();
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
  });

  it('createRadixWatchdog returns cleanup fn', () => {
    const cleanup = createRadixWatchdog(1000);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('watchdog auto-cleans orphan locks', () => {
    vi.useFakeTimers();
    document.body.setAttribute('data-scroll-locked', '1');
    const cleanup = createRadixWatchdog(100);
    vi.advanceTimersByTime(150);
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
    cleanup();
    vi.useRealTimers();
  });
});
