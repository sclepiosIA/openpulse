/**
 * JarvisContextualSuggestions - Suggestions contextuelles basées sur la page
 * 
 * Affiche des suggestions intelligentes en fonction de l'entité visualisée.
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Mail,
  CheckSquare,
  BarChart2,
  AlertTriangle,
  Calendar,
  Search,
  Edit,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  useJarvisContextualSuggestions,
  type ContextualSuggestion,
} from '@/hooks/jarvis/useJarvisContextualSuggestions';

interface JarvisContextualSuggestionsProps {
  onExecute: (command: string) => void;
  isDisabled?: boolean;
  maxVisible?: number;
}

const ICON_MAP = {
  summary: FileText,
  email: Mail,
  task: CheckSquare,
  chart: BarChart2,
  alert: AlertTriangle,
  calendar: Calendar,
  search: Search,
  edit: Edit,
};

const CATEGORY_COLORS = {
  analyze: 'text-primary bg-primary/10 border-primary/20',
  action: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20',
  navigate: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  create: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
};

const CATEGORY_LABELS = {
  analyze: 'Analyser',
  action: 'Action',
  navigate: 'Naviguer',
  create: 'Créer',
};

export function JarvisContextualSuggestions({ 
  onExecute, 
  isDisabled = false,
  maxVisible = 5 
}: JarvisContextualSuggestionsProps) {
  const { 
    suggestions, 
    pageType, 
    module, 
    entityName, 
    isLoading 
  } = useJarvisContextualSuggestions();
  
  const visibleSuggestions = suggestions.slice(0, maxVisible);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Sparkles className="h-4 w-4 mr-2" />
        </motion.div>
        <span className="text-sm">Analyse du contexte...</span>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {/* Header with context info */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">
            Suggestions contextuelles
          </span>
        </div>
        {entityName && (
          <Badge variant="secondary" className="text-[10px] h-5 px-2 font-normal">
            {entityName.length > 20 ? entityName.substring(0, 20) + '...' : entityName}
          </Badge>
        )}
      </div>
      
      {/* Suggestions list */}
      <ScrollArea className="max-h-[280px]">
        <AnimatePresence mode="popLayout">
          <div className="space-y-2">
            {visibleSuggestions.map((suggestion, index) => (
              <SuggestionItem
                key={suggestion.id}
                suggestion={suggestion}
                index={index}
                onExecute={onExecute}
                isDisabled={isDisabled}
              />
            ))}
          </div>
        </AnimatePresence>
      </ScrollArea>
      
      {/* Show more indicator */}
      {suggestions.length > maxVisible && (
        <p className="text-xs text-muted-foreground text-center">
          +{suggestions.length - maxVisible} autres suggestions
        </p>
      )}
    </div>
  );
}

interface SuggestionItemProps {
  suggestion: ContextualSuggestion;
  index: number;
  onExecute: (command: string) => void;
  isDisabled: boolean;
}

function SuggestionItem({ 
  suggestion, 
  index, 
  onExecute, 
  isDisabled 
}: SuggestionItemProps) {
  const Icon = ICON_MAP[suggestion.icon] || FileText;
  const categoryColor = CATEGORY_COLORS[suggestion.category];
  const categoryLabel = CATEGORY_LABELS[suggestion.category];
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
    >
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start h-auto py-2.5 px-3 rounded-xl",
          "hover:bg-muted/50 transition-all group",
          "border border-transparent hover:border-border/50"
        )}
        onClick={() => onExecute(suggestion.command)}
        disabled={isDisabled}
      >
        <div className="flex items-start gap-3 w-full">
          {/* Icon */}
          <div className={cn(
            "flex-shrink-0 p-1.5 rounded-lg border",
            categoryColor
          )}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">
                {suggestion.label}
              </span>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[9px] h-4 px-1.5 font-normal opacity-60",
                  "group-hover:opacity-100 transition-opacity"
                )}
              >
                {categoryLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {suggestion.command}
            </p>
          </div>
          
          {/* Arrow */}
          <ChevronRight className={cn(
            "h-4 w-4 text-muted-foreground/50 flex-shrink-0",
            "group-hover:text-primary group-hover:translate-x-0.5",
            "transition-all"
          )} />
        </div>
      </Button>
    </motion.div>
  );
}
