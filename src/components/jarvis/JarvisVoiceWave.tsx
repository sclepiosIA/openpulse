/**
 * JarvisVoiceWave - Visualisation audio pour voice input (v14.0)
 * 
 * Affichage temps réel de l'amplitude audio pendant l'enregistrement vocal
 */

import { memo, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { vibrateSelection, vibrateSuccess } from '@/lib/haptics';

interface JarvisVoiceWaveProps {
  isActive: boolean;
  isProcessing?: boolean;
  onStart: () => void;
  onStop: () => void;
  className?: string;
}

export const JarvisVoiceWave = memo(function JarvisVoiceWave({
  isActive,
  isProcessing = false,
  onStart,
  onStop,
  className,
}: JarvisVoiceWaveProps) {
  const [amplitudes, setAmplitudes] = useState<number[]>(Array(12).fill(0.3));
  const animationRef = useRef<number>();

  // Simulate voice amplitudes when active
  useEffect(() => {
    if (isActive && !isProcessing) {
      const animate = () => {
        setAmplitudes(prev => 
          prev.map(() => 0.3 + Math.random() * 0.7)
        );
        animationRef.current = requestAnimationFrame(animate);
      };
      
      // Throttle to ~20fps
      const interval = setInterval(() => {
        animationRef.current = requestAnimationFrame(animate);
      }, 50);
      
      return () => {
        clearInterval(interval);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        setAmplitudes(Array(12).fill(0.3));
      };
    }
  }, [isActive, isProcessing]);

  const handleToggle = () => {
    vibrateSelection();
    if (isActive) {
      onStop();
      vibrateSuccess();
    } else {
      onStart();
    }
  };

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {/* Voice button */}
      <motion.div whileTap={{ scale: 0.9 }}>
        <Button
          size="lg"
          onClick={handleToggle}
          disabled={isProcessing}
          className={cn(
            "h-14 w-14 rounded-full transition-all duration-300",
            isActive ? [
              "bg-destructive text-destructive-foreground",
              "shadow-lg shadow-destructive/30",
              "hover:bg-destructive/90"
            ] : [
              "bg-primary text-primary-foreground",
              "shadow-lg shadow-primary/30",
              "hover:bg-primary/90"
            ]
          )}
        >
          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <Loader2 className="h-6 w-6 animate-spin" />
              </motion.div>
            ) : isActive ? (
              <motion.div
                key="stop"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <Square className="h-5 w-5 fill-current" />
              </motion.div>
            ) : (
              <motion.div
                key="mic"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <Mic className="h-6 w-6" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </motion.div>

      {/* Wave visualization */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="flex items-center gap-0.5 h-10 overflow-hidden"
          >
            {amplitudes.map((amplitude, i) => (
              <motion.div
                key={`jarvis-voice-wave-bar-${i}`}
                className="w-1 bg-primary rounded-full"
                animate={{
                  height: isProcessing ? 8 : amplitude * 40,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 20,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status text */}
      <AnimatePresence>
        {isActive && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="text-sm text-muted-foreground"
          >
            {isProcessing ? 'Traitement...' : 'Parlez maintenant...'}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
});

/**
 * JarvisVoiceOverlay - Overlay plein écran pour voice input (v14.0)
 */
export const JarvisVoiceOverlay = memo(function JarvisVoiceOverlay({
  isOpen,
  isProcessing = false,
  transcript = '',
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  isProcessing?: boolean;
  transcript?: string;
  onClose: () => void;
  onSubmit: (text: string) => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl"
          onClick={onClose}
        >
          {/* Animated background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={`jarvis-voice-wave-bg-${i}`}
                className="absolute rounded-full bg-primary/5"
                style={{
                  width: 200 + i * 100,
                  height: 200 + i * 100,
                  top: '50%',
                  left: '50%',
                  marginTop: -(100 + i * 50),
                  marginLeft: -(100 + i * 50),
                }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.1, 0.3],
                }}
                transition={{
                  duration: 2 + i * 0.5,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              />
            ))}
          </div>

          {/* Content */}
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="relative flex flex-col items-center gap-8 p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Microphone button */}
            <motion.div
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center",
                "bg-gradient-to-br from-primary to-primary/80",
                "shadow-2xl shadow-primary/40"
              )}
              animate={{
                scale: isProcessing ? [1, 1.05, 1] : 1,
              }}
              transition={{ duration: 1, repeat: isProcessing ? Infinity : 0 }}
            >
              {isProcessing ? (
                <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
              ) : (
                <Mic className="w-10 h-10 text-primary-foreground" />
              )}
            </motion.div>

            {/* Transcript */}
            <div className="min-h-[60px] max-w-md text-center">
              <AnimatePresence mode="wait">
                {transcript ? (
                  <motion.p
                    key="transcript"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-xl font-medium text-foreground"
                  >
                    "{transcript}"
                  </motion.p>
                ) : (
                  <motion.p
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-lg text-muted-foreground"
                  >
                    {isProcessing ? 'Traitement en cours...' : 'Posez votre question...'}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={onClose}
                className="rounded-full px-6"
              >
                Annuler
              </Button>
              {transcript && (
                <Button
                  onClick={() => onSubmit(transcript)}
                  disabled={isProcessing}
                  className="rounded-full px-6"
                >
                  Envoyer
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
