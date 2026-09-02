import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/ui/use-mobile';

export type MobileDashboardMode = 'compact' | 'full';

interface MobileDashboardState {
  mode: MobileDashboardMode;
  setMode: (mode: MobileDashboardMode) => void;
  toggleMode: () => void;
  isCompact: boolean;
  isMobile: boolean;
  // Dual carousel indices
  carousel1Index: number;
  setCarousel1Index: (index: number) => void;
  carousel2Index: number;
  setCarousel2Index: (index: number) => void;
  // Legacy single carousel support
  currentWidgetIndex: number;
  setCurrentWidgetIndex: (index: number) => void;
}

const STORAGE_KEY = 'dashboard_mobile_mode';

export function useMobileDashboard(): MobileDashboardState {
  const isMobile = useIsMobile();
  
  // Persister le mode dans localStorage
  const [mode, setModeState] = useState<MobileDashboardMode>(() => {
    if (typeof window === 'undefined') return 'compact';
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as MobileDashboardMode) || 'compact';
  });

  // Dual carousel indices
  const [carousel1Index, setCarousel1Index] = useState(0);
  const [carousel2Index, setCarousel2Index] = useState(0);
  
  // Legacy single widget index (for backward compatibility)
  const [currentWidgetIndex, setCurrentWidgetIndex] = useState(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const setMode = (newMode: MobileDashboardMode) => {
    setModeState(newMode);
    // Reset indices when switching modes
    setCarousel1Index(0);
    setCarousel2Index(0);
    setCurrentWidgetIndex(0);
  };

  const toggleMode = () => {
    setMode(mode === 'compact' ? 'full' : 'compact');
  };

  return {
    mode,
    setMode,
    toggleMode,
    isCompact: mode === 'compact',
    isMobile,
    carousel1Index,
    setCarousel1Index,
    carousel2Index,
    setCarousel2Index,
    currentWidgetIndex,
    setCurrentWidgetIndex,
  };
}
