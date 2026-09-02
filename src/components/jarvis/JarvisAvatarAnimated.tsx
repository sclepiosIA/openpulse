/**
 * JarvisAvatarAnimated - Avatar premium avec animations avancées (v15.0)
 * 
 * Différents états visuels:
 * - idle: Animation subtile de respiration
 * - thinking: Rotation et pulsation
 * - speaking: Onde audio visualisée
 * - listening: Cercles concentriques
 * - success: Flash vert avec confetti
 * - error: Shake rouge
 */

import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { cn } from '@/lib/utils';
import jarvisLogo from '@/assets/jarvis-logo.png';

type AvatarState = 'idle' | 'thinking' | 'speaking' | 'listening' | 'success' | 'error';

interface JarvisAvatarAnimatedProps {
  state?: AvatarState;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showGlow?: boolean;
  showRings?: boolean;
  className?: string;
}

const SIZE_CONFIG = {
  sm: { container: 'w-8 h-8', logo: 'w-4 h-4', glow: '-inset-1', ring: 'w-10 h-10' },
  md: { container: 'w-12 h-12', logo: 'w-6 h-6', glow: '-inset-1.5', ring: 'w-16 h-16' },
  lg: { container: 'w-16 h-16', logo: 'w-8 h-8', glow: '-inset-2', ring: 'w-20 h-20' },
  xl: { container: 'w-24 h-24', logo: 'w-12 h-12', glow: '-inset-3', ring: 'w-32 h-32' },
};

const STATE_COLORS = {
  idle: 'from-primary to-primary/80',
  thinking: 'from-amber-500 to-amber-600',
  speaking: 'from-primary to-blue-500',
  listening: 'from-violet-500 to-purple-600',
  success: 'from-emerald-500 to-green-600',
  error: 'from-red-500 to-rose-600',
};

export const JarvisAvatarAnimated = memo(function JarvisAvatarAnimated({
  state = 'idle',
  size = 'md',
  showGlow = true,
  showRings = true,
  className,
}: JarvisAvatarAnimatedProps) {
  const sizeConfig = SIZE_CONFIG[size];
  const controls = useAnimation();
  const [particles, setParticles] = useState<number[]>([]);

  // Trigger success particles
  useEffect(() => {
    if (state === 'success') {
      setParticles([...Array(6)].map((_, i) => i));
      setTimeout(() => setParticles([]), 1000);
    }
  }, [state]);

  // State-specific animations
  useEffect(() => {
    switch (state) {
      case 'thinking':
        controls.start({
          rotate: [0, 360],
          transition: { duration: 2, repeat: Infinity, ease: 'linear' }
        });
        break;
      case 'error':
        controls.start({
          x: [0, -5, 5, -5, 5, 0],
          transition: { duration: 0.4 }
        });
        break;
      case 'success':
        controls.start({
          scale: [1, 1.2, 1],
          transition: { duration: 0.4 }
        });
        break;
      default:
        controls.start({
          rotate: 0,
          x: 0,
          scale: 1,
          transition: { duration: 0.3 }
        });
    }
  }, [state, controls]);

  return (
    <div className={cn("relative", className)}>
      {/* Outer rings for listening state */}
      <AnimatePresence>
        {showRings && state === 'listening' && (
          <>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={`listening-ring-${i}`}
                className={cn(
                  "absolute inset-0 m-auto rounded-full border-2 border-violet-500/30",
                  sizeConfig.ring
                )}
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{
                  scale: [1, 1.5 + i * 0.2],
                  opacity: [0.6, 0],
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Audio wave rings for speaking state */}
      <AnimatePresence>
        {showRings && state === 'speaking' && (
          <>
            {[0, 1].map((i) => (
              <motion.div
                key={`speaking-ring-${i}`}
                className={cn(
                  "absolute inset-0 m-auto rounded-full border-2 border-primary/40",
                  sizeConfig.ring
                )}
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{
                  scale: [1, 1.3],
                  opacity: [0.5, 0],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.4,
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Glow effect */}
      {showGlow && (
        <motion.div
          className={cn(
            "absolute rounded-2xl blur-lg",
            sizeConfig.glow,
            "bg-gradient-to-br",
            STATE_COLORS[state]
          )}
          animate={{
            opacity: state === 'idle' ? [0.2, 0.4, 0.2] : state === 'thinking' ? [0.3, 0.6, 0.3] : 0.3,
            scale: state === 'thinking' ? [1, 1.1, 1] : 1,
          }}
          transition={{
            duration: state === 'thinking' ? 1 : 2,
            repeat: Infinity,
          }}
        />
      )}

      {/* Main avatar container */}
      <motion.div
        animate={controls}
        className={cn(
          "relative rounded-2xl",
          "flex items-center justify-center",
          "shadow-xl",
          "ring-2 ring-white/20",
          "bg-gradient-to-br",
          STATE_COLORS[state],
          sizeConfig.container
        )}
      >
        {/* Inner gradient overlay */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/10 via-transparent to-white/20" />

        {/* Logo with state-specific animation */}
        <motion.img
          src={jarvisLogo}
          alt="Jarvis"
          className={cn("relative object-contain drop-shadow-lg", sizeConfig.logo)}
          animate={
            state === 'idle' 
              ? { scale: [1, 1.02, 1] }
              : state === 'speaking'
              ? { y: [0, -2, 0, 2, 0] }
              : {}
          }
          transition={{
            duration: state === 'speaking' ? 0.3 : 3,
            repeat: Infinity,
          }}
        />

        {/* Thinking spinner overlay */}
        <AnimatePresence>
          {state === 'thinking' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-2xl overflow-hidden"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Success particles */}
      <AnimatePresence>
        {particles.map((i) => (
          <motion.div
            key={`particle-${i}`}
            className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-emerald-500"
            initial={{ scale: 0, x: 0, y: 0 }}
            animate={{
              scale: [0, 1, 0],
              x: Math.cos((i * 2 * Math.PI) / 6) * 30,
              y: Math.sin((i * 2 * Math.PI) / 6) * 30,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        ))}
      </AnimatePresence>

      {/* Status indicator dot */}
      <motion.div
        className={cn(
          "absolute -bottom-0.5 -right-0.5",
          "w-3 h-3 rounded-full",
          "ring-2 ring-background",
          "shadow-md",
          state === 'error' ? 'bg-red-500' :
          state === 'success' ? 'bg-emerald-500' :
          state === 'thinking' ? 'bg-amber-500' :
          state === 'listening' ? 'bg-violet-500' :
          state === 'speaking' ? 'bg-blue-500' :
          'bg-emerald-500'
        )}
        animate={
          state !== 'idle' && state !== 'success' && state !== 'error'
            ? { scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }
            : {}
        }
        transition={{ duration: 1, repeat: Infinity }}
      />
    </div>
  );
});

/**
 * JarvisAvatarMini - Version mini pour les listes et indicateurs
 */
export const JarvisAvatarMini = memo(function JarvisAvatarMini({
  state = 'idle',
  className,
}: {
  state?: AvatarState;
  className?: string;
}) {
  return (
    <div className={cn("relative w-6 h-6", className)}>
      <div className={cn(
        "w-full h-full rounded-lg",
        "bg-gradient-to-br",
        STATE_COLORS[state],
        "flex items-center justify-center",
        "shadow-sm"
      )}>
        <img loading="lazy" decoding="async" src={jarvisLogo} 
          alt="J" 
          className="w-3 h-3 object-contain" />
      </div>
      <motion.div
        className={cn(
          "absolute -bottom-0.5 -right-0.5",
          "w-2 h-2 rounded-full",
          "ring-1 ring-background",
          state === 'error' ? 'bg-red-500' :
          state === 'success' ? 'bg-emerald-500' :
          state === 'thinking' ? 'bg-amber-500' :
          'bg-emerald-500'
        )}
        animate={state === 'thinking' ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
    </div>
  );
});
