/**
 * JarvisKeyboardShortcuts - Gestionnaire de raccourcis clavier (v15.0)
 *
 * Fournit un système de raccourcis clavier global pour Jarvis
 * avec affichage des raccourcis disponibles
 */

import { memo, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Keyboard, Command, CornerDownLeft, Mic, History, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Shortcut {
  key: string
  label: string
  description: string
  icon?: React.ElementType
  modifiers?: ('cmd' | 'ctrl' | 'shift' | 'alt')[]
}

const SHORTCUTS: Shortcut[] = [
  {
    key: 'k',
    label: 'Ouvrir/Fermer Jarvis',
    description: 'Accès rapide',
    icon: Command,
    modifiers: ['cmd'],
  },
  {
    key: 'n',
    label: 'Nouvelle conversation',
    description: 'Recommencer',
    icon: Plus,
    modifiers: ['cmd', 'shift'],
  },
  { key: '↵', label: 'Envoyer', description: 'Soumettre le message', icon: CornerDownLeft },
  { key: '⇧↵', label: 'Nouvelle ligne', description: 'Ajouter un saut de ligne' },
  {
    key: 'm',
    label: 'Voice input',
    description: 'Activer le micro',
    icon: Mic,
    modifiers: ['cmd'],
  },
  {
    key: 'h',
    label: 'Historique',
    description: 'Conversations passées',
    icon: History,
    modifiers: ['cmd'],
  },
  { key: 'Esc', label: 'Fermer', description: 'Fermer le panneau', icon: X },
]

interface JarvisKeyboardShortcutsProps {
  isOpen: boolean
  onClose: () => void
}

export const JarvisKeyboardShortcuts = memo(function JarvisKeyboardShortcuts({
  isOpen,
  onClose,
}: JarvisKeyboardShortcutsProps) {
  // A11y : fermer la modale via Escape
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn(
              'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
              'w-full max-w-md mx-4',
              'bg-background/95 backdrop-blur-xl',
              'rounded-2xl shadow-2xl',
              'border border-border/50',
              'overflow-hidden'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Keyboard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Raccourcis clavier</h3>
                  <p className="text-xs text-muted-foreground">Navigation rapide</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Shortcuts list */}
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {SHORTCUTS.map((shortcut, index) => {
                const Icon = shortcut.icon
                return (
                  <motion.div
                    key={shortcut.key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={cn(
                      'flex items-center justify-between',
                      'px-4 py-3 rounded-xl',
                      'bg-muted/30 hover:bg-muted/50',
                      'transition-colors duration-200'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
                      <div>
                        <p className="text-sm font-medium text-foreground">{shortcut.label}</p>
                        <p className="text-xs text-muted-foreground">{shortcut.description}</p>
                      </div>
                    </div>

                    {/* Key badges */}
                    <div className="flex items-center gap-1">
                      {shortcut.modifiers?.map((mod) => (
                        <kbd
                          key={mod}
                          className="px-2 py-1 text-[10px] font-medium rounded bg-muted text-muted-foreground"
                        >
                          {mod === 'cmd'
                            ? '⌘'
                            : mod === 'ctrl'
                              ? 'Ctrl'
                              : mod === 'shift'
                                ? '⇧'
                                : '⌥'}
                        </kbd>
                      ))}
                      <kbd className="px-2 py-1 text-[10px] font-medium rounded bg-muted text-muted-foreground">
                        {shortcut.key}
                      </kbd>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border/50 bg-muted/30">
              <p className="text-[10px] text-muted-foreground text-center">
                Appuyez sur <kbd className="px-1 rounded bg-muted">?</kbd> pour afficher ce menu
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
})

/**
 * useJarvisKeyboardShortcuts - Hook pour gérer les raccourcis
 */
export function useJarvisKeyboardShortcuts({
  onOpenJarvis,
  onNewConversation,
  onOpenHistory,
  onToggleVoice,
  onCloseJarvis,
  enabled = true,
}: {
  onOpenJarvis?: () => void
  onNewConversation?: () => void
  onOpenHistory?: () => void
  onToggleVoice?: () => void
  onCloseJarvis?: () => void
  enabled?: boolean
}) {
  const [showShortcuts, setShowShortcuts] = useState(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdKey = isMac ? e.metaKey : e.ctrlKey

      // Cmd/Ctrl + K - Toggle Jarvis
      if (cmdKey && e.key === 'k') {
        e.preventDefault()
        onOpenJarvis?.()
        return
      }

      // Cmd/Ctrl + Shift + N - New conversation
      if (cmdKey && e.shiftKey && e.key === 'n') {
        e.preventDefault()
        onNewConversation?.()
        return
      }

      // Cmd/Ctrl + M - Voice input
      if (cmdKey && e.key === 'm') {
        e.preventDefault()
        onToggleVoice?.()
        return
      }

      // Cmd/Ctrl + H - History
      if (cmdKey && e.key === 'h') {
        e.preventDefault()
        onOpenHistory?.()
        return
      }

      // Escape - Close
      if (e.key === 'Escape') {
        onCloseJarvis?.()
        return
      }

      // ? - Show shortcuts
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        setShowShortcuts(true)
        return
      }
    },
    [enabled, onOpenJarvis, onNewConversation, onOpenHistory, onToggleVoice, onCloseJarvis]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return {
    showShortcuts,
    setShowShortcuts,
    ShortcutsModal: () => (
      <JarvisKeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    ),
  }
}
