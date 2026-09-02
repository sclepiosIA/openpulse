/**
 * JarvisAppleHeader - Header minimaliste style Apple (v13.0)
 * 
 * Design épuré, animations subtiles, typographie soignée
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Plus, History, X, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { vibrateSelection } from '@/lib/haptics';
import jarvisLogo from '@/assets/jarvis-logo.png';

interface JarvisAppleHeaderProps {
  pendingCount?: number;
  isTyping?: boolean;
  onNewConversation?: () => void;
  onOpenHistory?: () => void;
  onClose?: () => void;
  className?: string;
}

export const JarvisAppleHeader = memo(function JarvisAppleHeader({
  pendingCount = 0,
  isTyping = false,
  onNewConversation,
  onOpenHistory,
  onClose,
  className,
}: JarvisAppleHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative flex items-center justify-between px-4 py-3",
        "bg-background/80 backdrop-blur-xl",
        "border-b border-border/40",
        className
      )}
    >
      {/* Left section */}
      <div className="flex items-center gap-2">
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              vibrateSelection();
              onClose();
            }}
            className="h-8 w-8 rounded-full hover:bg-muted/80 -ml-1" aria-label="Fermer">
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Center - Logo and Title */}
      <motion.div 
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        {/* Minimal logo */}
        <div className="relative">
          <motion.div
            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <img loading="lazy" decoding="async" src={jarvisLogo} 
              alt="Jarvis" 
              className="w-6 h-6 object-contain" />
          </motion.div>
          
          {/* Status indicator */}
          <motion.div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-background",
              isTyping 
                ? "bg-amber-500" 
                : "bg-emerald-500"
            )}
            animate={isTyping ? {
              scale: [1, 1.2, 1],
              opacity: [1, 0.7, 1],
            } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
        
        {/* Title */}
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-sm font-semibold text-foreground tracking-tight">
            Jarvis
          </span>
          {isTyping && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="text-xs text-muted-foreground"
            >
              réfléchit...
            </motion.span>
          )}
        </div>
      </motion.div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        {onNewConversation && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              vibrateSelection();
              onNewConversation();
            }}
            className="h-8 w-8 rounded-full hover:bg-muted/80" aria-label="Ajouter">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
        
        {onOpenHistory && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              vibrateSelection();
              onOpenHistory();
            }}
            className="h-8 w-8 rounded-full hover:bg-muted/80 relative"
            aria-label="Historique"
            title="Historique"
          >
            <History className="h-4 w-4 text-muted-foreground" />
            {pendingCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground rounded-full"
              >
                {pendingCount}
              </motion.span>
            )}
          </Button>
        )}
      </div>
    </motion.header>
  );
});
