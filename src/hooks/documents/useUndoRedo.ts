/**
 * useUndoRedo — pile d'historique générique pour l'état d'un éditeur.
 *
 * Office-parity : Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z). Snapshots par égalité
 * référentielle, plafond `capacity` pour éviter les fuites mémoire.
 *
 * Utilisation :
 *   const { state, set, replace, undo, redo, canUndo, canRedo } = useUndoRedo(initial);
 *   - `set(next)`  : pousse un nouvel état dans l'historique.
 *   - `replace(next)` : remplace le HEAD sans créer d'entrée (ex. drag continu).
 */
import { useCallback, useRef, useState } from 'react';

export interface UndoRedoApi<T> {
  state: T;
  set: (next: T | ((prev: T) => T)) => void;
  replace: (next: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (next: T) => void;
}

export function useUndoRedo<T>(initial: T, capacity = 100): UndoRedoApi<T> {
  const [state, setState] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((prev) => {
        const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        if (Object.is(value, prev)) return prev;
        past.current.push(prev);
        if (past.current.length > capacity) past.current.shift();
        future.current = [];
        return value;
      });
      rerender();
    },
    [capacity, rerender],
  );

  const replace = useCallback((next: T | ((prev: T) => T)) => {
    setState((prev) => {
      const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      return Object.is(value, prev) ? prev : value;
    });
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      const prevState = past.current.pop();
      if (prevState === undefined) return prev;
      future.current.push(prev);
      return prevState;
    });
    rerender();
  }, [rerender]);

  const redo = useCallback(() => {
    setState((prev) => {
      const nextState = future.current.pop();
      if (nextState === undefined) return prev;
      past.current.push(prev);
      return nextState;
    });
    rerender();
  }, [rerender]);

  const reset = useCallback((next: T) => {
    past.current = [];
    future.current = [];
    setState(next);
    rerender();
  }, [rerender]);

  return {
    state,
    set,
    replace,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    reset,
  };
}

/**
 * Détecte les combinaisons clavier standard undo/redo (Office/Google).
 * - Ctrl/Cmd+Z         → undo
 * - Ctrl/Cmd+Y         → redo (Windows/Office)
 * - Ctrl/Cmd+Shift+Z   → redo (Mac/VSCode)
 */
export function matchUndoRedo(e: KeyboardEvent | React.KeyboardEvent):
  | 'undo'
  | 'redo'
  | null {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return null;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) return 'undo';
  if (k === 'z' && e.shiftKey) return 'redo';
  if (k === 'y' && !e.shiftKey) return 'redo';
  return null;
}

/**
 * Vrai si le focus courant est dans une zone de saisie (input / textarea /
 * contentEditable). Utilisé pour NE PAS intercepter les raccourcis natifs
 * dans les champs de dialog / barre de formule.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}
