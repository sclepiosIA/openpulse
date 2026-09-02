import { useState, useCallback, useRef, useEffect } from "react";
import { debug } from "@/lib/debug";

export type ViewMode = 'single' | 'continuous';
export type FitMode = 'width' | 'page' | 'custom';

interface UsePDFViewerOptions {
  defaultScale?: number;
  defaultViewMode?: ViewMode;
  onPageChange?: (page: number) => void;
}

interface UsePDFViewerReturn {
  // State
  numPages: number;
  currentPage: number;
  scale: number;
  viewMode: ViewMode;
  fitMode: FitMode;
  showThumbnails: boolean;
  isFullscreen: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Refs
  containerRef: React.RefObject<HTMLDivElement>;
  
  // Actions
  setNumPages: (num: number) => void;
  setCurrentPage: (page: number) => void;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setScale: (scale: number) => void;
  fitToWidth: () => void;
  fitToPage: () => void;
  toggleViewMode: () => void;
  setViewMode: (mode: ViewMode) => void;
  toggleThumbnails: () => void;
  toggleFullscreen: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  calculateOptimalScale: (pageWidth: number) => number;
}

export function usePDFViewer(options: UsePDFViewerOptions = {}): UsePDFViewerReturn {
  const {
    defaultScale = 1,
    defaultViewMode = 'single',
    onPageChange,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScaleState] = useState(defaultScale);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [fitMode, setFitMode] = useState<FitMode>('width');
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate optimal scale based on container width
  const calculateOptimalScale = useCallback((pageWidth: number = 612) => {
    if (!containerRef.current) return 1;
    const containerWidth = containerRef.current.clientWidth;
    const padding = showThumbnails ? 240 : 48; // Thumbnail panel width + margin
    const availableWidth = containerWidth - padding;
    const optimalScale = Math.min(availableWidth / pageWidth, 2);
    return Math.max(optimalScale, 0.5);
  }, [showThumbnails]);

  // Auto-fit on mount and resize
  useEffect(() => {
    if (!isLoading && fitMode === 'width') {
      const optimalScale = calculateOptimalScale();
      setScaleState(optimalScale);
    }
  }, [isLoading, fitMode, calculateOptimalScale, showThumbnails]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle resize
  useEffect(() => {
    if (fitMode !== 'custom') {
      const handleResize = () => {
        const optimalScale = calculateOptimalScale();
        setScaleState(optimalScale);
      };
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [fitMode, calculateOptimalScale]);

  const goToPage = useCallback((page: number) => {
    const validPage = Math.min(Math.max(1, page), numPages);
    setCurrentPage(validPage);
    onPageChange?.(validPage);
  }, [numPages, onPageChange]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const zoomIn = useCallback(() => {
    setFitMode('custom');
    setScaleState(prev => Math.min(prev + 0.25, 3));
  }, []);

  const zoomOut = useCallback(() => {
    setFitMode('custom');
    setScaleState(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const setScale = useCallback((newScale: number) => {
    setFitMode('custom');
    setScaleState(newScale);
  }, []);

  const fitToWidth = useCallback(() => {
    setFitMode('width');
    const optimalScale = calculateOptimalScale();
    setScaleState(optimalScale);
  }, [calculateOptimalScale]);

  const fitToPage = useCallback(() => {
    setFitMode('page');
    // For page fit, we use a slightly smaller scale to show the whole page
    if (!containerRef.current) return;
    const containerHeight = containerRef.current.clientHeight;
    const pageHeight = 792; // Standard PDF page height (11")
    const padding = 48;
    const heightScale = (containerHeight - padding) / pageHeight;
    const widthScale = calculateOptimalScale();
    setScaleState(Math.min(heightScale, widthScale));
  }, [calculateOptimalScale]);

  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'single' ? 'continuous' : 'single');
  }, []);

  const toggleThumbnails = useCallback(() => {
    setShowThumbnails(prev => !prev);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      debug.error('Fullscreen error:', err);
    }
  }, []);

  return {
    // State
    numPages,
    currentPage,
    scale,
    viewMode,
    fitMode,
    showThumbnails,
    isFullscreen,
    isLoading,
    error,
    
    // Refs
    containerRef,
    
    // Actions
    setNumPages,
    setCurrentPage,
    goToPage,
    nextPage,
    prevPage,
    zoomIn,
    zoomOut,
    setScale,
    fitToWidth,
    fitToPage,
    toggleViewMode,
    setViewMode,
    toggleThumbnails,
    toggleFullscreen,
    setLoading,
    setError,
    calculateOptimalScale,
  };
}
