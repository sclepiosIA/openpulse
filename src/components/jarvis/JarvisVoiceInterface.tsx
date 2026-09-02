/**
 * JarvisVoiceInterface - Interface vocale bidirectionnelle pour Jarvis - Premium Immersive
 */

import { useCallback } from 'react'
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisVoice } from '@/hooks/jarvis/useJarvisVoice'

interface JarvisVoiceInterfaceProps {
  onCommand?: (command: string) => void
  className?: string
}

export function JarvisVoiceInterface({ onCommand, className }: JarvisVoiceInterfaceProps) {
  const handleVoiceCommand = useCallback(
    (cmd: { type: string; query?: string }) => {
      if (cmd.type === 'ask' && cmd.query) {
        onCommand?.(cmd.query)
      }
    },
    [onCommand]
  )

  const {
    isListening,
    isSpeaking,
    isAwake,
    transcript,
    startListening,
    stopListening,
    stopSpeaking,
  } = useJarvisVoice({
    onCommand: handleVoiceCommand,
  })

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Microphone button */}
      <Button
        variant={isListening ? 'default' : 'outline'}
        size="icon"
        className={cn(
          'relative h-10 w-10 rounded-full transition-colors border-border/50',
          isListening &&
            'bg-primary hover:bg-primary/90 ring-2 ring-primary/30 ring-offset-2 ring-offset-background',
          isAwake &&
            !isListening &&
            'ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-background'
        )}
        onClick={isListening ? stopListening : startListening}
        aria-label={isListening ? 'Arrêter le micro' : 'Démarrer le micro'}
        aria-pressed={isListening}
      >
        <AnimatePresence mode="wait">
          {isListening ? (
            <motion.div
              key="listening"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Mic className="h-5 w-5" />
            </motion.div>
          ) : (
            <motion.div
              key="not-listening"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <MicOff className="h-5 w-5 text-muted-foreground" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse animation when listening */}
        {isListening && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/30"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/20"
              animate={{ scale: [1, 2, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
            />
          </>
        )}

        {/* Awake indicator */}
        {isAwake && !isListening && (
          <motion.div
            className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500 }}
          />
        )}
      </Button>

      {/* Speaker button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-10 w-10 rounded-full border border-border/30 hover:bg-muted/50',
          isSpeaking && 'bg-primary/10 border-primary/30'
        )}
        onClick={isSpeaking ? stopSpeaking : undefined}
        disabled={!isSpeaking}
        aria-label={isSpeaking ? 'Couper la voix' : 'Voix inactive'}
      >
        <AnimatePresence mode="wait">
          {isSpeaking ? (
            <motion.div
              key="speaking"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="relative"
            >
              <Volume2 className="h-5 w-5 text-primary" />
              <motion.div
                className="absolute -right-1 -top-1"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <div className="h-2 w-2 rounded-full bg-primary" />
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="not-speaking"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <VolumeX className="h-5 w-5 text-muted-foreground" />
            </motion.div>
          )}
        </AnimatePresence>
      </Button>

      {/* Transcript display */}
      <AnimatePresence>
        {(isListening || transcript) && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex-1 min-w-0"
          >
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50">
              {isListening && !transcript && (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
              <span
                className={cn('text-sm truncate', !transcript && 'text-muted-foreground italic')}
              >
                {transcript || (isAwake ? 'Jarvis vous écoute...' : 'Dites "Jarvis"...')}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * JarvisVoiceButton - Bouton vocal compact
 */
export function JarvisVoiceButton({ className }: { className?: string }) {
  const { isListening, isAwake, startListening, stopListening } = useJarvisVoice()

  return (
    <Button
      variant={isListening ? 'default' : 'ghost'}
      size="icon"
      className={cn(
        'h-8 w-8 rounded-full relative transition-colors',
        isListening && 'bg-primary hover:bg-primary/90',
        isAwake && !isListening && 'ring-1 ring-emerald-500/50',
        className
      )}
      onClick={isListening ? stopListening : startListening}
      aria-label="Micro"
    >
      {isListening ? (
        <Mic className="h-4 w-4" />
      ) : (
        <MicOff className="h-4 w-4 text-muted-foreground" />
      )}
      {isAwake && (
        <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-background" />
      )}
    </Button>
  )
}
