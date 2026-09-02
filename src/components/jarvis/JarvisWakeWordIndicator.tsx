/**
 * JarvisWakeWordIndicator - Visual indicator for wake word detection status
 *
 * Shows when Jarvis is listening for the wake word "Hey Jarvis"
 * V11: Supports both internal hook usage and external state control
 */

import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, AudioWaveform } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useJarvisWakeWord } from '@/hooks/jarvis/useJarvisWakeWord'

interface JarvisWakeWordIndicatorProps {
  // External control mode
  isListening?: boolean
  isDetected?: boolean
  confidence?: number
  onToggle?: () => void

  // Internal hook mode
  onWakeUp?: () => void
  autoStart?: boolean

  // Common
  className?: string
  compact?: boolean
}

export function JarvisWakeWordIndicator({
  // External control props
  isListening: externalIsListening,
  isDetected: externalIsDetected,
  confidence: externalConfidence,
  onToggle,

  // Internal hook props
  onWakeUp,
  autoStart = false,

  // Common
  className,
  compact = false,
}: JarvisWakeWordIndicatorProps) {
  // Use internal hook only if external control is not provided
  const useExternalControl = externalIsListening !== undefined

  const internalHook = useJarvisWakeWord({
    onWakeUp: () => {
      onWakeUp?.()
      setTimeout(() => internalHook.resetDetection(), 3000)
    },
    autoStart: useExternalControl ? false : autoStart,
    sensitivity: 'medium',
  })

  // Resolve which values to use
  const isListening = useExternalControl ? externalIsListening : internalHook.isListening
  const isDetected = useExternalControl ? (externalIsDetected ?? false) : internalHook.isDetected
  const confidence = useExternalControl ? (externalConfidence ?? 0) : internalHook.confidence

  const handleToggle = () => {
    if (onToggle) {
      onToggle()
    } else if (isListening) {
      internalHook.stopListening()
    } else {
      internalHook.startListening()
    }
  }

  // Compact version for overlay
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className={cn(
          'fixed bottom-6 left-6 z-50 flex items-center gap-2 px-3 py-2 rounded-full',
          'bg-background/80 backdrop-blur-sm border shadow-lg',
          isDetected ? 'border-accent' : isListening ? 'border-primary/50' : 'border-border',
          className
        )}
      >
        <motion.button
          onClick={handleToggle}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full transition-all',
            isDetected
              ? 'bg-accent/20 text-accent-foreground'
              : isListening
                ? 'bg-primary/20 text-primary'
                : 'bg-muted text-muted-foreground'
          )}
          whileTap={{ scale: 0.95 }}
        >
          {isDetected ? (
            <AudioWaveform className="w-4 h-4" />
          ) : isListening ? (
            <Mic className="w-4 h-4" />
          ) : (
            <MicOff className="w-4 h-4" />
          )}
        </motion.button>

        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {isDetected ? 'Jarvis activé!' : isListening ? '"Hey Jarvis"...' : 'Wake word off'}
        </span>

        {/* Pulse animation */}
        {isListening && !isDetected && (
          <motion.span
            className="absolute left-3 w-8 h-8 rounded-full bg-primary/20"
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </motion.div>
    )
  }

  // Full version
  return (
    <div className={cn('relative flex items-center gap-2', className)}>
      {/* Status indicator */}
      <motion.button
        onClick={handleToggle}
        className={cn(
          'relative flex items-center justify-center w-10 h-10 rounded-full transition-all',
          'border-2',
          isDetected
            ? 'bg-accent/20 border-accent text-accent-foreground'
            : isListening
              ? 'bg-primary/20 border-primary text-primary'
              : 'bg-muted border-border text-muted-foreground hover:border-primary/50'
        )}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {isDetected ? (
            <motion.div
              key="detected"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <AudioWaveform className="w-5 h-5" />
            </motion.div>
          ) : isListening ? (
            <motion.div
              key="listening"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Mic className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <MicOff className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse animation when listening */}
        {isListening && !isDetected && (
          <motion.div
            className="absolute inset-0 rounded-full bg-primary/30"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {/* Success animation when detected */}
        {isDetected && (
          <motion.div
            className="absolute inset-0 rounded-full bg-accent/20"
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 0.5 }}
          />
        )}
      </motion.button>

      {/* Status text */}
      <AnimatePresence>
        {(isListening || isDetected) && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex flex-col"
          >
            <span
              className={cn(
                'text-sm font-medium',
                isDetected ? 'text-accent-foreground' : 'text-primary'
              )}
            >
              {isDetected ? 'Wake word détecté!' : 'Écoute en cours...'}
            </span>
            <span className="text-xs text-muted-foreground">
              {isDetected ? `Confiance: ${Math.round(confidence * 100)}%` : 'Dites "Hey Jarvis"'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
