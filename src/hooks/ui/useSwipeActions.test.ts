/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSwipeActions, type SwipeAction } from './useSwipeActions';

const { TOKENS } = vi.hoisted(() => ({
  TOKENS: {
    swipe: {
      threshold: 48,
      maxDistance: 96,
    },
  },
}));

vi.mock('@/config/mobile-tokens', () => ({
  mobileDesignTokens: TOKENS,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children?: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function makeTouchEvent(clientX: number) {
  return {
    touches: [{ clientX }],
  } as unknown as React.TouchEvent;
}

describe('useSwipeActions', () => {
  it('initialise avec les valeurs par défaut et les indicateurs d’actions', () => {
    const leftAction: SwipeAction = {
      id: 'left-1',
      label: 'Archiver',
      color: 'primary',
      onAction: vi.fn(),
    };
    const rightAction: SwipeAction = {
      id: 'right-1',
      label: 'Supprimer',
      color: 'destructive',
      onAction: vi.fn(),
    };

    const { result } = renderHook(
      () =>
        useSwipeActions({
          leftActions: [leftAction],
          rightActions: [rightAction],
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.translateX).toBe(0);
    expect(result.current.isSwiping).toBe(false);
    expect(result.current.hasLeftActions).toBe(true);
    expect(result.current.hasRightActions).toBe(true);
    expect(typeof result.current.handlers.onTouchStart).toBe('function');
    expect(typeof result.current.handlers.onTouchMove).toBe('function');
    expect(typeof result.current.handlers.onTouchEnd).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });

  it('passe en swipe au touch start, limite translateX au maxDistance, puis reset au touch end avec action gauche au-delà du seuil', () => {
    const onSwipeStart = vi.fn();
    const onSwipeEnd = vi.fn();
    const leftOnAction = vi.fn();
    const rightOnAction = vi.fn();

    const leftAction: SwipeAction = {
      id: 'left-1',
      label: 'Archiver',
      color: 'success',
      onAction: leftOnAction,
    };
    const rightAction: SwipeAction = {
      id: 'right-1',
      label: 'Supprimer',
      color: 'warning',
      onAction: rightOnAction,
    };

    const { result } = renderHook(
      () =>
        useSwipeActions({
          leftActions: [leftAction],
          rightActions: [rightAction],
          threshold: 50,
          onSwipeStart,
          onSwipeEnd,
        }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.handlers.onTouchStart(makeTouchEvent(100));
    });

    expect(result.current.isSwiping).toBe(true);
    expect(result.current.translateX).toBe(0);
    expect(onSwipeStart).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handlers.onTouchMove(makeTouchEvent(260));
    });

    expect(result.current.translateX).toBe(TOKENS.swipe.maxDistance);

    act(() => {
      result.current.handlers.onTouchEnd();
    });

    expect(result.current.isSwiping).toBe(false);
    expect(result.current.translateX).toBe(0);
    expect(leftOnAction).toHaveBeenCalledTimes(1);
    expect(rightOnAction).not.toHaveBeenCalled();
    expect(onSwipeEnd).toHaveBeenCalledTimes(1);
  });

  it('déclenche la première action de gauche quand le swipe vers la droite dépasse le seuil', async () => {
    const leftOnAction = vi.fn();
    const secondLeftOnAction = vi.fn();

    const leftActions: SwipeAction[] = [
      {
        id: 'left-primary',
        label: 'Valider',
        color: 'success',
        onAction: leftOnAction,
      },
      {
        id: 'left-secondary',
        label: 'Autre',
        color: 'primary',
        onAction: secondLeftOnAction,
      },
    ];

    const { result } = renderHook(
      () =>
        useSwipeActions({
          leftActions,
          threshold: 40,
        }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.handlers.onTouchStart(makeTouchEvent(10));
    });

    act(() => {
      result.current.handlers.onTouchMove(makeTouchEvent(80));
    });

    expect(result.current.translateX).toBe(70);

    await act(async () => {
      result.current.handlers.onTouchEnd();
    });

    expect(leftOnAction).toHaveBeenCalledTimes(1);
    expect(secondLeftOnAction).not.toHaveBeenCalled();
    expect(result.current.translateX).toBe(0);
    expect(result.current.isSwiping).toBe(false);
  });

  it('déclenche la première action de droite quand le swipe vers la gauche dépasse le seuil', async () => {
    const rightOnAction = vi.fn();
    const secondRightOnAction = vi.fn();

    const rightActions: SwipeAction[] = [
      {
        id: 'right-primary',
        label: 'Supprimer',
        color: 'destructive',
        onAction: rightOnAction,
      },
      {
        id: 'right-secondary',
        label: 'Reporter',
        color: 'warning',
        onAction: secondRightOnAction,
      },
    ];

    const { result } = renderHook(
      () =>
        useSwipeActions({
          rightActions,
          threshold: 30,
        }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.handlers.onTouchStart(makeTouchEvent(200));
    });

    act(() => {
      result.current.handlers.onTouchMove(makeTouchEvent(120));
    });

    expect(result.current.translateX).toBe(-80);

    await act(async () => {
      result.current.handlers.onTouchEnd();
    });

    expect(rightOnAction).toHaveBeenCalledTimes(1);
    expect(secondRightOnAction).not.toHaveBeenCalled();
    expect(result.current.translateX).toBe(0);
    expect(result.current.isSwiping).toBe(false);
  });

  it('ne déclenche aucune action si le déplacement reste sous le seuil et appelle onSwipeEnd', () => {
    const onSwipeEnd = vi.fn();
    const leftOnAction = vi.fn();
    const rightOnAction = vi.fn();

    const { result } = renderHook(
      () =>
        useSwipeActions({
          leftActions: [
            {
              id: 'left-1',
              label: 'Gauche',
              color: 'primary',
              onAction: leftOnAction,
            },
          ],
          rightActions: [
            {
              id: 'right-1',
              label: 'Droite',
              color: 'warning',
              onAction: rightOnAction,
            },
          ],
          threshold: 50,
          onSwipeEnd,
        }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.handlers.onTouchStart(makeTouchEvent(100));
    });

    act(() => {
      result.current.handlers.onTouchMove(makeTouchEvent(130));
    });

    expect(result.current.translateX).toBe(30);

    act(() => {
      result.current.handlers.onTouchEnd();
    });

    expect(leftOnAction).not.toHaveBeenCalled();
    expect(rightOnAction).not.toHaveBeenCalled();
    expect(result.current.translateX).toBe(0);
    expect(result.current.isSwiping).toBe(false);
    expect(onSwipeEnd).toHaveBeenCalledTimes(1);
  });

  it('ignore touchMove et touchEnd si aucun swipe n’est actif', () => {
    const leftOnAction = vi.fn();

    const { result } = renderHook(
      () =>
        useSwipeActions({
          leftActions: [
            {
              id: 'left-1',
              label: 'Action',
              color: 'primary',
              onAction: leftOnAction,
            },
          ],
        }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.handlers.onTouchMove(makeTouchEvent(140));
    });

    expect(result.current.translateX).toBe(0);
    expect(result.current.isSwiping).toBe(false);

    act(() => {
      result.current.handlers.onTouchEnd();
    });

    expect(leftOnAction).not.toHaveBeenCalled();
    expect(result.current.translateX).toBe(0);
    expect(result.current.isSwiping).toBe(false);
  });

  it('reset remet translateX et isSwiping à zéro/false après un swipe en cours', () => {
    const { result } = renderHook(() => useSwipeActions(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handlers.onTouchStart(makeTouchEvent(50));
    });

    act(() => {
      result.current.handlers.onTouchMove(makeTouchEvent(90));
    });

    expect(result.current.isSwiping).toBe(true);
    expect(result.current.translateX).toBe(40);

    act(() => {
      result.current.reset();
    });

    expect(result.current.translateX).toBe(0);
    expect(result.current.isSwiping).toBe(false);
  });

  it('propage une erreur si l’action déclenchée échoue', () => {
    const failingAction = vi.fn(() => {
      throw new Error('x');
    });

    const { result } = renderHook(
      () =>
        useSwipeActions({
          rightActions: [
            {
              id: 'right-fail',
              label: 'Erreur',
              color: 'destructive',
              onAction: failingAction,
            },
          ],
          threshold: 20,
        }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.handlers.onTouchStart(makeTouchEvent(100));
    });

    act(() => {
      result.current.handlers.onTouchMove(makeTouchEvent(60));
    });

    expect(() => {
      act(() => {
        result.current.handlers.onTouchEnd();
      });
    }).toThrow('x');

    expect(failingAction).toHaveBeenCalledTimes(1);
  });
});