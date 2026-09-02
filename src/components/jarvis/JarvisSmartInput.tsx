/**
 * JarvisSmartInput - Input intelligent ultra-premium (v14.0)
 *
 * Features:
 * - Auto-resize avec max height
 * - Suggestions rapides contextuelles
 * - Voice input toggle
 * - Attachments support (preview)
 * - Animations fluides Apple-like
 * - Glassmorphism design
 */

import { useState, useRef, useCallback, KeyboardEvent, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, Mic, Square, Loader2, Sparkles, Zap, Mail, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { vibrateSelection, vibrateSuccess } from '@/lib/haptics'
import { JARVIS_LAYOUT } from './JarvisDesignSystem'

interface QuickSuggestion {
  id: string
  label: string
  icon: React.ElementType
  prompt: string
}

const QUICK_SUGGESTIONS: QuickSuggestion[] = [
  { id: 'briefing', label: 'Briefing', icon: Sparkles, prompt: 'Génère mon briefing du jour' },
  { id: 'emails', label: 'Emails', icon: Mail, prompt: 'Résume mes emails importants' },
  { id: 'tasks', label: 'Tâches', icon: Zap, prompt: 'Mes tâches prioritaires' },
  { id: 'calendar', label: 'Agenda', icon: Calendar, prompt: 'Mon agenda du jour' },
]

interface JarvisSmartInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onQuickAction?: (prompt: string) => void
  onVoiceToggle?: () => void
  isLoading?: boolean
  isVoiceActive?: boolean
  placeholder?: string
  disabled?: boolean
  showQuickSuggestions?: boolean
  className?: string
}

export const JarvisSmartInput = memo(function JarvisSmartInput({
  value,
  onChange,
  onSubmit,
  onQuickAction,
  onVoiceToggle,
  isLoading = false,
  isVoiceActive = false,
  placeholder = "Demandez-moi n'importe quoi...",
  disabled = false,
  showQuickSuggestions = true,
  className,
}: JarvisSmartInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const newHeight = Math.min(textareaRef.current.scrollHeight, 150)
      textareaRef.current.style.height = `${newHeight}px`
    }
  }, [value])

  // Hide suggestions when typing
  useEffect(() => {
    setShowSuggestions(value.length === 0)
  }, [value])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (value.trim() && !disabled) {
          vibrateSelection()
          onSubmit()
        }
      }
    },
    [value, disabled, onSubmit]
  )

  const handleQuickSuggestion = useCallback(
    (e: React.MouseEvent, suggestion: QuickSuggestion) => {
      e.stopPropagation()
      vibrateSelection()
      if (onQuickAction) {
        onQuickAction(suggestion.prompt)
      } else {
        onChange(suggestion.prompt)
        setTimeout(() => {
          onSubmit()
        }, 100)
      }
    },
    [onChange, onSubmit, onQuickAction]
  )

  const canSubmit = value.trim().length > 0 && !disabled

  return (
    <div className={cn('relative bg-background/80', className)}>
      {/* Quick suggestions - show when empty */}
      <AnimatePresence>
        {showQuickSuggestions && showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 pb-2"
          >
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {QUICK_SUGGESTIONS.map((suggestion, index) => {
                const Icon = suggestion.icon
                return (
                  <motion.button
                    key={suggestion.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={(e) => handleQuickSuggestion(e, suggestion)}
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
                      'bg-muted/50 hover:bg-muted border border-border/40',
                      'text-xs font-medium text-muted-foreground hover:text-foreground',
                      'transition-colors duration-200 whitespace-nowrap',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{suggestion.label}</span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main input container */}
      <div className="px-4 pb-4 pt-2">
        <div className={JARVIS_LAYOUT.safeArea.bottom}>
          <motion.div
            className={cn(
              'relative flex items-end gap-2',
              'rounded-3xl transition-all duration-300',
              // Glassmorphism base
              'bg-muted/40 backdrop-blur-xl',
              'border border-border/40',
              // Focus states
              isFocused && [
                'border-primary/30',
                'bg-muted/60',
                'shadow-lg shadow-primary/5',
                'ring-2 ring-primary/10',
              ],
              // Disabled state
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            layout
          >
            {/* Gradient accent on focus */}
            <AnimatePresence>
              {isFocused && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none"
                />
              )}
            </AnimatePresence>

            {/* Textarea */}
            <div className="flex-1 py-3 pl-4 relative">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={placeholder}
                disabled={disabled}
                rows={1}
                className={cn(
                  'w-full resize-none bg-transparent',
                  'text-base leading-relaxed text-foreground',
                  'placeholder:text-muted-foreground/50',
                  'focus:outline-none',
                  'min-h-[24px] max-h-[150px]',
                  'scrollbar-hide'
                )}
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 p-2">
              {/* Voice button */}
              {onVoiceToggle && (
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      vibrateSelection()
                      onVoiceToggle()
                    }}
                    disabled={isLoading}
                    className={cn(
                      'h-9 w-9 rounded-full transition-all duration-200',
                      isVoiceActive
                        ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/25'
                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    )}
                    aria-label={
                      isVoiceActive ? 'Arrêter la dictée vocale' : 'Démarrer la dictée vocale'
                    }
                    aria-pressed={isVoiceActive}
                    title={isVoiceActive ? 'Arrêter la dictée' : 'Dictée vocale'}
                  >
                    {isVoiceActive ? (
                      <Square className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                </motion.div>
              )}

              {/* Submit button */}
              <motion.div
                animate={{
                  scale: canSubmit ? 1 : 0.9,
                }}
                whileHover={canSubmit ? { scale: 1.05 } : {}}
                whileTap={canSubmit ? { scale: 0.9 } : {}}
              >
                <Button
                  size="icon"
                  onClick={() => {
                    if (canSubmit) {
                      vibrateSuccess()
                      onSubmit()
                    }
                  }}
                  disabled={!canSubmit}
                  aria-label="Envoyer le message"
                  title="Envoyer"
                  className={cn(
                    'h-9 w-9 rounded-full transition-colors duration-300',
                    canSubmit
                      ? ['bg-primary hover:bg-primary/90', 'text-primary-foreground']
                      : ['bg-muted text-muted-foreground', 'opacity-50']
                  )}
                >
                  <AnimatePresence mode="wait">
                    {isLoading ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0, rotate: -90 }}
                        animate={{ opacity: 1, rotate: 0 }}
                        exit={{ opacity: 0, rotate: 90 }}
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="arrow"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>
            </div>
          </motion.div>

          {/* Keyboard hint */}
          <AnimatePresence>
            {isFocused && value.length > 0 && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[10px] text-muted-foreground/50 text-center mt-1.5"
              >
                <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">↵</kbd> pour envoyer •
                <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">⇧↵</kbd> nouvelle ligne
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
})
