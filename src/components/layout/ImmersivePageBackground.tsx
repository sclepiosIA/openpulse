import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useShouldAnimate } from '@/hooks/ui/useShouldAnimate'

interface ImmersivePageBackgroundProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'subtle'
}

const floatingElements = [
  { size: 80, x: '10%', y: '20%', duration: 8, delay: 0, color: 'hsl(197 64% 85% / 0.3)' },
  { size: 120, x: '85%', y: '15%', duration: 10, delay: 1, color: 'hsl(210 70% 88% / 0.25)' },
  { size: 60, x: '75%', y: '65%', duration: 9, delay: 2, color: 'hsl(200 22% 90% / 0.3)' },
  { size: 100, x: '15%', y: '75%', duration: 11, delay: 0.5, color: 'hsl(220 87% 85% / 0.2)' },
]

/**
 * Composant wrapper fournissant un fond immersif premium avec dégradés bleus,
 * radial gradients et éléments flottants animés pour une cohérence visuelle.
 */
export function ImmersivePageBackground({
  children,
  className,
  variant = 'default',
}: ImmersivePageBackgroundProps) {
  const shouldAnimate = useShouldAnimate()
  return (
    <div className={cn('relative min-h-dvh', className)}>
      {/* Background avec radial gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        {/* Dégradé principal */}
        <div className="absolute inset-0 bg-marque-papier" />

        {/* Radial cyan en haut à droite */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-marque-pastel-cyan rounded-full blur-3xl opacity-40" />

        {/* Radial bleu en milieu gauche */}
        <div className="absolute top-1/3 -left-48 w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-30" />

        {/* Radial orange subtil en bas (uniquement variant default) */}
        {variant === 'default' && (
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-orange-100 rounded-full blur-3xl opacity-20" />
        )}

        {/* Floating elements - conditionally animated */}
        {floatingElements.map((element) =>
          shouldAnimate ? (
            <motion.div
              key={`${element.x}-${element.y}`}
              className="absolute rounded-full blur-2xl"
              style={{
                width: element.size,
                height: element.size,
                left: element.x,
                top: element.y,
                backgroundColor: element.color,
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: [0, -15, 0],
                x: [0, 8, 0],
              }}
              transition={{
                opacity: { duration: 0.8, delay: element.delay },
                scale: { duration: 0.8, delay: element.delay },
                y: {
                  duration: element.duration,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: element.delay,
                },
                x: {
                  duration: element.duration * 1.3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: element.delay,
                },
              }}
            />
          ) : (
            <div
              key={`${element.x}-${element.y}`}
              className="absolute rounded-full blur-2xl"
              style={{
                width: element.size,
                height: element.size,
                left: element.x,
                top: element.y,
                backgroundColor: element.color,
              }}
            />
          )
        )}

        {/* Geometric shapes - conditionally animated */}
        {shouldAnimate ? (
          <>
            <motion.div
              className="absolute w-24 h-24 border border-primary/10 rounded-2xl"
              style={{ left: '8%', top: '45%', rotate: 15 }}
              animate={{ rotate: [15, 25, 15] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute w-16 h-16 border border-primary/5 rounded-full"
              style={{ right: '12%', top: '55%' }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        ) : (
          <>
            <div
              className="absolute w-24 h-24 border border-primary/10 rounded-2xl"
              style={{ left: '8%', top: '45%', transform: 'rotate(15deg)' }}
            />
            <div
              className="absolute w-16 h-16 border border-primary/5 rounded-full"
              style={{ right: '12%', top: '55%' }}
            />
          </>
        )}
      </div>

      {/* Contenu */}
      <div className="relative z-0">{children}</div>
    </div>
  )
}
