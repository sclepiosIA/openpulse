/**
 * JarvisPremiumMessage - Message bubble raffiné (v15.2)
 * 
 * - Font 14px, arrondi prononcé, timestamps intégrés dans la bulle
 * - Gradient utilisateur subtil, fond assistant distinct
 * - Full Markdown rendering + clickable email references
 */

import React, { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Copy,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import { useToast } from '@/hooks/shared/use-toast';
import { vibrateSelection, vibrateSuccess } from '@/lib/haptics';
import jarvisLogo from '@/assets/jarvis-logo.png';
import { JarvisMarkdownRenderer } from './JarvisMarkdownRenderer';

interface JarvisPremiumMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
  onRegenerate?: () => void;
  onFeedback?: (type: 'positive' | 'negative') => void;
  className?: string;
}

export const JarvisPremiumMessage = memo(function JarvisPremiumMessage({
  role,
  content,
  isStreaming = false,
  timestamp,
  onRegenerate,
  onFeedback,
  className,
}: JarvisPremiumMessageProps) {
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);
  const [showActions, setShowActions] = useState(false);
  const { toast } = useToast();

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    vibrateSuccess();
    toast({ description: 'Copié dans le presse-papiers' });
    setTimeout(() => setCopied(false), 2000);
  }, [content, toast]);

  const handleFeedback = useCallback((type: 'positive' | 'negative') => {
    vibrateSelection();
    setFeedbackGiven(type);
    onFeedback?.(type);
    toast({ 
      description: type === 'positive' 
        ? 'Merci pour votre retour positif !' 
        : 'Merci, nous allons améliorer Jarvis' 
    });
  }, [onFeedback, toast]);

  const formattedTime = timestamp 
    ? timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "flex gap-2.5 group",
        isUser ? "flex-row-reverse" : "flex-row",
        className
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={() => { if (!isUser && !isStreaming) setShowActions(prev => !prev); }}
    >
      {/* Avatar - assistant only */}
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

      {/* Message content */}
      <div className={cn(
        "flex flex-col",
        isUser ? "items-end" : "items-start",
        "max-w-[82%] sm:max-w-[72%]"
      )}>
        {/* Bubble */}
        <div
          className={cn(
            "relative px-3.5 py-2.5",
            isUser ? [
              "bg-gradient-to-br from-primary to-primary/90",
              "text-primary-foreground",
              "rounded-2xl rounded-br-lg",
              "shadow-md shadow-primary/20",
            ] : [
              "bg-muted/60",
              "text-foreground",
              "rounded-2xl rounded-bl-lg",
              "border border-border/50",
            ]
          )}
        >
          {/* User message */}
          {isUser ? (
            <div>
              <p className="text-[14px] leading-relaxed whitespace-pre-wrap">
                {content}
              </p>
              {/* Inline timestamp */}
              {formattedTime && !isStreaming && (
                <p className="text-[10px] text-primary-foreground/60 text-right mt-1 -mb-0.5">
                  {formattedTime}
                </p>
              )}
            </div>
          ) : (
            /* Assistant message with markdown */
            <div>
              <div>
                <JarvisMarkdownRenderer content={content} />
                {/* Streaming cursor */}
                {isStreaming && (
                  <motion.span
                    className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle rounded-full"
                    animate={{ opacity: [1, 0.3] }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                  />
                )}
              </div>
              {/* Inline timestamp */}
              {formattedTime && !isStreaming && (
                <p className="text-[10px] text-muted-foreground/50 text-right mt-1.5 -mb-0.5">
                  {formattedTime}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions row - assistant only */}
        {!isUser && !isStreaming && (
          <AnimatePresence>
            {showActions && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-0.5 mt-1 px-1"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-6 px-2 rounded-full hover:bg-muted gap-1"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {copied ? 'Copié' : 'Copier'}
                  </span>
                </Button>

                {onFeedback && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleFeedback('positive')}
                      disabled={feedbackGiven !== null}
                      className={cn(
                        "h-6 w-6 rounded-full",
                        feedbackGiven === 'positive' && "bg-emerald-500/10 text-emerald-500"
                      )} aria-label="J'aime">
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleFeedback('negative')}
                      disabled={feedbackGiven !== null}
                      className={cn(
                        "h-6 w-6 rounded-full",
                        feedbackGiven === 'negative' && "bg-red-500/10 text-red-500"
                      )} aria-label="Je n'aime pas">
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                  </>
                )}

                {onRegenerate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      vibrateSelection();
                      onRegenerate();
                    }}
                    className="h-6 w-6 rounded-full hover:bg-muted" aria-label="Actualiser">
                    <RefreshCw className="h-3 w-3 text-muted-foreground" />
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
});
