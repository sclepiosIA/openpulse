import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AriaLiveRegionProps {
  message: string;
  type?: 'polite' | 'assertive';
  className?: string;
}

/**
 * Composant pour annoncer des messages aux lecteurs d'écran
 * Utilise aria-live pour une meilleure accessibilité
 */
export function AriaLiveRegion({ 
  message, 
  type = 'polite',
  className 
}: AriaLiveRegionProps) {
  const [announcement, setAnnouncement] = useState('');
  
  useEffect(() => {
    if (message) {
      // Clear first then set to ensure announcement is made
      setAnnouncement('');
      const timer = setTimeout(() => {
        setAnnouncement(message);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [message]);
  
  return (
    <div
      role="status"
      aria-live={type}
      aria-atomic="true"
      className={cn("sr-only", className)}
    >
      {announcement}
    </div>
  );
}

// Hook pour utiliser l'annonce de manière programmatique
export function useAriaAnnounce() {
  const [announcement, setAnnouncement] = useState({ message: '', key: 0 });
  
  const announce = (message: string) => {
    setAnnouncement(prev => ({ message, key: prev.key + 1 }));
  };
  
  return { announcement, announce };
}
