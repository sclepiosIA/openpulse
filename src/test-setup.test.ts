import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('test-setup', () => {
  const originalResizeObserver = globalThis.ResizeObserver;
  const originalScrollIntoView = Element.prototype.scrollIntoView;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    if (originalResizeObserver) {
      globalThis.ResizeObserver = originalResizeObserver;
    } else {
      delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    }

    if (originalScrollIntoView) {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    } else {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it('ajoute ResizeObserver si absent', async () => {
    expect(globalThis.ResizeObserver).toBeUndefined();

    await import('./test-setup');

    expect(globalThis.ResizeObserver).toBeTypeOf('function');

    const observer = new globalThis.ResizeObserver();
    expect(observer.observe).toBeTypeOf('function');
    expect(observer.unobserve).toBeTypeOf('function');
    expect(observer.disconnect).toBeTypeOf('function');
    expect(() => observer.observe()).not.toThrow();
    expect(() => observer.unobserve()).not.toThrow();
    expect(() => observer.disconnect()).not.toThrow();
  });

  it('ne remplace pas ResizeObserver existant', async () => {
    const ExistingResizeObserver = class {
      observe() {
        return 'keep';
      }
      unobserve() {
        return 'keep';
      }
      disconnect() {
        return 'keep';
      }
    };

    globalThis.ResizeObserver = ExistingResizeObserver;

    await import('./test-setup');

    expect(globalThis.ResizeObserver).toBe(ExistingResizeObserver);
  });

  it('ajoute scrollIntoView si absent', async () => {
    expect(Element.prototype.scrollIntoView).toBeUndefined();

    await import('./test-setup');

    expect(Element.prototype.scrollIntoView).toBeTypeOf('function');

    const element = document.createElement('div');
    expect(() => element.scrollIntoView()).not.toThrow();
  });

  it('ne remplace pas scrollIntoView existant', async () => {
    const existingScrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = existingScrollIntoView;

    await import('./test-setup');

    expect(Element.prototype.scrollIntoView).toBe(existingScrollIntoView);
  });

  it('définit matchMedia avec les valeurs attendues', async () => {
    expect(window.matchMedia).toBeUndefined();

    await import('./test-setup');

    expect(window.matchMedia).toBeTypeOf('function');

    const result = window.matchMedia('(min-width: 768px)');

    expect(result.matches).toBe(false);
    expect(result.media).toBe('(min-width: 768px)');
    expect(result.onchange).toBeNull();
    expect(result.addListener).toBeTypeOf('function');
    expect(result.removeListener).toBeTypeOf('function');
    expect(result.addEventListener).toBeTypeOf('function');
    expect(result.removeEventListener).toBeTypeOf('function');
    expect(result.dispatchEvent).toBeTypeOf('function');
    expect(result.dispatchEvent(new Event('change'))).toBe(false);
  });

  it('remplace matchMedia existant par le polyfill défini', async () => {
    const previousMatchMedia = vi.fn(() => ({
      matches: true,
      media: 'old',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    }));

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: previousMatchMedia,
    });

    await import('./test-setup');

    expect(window.matchMedia).not.toBe(previousMatchMedia);

    const result = window.matchMedia('(max-width: 640px)');
    expect(result.matches).toBe(false);
    expect(result.media).toBe('(max-width: 640px)');
    expect(result.dispatchEvent(new Event('change'))).toBe(false);
  });
});