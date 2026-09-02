import { useRef, useCallback } from 'react';
import { vibrate } from '@/lib/haptics';

interface UseLongPressOptions {
  onLongPress: () => void;
  delay?: number;
  haptic?: boolean;
}

/**
 * Hook pour gérer les interactions long-press (500ms par défaut)
 * Avec feedback haptique optionnel
 */
export function useLongPress({ 
  onLongPress, 
  delay = 500,
  haptic = true 
}: UseLongPressOptions) {
  const timeout = useRef<NodeJS.Timeout>();
  const isLongPress = useRef(false);

  const start = useCallback(() => {
    isLongPress.current = false;
    timeout.current = setTimeout(() => {
      isLongPress.current = true;
      if (haptic) {
        vibrate(50); // Feedback haptique court
      }
      onLongPress();
    }, delay);
  }, [onLongPress, delay, haptic]);

  const clear = useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
  }, []);

  const handlers = {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
  };

  return {
    handlers,
    isLongPress: () => isLongPress.current,
  };
}
