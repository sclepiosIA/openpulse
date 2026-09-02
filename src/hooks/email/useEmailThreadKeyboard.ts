import { useEffect, useCallback } from 'react';

interface UseEmailThreadKeyboardProps {
  onReply?: () => void;
  onReplyAll?: () => void;
  onArchive?: () => void;
  onForward?: () => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  onNextMessage?: () => void;
  onPreviousMessage?: () => void;
  onToggleSelection?: () => void;
  onShowShortcuts?: () => void;
  disabled?: boolean;
}

export function useEmailThreadKeyboard({
  onReply,
  onReplyAll,
  onArchive,
  onForward,
  onExpandAll,
  onCollapseAll,
  onNextMessage,
  onPreviousMessage,
  onToggleSelection,
  onShowShortcuts,
  disabled = false,
}: UseEmailThreadKeyboardProps) {
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target;
    if (disabled) return;
    // Defensive: target may be Document/Window which don't expose .closest/.isContentEditable
    if (!(target instanceof HTMLElement)) return;

    // Ignore if user is typing in any editable element (including rich text editors)
    if (target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]') ||
        target.closest('[role="textbox"]') ||
        target.closest('.ProseMirror')) {
      return;
    }

    // Check for cmd/ctrl modifiers
    const hasModifier = event.metaKey || event.ctrlKey || event.altKey;

    switch (event.key.toLowerCase()) {
      case 'r':
        if (!hasModifier && onReply) {
          event.preventDefault();
          onReply();
        } else if (event.shiftKey && onReplyAll) {
          event.preventDefault();
          onReplyAll();
        }
        break;
      case 'a':
        if (!hasModifier && onArchive) {
          event.preventDefault();
          onArchive();
        }
        break;
      case 'f':
        if (!hasModifier && onForward) {
          event.preventDefault();
          onForward();
        }
        break;
      case 'e':
        if (!hasModifier && onExpandAll) {
          event.preventDefault();
          onExpandAll();
        }
        break;
      case 'c':
        if (!hasModifier && onCollapseAll) {
          event.preventDefault();
          onCollapseAll();
        }
        break;
      case 'j':
        if (!hasModifier && onNextMessage) {
          event.preventDefault();
          onNextMessage();
        }
        break;
      case 'k':
        if (!hasModifier && onPreviousMessage) {
          event.preventDefault();
          onPreviousMessage();
        }
        break;
      case 'x':
        if (!hasModifier && onToggleSelection) {
          event.preventDefault();
          onToggleSelection();
        }
        break;
      case '?':
        if (!hasModifier && onShowShortcuts) {
          event.preventDefault();
          onShowShortcuts();
        }
        break;
    }
  }, [disabled, onReply, onReplyAll, onArchive, onForward, onExpandAll, onCollapseAll, onNextMessage, onPreviousMessage, onToggleSelection, onShowShortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
