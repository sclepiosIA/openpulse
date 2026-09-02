/**
 * JarvisAppleInput - Input minimaliste style Apple (v13.0)
 * 
 * Design épuré, focus sur la fonctionnalité, animations subtiles
 */

import { useState, useRef, useCallback, KeyboardEvent, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { vibrateSelection } from '@/lib/haptics';

interface JarvisAppleInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onVoiceToggle?: () => void;
  isLoading?: boolean;
  isVoiceActive?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function JarvisAppleInput({
  value,
  onChange,
  onSubmit,
  onVoiceToggle,
  isLoading = false,
  isVoiceActive = false,
  placeholder = "Message...",
  disabled = false,
  className,
}: JarvisAppleInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [value]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading && !disabled) {
        vibrateSelection();
        onSubmit();
      }
    }
  }, [value, isLoading, disabled, onSubmit]);

  const canSubmit = value.trim().length > 0 && !isLoading && !disabled;

  return (
    <div className={cn("relative px-4 pb-4 pt-2", className)}>
      {/* Safe area for mobile */}
      <div className="pb-[env(safe-area-inset-bottom)]">
        <motion.div
          className={cn(
            "relative flex items-end gap-2 rounded-3xl transition-all duration-200",
            "bg-muted/50 border",
            isFocused 
              ? "border-primary/30 bg-muted/70 shadow-sm" 
              : "border-border/50",
            disabled && "opacity-50"
          )}
          layout
        >
          {/* Textarea */}
          <div className="flex-1 py-2.5 pl-4">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              disabled={disabled || isLoading}
              rows={1}
              className={cn(
                "w-full resize-none bg-transparent",
                "text-base leading-relaxed",
                "placeholder:text-muted-foreground/50",
                "focus:outline-none",
                "min-h-[24px] max-h-[120px]"
              )}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 p-1.5">
            {/* Voice button */}
            {onVoiceToggle && (
              <motion.div whileTap={{ scale: 0.9 }}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  vibrateSelection();
                  onVoiceToggle();
                }}
                disabled={isLoading}
                aria-label={isVoiceActive ? "Arrêter la dictée vocale" : "Démarrer la dictée vocale"}
                aria-pressed={isVoiceActive}
                title={isVoiceActive ? "Arrêter la dictée" : "Dictée vocale"}
                className={cn(
                  "h-9 w-9 rounded-full",
                  isVoiceActive
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "hover:bg-muted text-muted-foreground"
                )}
                >
                  {isVoiceActive ? (
                    <Square className="h-4 w-4 fill-current" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              </motion.div>
            )}

            {/* Submit button */}
            <motion.div
              animate={{ 
                scale: canSubmit ? 1 : 0.9,
                opacity: canSubmit ? 1 : 0.5,
              }}
              whileTap={canSubmit ? { scale: 0.85 } : {}}
            >
              <Button
                size="icon"
                onClick={() => {
                  if (canSubmit) {
                    vibrateSelection();
                    onSubmit();
                  }
                }}
                disabled={!canSubmit}
                className={cn(
                  "h-9 w-9 rounded-full transition-all duration-200",
                  canSubmit 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" 
                    : "bg-muted text-muted-foreground"
                )} aria-label="Chargement">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
