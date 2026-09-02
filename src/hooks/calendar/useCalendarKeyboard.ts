import { useEffect, useCallback } from 'react';

interface UseCalendarKeyboardOptions {
  onNewEvent: () => void;
  onNewTask: () => void;
  onToggleFilters: () => void;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  onToday: () => void;
  enabled?: boolean;
}

export function useCalendarKeyboard({
  onNewEvent,
  onNewTask,
  onToggleFilters,
  onPreviousPeriod,
  onNextPeriod,
  onToday,
  enabled = true,
}: UseCalendarKeyboardOptions) {
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if typing in an input, textarea, or contenteditable
    const target = event.target;
    // Defensive: target may be Document/Window which don't have closest/tagName
    if (!(target instanceof HTMLElement)) return;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest('[role="dialog"]')
    ) {
      return;
    }

    // Ignore if modifier keys are pressed (except for navigation)
    const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
    
    switch (event.key.toLowerCase()) {
      case 'n':
        if (!hasModifier) {
          event.preventDefault();
          onNewEvent();
        }
        break;
      case 't':
        if (!hasModifier) {
          event.preventDefault();
          onNewTask();
        }
        break;
      case 'f':
        if (!hasModifier) {
          event.preventDefault();
          onToggleFilters();
        }
        break;
      case 'arrowleft':
        if (!hasModifier) {
          event.preventDefault();
          onPreviousPeriod();
        }
        break;
      case 'arrowright':
        if (!hasModifier) {
          event.preventDefault();
          onNextPeriod();
        }
        break;
      case 'h':
        if (!hasModifier) {
          event.preventDefault();
          onToday();
        }
        break;
      default:
        break;
    }
  }, [onNewEvent, onNewTask, onToggleFilters, onPreviousPeriod, onNextPeriod, onToday]);

  useEffect(() => {
    if (!enabled) return;
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}

// Keyboard shortcuts help text
export const CALENDAR_SHORTCUTS = [
  { key: 'N', description: 'Nouvel événement' },
  { key: 'T', description: 'Nouvelle tâche' },
  { key: 'F', description: 'Ouvrir/fermer filtres' },
  { key: '←', description: 'Période précédente' },
  { key: '→', description: 'Période suivante' },
  { key: 'H', description: "Aujourd'hui" },
];
