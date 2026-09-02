import { renderHook, act } from '@testing-library/react';
import { useUndoRedo, matchUndoRedo, isTypingTarget } from './useUndoRedo';

describe('useUndoRedo', () => {
  it('retourne l’état initial sans undo/redo possible', () => {
    const { result } = renderHook(() => useUndoRedo('a'));
    expect(result.current.state).toBe('a');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('set pousse un nouvel état et active canUndo', () => {
    const { result } = renderHook(() => useUndoRedo('a'));
    act(() => {
      result.current.set('b');
    });
    expect(result.current.state).toBe('b');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('set accepte une fonction de mise à jour', () => {
    const { result } = renderHook(() => useUndoRedo(10));
    act(() => {
      result.current.set((prev) => prev + 5);
    });
    expect(result.current.state).toBe(15);
    expect(result.current.canUndo).toBe(true);
  });

  it('set avec une valeur identique (Object.is) ne crée pas d’entrée d’historique visible dans state', () => {
    const { result } = renderHook(() => useUndoRedo('a'));
    act(() => {
      result.current.set('a');
    });
    expect(result.current.state).toBe('a');
    act(() => {
      result.current.undo();
    });
    expect(result.current.state).toBe('a');
  });

  it('undo restaure l’état précédent et active canRedo', () => {
    const { result } = renderHook(() => useUndoRedo('a'));
    act(() => {
      result.current.set('b');
    });
    act(() => {
      result.current.set('c');
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.state).toBe('b');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);
  });

  it('redo réapplique l’état annulé', () => {
    const { result } = renderHook(() => useUndoRedo('a'));
    act(() => {
      result.current.set('b');
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.state).toBe('a');
    act(() => {
      result.current.redo();
    });
    expect(result.current.state).toBe('b');
    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
  });

  it('undo sans historique est un no-op', () => {
    const { result } = renderHook(() => useUndoRedo('seul'));
    act(() => {
      result.current.undo();
    });
    expect(result.current.state).toBe('seul');
    expect(result.current.canUndo).toBe(false);
  });

  it('redo sans futur est un no-op', () => {
    const { result } = renderHook(() => useUndoRedo('seul'));
    act(() => {
      result.current.redo();
    });
    expect(result.current.state).toBe('seul');
    expect(result.current.canRedo).toBe(false);
  });

  it('set après un undo vide la pile redo', () => {
    const { result } = renderHook(() => useUndoRedo('a'));
    act(() => {
      result.current.set('b');
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);
    act(() => {
      result.current.set('x');
    });
    expect(result.current.state).toBe('x');
    expect(result.current.canRedo).toBe(false);
  });

  it('replace modifie le HEAD sans créer d’entrée d’historique', () => {
    const { result } = renderHook(() => useUndoRedo('a'));
    act(() => {
      result.current.set('b');
    });
    act(() => {
      result.current.replace('b-drag');
    });
    expect(result.current.state).toBe('b-drag');
    act(() => {
      result.current.undo();
    });
    expect(result.current.state).toBe('a');
  });

  it('replace accepte une fonction de mise à jour', () => {
    const { result } = renderHook(() => useUndoRedo(1));
    act(() => {
      result.current.replace((prev) => prev * 3);
    });
    expect(result.current.state).toBe(3);
  });

  it('reset remplace l’état et vide les deux piles', () => {
    const { result } = renderHook(() => useUndoRedo('a'));
    act(() => {
      result.current.set('b');
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);
    act(() => {
      result.current.reset('zero');
    });
    expect(result.current.state).toBe('zero');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('respecte la capacité maximale de la pile undo', () => {
    const { result } = renderHook(() => useUndoRedo(0, 3));
    act(() => {
      result.current.set(1);
    });
    act(() => {
      result.current.set(2);
    });
    act(() => {
      result.current.set(3);
    });
    act(() => {
      result.current.set(4);
    });
    // capacité = 3 → la plus ancienne entrée (0) a été évincée
    act(() => {
      result.current.undo();
    });
    expect(result.current.state).toBe(3);
    act(() => {
      result.current.undo();
    });
    expect(result.current.state).toBe(2);
    act(() => {
      result.current.undo();
    });
    expect(result.current.state).toBe(1);
    act(() => {
      result.current.undo();
    });
    // plus rien à annuler : 0 a été perdu par le plafond
    expect(result.current.state).toBe(1);
    expect(result.current.canUndo).toBe(false);
  });

  it('undo/redo enchaînés préservent la cohérence sur plusieurs états', () => {
    const { result } = renderHook(() => useUndoRedo({ v: 1 }));
    const s2 = { v: 2 };
    const s3 = { v: 3 };
    act(() => {
      result.current.set(s2);
    });
    act(() => {
      result.current.set(s3);
    });
    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.state).toEqual({ v: 1 });
    act(() => {
      result.current.redo();
    });
    expect(result.current.state).toBe(s2);
    act(() => {
      result.current.redo();
    });
    expect(result.current.state).toBe(s3);
  });
});

describe('matchUndoRedo', () => {
  const makeEvent = (opts: {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
  }): KeyboardEvent =>
    new KeyboardEvent('keydown', {
      key: opts.key,
      ctrlKey: opts.ctrlKey ?? false,
      metaKey: opts.metaKey ?? false,
      shiftKey: opts.shiftKey ?? false,
    });

  it.each([
    [{ key: 'z', ctrlKey: true }, 'undo'],
    [{ key: 'Z', ctrlKey: true }, 'undo'],
    [{ key: 'z', metaKey: true }, 'undo'],
    [{ key: 'z', ctrlKey: true, shiftKey: true }, 'redo'],
    [{ key: 'Z', metaKey: true, shiftKey: true }, 'redo'],
    [{ key: 'y', ctrlKey: true }, 'redo'],
    [{ key: 'Y', metaKey: true }, 'redo'],
    [{ key: 'y', ctrlKey: true, shiftKey: true }, null],
    [{ key: 'z' }, null],
    [{ key: 'y' }, null],
    [{ key: 'a', ctrlKey: true }, null],
  ] as const)('détecte %j → %s', (opts, expected) => {
    expect(matchUndoRedo(makeEvent(opts))).toBe(expected);
  });
});

describe('isTypingTarget', () => {
  it('retourne false pour null', () => {
    expect(isTypingTarget(null)).toBe(false);
  });

  it.each([['input'], ['textarea'], ['select']])(
    'retourne true pour un élément <%s>',
    (tag) => {
      const el = document.createElement(tag);
      expect(isTypingTarget(el)).toBe(true);
    },
  );

  it('retourne true pour un élément contentEditable', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'isContentEditable', { value: true });
    expect(isTypingTarget(el)).toBe(true);
  });

  it('retourne false pour un div ordinaire', () => {
    const el = document.createElement('div');
    expect(isTypingTarget(el)).toBe(false);
  });

  it('retourne false pour un bouton', () => {
    const el = document.createElement('button');
    expect(isTypingTarget(el)).toBe(false);
  });
});