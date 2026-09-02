import { useEffect } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  description: string;
  callback: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && altMatch && shiftMatch && keyMatch) {
          event.preventDefault();
          shortcut.callback();
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// Hook spécifique pour les raccourcis de navigation
export function useNavigationShortcuts(
  tabs: string[],
  activeTab: string,
  setActiveTab: (tab: string) => void
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Navigation avec Alt + chiffre (1-9)
      if (event.altKey && !event.ctrlKey && !event.shiftKey) {
        const num = parseInt(event.key);
        if (num >= 1 && num <= tabs.length) {
          event.preventDefault();
          setActiveTab(tabs[num - 1]);
        }
      }

      // Navigation avec Tab (suivant) et Shift+Tab (précédent)
      if (event.key === 'Tab' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        const currentIndex = tabs.indexOf(activeTab);
        if (event.shiftKey) {
          // Précédent
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
          setActiveTab(tabs[prevIndex]);
        } else {
          // Suivant
          const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
          setActiveTab(tabs[nextIndex]);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTab, setActiveTab]);
}
