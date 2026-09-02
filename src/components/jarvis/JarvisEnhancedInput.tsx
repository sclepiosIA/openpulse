/**
 * JarvisEnhancedInput - Input premium unifié (v12.6)
 *
 * Fonctionnalités:
 * - Suggestions contextuelles pendant la frappe
 * - Raccourcis clavier (/, @, #)
 * - Envoi avec Enter, nouvelle ligne avec Shift+Enter
 * - Design glass ultra premium avec micro-interactions
 * - Indicateur de caractères et statut de connexion
 */

import { useState, useRef, useCallback, KeyboardEvent, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Loader2, Slash, ArrowUp, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { vibrateSelection } from '@/lib/haptics'

interface QuickCommand {
  id: string
  trigger: string
  label: string
  description: string
  command: string
  icon: string
}

const QUICK_COMMANDS: QuickCommand[] = [
  {
    id: 'emails',
    trigger: '/emails',
    label: 'Emails',
    description: 'Résumer mes emails non lus',
    command: 'Résume mes emails non lus',
    icon: '📧',
  },
  {
    id: 'taches',
    trigger: '/taches',
    label: 'Tâches',
    description: 'Afficher mes tâches prioritaires',
    command: 'Quelles sont mes tâches prioritaires ?',
    icon: '✅',
  },
  {
    id: 'pipeline',
    trigger: '/pipeline',
    label: 'Pipeline',
    description: 'État du pipeline commercial',
    command: "Quel est l'état du pipeline ?",
    icon: '📈',
  },
  {
    id: 'tresorerie',
    trigger: '/tresorerie',
    label: 'Trésorerie',
    description: 'Situation de trésorerie',
    command: 'Quelle est la situation de trésorerie ?',
    icon: '💰',
  },
  {
    id: 'agenda',
    trigger: '/agenda',
    label: 'Agenda',
    description: 'Mes rendez-vous du jour',
    command: "Quels sont mes rendez-vous aujourd'hui ?",
    icon: '📅',
  },
  {
    id: 'support',
    trigger: '/support',
    label: 'Support',
    description: 'Tickets ouverts',
    command: 'Combien de tickets de support sont ouverts ?',
    icon: '🎫',
  },
  {
    id: 'briefing',
    trigger: '/briefing',
    label: 'Briefing',
    description: 'Briefing quotidien',
    command: 'Quel est mon briefing du jour ?',
    icon: '☀️',
  },
  {
    id: 'help',
    trigger: '/help',
    label: 'Aide',
    description: 'Ce que Jarvis peut faire',
    command: "Qu'est-ce que tu peux faire pour moi ?",
    icon: '❓',
  },
]

const MAX_CHARS = 2000

interface JarvisEnhancedInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onVoiceStart?: () => void
  isLoading?: boolean
  isVoiceActive?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function JarvisEnhancedInput({
  value,
  onChange,
  onSubmit,
  onVoiceStart,
  isLoading = false,
  isVoiceActive = false,
  placeholder = 'Demandez à Jarvis...',
  className,
  disabled = false,
}: JarvisEnhancedInputProps) {
  const [showCommands, setShowCommands] = useState(false)
  const [filteredCommands, setFilteredCommands] = useState<QuickCommand[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const charCount = value.length
  const charPercentage = (charCount / MAX_CHARS) * 100

  // Filter commands based on input
  useEffect(() => {
    if (value.startsWith('/')) {
      const search = value.slice(1).toLowerCase()
      const filtered = QUICK_COMMANDS.filter(
        (cmd) =>
          cmd.trigger.toLowerCase().includes(search) || cmd.label.toLowerCase().includes(search)
      )
      setFilteredCommands(filtered)
      setShowCommands(filtered.length > 0)
      setSelectedIndex(0)
    } else {
      setShowCommands(false)
    }
  }, [value])

  // Handle command selection
  const selectCommand = useCallback(
    (command: QuickCommand) => {
      vibrateSelection()
      onChange(command.command)
      setShowCommands(false)
      textareaRef.current?.focus()
    },
    [onChange]
  )

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Command palette navigation
      if (showCommands) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1))
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          return
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            selectCommand(filteredCommands[selectedIndex])
          }
          return
        }
        if (e.key === 'Escape') {
          setShowCommands(false)
          return
        }
      }

      // Submit on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (value.trim() && !isLoading && !disabled) {
          vibrateSelection()
          onSubmit()
        }
      }
    },
    [
      showCommands,
      filteredCommands,
      selectedIndex,
      selectCommand,
      value,
      isLoading,
      disabled,
      onSubmit,
    ]
  )

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px'
    }
  }, [value])

  return (
    <div className={cn('relative', className)}>
      {/* Command palette dropdown - Premium glass */}
      <AnimatePresence>
        {showCommands && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="absolute bottom-full left-0 right-0 mb-2 bg-popover/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl shadow-black/20 overflow-hidden z-50"
          >
            <div className="p-3 border-b border-border/30 bg-muted/30">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <div className="p-1 rounded-md bg-primary/10">
                  <Slash className="h-3 w-3 text-primary" />
                </div>
                <span>Commandes rapides</span>
                <div className="ml-auto flex items-center gap-1 text-[10px]">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">↑↓</kbd>
                  <span>naviguer</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 ml-1">
                    ↵
                  </kbd>
                  <span>sélectionner</span>
                </div>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {filteredCommands.map((cmd, index) => (
                <motion.button
                  key={cmd.id}
                  onClick={() => selectCommand(cmd)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={cn(
                    'w-full px-3 py-2.5 text-left flex items-center gap-3 rounded-xl transition-all',
                    index === selectedIndex
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                      : 'hover:bg-muted/60'
                  )}
                >
                  <span className="text-lg">{cmd.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{cmd.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{cmd.description}</div>
                  </div>
                  {index === selectedIndex && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="shrink-0">
                      <Zap className="w-4 h-4 text-primary" />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input container - Ultra Premium glass design */}
      <div
        className={cn(
          'relative rounded-2xl transition-all duration-300',
          'bg-gradient-to-br from-card/95 via-card/90 to-muted/40 backdrop-blur-xl',
          'border shadow-lg',
          isFocused
            ? 'border-primary/40 shadow-xl shadow-primary/10 ring-2 ring-primary/20'
            : 'border-border/40 shadow-black/5',
          disabled && 'opacity-50 pointer-events-none'
        )}
      >
        {/* Animated gradient border on focus */}
        <AnimatePresence>
          {isFocused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-primary/30 via-cyan-400/20 to-primary/30 -z-10 blur-sm"
            />
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2 p-3">
          {/* Textarea container */}
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              disabled={disabled || isLoading}
              spellCheck={false}
              autoComplete="off"
              data-gramm="false"
              className={cn(
                'min-h-[52px] max-h-[150px] resize-none border-0 bg-transparent',
                'focus:ring-0 focus:outline-none placeholder:text-muted-foreground/40',
                'py-3.5 px-3 text-[15px] leading-relaxed',
                '[text-decoration:none!important]'
              )}
              rows={1}
            />

            {/* Hints and character counter */}
            <div className="absolute left-3 right-3 bottom-0 flex items-center justify-between text-[10px] text-muted-foreground/40 font-medium">
              {/* Keyboard hints */}
              {!value && (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/30">
                    <Slash className="h-2.5 w-2.5" />
                    commandes
                  </span>
                  <span className="hidden sm:flex items-center gap-1">Shift+↵ nouvelle ligne</span>
                </div>
              )}

              {/* Character counter with progress */}
              {value && (
                <div className="flex items-center gap-2 ml-auto">
                  <div className="w-16 h-1 rounded-full bg-muted/50 overflow-hidden">
                    <motion.div
                      className={cn(
                        'h-full rounded-full transition-colors',
                        charPercentage > 90
                          ? 'bg-red-500'
                          : charPercentage > 70
                            ? 'bg-amber-500'
                            : 'bg-primary'
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(charPercentage, 100)}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      charPercentage > 90 && 'text-red-500',
                      charPercentage > 70 && charPercentage <= 90 && 'text-amber-500'
                    )}
                  >
                    {charCount}/{MAX_CHARS}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 pb-1">
            {/* Voice button with pulse when active */}
            {onVoiceStart && (
              <motion.div className="relative">
                {isVoiceActive && (
                  <motion.div
                    className="absolute inset-0 rounded-xl bg-destructive/30"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'relative h-11 w-11 rounded-xl transition-all',
                    isVoiceActive
                      ? 'bg-destructive/15 text-destructive ring-2 ring-destructive/30'
                      : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => {
                    vibrateSelection()
                    onVoiceStart?.()
                  }}
                  disabled={isLoading}
                  aria-label="Micro"
                >
                  <Mic className={cn('h-4.5 w-4.5', isVoiceActive && 'animate-pulse')} />
                </Button>
              </motion.div>
            )}

            {/* Premium Send button */}
            <motion.div
              whileHover={{ scale: value.trim() ? 1.05 : 1 }}
              whileTap={{ scale: value.trim() ? 0.92 : 1 }}
            >
              <Button
                size="icon"
                className={cn(
                  'h-11 w-11 rounded-xl transition-colors duration-300 relative overflow-hidden',
                  value.trim()
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted/60 text-muted-foreground/60'
                )}
                onClick={() => {
                  vibrateSelection()
                  onSubmit()
                }}
                disabled={!value.trim() || isLoading || disabled}
                aria-label="Chargement"
              >
                {/* Shine effect on hover */}
                {value.trim() && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full"
                    whileHover={{ translateX: '100%' }}
                    transition={{ duration: 0.5 }}
                  />
                )}

                {isLoading ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <ArrowUp className="h-4.5 w-4.5 relative z-10" />
                )}
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
