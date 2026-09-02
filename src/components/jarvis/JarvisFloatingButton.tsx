/**
 * JarvisFloatingButton - Bouton flottant ultra-premium (v14.0)
 * 
 * Features:
 * - Glassmorphism avec glow effects
 * - Animations fluides type Apple
 * - Badge de notification dynamique
 * - Hover label avec transition
 * - Support PWA et safe areas
 */

import { useState, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { vibrateSelection } from '@/lib/haptics';
import { useJarvis } from '@/hooks/jarvis/useJarvis';
import { useJarvisProactiveAlerts } from '@/hooks/jarvis/useJarvisProactiveAlerts';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { JarvisPremiumPanel } from './JarvisPremiumPanel';
import jarvisLogo from '@/assets/jarvis-logo.png';
import { JARVIS_ANIMATIONS } from './JarvisDesignSystem';

interface JarvisFloatingButtonProps {
  className?: string;
  position?: 'bottom-right' | 'bottom-left';
  variant?: 'sheet' | 'inline';
  disabled?: boolean;
}

export const JarvisFloatingButton = memo(function JarvisFloatingButton({
  className,
  position = 'bottom-right',
  variant = 'sheet',
  disabled = false,
}: JarvisFloatingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  
  const { pendingCount, isTyping } = useJarvis();
  const { unreadCount } = useJarvisProactiveAlerts();

  // Pulse animation when new notification
  useEffect(() => {
    if (unreadCount > 0 || pendingCount > 0) {
      setHasNewNotification(true);
      const timer = setTimeout(() => setHasNewNotification(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [unreadCount, pendingCount]);

  const handleOpen = useCallback(() => {
    vibrateSelection();
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    vibrateSelection();
    setIsOpen(false);
  }, []);

  const totalBadge = (pendingCount || 0) + (unreadCount || 0);

  const positionClasses = {
    'bottom-right': 'right-4 bottom-4 sm:right-6 sm:bottom-6',
    'bottom-left': 'left-4 bottom-4 sm:left-6 sm:bottom-6',
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            className={cn(
              "fixed z-50",
              positionClasses[position],
              "pb-[env(safe-area-inset-bottom)]",
              className
            )}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={JARVIS_ANIMATIONS.spring.bouncy}
          >
            {/* Multi-layer glow effect */}
            <AnimatePresence>
              {(hasNewNotification || isTyping) && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl"
                    initial={{ scale: 1, opacity: 0 }}
                    animate={{
                      scale: [1, 1.4, 1],
                      opacity: [0.3, 0.1, 0.3],
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-2xl bg-primary/20 blur-md"
                    initial={{ scale: 1, opacity: 0 }}
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.4, 0.2, 0.4],
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                  />
                </>
              )}
            </AnimatePresence>

            {/* Main button */}
            <motion.button
              onClick={handleOpen}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              disabled={disabled}
              className={cn(
                "relative flex items-center justify-center",
                "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl",
                "bg-gradient-to-br from-primary via-primary to-primary/85",
                "shadow-xl shadow-primary/30",
                "transition-all duration-300",
                "hover:shadow-2xl hover:shadow-primary/40",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                "ring-1 ring-white/10"
              )}
              whileHover={{ scale: 1.05, rotate: 2 }}
              whileTap={{ scale: 0.92 }}
            >
              {/* Inner gradient overlay */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/10 via-transparent to-white/20 pointer-events-none" />
              
              {/* Animated logo */}
              <motion.div
                animate={isTyping ? { 
                  rotate: [0, 360],
                } : {
                  rotate: 0,
                  scale: isHovered ? 1.1 : 1,
                }}
                transition={isTyping ? { 
                  duration: 2, 
                  repeat: Infinity, 
                  ease: 'linear' 
                } : {
                  type: 'spring',
                  stiffness: 300,
                }}
                className="relative z-10"
              >
                <img
                  src={jarvisLogo}
                  alt="Jarvis"
                  className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-lg"
                />
              </motion.div>

              {/* Badge */}
              <AnimatePresence>
                {totalBadge > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className={cn(
                      "absolute -top-1 -right-1 z-20",
                      "flex items-center justify-center",
                      "min-w-5 h-5 px-1.5 rounded-full",
                      "text-[10px] font-bold",
                      "bg-destructive text-destructive-foreground",
                      "ring-2 ring-background",
                      "shadow-lg"
                    )}
                  >
                    {totalBadge > 99 ? '99+' : totalBadge}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Status indicator */}
              <motion.div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 z-20",
                  "w-4 h-4 rounded-full",
                  "ring-2 ring-background",
                  "shadow-md",
                  isTyping ? "bg-amber-500" : "bg-emerald-500"
                )}
                animate={isTyping ? {
                  scale: [1, 1.2, 1],
                  opacity: [1, 0.7, 1],
                } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </motion.button>

            {/* Hover label */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, x: position === 'bottom-right' ? 10 : -10, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: position === 'bottom-right' ? 10 : -10, scale: 0.9 }}
                  transition={JARVIS_ANIMATIONS.spring.smooth}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2",
                    "px-4 py-2 rounded-xl",
                    "bg-popover/95 backdrop-blur-xl text-popover-foreground",
                    "shadow-xl border border-border/50",
                    "whitespace-nowrap",
                    position === 'bottom-right' ? 'right-full mr-3' : 'left-full ml-3'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10">
                      <Brain className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Jarvis</span>
                      <span className="text-[10px] text-muted-foreground">
                        {isTyping ? 'En réflexion...' : 'Assistant IA'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sheet panel */}
      {variant === 'sheet' && (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent
            side="right"
            className="w-full sm:max-w-md p-0 flex flex-col border-l-0"
          >
            <JarvisPremiumPanel onClose={handleClose} className="h-full" />
          </SheetContent>
        </Sheet>
      )}
    </>
  );
});

