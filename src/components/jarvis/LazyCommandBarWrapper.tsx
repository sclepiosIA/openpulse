/**
 * LazyCommandBarWrapper - Encapsulates useJarvisCommandBar hook in a lazy-loadable component.
 * 
 * This exists because hooks cannot be lazy-loaded directly.
 * By wrapping the hook in a component, we defer loading JarvisCommandBar
 * and all its dependencies (framer-motion, lucide icons, etc.) until after initial render.
 */

import { useEffect } from 'react';
import { debug } from '@/lib/debug';
import { JarvisCommandBar, useJarvisCommandBar } from '@/components/jarvis/JarvisCommandBar';

export function LazyCommandBarWrapper() {
  const { CommandBar, open } = useJarvisCommandBar((action) => {
    debug.log('[Jarvis CommandBar] Action:', action);
  });

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'gestion-desktop-open-jarvis') {
        open();
      }
    };
    window.addEventListener('message', handler);
    window.addEventListener('gestion-desktop-open-jarvis', open as EventListener);
    return () => {
      window.removeEventListener('message', handler);
      window.removeEventListener('gestion-desktop-open-jarvis', open as EventListener);
    };
  }, [open]);

  return <CommandBar />;
}
