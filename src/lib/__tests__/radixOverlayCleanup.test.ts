import { describe, it, expect, beforeEach } from 'vitest';
import { hasOpenDialog, isBodyLocked, cleanupRadixUIState } from '../dom/radixOverlayCleanup';

describe('radixOverlayCleanup', () => {
  beforeEach(() => {
    document.body.removeAttribute('data-scroll-locked');
    document.body.style.pointerEvents = '';
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.documentElement.style.pointerEvents = '';
  });

  describe('hasOpenDialog', () => {
    it('false when no dialog', () => expect(hasOpenDialog()).toBe(false));
    it('true when dialog open', () => {
      const div = document.createElement('div');
      div.setAttribute('role', 'dialog');
      div.setAttribute('data-state', 'open');
      document.body.appendChild(div);
      expect(hasOpenDialog()).toBe(true);
      div.remove();
    });
  });

  describe('isBodyLocked', () => {
    it('false by default', () => expect(isBodyLocked()).toBe(false));
    it('true with scroll-locked', () => {
      document.body.setAttribute('data-scroll-locked', '1');
      expect(isBodyLocked()).toBe(true);
    });
    it('true with pointer-events none', () => {
      document.body.style.pointerEvents = 'none';
      expect(isBodyLocked()).toBe(true);
    });
    it('true with overflow hidden on body', () => {
      document.body.style.overflow = 'hidden';
      expect(isBodyLocked()).toBe(true);
    });
  });

  describe('cleanupRadixUIState', () => {
    it('removes scroll-locked', () => {
      document.body.setAttribute('data-scroll-locked', '1');
      cleanupRadixUIState();
      expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
    });
    it('resets pointer-events', () => {
      document.body.style.pointerEvents = 'none';
      cleanupRadixUIState();
      expect(document.body.style.pointerEvents).toBe('');
    });
    it('resets overflow', () => {
      document.body.style.overflow = 'hidden';
      cleanupRadixUIState();
      expect(document.body.style.overflow).toBe('');
    });
    it('skips cleanup if dialog is open (non-aggressive)', () => {
      const div = document.createElement('div');
      div.setAttribute('role', 'dialog');
      div.setAttribute('data-state', 'open');
      document.body.appendChild(div);
      document.body.setAttribute('data-scroll-locked', '1');
      cleanupRadixUIState();
      expect(document.body.hasAttribute('data-scroll-locked')).toBe(true);
      div.remove();
    });
    it('cleans even with dialog in aggressive mode', () => {
      const div = document.createElement('div');
      div.setAttribute('role', 'dialog');
      div.setAttribute('data-state', 'open');
      document.body.appendChild(div);
      document.body.setAttribute('data-scroll-locked', '1');
      cleanupRadixUIState({ aggressive: true });
      expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
      div.remove();
    });
  });
});
