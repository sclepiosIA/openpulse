/**
 * JarvisQuickActions - Actions rapides dans le header Jarvis
 * 
 * Boutons d'accès rapide aux commandes les plus utiles.
 */

import { motion } from 'framer-motion';
import {
  FileText,
  Mail,
  CheckSquare,
  BarChart2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useJarvisContextualSuggestions } from '@/hooks/jarvis/useJarvisContextualSuggestions';

interface JarvisQuickActionsProps {
  onExecute: (command: string) => void;
  isDisabled?: boolean;
  compact?: boolean;
}

const ICON_MAP = {
  summary: FileText,
  email: Mail,
  task: CheckSquare,
  chart: BarChart2,
};

export function JarvisQuickActions({ 
  onExecute, 
  isDisabled = false,
  compact = false 
}: JarvisQuickActionsProps) {
  const { quickActions } = useJarvisContextualSuggestions();
  
  return (
    <div className={cn(
      "flex items-center gap-1",
      compact ? "gap-0.5" : "gap-1"
    )}>
      {quickActions.map((action, index) => {
        const Icon = ICON_MAP[action.icon as keyof typeof ICON_MAP] || Zap;
        
        return (
          <Tooltip key={action.id}>
            <TooltipTrigger asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8 rounded-lg transition-all",
                    "hover:bg-primary/10 hover:text-primary",
                    "focus:ring-2 focus:ring-primary/20",
                    compact && "h-7 w-7"
                  )}
                  onClick={() => onExecute(action.command)}
                  disabled={isDisabled}
                  aria-label={action.label}
                  title={action.label}
                >
                  <Icon className={cn("h-4 w-4", compact && "h-3.5 w-3.5")} />
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px]">
              <p className="font-medium">{action.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {action.command.length > 50 
                  ? action.command.substring(0, 50) + '...' 
                  : action.command}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
