/**
 * JarvisMiniFab - Bouton flottant miniature pour Jarvis en arrière-plan
 * 
 * S'affiche uniquement quand Jarvis travaille en arrière-plan ou a une réponse prête.
 * Positionné à gauche du bouton Feedback.
 */

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useJarvisUnifiedOptional } from '@/contexts/JarvisUnifiedContext';
// Cadre carre de 24 px : la charte fournit un symbole allege pour cette
// taille, ou le dessin complet devient une tache.
import symboleMarque from '@/assets/marque/symbole-reduit.svg';

export const JarvisMiniFab = memo(function JarvisMiniFab() {
  const ctx = useJarvisUnifiedOptional();
  
  if (!ctx) return null;
  
  const { isMinimized, isProcessingInBackground, hasCompletedResponse, restorePanel } = ctx;
  
  // Ne s'affiche que quand Jarvis est minimisé
  if (!isMinimized) return null;
  
  const isReady = hasCompletedResponse;
  const isWorking = isProcessingInBackground;
  
  return (
    <AnimatePresence>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        onClick={restorePanel}
        className={cn(
          'fixed bottom-4 right-20 z-50',
          'h-12 w-12 rounded-full',
          'flex items-center justify-center',
          'shadow-lg border border-border/50',
          'cursor-pointer transition-shadow duration-300',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isReady
            ? 'bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.4)] border-emerald-500/30'
            : 'bg-background/95 backdrop-blur-sm',
        )}
        aria-label={isReady ? 'Jarvis a terminé - Cliquer pour voir la réponse' : 'Jarvis travaille en arrière-plan'}
      >
        {/* Processing spinner ring */}
        {isWorking && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary/60"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          />
        )}
        
        {/* Ready glow pulses */}
        {isReady && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full bg-emerald-500/20"
              animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-full bg-emerald-500/15"
              animate={{ scale: [1, 1.6], opacity: [0.3, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            />
          </>
        )}
        
        {/* Logo */}
        <motion.img
          src={symboleMarque}
          alt="Jarvis"
          className="h-6 w-6 object-contain relative z-10"
          animate={isWorking ? { rotate: [0, 360] } : {}}
          transition={isWorking ? { duration: 3, repeat: Infinity, ease: 'linear' } : {}}
        />
        
        {/* Ready badge */}
        {isReady && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 z-20 h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold ring-2 ring-background shadow-md"
          >
            ✓
          </motion.div>
        )}
      </motion.button>
    </AnimatePresence>
  );
});
