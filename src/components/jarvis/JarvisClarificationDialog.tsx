/**
 * JARVIS 12.0 - Dialog de clarification
 * 
 * Interface pour les questions de clarification de Jarvis.
 * Permet une interaction naturelle quand Jarvis a besoin de plus d'informations.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Send, X, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ClarificationRequest {
  id: string;
  question: string;
  options?: string[];
  context: string;
  priority: 'low' | 'medium' | 'high';
}

interface JarvisClarificationDialogProps {
  clarification: ClarificationRequest;
  onAnswer: (answer: string) => void;
  onDismiss: () => void;
  className?: string;
}

export function JarvisClarificationDialog({
  clarification,
  onAnswer,
  onDismiss,
  className,
}: JarvisClarificationDialogProps) {
  const [customAnswer, setCustomAnswer] = useState('');

  const handleOptionClick = (option: string) => {
    onAnswer(option);
  };

  const handleCustomSubmit = () => {
    if (customAnswer.trim()) {
      onAnswer(customAnswer.trim());
      setCustomAnswer('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCustomSubmit();
    }
  };

  const priorityColors = {
    low: 'bg-muted text-muted-foreground',
    medium: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    high: 'bg-destructive/10 text-destructive border-destructive/30',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'relative rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-lg',
          'p-4 max-w-md',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <HelpCircle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Jarvis a besoin d'une précision
              </p>
              <Badge 
                variant="outline" 
                className={cn('text-xs mt-1', priorityColors[clarification.priority])}
              >
                {clarification.priority === 'high' ? 'Important' : 
                 clarification.priority === 'medium' ? 'Question' : 'Optionnel'}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onDismiss} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Question */}
        <div className="mb-4">
          <p className="text-sm text-foreground leading-relaxed">
            {clarification.question}
          </p>
        </div>

        {/* Options */}
        {clarification.options && clarification.options.length > 0 && (
          <div className="mb-4 space-y-2">
            {clarification.options.map((option, index) => (
              <motion.button
                key={option || `option-${index}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleOptionClick(option)}
                className={cn(
                  'w-full px-4 py-2.5 rounded-lg text-left text-sm',
                  'bg-muted/50 hover:bg-muted border border-transparent hover:border-border/50',
                  'transition-colors duration-200'
                )}
              >
                <span className="text-muted-foreground mr-2">{index + 1}.</span>
                <span className="text-foreground">{option}</span>
              </motion.button>
            ))}
          </div>
        )}

        {/* Custom answer */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={customAnswer}
              onChange={(e) => setCustomAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ou tapez votre réponse..."
              className="pl-10 bg-muted/30 border-border/50"
            />
          </div>
          <Button
            size="icon"
            onClick={handleCustomSubmit}
            disabled={!customAnswer.trim()}
            className="shrink-0" aria-label="Envoyer">
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Context hint */}
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Appuyez sur Entrée ou cliquez sur une option
        </p>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Composant compact pour afficher une clarification inline
 */
export function JarvisClarificationInline({
  clarification,
  onAnswer,
  className,
}: {
  clarification: ClarificationRequest;
  onAnswer: (answer: string) => void;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn('overflow-hidden', className)}
    >
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 mb-2">
        <div className="flex items-start gap-2">
          <HelpCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground mb-2">{clarification.question}</p>
            {clarification.options && (
              <div className="flex flex-wrap gap-1.5">
                {clarification.options.map((option, index) => (
                  <Button
                    key={option || `option-${index}`}
                    variant="outline"
                    size="sm"
                    onClick={() => onAnswer(option)}
                    className="h-7 text-xs"
                  >
                    {option}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
