import { useCallback } from 'react';
import { useEmailContext } from '@/contexts/EmailContext';
import { EmailDraft } from '@/types/email';

/**
 * Hook pour gérer la navigation dans l'interface email
 * Centralise la logique de navigation entre inbox, thread, composer
 */
export function useEmailNavigation() {
  const { state, actions } = useEmailContext();

  const selectThread = useCallback((threadId: string, subject?: string) => {
    const thread = state.threads.find(t => t.id === threadId);
    actions.selectThread(threadId, subject || thread?.subject);
  }, [actions, state.threads]);

  const closeThread = useCallback(() => {
    actions.selectThread(null);
  }, [actions]);

  const startComposing = useCallback(() => {
    actions.startComposing();
  }, [actions]);

  const editDraft = useCallback((draft: EmailDraft) => {
    actions.editDraft(draft);
  }, [actions]);

  const goBack = useCallback(() => {
    actions.goBack();
  }, [actions]);

  const selectNextThread = useCallback(() => {
    const currentIndex = state.threads.findIndex(t => t.id === state.selectedThread);
    if (currentIndex < state.threads.length - 1) {
      const nextThread = state.threads[currentIndex + 1];
      actions.selectThread(nextThread.id, nextThread.subject);
    }
  }, [state.threads, state.selectedThread, actions]);

  const selectPreviousThread = useCallback(() => {
    const currentIndex = state.threads.findIndex(t => t.id === state.selectedThread);
    if (currentIndex > 0) {
      const prevThread = state.threads[currentIndex - 1];
      actions.selectThread(prevThread.id, prevThread.subject);
    }
  }, [state.threads, state.selectedThread, actions]);

  return {
    // State
    selectedThread: state.selectedThread,
    composing: state.composing,
    draftToEdit: state.draftToEdit,
    
    // Actions
    selectThread,
    closeThread,
    startComposing,
    editDraft,
    goBack,
    selectNextThread,
    selectPreviousThread,
    
    // Helper functions
    canGoNext: state.selectedThread 
      ? state.threads.findIndex(t => t.id === state.selectedThread) < state.threads.length - 1
      : false,
    canGoPrevious: state.selectedThread
      ? state.threads.findIndex(t => t.id === state.selectedThread) > 0
      : false,
  };
}
