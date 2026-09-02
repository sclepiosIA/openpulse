/**
 * useJarvisGestures - Hook de navigation gestuelle pour JARVIS 6.0
 * 
 * Gère les gestes tactiles et souris pour la navigation entre agents,
 * le rafraîchissement du contexte, et les actions rapides.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { AgentId } from '@/types/jarvis-agents';
import type { GestureType, GestureAction } from '@/types/jarvis-v6';

interface GestureState {
  startX: number;
  startY: number;
  startTime: number;
  isActive: boolean;
}

interface UseJarvisGesturesOptions {
  /** Référence à l'élément DOM à surveiller */
  containerRef: React.RefObject<HTMLElement>;
  /** Agents disponibles pour la navigation */
  enabledAgents: AgentId[];
  /** Agent actuellement sélectionné */
  currentAgent?: AgentId;
  /** Callbacks */
  onAgentChange?: (agent: AgentId) => void;
  onRefresh?: () => void;
  onQuickAction?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  /** Seuils de détection */
  swipeThreshold?: number;
  longPressThreshold?: number;
  pinchThreshold?: number;
}

interface UseJarvisGesturesReturn {
  /** Geste en cours de détection */
  activeGesture: GestureType | null;
  /** Distance du swipe en cours */
  swipeDistance: { x: number; y: number };
  /** Progression du long press (0-1) */
  longPressProgress: number;
  /** Active/désactive les gestes */
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  /** Historique des derniers gestes */
  gestureHistory: GestureAction[];
}

const DEFAULT_SWIPE_THRESHOLD = 50;
const DEFAULT_LONG_PRESS_THRESHOLD = 500;
const DEFAULT_PINCH_THRESHOLD = 0.2;

const ALL_AGENTS: AgentId[] = ['sophia', 'marcus', 'olivia', 'noah', 'emma', 'alex'];

export function useJarvisGestures({
  containerRef,
  enabledAgents = ALL_AGENTS,
  currentAgent,
  onAgentChange,
  onRefresh,
  onQuickAction,
  onZoomIn,
  onZoomOut,
  swipeThreshold = DEFAULT_SWIPE_THRESHOLD,
  longPressThreshold = DEFAULT_LONG_PRESS_THRESHOLD,
}: UseJarvisGesturesOptions): UseJarvisGesturesReturn {
  const [isEnabled, setEnabled] = useState(true);
  const [activeGesture, setActiveGesture] = useState<GestureType | null>(null);
  const [swipeDistance, setSwipeDistance] = useState({ x: 0, y: 0 });
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [gestureHistory, setGestureHistory] = useState<GestureAction[]>([]);

  // Refs for tracking gesture state
  const gestureRef = useRef<GestureState>({
    startX: 0,
    startY: 0,
    startTime: 0,
    isActive: false,
  });
  const longPressTimerRef = useRef<number | null>(null);
  const longPressIntervalRef = useRef<number | null>(null);
  const initialPinchDistanceRef = useRef<number | null>(null);

  // Get next/previous agent in the list
  const getAdjacentAgent = useCallback((direction: 'next' | 'prev'): AgentId | undefined => {
    if (!currentAgent || enabledAgents.length === 0) return enabledAgents[0];
    
    const currentIndex = enabledAgents.indexOf(currentAgent);
    if (currentIndex === -1) return enabledAgents[0];

    if (direction === 'next') {
      return enabledAgents[(currentIndex + 1) % enabledAgents.length];
    } else {
      return enabledAgents[(currentIndex - 1 + enabledAgents.length) % enabledAgents.length];
    }
  }, [currentAgent, enabledAgents]);

  // Add gesture to history
  const recordGesture = useCallback((gesture: GestureType, action: string, params?: Record<string, unknown>) => {
    setGestureHistory(prev => [
      { gesture, action, params },
      ...prev.slice(0, 9) // Keep last 10
    ]);
  }, []);

  // Handle touch/mouse start
  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (!isEnabled) return;

    gestureRef.current = {
      startX: clientX,
      startY: clientY,
      startTime: Date.now(),
      isActive: true,
    };

    setSwipeDistance({ x: 0, y: 0 });
    setLongPressProgress(0);

    // Start long press timer
    longPressTimerRef.current = window.setTimeout(() => {
      if (gestureRef.current.isActive) {
        setActiveGesture('long-press');
        onQuickAction?.();
        recordGesture('long-press', 'quick-action');
      }
    }, longPressThreshold);

    // Progress indicator for long press
    longPressIntervalRef.current = window.setInterval(() => {
      if (gestureRef.current.isActive) {
        const elapsed = Date.now() - gestureRef.current.startTime;
        setLongPressProgress(Math.min(elapsed / longPressThreshold, 1));
      }
    }, 16);
  }, [isEnabled, longPressThreshold, onQuickAction, recordGesture]);

  // Handle touch/mouse move
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isEnabled || !gestureRef.current.isActive) return;

    const deltaX = clientX - gestureRef.current.startX;
    const deltaY = clientY - gestureRef.current.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Cancel long press if moved too much
    if (distance > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (longPressIntervalRef.current) {
        clearInterval(longPressIntervalRef.current);
        longPressIntervalRef.current = null;
      }
      setLongPressProgress(0);
    }

    setSwipeDistance({ x: deltaX, y: deltaY });

    // Detect swipe direction
    if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
      setActiveGesture(deltaX > 0 ? 'swipe-right' : 'swipe-left');
    } else if (Math.abs(deltaY) > swipeThreshold && Math.abs(deltaY) > Math.abs(deltaX)) {
      setActiveGesture(deltaY > 0 ? 'swipe-down' : 'swipe-up');
    }
  }, [isEnabled, swipeThreshold]);

  // Handle touch/mouse end
  const handleEnd = useCallback(() => {
    if (!isEnabled) return;

    // Clear timers
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressIntervalRef.current) {
      clearInterval(longPressIntervalRef.current);
      longPressIntervalRef.current = null;
    }

    const { x: deltaX, y: deltaY } = swipeDistance;

    // Execute gesture action
    if (activeGesture === 'swipe-left' && Math.abs(deltaX) > swipeThreshold) {
      const nextAgent = getAdjacentAgent('next');
      if (nextAgent) {
        onAgentChange?.(nextAgent);
        recordGesture('swipe-left', 'next-agent', { agent: nextAgent });
      }
    } else if (activeGesture === 'swipe-right' && Math.abs(deltaX) > swipeThreshold) {
      const prevAgent = getAdjacentAgent('prev');
      if (prevAgent) {
        onAgentChange?.(prevAgent);
        recordGesture('swipe-right', 'prev-agent', { agent: prevAgent });
      }
    } else if (activeGesture === 'swipe-down' && Math.abs(deltaY) > swipeThreshold) {
      onRefresh?.();
      recordGesture('swipe-down', 'refresh');
    } else if (activeGesture === 'swipe-up' && Math.abs(deltaY) > swipeThreshold) {
      // Swipe up could minimize or other action
    }

    // Reset state
    gestureRef.current.isActive = false;
    setActiveGesture(null);
    setSwipeDistance({ x: 0, y: 0 });
    setLongPressProgress(0);
  }, [isEnabled, activeGesture, swipeDistance, swipeThreshold, getAdjacentAgent, onAgentChange, onRefresh, recordGesture]);

  // Handle pinch gesture (touch only)
  const handlePinch = useCallback((touches: TouchList) => {
    if (!isEnabled || touches.length !== 2) return;

    const touch1 = touches[0];
    const touch2 = touches[1];
    const currentDistance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );

    if (initialPinchDistanceRef.current === null) {
      initialPinchDistanceRef.current = currentDistance;
      return;
    }

    const scale = currentDistance / initialPinchDistanceRef.current;

    if (scale > 1 + DEFAULT_PINCH_THRESHOLD) {
      setActiveGesture('pinch-out');
      onZoomIn?.();
      recordGesture('pinch-out', 'zoom-in');
      initialPinchDistanceRef.current = currentDistance;
    } else if (scale < 1 - DEFAULT_PINCH_THRESHOLD) {
      setActiveGesture('pinch-in');
      onZoomOut?.();
      recordGesture('pinch-in', 'zoom-out');
      initialPinchDistanceRef.current = currentDistance;
    }
  }, [isEnabled, onZoomIn, onZoomOut, recordGesture]);

  // Handle double tap
  const lastTapRef = useRef<number>(0);
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setActiveGesture('double-tap');
      onQuickAction?.();
      recordGesture('double-tap', 'quick-action');
    }
    lastTapRef.current = now;
  }, [onQuickAction, recordGesture]);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Touch events
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleStart(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        initialPinchDistanceRef.current = null;
        handlePinch(e.touches);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        handlePinch(e.touches);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        handleEnd();
        handleDoubleTap();
        initialPinchDistanceRef.current = null;
      }
    };

    // Mouse events (for desktop testing)
    const handleMouseDown = (e: MouseEvent) => {
      handleStart(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      handleEnd();
    };

    // Add listeners
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseUp);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [containerRef, handleStart, handleMove, handleEnd, handlePinch, handleDoubleTap]);

  return {
    activeGesture,
    swipeDistance,
    longPressProgress,
    isEnabled,
    setEnabled,
    gestureHistory,
  };
}
