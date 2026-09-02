/**
 * JarvisMessageBubble - Bulle de message enrichie v12.8
 * 
 * Design ultra premium avec:
 * - Typing effect avec curseur animé
 * - Actions inline avec micro-interactions
 * - Rich previews pour différents types de données
 * - Feedback utilisateur avec animations
 * - Gradient glassmorphism et ombres multi-couches
 * - Support des références email cliquables [[email:UUID|title]]
 */

import React, { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ThumbsUp,
  ThumbsDown,
  Copy,
  RefreshCw,
  Check,
  Sparkles,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/shared/use-toast';
import { vibrateSelection, vibrateSuccess } from '@/lib/haptics';
import type { JarvisKBSource } from '@/types/jarvis';
import jarvisLogo from '@/assets/jarvis-logo.png';
import { JarvisMarkdownRenderer } from './JarvisMarkdownRenderer';

interface InlineAction {
  id: string;
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'primary';
}

interface DataPreview {
  type: 'email' | 'task' | 'etablissement' | 'kpi';
  title: string;
  subtitle?: string;
  metadata?: string;
  actions?: InlineAction[];
}

interface JarvisMessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
  sources?: JarvisKBSource[];
  dataPreviews?: DataPreview[];
  inlineActions?: InlineAction[];
  onFeedback?: (type: 'positive' | 'negative') => void;
  onRegenerate?: () => void;
  className?: string;
}

export const JarvisMessageBubble = memo(function JarvisMessageBubble({
  role,
  content,
  isStreaming = false,
  timestamp,
  sources,
  dataPreviews,
  inlineActions,
  onFeedback,
  onRegenerate,
  className,
}: JarvisMessageBubbleProps) {
  const { toast } = useToast();
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);
  const [copied, setCopied] = useState(false);

  const isUser = role === 'user';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      vibrateSuccess();
      toast({ title: 'Copié !', duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Erreur de copie', variant: 'destructive' });
    }
  }, [content, toast]);

  const handleFeedback = useCallback((type: 'positive' | 'negative') => {
    setFeedbackGiven(type);
    vibrateSelection();
    onFeedback?.(type);
  }, [onFeedback]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "flex gap-3.5 group",
        isUser ? "flex-row-reverse" : "flex-row",
        className
      )}
    >
      {/* Avatar - Aligned with PremiumMessage (7x7 circle) */}
      {!isUser && (
        <div className="flex-shrink-0 self-end">
          <div className={cn(
            "w-7 h-7 rounded-full",
            "bg-gradient-to-br from-primary to-primary/80",
            "flex items-center justify-center",
            "shadow-sm shadow-primary/15",
            "ring-2 ring-background"
          )}>
            <img loading="lazy" decoding="async" src={jarvisLogo} 
              alt="Jarvis" 
              className="w-4 h-4 object-contain" />
          </div>
        </div>
      )}

      {/* Message Content */}
      <div className={cn(
        "flex flex-col gap-2.5 max-w-[85%] min-w-0",
        isUser ? "items-end" : "items-start"
      )}>
        {/* Main Bubble with enhanced styling */}
        <motion.div 
          className={cn(
            "relative px-4 py-3.5 rounded-2xl",
            isUser 
              ? "bg-gradient-to-br from-primary via-primary to-primary/90 text-white rounded-br-md shadow-lg shadow-primary/25" 
              : "bg-gradient-to-br from-card/98 via-card/95 to-muted/60 backdrop-blur-xl border border-border/40 rounded-bl-md shadow-lg shadow-black/5"
          )}
          whileHover={{ scale: 1.005 }}
          transition={{ type: 'spring', stiffness: 500 }}
        >
          {/* Content */}
          <div className={cn(
            isUser ? "prose-invert [&_strong]:text-white [&_h2]:text-white [&_h3]:text-white" : ""
          )}>
            <JarvisMarkdownRenderer content={content} />
          </div>

          {/* Streaming cursor */}
          {isStreaming && !isUser && content && (
            <motion.span
              className="inline-block w-2 h-4 bg-primary ml-0.5 align-middle rounded-sm"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
            />
          )}
        </motion.div>

        {/* Data Previews */}
        <AnimatePresence>
          {dataPreviews && dataPreviews.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full space-y-2"
            >
              {dataPreviews.map((preview) => (
                <DataPreviewCard key={`${preview.type}-${preview.title}`} preview={preview} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sources */}
        {sources && sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sources.map((source, index) => (
              <motion.button
                key={source.titre || `source-${index}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs",
                  "bg-muted/50 hover:bg-muted border border-border/50",
                  "transition-colors group/source"
                )}
              >
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="truncate max-w-[150px]">{source.titre}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover/source:opacity-100 transition-opacity" />
              </motion.button>
            ))}
          </div>
        )}

        {/* Inline Actions */}
        {inlineActions && inlineActions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {inlineActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  variant={action.variant === 'primary' ? 'default' : 'outline'}
                  size="sm"
                  onClick={action.onClick}
                  className="h-8 text-xs rounded-lg"
                >
                  {Icon && <Icon className="w-3.5 h-3.5 mr-1.5" />}
                  {action.label}
                </Button>
              );
            })}
          </div>
        )}

        {/* Feedback Actions (assistant only) - Enhanced with glass effect */}
        {!isUser && !isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-0.5 p-1 rounded-xl bg-muted/40 backdrop-blur-sm border border-border/30 opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 max-sm:opacity-100 transition-all duration-200"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFeedback('positive')}
                  disabled={feedbackGiven !== null}
                  className={cn(
                    "h-7 w-7 p-0 rounded-lg transition-all",
                    feedbackGiven === 'positive' 
                      ? "bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/30" 
                      : "hover:bg-emerald-500/10 hover:text-emerald-500"
                  )}
                >
                  <motion.div whileTap={{ scale: 1.2 }}>
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </motion.div>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Utile</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFeedback('negative')}
                  disabled={feedbackGiven !== null}
                  className={cn(
                    "h-7 w-7 p-0 rounded-lg transition-all",
                    feedbackGiven === 'negative' 
                      ? "bg-red-500/20 text-red-500 ring-1 ring-red-500/30" 
                      : "hover:bg-red-500/10 hover:text-red-500"
                  )}
                >
                  <motion.div whileTap={{ scale: 1.2 }}>
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </motion.div>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pas utile</TooltipContent>
            </Tooltip>

            <div className="w-px h-4 bg-border/50 mx-0.5" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 w-7 p-0 rounded-lg hover:bg-muted/80"
                >
                  <motion.div whileTap={{ scale: 1.2 }}>
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </motion.div>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied ? 'Copié !' : 'Copier'}</TooltipContent>
            </Tooltip>

            {onRegenerate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      vibrateSelection();
                      onRegenerate();
                    }}
                    className="h-7 w-7 p-0 rounded-lg hover:bg-primary/10 hover:text-primary"
                  >
                    <motion.div 
                      whileTap={{ rotate: 180 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </motion.div>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Régénérer</TooltipContent>
              </Tooltip>
            )}
          </motion.div>
        )}

        {/* Timestamp with subtle styling */}
        {timestamp && !isStreaming && (
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-[10px] text-muted-foreground/60 px-1 font-medium"
          >
            {timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </motion.span>
        )}
      </div>
    </motion.div>
  );
});

// Data Preview Card Component
const DataPreviewCard = memo(function DataPreviewCard({ 
  preview 
}: { 
  preview: DataPreview 
}) {
  const typeConfig = {
    email: { icon: '📧', color: 'border-l-sky-500' },
    task: { icon: '✅', color: 'border-l-emerald-500' },
    etablissement: { icon: '🏥', color: 'border-l-violet-500' },
    kpi: { icon: '📊', color: 'border-l-amber-500' },
  };

  const config = typeConfig[preview.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "w-full p-3 rounded-xl bg-card/80 backdrop-blur-sm border border-border/50",
        "border-l-4",
        config.color
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{preview.title}</p>
          {preview.subtitle && (
            <p className="text-xs text-muted-foreground truncate">{preview.subtitle}</p>
          )}
          {preview.metadata && (
            <p className="text-xs text-muted-foreground mt-1">{preview.metadata}</p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
      
      {preview.actions && preview.actions.length > 0 && (
        <div className="flex gap-2 mt-2 pl-8">
          {preview.actions.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              onClick={action.onClick}
              className="h-7 text-xs rounded-lg"
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </motion.div>
  );
});
