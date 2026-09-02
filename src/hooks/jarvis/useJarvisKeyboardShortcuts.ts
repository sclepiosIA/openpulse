/**
 * useJarvisKeyboardShortcuts - Global keyboard shortcuts for Jarvis 12.0
 * 
 * Enhanced shortcuts:
 * - Cmd/Ctrl+J: Toggle Jarvis panel
 * - Cmd/Ctrl+Shift+J: Mode vocal immédiat
 * - Cmd/Ctrl+K: Palette de commandes Jarvis
 * - Cmd/Ctrl+.: Action rapide contextuelle
 * - Escape: Fermer et annuler action en cours
 */

import { useEffect, useCallback } from 'react';

interface UseJarvisKeyboardShortcutsProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onVoiceMode?: () => void;
  onCommandPalette?: () => void;
  onQuickAction?: () => void;
  enabled?: boolean;
}

export interface JarvisShortcut {
  key: string;
  modifiers: ('meta' | 'ctrl' | 'shift' | 'alt')[];
  description: string;
  action: () => void;
}

export function useJarvisKeyboardShortcuts({
  isOpen,
  onToggle,
  onClose,
  onVoiceMode,
  onCommandPalette,
  onQuickAction,
  enabled = true,
}: UseJarvisKeyboardShortcutsProps) {
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    const isMod = e.metaKey || e.ctrlKey;

    // Cmd/Ctrl + Shift + J: Mode vocal immédiat
    if (isMod && e.shiftKey && e.key.toLowerCase() === 'j') {
      e.preventDefault();
      onVoiceMode?.();
      return;
    }

    // Cmd/Ctrl + J: Toggle Jarvis
    if (isMod && !e.shiftKey && e.key.toLowerCase() === 'j') {
      e.preventDefault();
      onToggle();
      return;
    }

    // Cmd/Ctrl + K: Palette de commandes
    if (isMod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      onCommandPalette?.();
      return;
    }

    // Cmd/Ctrl + .: Action rapide contextuelle
    if (isMod && e.key === '.') {
      e.preventDefault();
      onQuickAction?.();
      return;
    }

    // Escape: Fermer Jarvis
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      onClose();
      return;
    }
  }, [enabled, isOpen, onToggle, onClose, onVoiceMode, onCommandPalette, onQuickAction]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Liste des raccourcis pour affichage dans l'UI
  const shortcuts: JarvisShortcut[] = [
    {
      key: 'J',
      modifiers: ['meta'],
      description: 'Ouvrir/Fermer Jarvis',
      action: onToggle,
    },
    {
      key: 'J',
      modifiers: ['meta', 'shift'],
      description: 'Mode vocal',
      action: onVoiceMode || (() => {}),
    },
    {
      key: 'K',
      modifiers: ['meta'],
      description: 'Palette de commandes',
      action: onCommandPalette || (() => {}),
    },
    {
      key: '.',
      modifiers: ['meta'],
      description: 'Action rapide',
      action: onQuickAction || (() => {}),
    },
    {
      key: 'Escape',
      modifiers: [],
      description: 'Fermer',
      action: onClose,
    },
  ];

  return { shortcuts };
}
