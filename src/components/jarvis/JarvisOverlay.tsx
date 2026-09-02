/**
 * JarvisOverlay - Overlay Global Contextuel JARVIS 12.0
 *
 * Mini-bulle flottante toujours visible avec expansion en overlay.
 * Détection automatique du contexte de la page.
 * Actions rapides contextuelles.
 * V11: Intégration Wake Word Detection
 */

import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  X,
  Mic,
  MicOff,
  Send,
  ChevronUp,
  Zap,
  Mail,
  CheckSquare,
  Building2,
  DollarSign,
  Lightbulb,
  ArrowRight,
  Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useJarvisFocus, type JarvisFocusMode } from '@/hooks/jarvis/useJarvisFocus'
import { useJarvisPredictions } from '@/hooks/jarvis/useJarvisPredictions'
import { useJarvisWakeWord } from '@/hooks/jarvis/useJarvisWakeWord'
import { JarvisWakeWordIndicator } from './JarvisWakeWordIndicator'

interface JarvisOverlayProps {
  onOpenFullPanel: () => void
  onSendMessage: (message: string) => void
  onStartVoice: () => void
  wakeWordEnabled?: boolean
}

const MODE_CONFIG: Record<
  JarvisFocusMode,
  {
    icon: typeof Sparkles
    label: string
    color: string
    suggestions: string[]
  }
> = {
  general: {
    icon: Sparkles,
    label: 'Général',
    color: 'text-primary',
    suggestions: ['Briefing du jour', 'Tâches urgentes', 'Emails importants'],
  },
  emails: {
    icon: Mail,
    label: 'Emails',
    color: 'text-sky-500',
    suggestions: ['Emails non lus urgents', 'Répondre à ce mail', 'Classifier les threads'],
  },
  tasks: {
    icon: CheckSquare,
    label: 'Tâches',
    color: 'text-emerald-500',
    suggestions: ['Tâches en retard', 'Créer une tâche', 'Planning de la semaine'],
  },
  support: {
    icon: Zap,
    label: 'Support',
    color: 'text-orange-500',
    suggestions: ['Tickets critiques', 'Créer un ticket', 'Stats support'],
  },
  crm: {
    icon: Building2,
    label: 'CRM',
    color: 'text-violet-500',
    suggestions: ['Pipeline commercial', 'Prospects froids', 'Prochaines relances'],
  },
  calendar: {
    icon: Sparkles,
    label: 'Agenda',
    color: 'text-pink-500',
    suggestions: ['Réunions du jour', 'Planifier un RDV', 'Disponibilités'],
  },
  tresorerie: {
    icon: DollarSign,
    label: 'Trésorerie',
    color: 'text-amber-500',
    suggestions: ['Solde actuel', 'Factures impayées', 'Prévisions de trésorerie'],
  },
  rd: {
    icon: Lightbulb,
    label: 'R&D',
    color: 'text-cyan-500',
    suggestions: ['Sprint actuel', 'Vélocité', 'Backlog prioritaire'],
  },
  formation: {
    icon: Sparkles,
    label: 'Formation',
    color: 'text-teal-500',
    suggestions: ['Sessions à venir', 'Émargements en attente', 'Stats formations'],
  },
}

export function JarvisOverlay({
  onOpenFullPanel,
  onSendMessage,
  onStartVoice,
  wakeWordEnabled = false,
}: JarvisOverlayProps) {
  const location = useLocation()
  const { focusContext, currentMode } = useJarvisFocus()
  const { topPrediction, getPredictionCommand } = useJarvisPredictions()

  const [isExpanded, setIsExpanded] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isHovered, setIsHovered] = useState(false)

  // Wake Word Detection
  const handleWakeWordDetected = useCallback(() => {
    setIsExpanded(true)
    // Auto-start voice after wake word
    onStartVoice()
  }, [onStartVoice])

  const {
    isListening: isWakeWordListening,
    isDetected: isWakeWordDetected,
    startListening: startWakeWord,
    stopListening: stopWakeWord,
    confidence: wakeWordConfidence,
  } = useJarvisWakeWord({
    autoStart: wakeWordEnabled,
    onWakeUp: handleWakeWordDetected,
    wakeWords: ['jarvis', 'hey jarvis', 'ok jarvis'],
    sensitivity: 'medium',
  })

  const config = MODE_CONFIG[currentMode] || MODE_CONFIG.general
  const Icon = config.icon

  // Fermer l'overlay sur changement de page
  useEffect(() => {
    setIsExpanded(false)
  }, [location.pathname])

  // A11y : fermer l'overlay via Escape lorsqu'il est ouvert
  useEffect(() => {
    if (!isExpanded) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isExpanded])

  const handleSend = useCallback(() => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim())
      setInputValue('')
      setIsExpanded(false)
    }
  }, [inputValue, onSendMessage])

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      onSendMessage(suggestion)
      setIsExpanded(false)
    },
    [onSendMessage]
  )

  const handlePredictionClick = useCallback(() => {
    if (topPrediction) {
      const command = getPredictionCommand(topPrediction)
      onSendMessage(command)
      setIsExpanded(false)
    }
  }, [topPrediction, getPredictionCommand, onSendMessage])

  return (
    <>
      {/* Mini-bulle flottante */}
      <motion.div
        className={cn('fixed bottom-6 right-6 z-50', isExpanded && 'pointer-events-none opacity-0')}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: isExpanded ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Button
          onClick={() => setIsExpanded(true)}
          size="lg"
          className={cn(
            'h-14 w-14 rounded-full',
            'bg-primary hover:bg-primary/90',
            'transition-colors duration-300',
            isHovered && 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background'
          )}
        >
          <Icon className="h-6 w-6 text-primary-foreground" />
        </Button>

        {/* Badge de contexte */}
        <AnimatePresence>
          {isHovered && currentMode !== 'general' && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="absolute right-full mr-3 top-1/2 -translate-y-1/2"
            >
              <Badge
                variant="secondary"
                className={cn('whitespace-nowrap shadow-md', config.color)}
              >
                Mode {config.label}
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Indicateur de prédiction */}
        <AnimatePresence>
          {topPrediction && topPrediction.confidence > 0.7 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-warning flex items-center justify-center"
            >
              <Zap className="h-2.5 w-2.5 text-warning-foreground" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Overlay expandé */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
              onClick={() => setIsExpanded(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed bottom-6 right-6 z-50 w-[380px]"
            >
              <Card className="overflow-hidden shadow-2xl shadow-primary/10 border-primary/20">
                {/* Header */}
                <div className="p-4 bg-gradient-to-r from-primary/10 to-transparent border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5',
                          'ring-1 ring-primary/20'
                        )}
                      >
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">Jarvis</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <span
                            className={cn(
                              'inline-block w-1.5 h-1.5 rounded-full',
                              config.color,
                              'bg-current'
                            )}
                          />
                          Mode {config.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onOpenFullPanel}
                        aria-label="Précédent"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setIsExpanded(false)}
                        aria-label="Fermer"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Prédiction */}
                {topPrediction && topPrediction.confidence > 0.6 && (
                  <div className="p-3 bg-warning/5 border-b border-warning/20">
                    <button onClick={handlePredictionClick} className="w-full text-left group">
                      <div className="flex items-start gap-2">
                        <Zap className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-warning">
                            Suggestion intelligente
                          </p>
                          <p className="text-sm text-foreground mt-0.5 line-clamp-2 group-hover:text-primary transition-colors">
                            {topPrediction.description}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </div>
                    </button>
                  </div>
                )}

                {/* Suggestions contextuelles */}
                <div className="p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Actions rapides</p>
                  <div className="flex flex-wrap gap-1.5">
                    {config.suggestions.map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="secondary"
                        size="sm"
                        className="h-7 text-xs bg-muted/50 hover:bg-muted"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Établissement focus */}
                {focusContext.etablissement_name && (
                  <div className="px-3 pb-2">
                    <Badge variant="outline" className="text-xs">
                      <Building2 className="h-3 w-3 mr-1" />
                      {focusContext.etablissement_name}
                    </Badge>
                  </div>
                )}

                {/* Wake Word Status */}
                {wakeWordEnabled && (
                  <div className="px-3 pb-2">
                    <Badge
                      variant={isWakeWordListening ? 'default' : 'outline'}
                      className={cn(
                        'text-xs transition-all',
                        isWakeWordListening &&
                          'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                      )}
                    >
                      {isWakeWordListening ? (
                        <>
                          <Volume2 className="h-3 w-3 mr-1 animate-pulse" />
                          Écoute "Hey Jarvis"
                        </>
                      ) : (
                        <>
                          <MicOff className="h-3 w-3 mr-1" />
                          Wake word désactivé
                        </>
                      )}
                    </Badge>
                  </div>
                )}

                {/* Input */}
                <div className="p-3 border-t border-border/50 bg-muted/30">
                  <div className="flex gap-2">
                    <Button
                      variant={isWakeWordListening ? 'default' : 'outline'}
                      size="icon"
                      className={cn(
                        'h-10 w-10 shrink-0 transition-all',
                        isWakeWordListening && 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      )}
                      onClick={() => {
                        if (isWakeWordListening) {
                          stopWakeWord()
                        } else if (wakeWordEnabled) {
                          startWakeWord()
                        } else {
                          onStartVoice()
                        }
                      }}
                      aria-label="Volume"
                    >
                      {isWakeWordListening ? (
                        <Volume2 className="h-4 w-4 animate-pulse" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="flex-1 relative">
                      <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={
                          isWakeWordListening ? "Dites 'Hey Jarvis'..." : 'Demandez à Jarvis...'
                        }
                        className="pr-10 bg-background/80"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                        onClick={handleSend}
                        disabled={!inputValue.trim()}
                        aria-label="Envoyer"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Wake Word Indicator - bottom left when not expanded */}
      {wakeWordEnabled && !isExpanded && (
        <JarvisWakeWordIndicator
          isListening={isWakeWordListening}
          isDetected={isWakeWordDetected}
          confidence={wakeWordConfidence}
          onToggle={() => (isWakeWordListening ? stopWakeWord() : startWakeWord())}
          compact
        />
      )}
    </>
  )
}
