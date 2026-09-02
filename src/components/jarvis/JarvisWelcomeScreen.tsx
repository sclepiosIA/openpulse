/**
 * JarvisWelcomeScreen - Écran d'accueil immersif v12.6
 * 
 * Animation cinématique premium, salutation personnalisée dynamique,
 * suggestion contextuelle intelligente et quick actions réinventées
 */

import { memo, useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShouldAnimateLight } from '@/hooks/ui/useShouldAnimate';
import {
  Mail,
  ListTodo,
  BarChart3,
  Calendar,
  TrendingUp,
  Users,
  Sparkles,
  ArrowRight,
  Command,
  Mic,
  Zap,
  Clock,
  Sun,
  Moon,
  CloudSun,
  Coffee,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJarvisUnifiedOptional, JARVIS_COLORS } from '@/contexts/JarvisUnifiedContext';
import { vibrateSelection } from '@/lib/haptics';

interface WelcomeAction {
  id: string;
  label: string;
  icon: React.ElementType;
  command: string;
  colorClass: string;
  bgClass: string;
  glowClass: string;
}

const welcomeActions: WelcomeAction[] = [
  { id: 'emails', label: 'Emails', icon: Mail, command: 'Résume mes emails non lus', colorClass: 'text-sky-500', bgClass: 'bg-sky-500/10', glowClass: 'shadow-sky-500/20' },
  { id: 'taches', label: 'Tâches', icon: ListTodo, command: 'Quelles sont mes tâches prioritaires ?', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10', glowClass: 'shadow-emerald-500/20' },
  { id: 'stats', label: 'Stats', icon: BarChart3, command: 'Donne-moi les KPIs du mois', colorClass: 'text-violet-500', bgClass: 'bg-violet-500/10', glowClass: 'shadow-violet-500/20' },
  { id: 'agenda', label: 'Agenda', icon: Calendar, command: 'Quels sont mes rendez-vous ?', colorClass: 'text-amber-500', bgClass: 'bg-amber-500/10', glowClass: 'shadow-amber-500/20' },
  { id: 'pipeline', label: 'Pipeline', icon: TrendingUp, command: 'État du pipeline commercial', colorClass: 'text-rose-500', bgClass: 'bg-rose-500/10', glowClass: 'shadow-rose-500/20' },
  { id: 'equipe', label: 'Équipe', icon: Users, command: 'Qui est disponible ?', colorClass: 'text-cyan-500', bgClass: 'bg-cyan-500/10', glowClass: 'shadow-cyan-500/20' },
];

function getGreetingData() {
  const hour = new Date().getHours();
  if (hour < 6) return { text: 'Bonne nuit', icon: Moon, period: 'night' };
  if (hour < 12) return { text: 'Bonjour', icon: Sun, period: 'morning' };
  if (hour < 14) return { text: 'Bon appétit', icon: Coffee, period: 'lunch' };
  if (hour < 18) return { text: 'Bon après-midi', icon: CloudSun, period: 'afternoon' };
  if (hour < 21) return { text: 'Bonne soirée', icon: Briefcase, period: 'evening' };
  return { text: 'Bonne nuit', icon: Moon, period: 'night' };
}

function formatTime(): string {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(): string {
  return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

interface JarvisWelcomeScreenProps {
  userName?: string;
  suggestion?: {
    title: string;
    description: string;
    action: string;
    type: 'urgent' | 'insight' | 'opportunity';
  };
  onAction?: (command: string) => void;
  className?: string;
}

export const JarvisWelcomeScreen = memo(function JarvisWelcomeScreen({
  userName = 'Utilisateur',
  suggestion,
  onAction,
  className,
}: JarvisWelcomeScreenProps) {
  const jarvisContext = useJarvisUnifiedOptional();
  const shouldAnimate = useShouldAnimateLight();
  const [time, setTime] = useState(formatTime());
  const greetingData = useMemo(() => getGreetingData(), []);
  const date = useMemo(() => formatDate(), []);
  const GreetingIcon = greetingData.icon;

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setTime(formatTime()), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = (command: string) => {
    vibrateSelection();
    if (onAction) {
      onAction(command);
    } else if (jarvisContext) {
      jarvisContext.executeQuickAction(command);
    }
  };

  const suggestionColors = suggestion ? JARVIS_COLORS[suggestion.type] : null;

  return (
    <div className={cn("flex flex-col items-center justify-center px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8", className)}>
      
      {/* Animated Logo with Premium Glow Effect */}
      <motion.div
        initial={{ scale: 0.3, opacity: 0, rotateY: -180 }}
        animate={{ scale: 1, opacity: 1, rotateY: 0 }}
        transition={{ 
          type: "spring", 
          stiffness: 150, 
          damping: 15,
          delay: 0.1 
        }}
        className="relative"
      >
        {/* Multi-layer glow effect */}
        <motion.div
          className="absolute rounded-full bg-gradient-to-br from-primary/30 via-cyan-400/20 to-blue-500/30 blur-3xl"
          animate={shouldAnimate ? { 
            scale: [1, 1.3, 1],
            opacity: [0.4, 0.6, 0.4],
            rotate: [0, 180, 360],
          } : { scale: 1, opacity: 0.4 }}
          transition={shouldAnimate ? { duration: 8, repeat: Infinity, ease: "linear" } : { duration: 0 }}
          style={{ width: 160, height: 160, left: -40, top: -40 }}
        />
        <motion.div
          className="absolute rounded-full bg-gradient-to-tr from-cyan-400/25 to-primary/20 blur-2xl"
          animate={shouldAnimate ? { 
            scale: [1.2, 0.9, 1.2],
            opacity: [0.3, 0.5, 0.3]
          } : { scale: 1, opacity: 0.3 }}
          transition={shouldAnimate ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
          style={{ width: 120, height: 120, left: -20, top: -20 }}
        />
        
        {/* Logo container with glass effect */}
        <motion.div
          className="relative w-24 h-24 rounded-3xl p-[2px] shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(200, 85%, 45%), hsl(var(--primary) / 0.8))',
          }}
          whileHover={{ scale: 1.08, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="w-full h-full rounded-[22px] bg-gradient-to-br from-primary/95 via-primary to-primary/90 flex items-center justify-center relative overflow-hidden">
            {/* Shine effect */}
              {shouldAnimate && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                />
              )}
            <Sparkles className="w-12 h-12 text-white drop-shadow-lg relative z-10" />
          </div>
          
          {/* Online indicator */}
            <motion.div
              className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 ring-[3px] ring-background flex items-center justify-center shadow-lg shadow-emerald-500/50"
              animate={shouldAnimate ? { scale: [1, 1.15, 1] } : {}}
              transition={shouldAnimate ? { duration: 2, repeat: Infinity } : { duration: 0 }}
            >
            <Zap className="h-3 w-3 text-white" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Personalized Greeting with Time */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
        className="text-center space-y-3"
      >
        {/* Time and Date */}
        <motion.div 
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono">{time}</span>
          <span className="text-muted-foreground/50">•</span>
          <span className="capitalize">{date}</span>
        </motion.div>
        
        {/* Main Greeting */}
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center justify-center gap-3">
            <motion.span
              animate={shouldAnimate ? { rotate: [0, 10, -10, 0] } : {}}
              transition={shouldAnimate ? { duration: 2, repeat: Infinity, repeatDelay: 3 } : { duration: 0 }}
            >
              <GreetingIcon className="w-7 h-7 text-amber-500" />
            </motion.span>
            <span>
              {greetingData.text}, {userName.split(' ')[0]} !
            </span>
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Comment puis-je vous aider aujourd'hui ?
          </p>
        </div>
      </motion.div>

      {/* Suggestion Card - Premium Glass Design */}
      <AnimatePresence mode="wait">
        {suggestion && (
          <motion.button
            initial={{ y: 30, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.95 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 150 }}
            onClick={() => handleAction(suggestion.action)}
            className={cn(
              "w-full max-w-sm p-4 rounded-2xl text-left relative overflow-hidden group",
              "bg-gradient-to-br backdrop-blur-xl border transition-all duration-300",
              "hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
              "focus:outline-none focus:ring-2 focus:ring-primary/50",
              suggestionColors?.bg,
              suggestionColors?.border,
            )}
          >
            {/* Animated gradient overlay on hover */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-cyan-400/10 opacity-0 group-hover:opacity-100 transition-opacity"
            />
            
            <div className="relative flex items-start gap-3">
              <motion.div 
                className={cn(
                  "p-2.5 rounded-xl shrink-0",
                  suggestionColors?.bg?.replace('/10', '/20')
                )}
                whileHover={{ rotate: 15, scale: 1.1 }}
              >
                <Sparkles className={cn("w-5 h-5", suggestionColors?.icon)} />
              </motion.div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Suggestion du jour
                  </p>
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-primary"
                    animate={shouldAnimate ? { scale: [1, 1.5, 1], opacity: [1, 0.5, 1] } : {}}
                    transition={shouldAnimate ? { duration: 2, repeat: Infinity } : { duration: 0 }}
                  />
                </div>
                <p className="font-semibold text-foreground truncate">
                  {suggestion.title}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                  {suggestion.description}
                </p>
              </div>
              <motion.div
                className="shrink-0 mt-1 p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors"
                whileHover={{ x: 3 }}
              >
                <ArrowRight className="w-4 h-4 text-primary" />
              </motion.div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Quick Actions Grid - Enhanced */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 100 }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Actions rapides
          </p>
          <Zap className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {welcomeActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.id}
                initial={{ y: 20, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + index * 0.06, type: "spring", stiffness: 200 }}
                onClick={() => handleAction(action.command)}
                whileHover={{ y: -4, scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "flex flex-col items-center gap-2.5 p-3 sm:p-4 rounded-2xl",
                  "bg-card/90 backdrop-blur-sm border border-border/50",
                  "hover:border-primary/40 hover:shadow-lg",
                  "transition-all duration-200 group",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50",
                  `hover:${action.glowClass}`
                )}
              >
                <motion.div 
                  className={cn(
                    "p-3 rounded-xl transition-all duration-300",
                    action.bgClass,
                    "group-hover:shadow-lg"
                  )}
                  whileHover={{ rotate: 10 }}
                >
                  <Icon className={cn("w-5 h-5 sm:w-6 sm:h-6", action.colorClass)} />
                </motion.div>
                <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                  {action.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Hints with Better Styling */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-muted-foreground"
      >
        <motion.div 
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-muted/60 backdrop-blur-sm border border-border/30"
          whileHover={{ scale: 1.05, backgroundColor: 'hsl(var(--muted))' }}
        >
          <Command className="w-3 h-3" />
          <span>
            Tapez <kbd className="px-1.5 py-0.5 rounded bg-background text-[10px] font-mono border border-border/50">/</kbd>
          </span>
        </motion.div>
        <motion.div 
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-muted/60 backdrop-blur-sm border border-border/30"
          whileHover={{ scale: 1.05, backgroundColor: 'hsl(var(--muted))' }}
        >
          <Mic className="w-3 h-3" />
          <span>"Hey Jarvis"</span>
        </motion.div>
      </motion.div>
    </div>
  );
});
