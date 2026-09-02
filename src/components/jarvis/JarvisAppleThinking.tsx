/**
 * JarvisAppleThinking - Indicateur de réflexion style Apple (v15.5)
 * 
 * Animation sophistiquée avec rotation d'états dynamiques:
 * - Analyse → Recherche → Génération
 * - Points animés combinés avec texte
 * - Design premium aligné Apple
 */

import { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JarvisAppleThinkingProps {
  className?: string;
}

// États de réflexion avec icônes
const THINKING_STATES = [
  { text: 'Analyse en cours', icon: Brain },
  { text: 'Recherche d\'informations', icon: Search },
  { text: 'Génération de la réponse', icon: Sparkles },
];

export const JarvisAppleThinking = memo(function JarvisAppleThinking({
  className,
}: JarvisAppleThinkingProps) {
  const [stateIndex, setStateIndex] = useState(0);
  
  // Rotation automatique des états
  useEffect(() => {
    const interval = setInterval(() => {
      setStateIndex((prev) => (prev + 1) % THINKING_STATES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);
  
  const currentState = THINKING_STATES[stateIndex];
  const Icon = currentState.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn("flex justify-start", className)}
    >
      <div className="bg-muted/70 backdrop-blur-sm rounded-2xl rounded-bl-md px-4 py-3 border border-border/30">
        <div className="flex items-center gap-3">
          {/* Icône animée */}
          <motion.div
            key={stateIndex}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10"
          >
            <Icon className="w-3.5 h-3.5 text-primary" />
          </motion.div>
          
          {/* Texte dynamique */}
          <AnimatePresence mode="wait">
            <motion.span
              key={stateIndex}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 5 }}
              transition={{ duration: 0.2 }}
              className="text-sm text-muted-foreground font-medium"
            >
              {currentState.text}
            </motion.span>
          </AnimatePresence>
          
          {/* Points animés */}
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={`jarvis-apple-thinking-dot-${i}`}
                className="w-1.5 h-1.5 rounded-full bg-primary"
                animate={{
                  scale: [1, 1.4, 1],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

// Alternative simple: Dots only (pour les contextes où le texte n'est pas souhaité)
export const JarvisAppleThinkingDots = memo(function JarvisAppleThinkingDots({
  className,
}: JarvisAppleThinkingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn("flex justify-start", className)}
    >
      <div className="bg-muted/70 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={`jarvis-apple-thinking-dots-${i}`}
              className="w-2 h-2 rounded-full bg-primary"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.3, 0.8, 0.3],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
});

// Alternative: Subtle pulse animation
export const JarvisAppleThinkingPulse = memo(function JarvisAppleThinkingPulse({
  className,
}: JarvisAppleThinkingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn("flex justify-start", className)}
    >
      <motion.div 
        className="bg-muted/70 rounded-2xl rounded-bl-md px-5 py-3"
        animate={{
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <span className="text-sm text-muted-foreground">
          Jarvis réfléchit...
        </span>
      </motion.div>
    </motion.div>
  );
});
