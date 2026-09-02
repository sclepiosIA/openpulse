import { useState, useEffect, useCallback } from 'react';

export type VisioProvider = 'marque_meet' | 'google_meet' | 'teams' | 'zoom' | 'other';

interface VisioDetectionResult {
  activeVisioType: VisioProvider | null;
  visioUrl: string | null;
  visioTitle: string | null;
  roomCode: string | null;
}

const VISIO_PATTERNS: Record<VisioProvider, RegExp> = {
  marque_meet: /\/visio\/([a-zA-Z0-9-]+)/,
  google_meet: /meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i,
  teams: /teams\.microsoft\.com\/.*meetup-join/i,
  zoom: /zoom\.us\/j\/(\d+)/i,
  other: /.*/, // Fallback
};

export function useVisioDetection(): VisioDetectionResult {
  const [state, setState] = useState<VisioDetectionResult>({
    activeVisioType: null,
    visioUrl: null,
    visioTitle: null,
    roomCode: null,
  });

  // Check current URL for visio
  const checkCurrentUrl = useCallback(() => {
    const url = window.location.href;
    
    for (const [provider, pattern] of Object.entries(VISIO_PATTERNS)) {
      if (provider === 'other') continue;
      
      const match = url.match(pattern);
      if (match) {
        setState({
          activeVisioType: provider as VisioProvider,
          visioUrl: url,
          visioTitle: document.title,
          roomCode: match[1] || null,
        });
        return;
      }
    }

    setState({
      activeVisioType: null,
      visioUrl: null,
      visioTitle: null,
      roomCode: null,
    });
  }, []);

  // Monitor URL changes
  useEffect(() => {
    checkCurrentUrl();

    // Listen for popstate (back/forward)
    window.addEventListener('popstate', checkCurrentUrl);
    
    // Create MutationObserver to detect SPA navigation
    const observer = new MutationObserver(() => {
      checkCurrentUrl();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      window.removeEventListener('popstate', checkCurrentUrl);
      observer.disconnect();
    };
  }, [checkCurrentUrl]);

  return state;
}

// Helper to detect visio links in text
export function detectVisioLink(text: string): { provider: VisioProvider; url: string; roomCode?: string } | null {
  // Check for OpenPulse Meet
  const marqueMatch = text.match(/\/visio\/([a-zA-Z0-9-]+)/);
  if (marqueMatch) {
    return {
      provider: 'marque_meet',
      url: marqueMatch[0],
      roomCode: marqueMatch[1],
    };
  }

  // Check for Google Meet
  const meetMatch = text.match(/https?:\/\/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  if (meetMatch) {
    return {
      provider: 'google_meet',
      url: meetMatch[0],
      roomCode: meetMatch[1],
    };
  }

  // Check for Teams
  const teamsMatch = text.match(/https?:\/\/teams\.microsoft\.com\/[^\s]+meetup-join[^\s]*/i);
  if (teamsMatch) {
    return {
      provider: 'teams',
      url: teamsMatch[0],
    };
  }

  // Check for Zoom
  const zoomMatch = text.match(/https?:\/\/[a-z0-9]*\.?zoom\.us\/j\/(\d+)[^\s]*/i);
  if (zoomMatch) {
    return {
      provider: 'zoom',
      url: zoomMatch[0],
      roomCode: zoomMatch[1],
    };
  }

  return null;
}
