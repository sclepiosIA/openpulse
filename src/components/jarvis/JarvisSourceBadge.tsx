/**
 * JarvisSourceBadge - Badge affichant une source KB utilisée par Jarvis - Premium Immersive
 */

import { BookOpen, FileText, HelpCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import type { JarvisKBSource } from '@/types/jarvis';

interface JarvisSourceBadgeProps {
  source: JarvisKBSource;
  onClick?: () => void;
  compact?: boolean;
}

export function JarvisSourceBadge({ source, onClick, compact = false }: JarvisSourceBadgeProps) {
  const config = {
    solution: {
      icon: BookOpen,
      label: 'Solution',
      className: 'bg-gradient-to-br from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400 border-sky-500/20 hover:border-sky-500/40',
      iconBg: 'bg-sky-500/10',
    },
    internal: {
      icon: FileText,
      label: 'Interne',
      className: 'bg-gradient-to-br from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:border-amber-500/40',
      iconBg: 'bg-amber-500/10',
    },
    faq: {
      icon: HelpCircle,
      label: 'FAQ',
      className: 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40',
      iconBg: 'bg-emerald-500/10',
    },
  };

  const { icon: Icon, label, className, iconBg } = config[source.base_type] || config.internal;

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              'cursor-pointer gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all hover:shadow-sm',
              className
            )}
            onClick={onClick}
          >
            <Icon className="h-3 w-3" />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs bg-card border-border/50 shadow-lg">
          <p className="font-medium text-sm">{source.titre}</p>
          {source.excerpt && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{source.excerpt}</p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <motion.div 
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md',
        className
      )}
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className={cn("p-2 rounded-lg shrink-0", iconBg)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{source.titre}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shrink-0 bg-background/80">
            {label}
          </Badge>
        </div>
        {source.excerpt && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">{source.excerpt}</p>
        )}
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 opacity-40 mt-0.5" />
    </motion.div>
  );
}
