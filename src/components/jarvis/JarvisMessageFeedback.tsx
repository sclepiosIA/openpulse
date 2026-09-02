/**
 * JarvisMessageFeedback - Feedback utilisateur sur les réponses
 * Permet d'améliorer la qualité des réponses via l'apprentissage
 */

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Flag, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/shared/use-toast';

interface JarvisMessageFeedbackProps {
  messageId: string;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative' | 'report') => void;
  className?: string;
}

export function JarvisMessageFeedback({ 
  messageId, 
  onFeedback,
  className 
}: JarvisMessageFeedbackProps) {
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  const [showThanks, setShowThanks] = useState(false);
  const { toast } = useToast();

  const handleFeedback = (type: 'positive' | 'negative' | 'report') => {
    if (type === 'report') {
      onFeedback?.(messageId, 'report');
      toast({
        title: 'Signalement envoyé',
        description: 'Merci, nous examinerons cette réponse.',
      });
      return;
    }

    setFeedback(type);
    setShowThanks(true);
    onFeedback?.(messageId, type);
    
    setTimeout(() => setShowThanks(false), 2000);
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <AnimatePresence mode="wait">
        {showThanks ? (
          <motion.span
            key="thanks"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="text-xs text-emerald-500 font-medium"
          >
            Merci ! ✨
          </motion.span>
        ) : (
          <motion.div
            key="buttons"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1"
          >
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 w-7 p-0 rounded-lg transition-all',
                feedback === 'positive' 
                  ? 'bg-emerald-500/20 text-emerald-500' 
                  : 'text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10'
              )}
              onClick={() => handleFeedback('positive')}
              disabled={feedback !== null}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 w-7 p-0 rounded-lg transition-all',
                feedback === 'negative' 
                  ? 'bg-red-500/20 text-red-500' 
                  : 'text-muted-foreground hover:text-red-500 hover:bg-red-500/10'
              )}
              onClick={() => handleFeedback('negative')}
              disabled={feedback !== null}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Plus d'options"
                  title="Plus d'options"
                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => handleFeedback('report')}>
                  <Flag className="h-3.5 w-3.5 mr-2 text-amber-500" />
                  Signaler
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
