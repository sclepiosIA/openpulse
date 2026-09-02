/**
 * JarvisImmersiveMode - Mode plein écran immersif v12.5
 * 
 * Overlay focus mode avec gestes tactiles et animations premium
 */

import { memo, useEffect, useCallback, useState, useRef } from 'react';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { X, Maximize2, Minimize2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { vibrateSelection } from '@/lib/haptics';

interface JarvisImmersiveModeProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const JarvisImmersiveMode = memo(function JarvisImmersiveMode({
  isOpen,
  onClose,
  children,
  title = 'Jarvis',
  className,
}: JarvisImmersiveModeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragControls = useDragControls();
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle swipe down to close
  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    if (info.offset.y > 100 && info.velocity.y > 0) {
      vibrateSelection();
      onClose();
    }
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Immersive Container */}
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ 
              type: 'spring', 
              damping: 30, 
              stiffness: 300,
              mass: 0.8
            }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={handleDragEnd}
            className={cn(
              "fixed inset-x-0 bottom-0 top-0 z-[101]",
              "flex flex-col",
              "bg-background",
              "safe-area-inset",
              className
            )}
            style={{
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {/* Drag Handle */}
            <div 
              className="absolute top-3 left-1/2 -translate-x-1/2 z-10 cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <motion.div
                className={cn(
                  "w-10 h-1 rounded-full bg-muted-foreground/30",
                  isDragging && "bg-muted-foreground/50"
                )}
                animate={{ width: isDragging ? 48 : 40 }}
              />
            </div>

            {/* Header */}
            <header className="relative flex items-center justify-between px-4 py-4 border-b border-border/50">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-10 w-10 rounded-full" aria-label="Suivant">
                <ChevronDown className="h-5 w-5" />
              </Button>

              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                <motion.div
                  className="w-2 h-2 rounded-full bg-emerald-500"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="font-semibold text-sm">{title}</span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-10 w-10 rounded-full" aria-label="Fermer">
                <X className="h-5 w-5" />
              </Button>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {children}
            </div>

            {/* Swipe hint (mobile only) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 md:hidden"
            >
              <div className="flex flex-col items-center gap-1 text-muted-foreground/50">
                <motion.div
                  animate={{ y: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
                <span className="text-[10px]">Glisser pour fermer</span>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

// ============================================================================
// Immersive Toggle Button
// ============================================================================

interface ImmersiveToggleProps {
  isImmersive: boolean;
  onToggle: () => void;
  className?: string;
}

export const ImmersiveToggle = memo(function ImmersiveToggle({
  isImmersive,
  onToggle,
  className,
}: ImmersiveToggleProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        vibrateSelection();
        onToggle();
      }}
      className={cn(
        "h-8 w-8 rounded-lg transition-all",
        "hover:bg-primary/10",
        className
      )} aria-label="Réduire">
      {isImmersive ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </Button>
  );
});
