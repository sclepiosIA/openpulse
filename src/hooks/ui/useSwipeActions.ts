import { useState, useRef, useCallback, TouchEvent } from 'react';
import { mobileDesignTokens } from '@/config/mobile-tokens';

export interface SwipeAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  color: 'primary' | 'success' | 'warning' | 'destructive';
  onAction: () => void | Promise<void>;
}

export interface UseSwipeActionsProps {
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  threshold?: number;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
}

export function useSwipeActions({
  leftActions = [],
  rightActions = [],
  threshold = mobileDesignTokens.swipe.threshold,
  onSwipeStart,
  onSwipeEnd,
}: UseSwipeActionsProps = {}) {
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const actionTriggered = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    setIsSwiping(true);
    actionTriggered.current = false;
    onSwipeStart?.();
  }, [onSwipeStart]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isSwiping) return;
    
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    
    // Limiter le swipe
    const maxSwipe = mobileDesignTokens.swipe.maxDistance;
    const limitedDiff = Math.max(-maxSwipe, Math.min(maxSwipe, diff));
    
    setTranslateX(limitedDiff);
  }, [isSwiping]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping) return;
    
    const diff = currentX.current - startX.current;
    const absDiff = Math.abs(diff);
    
    // Swipe gauche (révèle actions à droite)
    if (diff < -threshold && rightActions.length > 0 && !actionTriggered.current) {
      actionTriggered.current = true;
      rightActions[0].onAction();
    }
    
    // Swipe droite (révèle actions à gauche)
    if (diff > threshold && leftActions.length > 0 && !actionTriggered.current) {
      actionTriggered.current = true;
      leftActions[0].onAction();
    }
    
    // Reset
    setTranslateX(0);
    setIsSwiping(false);
    onSwipeEnd?.();
  }, [isSwiping, threshold, leftActions, rightActions, onSwipeEnd]);

  const reset = useCallback(() => {
    setTranslateX(0);
    setIsSwiping(false);
  }, []);

  return {
    translateX,
    isSwiping,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    reset,
    hasLeftActions: leftActions.length > 0,
    hasRightActions: rightActions.length > 0,
  };
}
