import { useEffect } from 'react';
import { safeStorage } from '@/lib/safeStorage';

const EDITING_FLAG = 'app-editing-active';
const LAST_INPUT_KEY = 'app-last-input-at';
/** If user typed within the last 2 minutes, consider editing active */
const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

/**
 * Global guard: tracks user input activity across the app.
 * Sets a localStorage flag that pre-boot scripts (index.html) can read
 * to avoid destructive auto-reloads while the user is typing.
 *
 * Mount this ONCE at app root level (e.g. in App.tsx).
 */
export function useActiveEditingGuard() {
  useEffect(() => {
    function markActive() {
      const now = String(Date.now());
      safeStorage.setItem(LAST_INPUT_KEY, now);
      safeStorage.setItem(EDITING_FLAG, '1');
    }

    function clearIfStale() {
      const last = parseInt(safeStorage.getItem(LAST_INPUT_KEY) || '0', 10);
      if (Date.now() - last > ACTIVE_WINDOW_MS) {
        safeStorage.removeItem(EDITING_FLAG);
      }
    }

    // Listen on capture phase to catch all inputs
    const events = ['input', 'keydown', 'compositionstart', 'beforeinput'] as const;
    const safeClosest = (el: unknown, selector: string): Element | null => {
      if (!(el instanceof Element)) return null;
      try {
        return typeof el.closest === 'function' ? el.closest(selector) : null;
      } catch {
        return null;
      }
    };

    const handler = (e: Event) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const tag = target.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
        target.isContentEditable || !!safeClosest(target, '[contenteditable="true"]');
      if (isEditable) {
        markActive();
      }
    };

    // selectionchange catches caret movement inside contenteditable (Tiptap/ProseMirror)
    const selectionHandler = () => {
      const sel = document.getSelection();
      const node = sel?.anchorNode as Node | null;
      if (!node) return;
      const el = (node.nodeType === 1 ? (node as Element) : node.parentElement);
      if (!el) return;
      const isEditable = (el instanceof HTMLElement && el.isContentEditable) ||
        !!safeClosest(el, '[contenteditable="true"]');
      if (isEditable) {
        markActive();
      }
    };

    events.forEach(evt => document.addEventListener(evt, handler, { capture: true, passive: true }));
    document.addEventListener('selectionchange', selectionHandler, { passive: true });

    // Periodically clear stale flag
    const interval = setInterval(clearIfStale, 30_000);

    // Cleanup on unmount
    return () => {
      events.forEach(evt => document.removeEventListener(evt, handler, true));
      document.removeEventListener('selectionchange', selectionHandler);
      clearInterval(interval);
      safeStorage.removeItem(EDITING_FLAG);
    };
  }, []);
}
