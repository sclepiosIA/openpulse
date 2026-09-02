/**
 * JarvisGlassHeader - Header compact horizontal style Apple (v15.1)
 * 
 * Layout horizontal: avatar 36px + titre sur une ligne, hauteur ~56px
 */

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  History,
  X,
  MoreHorizontal,
  Settings,
  Mic,
  MicOff,
  Sparkles,
  Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { vibrateSelection } from '@/lib/haptics';
import jarvisLogo from '@/assets/jarvis-logo.png';

interface JarvisGlassHeaderProps {
  pendingCount?: number;
  isTyping?: boolean;
  isVoiceActive?: boolean;
  connectionStatus?: 'connected' | 'connecting' | 'disconnected';
  onNewConversation?: () => void;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
  onToggleVoice?: () => void;
  onClose?: () => void;
  className?: string;
}

export const JarvisGlassHeader = memo(function JarvisGlassHeader({
  pendingCount = 0,
  isTyping = false,
  isVoiceActive = false,
  connectionStatus = 'connected',
  onNewConversation,
  onOpenHistory,
  onOpenSettings,
  onToggleVoice,
  onClose,
  className,
}: JarvisGlassHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);

  const statusConfig = {
    connected: { color: 'bg-emerald-500', label: 'En ligne', animate: false },
    connecting: { color: 'bg-amber-500', label: 'Connexion...', animate: true },
    disconnected: { color: 'bg-red-500', label: 'Hors ligne', animate: false },
  };

  const status = isTyping 
    ? { color: 'bg-amber-500', label: 'Réflexion...', animate: true }
    : statusConfig[connectionStatus];

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative z-10 flex items-center gap-3 px-3 py-2",
        "bg-background/80 backdrop-blur-xl",
        "border-b border-border/30",
        className
      )}
    >
      {/* Avatar + Title inline */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {/* Compact avatar */}
        <div className="relative flex-shrink-0">
          <div className={cn(
            "w-9 h-9 rounded-xl",
            "bg-gradient-to-br from-primary to-primary/80",
            "flex items-center justify-center",
            "shadow-md shadow-primary/20"
          )}>
            <img loading="lazy" decoding="async" src={jarvisLogo} 
              alt="Jarvis" 
              className="w-5 h-5 object-contain" />
          </div>
          
          {/* Status dot */}
          <motion.div
            className={cn(
              "absolute -bottom-0.5 -right-0.5",
              "w-3 h-3 rounded-full",
              status.color,
              "ring-2 ring-background"
            )}
            animate={status.animate ? {
              scale: [1, 1.2, 1],
              opacity: [1, 0.7, 1],
            } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>

        {/* Title + status text */}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-foreground tracking-tight leading-tight">
            Jarvis
          </span>
          <AnimatePresence mode="wait">
            <motion.span
              key={status.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[11px] text-muted-foreground/70 leading-tight flex items-center gap-1"
            >
              {isTyping && <Brain className="w-3 h-3 text-amber-500 flex-shrink-0" />}
              {status.label}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
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

        <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-muted/80 relative"
              aria-label="Plus d'options"
              title="Plus d'options"
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              {pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground rounded-full">
                  {pendingCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 z-[10000]">
            {onOpenHistory && (
              <DropdownMenuItem onClick={() => {
                vibrateSelection();
                onOpenHistory();
              }}>
                <History className="h-4 w-4 mr-2" />
                Historique
                {pendingCount > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {pendingCount}
                  </span>
                )}
              </DropdownMenuItem>
            )}
            {onToggleVoice && (
              <DropdownMenuItem onClick={() => {
                vibrateSelection();
                onToggleVoice();
              }}>
                {isVoiceActive ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                {isVoiceActive ? 'Désactiver voix' : 'Activer voix'}
              </DropdownMenuItem>
            )}
            {onOpenSettings && (
              <DropdownMenuItem onClick={() => {
                vibrateSelection();
                onOpenSettings();
              }}>
                <Settings className="h-4 w-4 mr-2" />
                Paramètres
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-muted-foreground">
              <Sparkles className="h-4 w-4 mr-2" />
              Version 15.1
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Close button - tout à droite */}
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              vibrateSelection();
              onClose();
            }}
            className="h-8 w-8 rounded-full hover:bg-muted/80" aria-label="Fermer">
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>
    </motion.header>
  );
});
