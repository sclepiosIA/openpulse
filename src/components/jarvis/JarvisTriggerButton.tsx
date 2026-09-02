/**
 * JarvisTriggerButton - Bouton flottant mobile uniquement - Premium Immersive
 * Sur desktop, Jarvis est intégré au logo dans la sidebar (JarvisLogoTrigger)
 */

import { useState } from 'react'
import { Bot, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvis } from '@/hooks/jarvis/useJarvis'
import { JarvisPremiumPanel } from './JarvisPremiumPanel'
import { useMediaQuery } from '@/hooks/shared/use-media-query'

interface JarvisTriggerButtonProps {
  className?: string
}

/**
 * Bouton flottant Jarvis - MOBILE UNIQUEMENT
 * Sur desktop (md+), le logo dans la sidebar sert de trigger
 */
export function JarvisTriggerButton({ className }: JarvisTriggerButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { isEnabled, pendingCount } = useJarvis()
  const isMobile = useMediaQuery('(max-width: 767px)')

  // Ne pas afficher sur desktop - le logo sidebar prend le relais
  if (!isEnabled || !isMobile) return null

  return (
    <>
      {/* Floating trigger button - MOBILE ONLY */}
      <motion.div
        className={cn('fixed bottom-20 right-4 z-50 md:hidden', className)}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      >
        <Button
          size="lg"
          className={cn(
            'h-16 w-16 rounded-2xl relative overflow-hidden',
            'bg-primary hover:bg-primary/90',
            'transition-colors duration-300 border border-white/10',
            isOpen && 'rotate-180'
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          {/* Background glow effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent"
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -180, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 180, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative z-10"
              >
                <X className="h-7 w-7" />
              </motion.div>
            ) : (
              <motion.div
                key="bot"
                initial={{ rotate: 180, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -180, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative z-10"
              >
                <Sparkles className="h-7 w-7" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pending count badge */}
          {pendingCount > 0 && !isOpen && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 z-20"
            >
              <Badge className="h-6 w-6 p-0 flex items-center justify-center rounded-full text-xs font-bold bg-gradient-to-br from-destructive to-destructive/90 border-2 border-background shadow-lg">
                {pendingCount > 9 ? '9+' : pendingCount}
              </Badge>
            </motion.div>
          )}

          {/* Pulse animations when has pending */}
          {pendingCount > 0 && !isOpen && (
            <>
              <motion.div
                className="absolute inset-0 rounded-2xl bg-primary"
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-0 rounded-2xl bg-primary"
                animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0, 0.2] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
              />
            </>
          )}
        </Button>
      </motion.div>

      {/* Mobile Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-[90vw] sm:w-[400px] p-0 border-l-primary/10">
          <SheetTitle className="sr-only">Assistant Jarvis</SheetTitle>
          <SheetDescription className="sr-only">
            Assistant IA proactif pour vous aider dans vos tâches
          </SheetDescription>
          <JarvisPremiumPanel onClose={() => setIsOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
