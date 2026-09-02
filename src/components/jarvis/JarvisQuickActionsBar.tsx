/**
 * JarvisQuickActionsBar - Barre d'actions rapides premium (v12.6)
 * 
 * Actions contextuelles basées sur l'heure et l'activité
 * Design glass ultra premium avec animations fluides
 */

import { useMemo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  ListTodo,
  BarChart3,
  Calendar,
  TrendingUp,
  Users,
  DollarSign,
  HelpCircle,
  Sparkles,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { vibrateSelection } from '@/lib/haptics';
import { useJarvisUnifiedOptional, JARVIS_COLORS } from '@/contexts/JarvisUnifiedContext';

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  command: string;
  colorKey: keyof typeof JARVIS_COLORS | 'default';
  priority: number;
  emoji: string;
}

// Actions contextuelles avec couleurs du système de design
function getContextualActions(): QuickAction[] {
  const hour = new Date().getHours();
  
  const allActions: QuickAction[] = [
    { id: 'emails', label: 'Emails', icon: Mail, command: 'Résume mes emails non lus', colorKey: 'reminder', priority: 1, emoji: '📧' },
    { id: 'taches', label: 'Tâches', icon: ListTodo, command: 'Quelles sont mes tâches prioritaires ?', colorKey: 'insight', priority: 2, emoji: '✅' },
    { id: 'pipeline', label: 'Pipeline', icon: TrendingUp, command: 'Quel est l\'état du pipeline commercial ?', colorKey: 'opportunity', priority: 3, emoji: '📈' },
    { id: 'agenda', label: 'Agenda', icon: Calendar, command: 'Quels sont mes rendez-vous aujourd\'hui ?', colorKey: 'risk', priority: 4, emoji: '📅' },
    { id: 'tresorerie', label: 'Trésorerie', icon: DollarSign, command: 'Quelle est la situation de trésorerie ?', colorKey: 'opportunity', priority: 5, emoji: '💰' },
    { id: 'equipe', label: 'Équipe', icon: Users, command: 'Qui est disponible aujourd\'hui ?', colorKey: 'prediction', priority: 6, emoji: '👥' },
    { id: 'stats', label: 'Stats', icon: BarChart3, command: 'Donne-moi les KPIs du mois', colorKey: 'reminder', priority: 7, emoji: '📊' },
    { id: 'support', label: 'Support', icon: HelpCircle, command: 'Combien de tickets ouverts ?', colorKey: 'risk', priority: 8, emoji: '🎫' },
  ];

  // Prioriser selon l'heure
  if (hour >= 8 && hour < 10) {
    allActions.find(a => a.id === 'emails')!.priority = 0;
    allActions.find(a => a.id === 'agenda')!.priority = 1;
  } else if (hour >= 10 && hour < 12) {
    allActions.find(a => a.id === 'taches')!.priority = 0;
    allActions.find(a => a.id === 'pipeline')!.priority = 1;
  } else if (hour >= 14 && hour < 16) {
    allActions.find(a => a.id === 'pipeline')!.priority = 0;
    allActions.find(a => a.id === 'equipe')!.priority = 1;
  } else if (hour >= 16 && hour < 18) {
    allActions.find(a => a.id === 'stats')!.priority = 0;
    allActions.find(a => a.id === 'tresorerie')!.priority = 1;
  }

  return allActions.sort((a, b) => a.priority - b.priority);
}

interface JarvisQuickActionsBarProps {
  onAction?: (command: string) => void;
  disabled?: boolean;
  className?: string;
  maxVisible?: number;
}

export function JarvisQuickActionsBar({
  onAction,
  disabled = false,
  className,
  maxVisible = 6,
}: JarvisQuickActionsBarProps) {
  const jarvisContext = useJarvisUnifiedOptional();
  const actions = useMemo(() => getContextualActions().slice(0, maxVisible), [maxVisible]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleAction = useCallback((command: string) => {
    vibrateSelection();
    if (onAction) {
      onAction(command);
    } else if (jarvisContext) {
      jarvisContext.executeQuickAction(command);
    }
  }, [onAction, jarvisContext]);

  // Obtenir la couleur d'icône depuis le système de design
  const getIconColor = (colorKey: QuickAction['colorKey']) => {
    if (colorKey === 'default') return 'text-muted-foreground';
    return JARVIS_COLORS[colorKey]?.icon || 'text-primary';
  };

  return (
    <div className={cn("relative", className)}>
      <ScrollArea className="w-full">
        <div className="flex items-center gap-2 pb-2">
          {/* AI Sparkle indicator - Premium animated */}
          <motion.div
            initial={{ opacity: 0, scale: 0, rotate: -180 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="relative flex items-center justify-center h-10 w-10 rounded-xl flex-shrink-0"
          >
            {/* Animated glow */}
            <motion.div 
              className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/30 to-cyan-400/20 blur-md"
              animate={{ 
                opacity: [0.4, 0.7, 0.4],
                scale: [0.9, 1.1, 0.9] 
              }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <div className="relative h-full w-full rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/25 flex items-center justify-center backdrop-blur-sm">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-4.5 w-4.5 text-primary" />
              </motion.div>
            </div>
          </motion.div>

          {actions.map((action, index) => {
            const Icon = action.icon;
            const isHovered = hoveredId === action.id;
            
            return (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, x: -15, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ delay: index * 0.05, type: "spring", stiffness: 200 }}
                onMouseEnter={() => setHoveredId(action.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="relative"
              >
                {/* Glow effect on hover */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute -inset-1 rounded-2xl bg-primary/10 blur-md -z-10"
                    />
                  )}
                </AnimatePresence>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction(action.command)}
                  disabled={disabled}
                  className={cn(
                    "h-10 px-3.5 gap-2 rounded-xl text-xs font-medium",
                    "bg-card/90 backdrop-blur-sm",
                    "border-border/40 hover:border-primary/40",
                    "hover:bg-primary/8 hover:shadow-lg hover:shadow-primary/10",
                    "transition-all duration-200",
                    "whitespace-nowrap group"
                  )}
                >
                  <motion.span 
                    className="text-base"
                    animate={{ scale: isHovered ? 1.2 : 1, rotate: isHovered ? 10 : 0 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {action.emoji}
                  </motion.span>
                  <span className="text-foreground/80 group-hover:text-foreground transition-colors">
                    {action.label}
                  </span>
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ 
                      width: isHovered ? 'auto' : 0, 
                      opacity: isHovered ? 1 : 0 
                    }}
                    className="overflow-hidden"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-primary" />
                  </motion.div>
                </Button>
              </motion.div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>
    </div>
  );
}
