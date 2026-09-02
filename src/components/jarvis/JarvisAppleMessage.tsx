/**
 * JarvisAppleMessage - Message bubble style Apple (v13.0)
 * 
 * Design épuré iMessage-like, animations subtiles, typographie soignée
 */

import { memo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/shared/use-toast';
import { vibrateSelection, vibrateSuccess } from '@/lib/haptics';

interface JarvisAppleMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
  onRegenerate?: () => void;
  onFeedback?: (type: 'positive' | 'negative') => void;
  className?: string;
}

export const JarvisAppleMessage = memo(function JarvisAppleMessage({
  role,
  content,
  isStreaming = false,
  timestamp,
  onRegenerate,
  onFeedback,
  className,
}: JarvisAppleMessageProps) {
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);
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
  }, [onFeedback]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start",
        "group",
        className
      )}
    >
      <div className={cn(
        "max-w-[85%] sm:max-w-[75%]",
        isUser ? "items-end" : "items-start",
        "flex flex-col gap-1"
      )}>
        {/* Message bubble */}
        <div
          className={cn(
            "px-4 py-2.5 rounded-2xl",
            isUser ? [
              "bg-primary text-primary-foreground",
              "rounded-br-md",
            ] : [
              "bg-muted/70 text-foreground",
              "rounded-bl-md",
            ]
          )}
        >
          {isUser ? (
            <p className="text-[15px] leading-7 whitespace-pre-wrap">
              {content}
            </p>
          ) : (
            <div className={cn(
              "prose prose-sm max-w-none",
              "prose-p:my-2.5 prose-p:leading-7 prose-p:text-[15px]",
              "prose-headings:font-semibold prose-headings:text-primary prose-headings:mt-4 prose-headings:mb-2",
              "prose-h1:text-lg prose-h2:text-base prose-h3:text-sm",
              "prose-ul:my-3 prose-ul:space-y-2",
              "prose-ol:my-3 prose-ol:space-y-2 prose-ol:marker:text-primary prose-ol:marker:font-semibold",
              "prose-li:leading-7 prose-li:pl-1",
              "prose-strong:text-primary prose-strong:font-semibold",
              "prose-code:bg-background/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm prose-code:border prose-code:border-border/30",
              "prose-pre:bg-background/50 prose-pre:rounded-xl",
              "prose-a:text-primary prose-a:underline prose-a:underline-offset-2 prose-a:decoration-primary/40 hover:prose-a:decoration-primary",
              "prose-blockquote:border-l-2 prose-blockquote:border-primary/40 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground",
              "[&>p:first-child]:mt-0 [&>p:last-child]:mb-0",
            )}>
              <ReactMarkdown>{content}</ReactMarkdown>
              
              {/* Streaming cursor */}
              {isStreaming && (
                <motion.span
                  className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle rounded-full"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                />
              )}
            </div>
          )}
        </div>

        {/* Actions - only for assistant messages */}
        {!isUser && !isStreaming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-0.5 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 w-7 p-0 rounded-full hover:bg-muted"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>

            {onFeedback && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFeedback('positive')}
                  disabled={feedbackGiven !== null}
                  className={cn(
                    "h-7 w-7 p-0 rounded-full",
                    feedbackGiven === 'positive' && "text-emerald-500"
                  )}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFeedback('negative')}
                  disabled={feedbackGiven !== null}
                  className={cn(
                    "h-7 w-7 p-0 rounded-full",
                    feedbackGiven === 'negative' && "text-red-500"
                  )}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </>
            )}

            {onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  vibrateSelection();
                  onRegenerate();
                }}
                className="h-7 w-7 p-0 rounded-full hover:bg-muted"
              >
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
          </motion.div>
        )}

        {/* Timestamp */}
        {timestamp && !isStreaming && (
          <span className="text-[10px] text-muted-foreground/50 px-2">
            {timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </motion.div>
  );
});
