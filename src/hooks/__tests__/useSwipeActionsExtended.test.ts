import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSwipeActions, type SwipeAction } from '../ui/useSwipeActions';

// Mock mobile-tokens
vi.mock('@/config/mobile-tokens', () => ({
  mobileDesignTokens: {
    swipe: { threshold: 50, maxDistance: 200 },
  },
}));

const makeAction = (overrides: Partial<SwipeAction> = {}): SwipeAction => ({
  id: 'test',
  label: 'Test',
  color: 'primary',
  onAction: vi.fn(),
  ...overrides,
});

const createTouchEvent = (clientX: number) => ({
  touches: [{ clientX }],
} as unknown as React.TouchEvent);

describe('useSwipeActions extended', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useSwipeActions());
    expect(result.current.translateX).toBe(0);
    expect(result.current.isSwiping).toBe(false);
    expect(result.current.hasLeftActions).toBe(false);
    expect(result.current.hasRightActions).toBe(false);
  });

  it('reports hasLeftActions/hasRightActions', () => {
    const { result } = renderHook(() => useSwipeActions({
      leftActions: [makeAction()],
      rightActions: [makeAction(), makeAction()],
    }));
    expect(result.current.hasLeftActions).toBe(true);
    expect(result.current.hasRightActions).toBe(true);
  });

  it('handlers are functions', () => {
    const { result } = renderHook(() => useSwipeActions());
    expect(typeof result.current.handlers.onTouchStart).toBe('function');
    expect(typeof result.current.handlers.onTouchMove).toBe('function');
    expect(typeof result.current.handlers.onTouchEnd).toBe('function');
  });

  it('reset resets state', () => {
    const { result } = renderHook(() => useSwipeActions({ rightActions: [makeAction()] }));
    act(() => result.current.handlers.onTouchStart(createTouchEvent(100)));
    act(() => result.current.reset());
    expect(result.current.translateX).toBe(0);
    expect(result.current.isSwiping).toBe(false);
  });

  it('touch start sets isSwiping', () => {
    const { result } = renderHook(() => useSwipeActions());
    act(() => result.current.handlers.onTouchStart(createTouchEvent(100)));
    expect(result.current.isSwiping).toBe(true);
  });

  it('touch move updates translateX', () => {
    const { result } = renderHook(() => useSwipeActions());
    act(() => result.current.handlers.onTouchStart(createTouchEvent(100)));
    act(() => result.current.handlers.onTouchMove(createTouchEvent(150)));
    expect(result.current.translateX).toBe(50);
  });

  it('limits translateX to maxDistance', () => {
    const { result } = renderHook(() => useSwipeActions());
    act(() => result.current.handlers.onTouchStart(createTouchEvent(0)));
    act(() => result.current.handlers.onTouchMove(createTouchEvent(500)));
    expect(result.current.translateX).toBeLessThanOrEqual(200);
  });

  it('triggers right action on left swipe past threshold', () => {
    const action = makeAction();
    const { result } = renderHook(() => useSwipeActions({ rightActions: [action] }));
    act(() => result.current.handlers.onTouchStart(createTouchEvent(200)));
    act(() => result.current.handlers.onTouchMove(createTouchEvent(100)));
    act(() => result.current.handlers.onTouchEnd());
    expect(action.onAction).toHaveBeenCalledTimes(1);
  });

  it('triggers left action on right swipe past threshold', () => {
    const action = makeAction();
    const { result } = renderHook(() => useSwipeActions({ leftActions: [action] }));
    act(() => result.current.handlers.onTouchStart(createTouchEvent(100)));
    act(() => result.current.handlers.onTouchMove(createTouchEvent(200)));
    act(() => result.current.handlers.onTouchEnd());
    expect(action.onAction).toHaveBeenCalledTimes(1);
  });

  it('does not trigger action below threshold', () => {
    const action = makeAction();
    const { result } = renderHook(() => useSwipeActions({ rightActions: [action] }));
    act(() => result.current.handlers.onTouchStart(createTouchEvent(100)));
    act(() => result.current.handlers.onTouchMove(createTouchEvent(80)));
    act(() => result.current.handlers.onTouchEnd());
    expect(action.onAction).not.toHaveBeenCalled();
  });

  it('resets translateX on touch end', () => {
    const { result } = renderHook(() => useSwipeActions());
    act(() => result.current.handlers.onTouchStart(createTouchEvent(100)));
    act(() => result.current.handlers.onTouchMove(createTouchEvent(200)));
    act(() => result.current.handlers.onTouchEnd());
    expect(result.current.translateX).toBe(0);
    expect(result.current.isSwiping).toBe(false);
  });

  it('calls onSwipeStart/onSwipeEnd callbacks', () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const { result } = renderHook(() => useSwipeActions({ onSwipeStart: onStart, onSwipeEnd: onEnd }));
    act(() => result.current.handlers.onTouchStart(createTouchEvent(100)));
    expect(onStart).toHaveBeenCalledTimes(1);
    act(() => result.current.handlers.onTouchMove(createTouchEvent(110)));
    act(() => result.current.handlers.onTouchEnd());
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
