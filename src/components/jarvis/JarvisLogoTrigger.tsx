/**
 * JarvisLogoTrigger - Logo OpenPulse cliquable qui ouvre Jarvis
 * Design Premium Immersive - Modal centré moderne
 * 
 * V4.0: Unified state via JarvisUnifiedContext (no local isOpen)
 */

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Sparkles, Zap, ArrowRight, AlertTriangle, Lightbulb, TrendingUp, Bell, BrainCircuit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useJarvis } from '@/hooks/jarvis/useJarvis';
import { JarvisPremiumPanel } from './JarvisPremiumPanel';
import { useMediaQuery } from '@/hooks/shared/use-media-query';
import { useJarvisKeyboardShortcuts } from '@/hooks/jarvis/useJarvisKeyboardShortcuts';
import { useJarvisUnifiedOptional } from '@/contexts/JarvisUnifiedContext';
import { useJarvisSmartTriggers } from '@/hooks/jarvis/useJarvisSmartTriggers';
import { useJarvisIntentPrediction } from '@/hooks/jarvis/useJarvisIntentPrediction';
import type { SmartTrigger } from '@/hooks/jarvis/useJarvisSmartTriggers';
import type { PredictedIntent } from '@/hooks/jarvis/useJarvisIntentPrediction';
// Emplacement CARRE (h-11 w-11) : il lui faut le symbole, pas le
// verrouillage horizontal. Le nom de la variable trahit l'origine du
// defaut -- l'emplacement attendait la croix carree de la marque d'origine,
// et le lettrage horizontal l'a remplacee sans que le cadre change. Mesure :
// une image de 1920x447 rendue dans 38x44 px, soit un pave illisible en tete
// de barre laterale.
import symboleMarque from '@/assets/marque/symbole.svg';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface JarvisLogoTriggerProps {
  collapsed?: boolean;
  className?: string;
}

export function JarvisLogoTrigger({ collapsed = false, className }: JarvisLogoTriggerProps) {
  const { isEnabled, pendingCount } = useJarvis();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  const [isHovering, setIsHovering] = useState(false);
  const ctx = useJarvisUnifiedOptional();

  // Single source of truth: isPanelOpen from unified context
  const isOpen = ctx?.isPanelOpen ?? false;

  // Smart triggers & predictions count for badge
  const { triggers, hasUrgent } = useJarvisSmartTriggers({ enabled: !isOpen });
  const { highConfidencePredictions } = useJarvisIntentPrediction({ enabled: !isOpen });
  const suggestionsCount = triggers.length + (highConfidencePredictions?.length ?? 0);
  const totalBadgeCount = pendingCount + suggestionsCount;

  // Animation states
  const hasPending = totalBadgeCount > 0;

  // Global keyboard shortcut (Cmd/Ctrl+J)
  const handleToggle = useCallback(() => {
    if (!isEnabled || !ctx) return;
    if (isOpen) {
      ctx.closePanel();
    } else {
      ctx.openPanel();
    }
  }, [isEnabled, isOpen, ctx]);

  const handleClose = useCallback(() => {
    // Prevent closing while Jarvis is actively streaming, typing, or has pending actions
    const convCtx = ctx as any;
    const isStreaming = convCtx?.streamState?.isStreaming || convCtx?.isTyping;
    const hasPendingActions = (convCtx?.pendingActions?.length ?? 0) > 0;
    if (isStreaming || hasPendingActions) return;
    ctx?.closePanel();
    ctx?.clearMinimizedState?.();
  }, [ctx]);

  const handleOpen = useCallback(() => {
    if (!isEnabled || !ctx) return;
    ctx.openPanel();
  }, [isEnabled, ctx]);

  // Handle minimize: close modal/sheet but keep panel alive
  const handleMinimize = useCallback(() => {
    ctx?.minimizePanel?.();
  }, [ctx]);

  useJarvisKeyboardShortcuts({
    isOpen,
    onToggle: handleToggle,
    onClose: handleClose,
    enabled: isEnabled,
  });

  // Listen for programmatic close requests (e.g. from email reference clicks)
  useEffect(() => {
    const handler = () => ctx?.closePanel();
    window.addEventListener('jarvis:close', handler);
    return () => window.removeEventListener('jarvis:close', handler);
  }, [ctx]);

  const LogoButton = (
    <motion.button
      className={cn(
        'relative group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg',
        'transition-all duration-300',
        className
      )}
      onClick={handleOpen}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Ouvrir Jarvis - Assistant IA"
    >
      {/* Animated glow ring when pending actions */}
      {hasPending && !collapsed && (
        <motion.div
          className="absolute inset-0 rounded-lg"
          style={{
            background: 'conic-gradient(from 0deg, transparent, hsl(var(--primary) / 0.6), transparent)',
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
      )}

      {/* Subtle glow on hover */}
      <motion.div
        className="absolute -inset-1 rounded-lg bg-primary/20 blur-md"
        animate={{
          opacity: isHovering ? 0.6 : hasPending ? 0.3 : 0,
        }}
        transition={{ duration: 0.3 }}
      />
      
      {/* Logo image - direct sans cadre */}
      <motion.img
        src={symboleMarque}
        alt="OpenPulse - Jarvis"
        className={cn(
          "relative object-contain drop-shadow-md",
          collapsed ? "h-9 w-9" : "h-11 w-11"
        )}
        animate={{
          rotate: isHovering ? [0, -5, 5, 0] : 0,
          scale: isHovering ? 1.05 : 1,
        }}
        transition={{ duration: 0.5 }}
      />

      {/* Status badge - bottom right */}
      {isEnabled && !collapsed && (
        <motion.div
          className={cn(
            'absolute -bottom-1 -right-1',
            'h-5 w-5 rounded-lg',
            'flex items-center justify-center',
            'ring-2 ring-card shadow-lg',
            hasPending 
              ? 'bg-gradient-to-br from-warning to-destructive' 
              : 'bg-gradient-to-br from-primary to-primary/70'
          )}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500 }}
        >
          {hasPending ? (
            <Zap className="h-3 w-3 text-white" />
          ) : (
            <Sparkles className="h-3 w-3 text-white" />
          )}
        </motion.div>
      )}

      {/* En mode collapsed, indicateur simplifié */}
      {isEnabled && collapsed && hasPending && (
        <motion.div
          className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-1 ring-card"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {/* Pending count badge - top right */}
      {hasPending && !collapsed && (
        <motion.div
          initial={{ scale: 0, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          className="absolute -top-2 -right-2"
        >
          <motion.div
            className={cn(
              'h-6 min-w-6 px-1.5 rounded-full',
              'bg-destructive text-destructive-foreground',
              'flex items-center justify-center',
              'text-xs font-bold',
              'ring-2 ring-card',
              'shadow-lg shadow-destructive/30'
            )}
            animate={hasUrgent ? { scale: [1, 1.15, 1] } : {}}
            transition={hasUrgent ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : {}}
          >
            {totalBadgeCount > 9 ? '9+' : totalBadgeCount}
          </motion.div>
        </motion.div>
      )}
    </motion.button>
  );

  // Icon for trigger type
  const getTriggerIcon = (type: SmartTrigger['type']) => {
    switch (type) {
      case 'urgent': return AlertTriangle;
      case 'opportunity': return TrendingUp;
      case 'risk': return AlertTriangle;
      case 'reminder': return Bell;
      case 'insight': return Lightbulb;
      default: return Sparkles;
    }
  };

  const getTriggerColor = (type: SmartTrigger['type']) => {
    switch (type) {
      case 'urgent': return 'text-destructive';
      case 'opportunity': return 'text-primary';
      case 'risk': return 'text-warning';
      case 'reminder': return 'text-muted-foreground';
      case 'insight': return 'text-primary';
      default: return 'text-foreground';
    }
  };

  const handleTriggerClick = useCallback((trigger: SmartTrigger) => {
    if (ctx) {
      ctx.openPanel();
    }
  }, [ctx]);

  const handlePredictionClick = useCallback((prediction: PredictedIntent) => {
    if (ctx) {
      ctx.openPanel();
    }
  }, [ctx]);

  const hasSuggestions = triggers.length > 0 || (highConfidencePredictions?.length ?? 0) > 0;

  // HoverCard content for suggestions
  const SuggestionsHoverContent = hasSuggestions ? (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 mb-2">
        <BrainCircuit className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Suggestions Jarvis</span>
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
          {totalBadgeCount}
        </Badge>
      </div>
      
      {triggers.slice(0, 3).map((trigger) => {
        const TIcon = getTriggerIcon(trigger.type);
        return (
          <button
            key={trigger.id}
            onClick={(e) => { e.stopPropagation(); handleTriggerClick(trigger); }}
            className={cn(
              "w-full flex items-start gap-2.5 p-2 rounded-lg text-left",
              "hover:bg-accent/60 transition-colors group/item cursor-pointer"
            )}
          >
            <div className={cn("mt-0.5 shrink-0", getTriggerColor(trigger.type))}>
              <TIcon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{trigger.title}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-1">{trigger.message}</p>
            </div>
            <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity mt-1 shrink-0" />
          </button>
        );
      })}

      {highConfidencePredictions?.slice(0, 2).map((prediction) => {
        const intentLabels: Record<string, string> = {
          daily_briefing: 'Briefing du jour',
          summarize_emails: 'Résumé des emails',
          crm_analysis: 'Analyse CRM client',
          daily_summary: 'Bilan de la journée',
          financial_analysis: 'Analyse financière',
          sprint_analysis: 'Suivi du sprint',
          week_planning: 'Planification de la semaine',
          week_summary: 'Bilan hebdomadaire',
          check_tasks: 'Vérifier les tâches',
          review_pipeline: 'Revue du pipeline',
          team_update: 'Mise à jour équipe',
        };
        const label = intentLabels[prediction.intent] || prediction.intent.replace(/_/g, ' ');
        return (
        <button
          key={prediction.id}
          onClick={(e) => { e.stopPropagation(); handlePredictionClick(prediction); }}
          className={cn(
            "w-full flex items-start gap-2.5 p-2 rounded-lg text-left",
            "hover:bg-accent/60 transition-colors group/item cursor-pointer"
          )}
        >
          <div className="mt-0.5 shrink-0 text-primary">
            <Lightbulb className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{label}</p>
            <p className="text-[11px] text-muted-foreground line-clamp-1">{prediction.reasoning}</p>
          </div>
          <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity mt-1 shrink-0" />
        </button>
        );
      })}

      <div className="pt-1 border-t border-border/50">
        <button
          onClick={(e) => { e.stopPropagation(); handleOpen(); }}
          className="w-full text-center text-[11px] text-primary hover:text-primary/80 font-medium py-1 transition-colors"
        >
          Ouvrir Jarvis →
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Logo avec HoverCard pour suggestions ou Tooltip si collapsed */}
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            {LogoButton}
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <span>Jarvis - Assistant IA</span>
              {hasPending && (
                <Badge variant="destructive" className="ml-1">
                  {totalBadgeCount}
                </Badge>
              )}
          </TooltipContent>
        </Tooltip>
      ) : hasSuggestions ? (
        <HoverCard openDelay={300} closeDelay={200}>
          <HoverCardTrigger asChild>
            {LogoButton}
          </HoverCardTrigger>
          <HoverCardContent side="right" align="start" className="w-72 p-3">
            {SuggestionsHoverContent}
          </HoverCardContent>
        </HoverCard>
      ) : (
        LogoButton
      )}

      {/* Mobile: Full screen sheet - via Portal */}
      {isMobile ? (
        <>
          <Sheet open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); else ctx?.openPanel(); }}>
            <SheetContent side="bottom" className="h-[100dvh] p-0 rounded-t-3xl">
              <SheetTitle className="sr-only">Assistant Jarvis</SheetTitle>
              <SheetDescription className="sr-only">
                Assistant IA proactif pour vous aider dans vos tâches
              </SheetDescription>
              <JarvisPremiumPanel onClose={handleClose} onMinimize={handleMinimize} className="h-full" />
            </SheetContent>
          </Sheet>
          {/* Keep panel mounted but hidden when minimized (mobile) to preserve state */}
          {ctx?.isMinimized && !isOpen && (
            <div className="fixed -left-[9999px] opacity-0 pointer-events-none" aria-hidden="true">
              <JarvisPremiumPanel onClose={handleClose} onMinimize={handleMinimize} />
            </div>
          )}
        </>
      ) : (
        /* Desktop & Tablet: Centered modal via Portal to escape sidebar context */
        createPortal(
          <>
            <AnimatePresence>
              {isOpen && (
                <>
                  {/* Backdrop with enhanced blur */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-black/40 backdrop-blur-md z-[9998]"
                    onClick={(e) => { e.stopPropagation(); handleClose(); }}
                  />
                </>
              )}
            </AnimatePresence>
            
            {/* Panel stays mounted when open OR minimized to preserve state */}
            {(isOpen || ctx?.isMinimized) && (
              <div
                className={cn(
                  "fixed inset-0 z-[9999] flex items-center justify-center p-4",
                  isOpen ? "pointer-events-none" : "pointer-events-none opacity-0 h-0 overflow-hidden"
                )}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "pointer-events-auto overflow-hidden",
                    isTablet 
                      ? "w-full max-w-[700px] h-[min(90vh,850px)]"
                      : "w-full max-w-[800px] h-[min(85vh,900px)]",
                    "rounded-3xl",
                    "bg-background",
                    "shadow-2xl shadow-primary/20",
                    "ring-1 ring-primary/10",
                    !isOpen && "invisible"
                  )}
                  style={{
                    boxShadow: isOpen ? `
                      0 0 0 1px hsl(var(--primary) / 0.1),
                      0 25px 50px -12px hsl(var(--primary) / 0.25),
                      0 0 80px -20px hsl(var(--primary) / 0.15)
                    ` : 'none'
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                  
                  <JarvisPremiumPanel onClose={handleClose} onMinimize={handleMinimize} className="h-full" />
                </div>
              </div>
            )}
          </>,
          document.body
        )
      )}
    </>
  );
}
