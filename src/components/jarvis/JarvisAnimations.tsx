/**
 * JarvisTypingDots - Animation de frappe ultra-fluide (v14.0)
 */

import { memo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface JarvisTypingDotsProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'muted' | 'white'
  className?: string
}

export const JarvisTypingDots = memo(function JarvisTypingDots({
  size = 'md',
  color = 'primary',
  className,
}: JarvisTypingDotsProps) {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  }

  const colorClasses = {
    primary: 'bg-primary',
    muted: 'bg-muted-foreground',
    white: 'bg-card',
  }

  const gapClasses = {
    sm: 'gap-1',
    md: 'gap-1.5',
    lg: 'gap-2',
  }

  return (
    <div className={cn('flex items-center', gapClasses[size], className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={`typing-dot-${i}`}
          className={cn('rounded-full', sizeClasses[size], colorClasses[color])}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.4, 1, 0.4],
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
  )
})

/**
 * JarvisWaveIndicator - Indicateur audio wave (v14.0)
 */
export const JarvisWaveIndicator = memo(function JarvisWaveIndicator({
  className,
  isActive = true,
}: {
  className?: string
  isActive?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-center gap-0.5 h-6', className)}>
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={`wave-bar-${i}`}
          className="w-1 bg-primary rounded-full"
          animate={
            isActive
              ? {
                  height: ['8px', '20px', '8px'],
                }
              : {
                  height: '8px',
                }
          }
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.08,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
})

/**
 * JarvisOrbitalLoader - Loader orbital futuriste (v14.0)
 */
export const JarvisOrbitalLoader = memo(function JarvisOrbitalLoader({
  size = 40,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      {/* Outer ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-primary/20"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />

      {/* Middle ring */}
      <motion.div
        className="absolute inset-1 rounded-full border-2 border-primary/40"
        animate={{ rotate: -360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />

      {/* Orbiting dots */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={`orbit-dot-${i}`}
          className="absolute w-2 h-2 bg-primary rounded-full"
          style={{
            top: '50%',
            left: '50%',
            marginTop: '-4px',
            marginLeft: '-4px',
          }}
          animate={{
            x: [
              Math.cos((i * 2 * Math.PI) / 3) * (size / 2 - 6),
              Math.cos((i * 2 * Math.PI) / 3 + Math.PI) * (size / 2 - 6),
              Math.cos((i * 2 * Math.PI) / 3 + 2 * Math.PI) * (size / 2 - 6),
            ],
            y: [
              Math.sin((i * 2 * Math.PI) / 3) * (size / 2 - 6),
              Math.sin((i * 2 * Math.PI) / 3 + Math.PI) * (size / 2 - 6),
              Math.sin((i * 2 * Math.PI) / 3 + 2 * Math.PI) * (size / 2 - 6),
            ],
            opacity: [1, 0.5, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Center core */}
      <motion.div
        className="absolute inset-0 m-auto w-3 h-3 rounded-full bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/40"
        animate={{
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    </div>
  )
})

/**
 * JarvisPulseRing - Indicateur de pulsation (v14.0)
 */
export const JarvisPulseRing = memo(function JarvisPulseRing({
  size = 48,
  color = 'primary',
  className,
}: {
  size?: number
  color?: 'primary' | 'success' | 'warning'
  className?: string
}) {
  const colorClasses = {
    primary: 'bg-primary',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
  }

  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      {/* Pulsing rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={`pulse-ring-${i}`}
          className={cn('absolute inset-0 rounded-full', colorClasses[color])}
          animate={{
            scale: [1, 1.5 + i * 0.2],
            opacity: [0.4 - i * 0.1, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.4,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Core */}
      <motion.div
        className={cn('relative w-1/3 h-1/3 rounded-full', colorClasses[color], 'shadow-lg')}
        style={{
          boxShadow: `0 0 20px ${color === 'primary' ? 'hsl(var(--primary) / 0.5)' : color === 'success' ? 'rgb(16 185 129 / 0.5)' : 'rgb(245 158 11 / 0.5)'}`,
        }}
        animate={{
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    </div>
  )
})
