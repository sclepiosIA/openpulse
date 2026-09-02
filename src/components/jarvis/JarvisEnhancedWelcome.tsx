/**
 * JarvisEnhancedWelcome - Écran d'accueil compact et rapide (v15.1)
 */

import { memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  MessageCircle,
  Mail,
  Calendar,
  BarChart2,
  FileText,
  CheckCircle2,
  Bell,
  TrendingUp,
  Users,
  Zap,
  Clock,
  Sun,
  Moon,
  Sunrise,
  Brain,
  ArrowRight,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { vibrateSelection } from '@/lib/haptics';
import { useLocation } from 'react-router-dom';

interface Suggestion {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  prompt: string;
  gradient: string;
  priority: number;
}

function getTimeContext(): { 
  greeting: string; 
  period: 'morning' | 'afternoon' | 'evening' | 'night';
  icon: React.ElementType;
} {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { greeting: 'Bonjour', period: 'morning', icon: Sunrise };
  if (hour >= 12 && hour < 18) return { greeting: 'Bon après-midi', period: 'afternoon', icon: Sun };
  if (hour >= 18 && hour < 22) return { greeting: 'Bonsoir', period: 'evening', icon: Moon };
  return { greeting: 'Bonne nuit', period: 'night', icon: Moon };
}

function getContextualSuggestions(pathname: string, period: string): Suggestion[] {
  const allSuggestions: Suggestion[] = [];
  
  if (period === 'morning') {
    allSuggestions.push(
      { id: 'briefing', label: 'Briefing matinal', description: 'Résumé de votre journée', icon: Sparkles, prompt: 'Génère mon briefing complet du jour avec mes priorités', gradient: 'from-amber-500/20 to-orange-500/10', priority: 1 },
      { id: 'emails', label: 'Emails urgents', description: 'Messages prioritaires', icon: Mail, prompt: 'Quels emails urgents nécessitent mon attention ?', gradient: 'from-blue-500/20 to-cyan-500/10', priority: 2 }
    );
  } else if (period === 'afternoon') {
    allSuggestions.push(
      { id: 'tasks', label: 'Tâches prioritaires', description: 'Ce qui reste à faire', icon: CheckCircle2, prompt: 'Quelles tâches prioritaires dois-je terminer aujourd\'hui ?', gradient: 'from-emerald-500/20 to-green-500/10', priority: 1 },
      { id: 'meetings', label: 'Réunions à venir', description: 'Votre agenda', icon: Calendar, prompt: 'Résume mes prochaines réunions et comment m\'y préparer', gradient: 'from-purple-500/20 to-violet-500/10', priority: 2 }
    );
  } else {
    allSuggestions.push(
      { id: 'summary', label: 'Bilan de la journée', description: 'Ce qui a été accompli', icon: TrendingUp, prompt: 'Fais le bilan de ma journée : accomplissements et points d\'attention', gradient: 'from-indigo-500/20 to-blue-500/10', priority: 1 },
      { id: 'tomorrow', label: 'Préparer demain', description: 'Anticipez votre journée', icon: Clock, prompt: 'Aide-moi à préparer demain : quelles sont les priorités ?', gradient: 'from-pink-500/20 to-rose-500/10', priority: 2 }
    );
  }
  
  if (pathname.includes('/etablissements')) {
    allSuggestions.push(
      { id: 'pipeline', label: 'Pipeline commercial', description: 'Vue d\'ensemble', icon: BarChart2, prompt: 'Donne-moi l\'état complet du pipeline commercial', gradient: 'from-cyan-500/20 to-teal-500/10', priority: 3 },
      { id: 'prospects', label: 'Prospects à relancer', description: 'Opportunités froides', icon: Users, prompt: 'Quels prospects froids devrais-je relancer en priorité ?', gradient: 'from-orange-500/20 to-amber-500/10', priority: 4 }
    );
  } else if (pathname.includes('/tresorerie')) {
    allSuggestions.push(
      { id: 'solde', label: 'Situation financière', description: 'Solde et flux', icon: BarChart2, prompt: 'Quel est l\'état de notre trésorerie ?', gradient: 'from-emerald-500/20 to-green-500/10', priority: 3 },
      { id: 'factures', label: 'Factures en retard', description: 'Encaissements', icon: FileText, prompt: 'Quelles factures sont en retard de paiement ?', gradient: 'from-red-500/20 to-rose-500/10', priority: 4 }
    );
  } else if (pathname.includes('/support')) {
    allSuggestions.push(
      { id: 'tickets', label: 'Tickets critiques', description: 'Urgences support', icon: Bell, prompt: 'Quels tickets support sont critiques ?', gradient: 'from-red-500/20 to-orange-500/10', priority: 3 }
    );
  } else {
    allSuggestions.push(
      { id: 'actions', label: 'Actions suggérées', description: 'Recommandations IA', icon: Zap, prompt: 'Suggère-moi les actions prioritaires à faire maintenant', gradient: 'from-violet-500/20 to-purple-500/10', priority: 3 },
      { id: 'rapport', label: 'Rapport rapide', description: 'Vue synthétique', icon: FileText, prompt: 'Génère un rapport synthétique de la semaine', gradient: 'from-blue-500/20 to-indigo-500/10', priority: 4 }
    );
  }
  
  return allSuggestions.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

interface JarvisEnhancedWelcomeProps {
  userName?: string;
  onSendMessage?: (message: string) => void;
  onLoadConversation?: (id: string) => void;
  recentConversations?: Array<{ id: string; title: string; date: Date }>;
  className?: string;
}

export const JarvisEnhancedWelcome = memo(function JarvisEnhancedWelcome({
  userName = 'Utilisateur',
  onSendMessage,
  onLoadConversation,
  recentConversations = [],
  className,
}: JarvisEnhancedWelcomeProps) {
  const timeContext = useMemo(() => getTimeContext(), []);
  const firstName = userName.split(' ')[0];
  const location = useLocation();
  const [hoveredSuggestion, setHoveredSuggestion] = useState<string | null>(null);
  
  const suggestions = useMemo(
    () => getContextualSuggestions(location.pathname, timeContext.period),
    [location.pathname, timeContext.period]
  );
  
  const handleSuggestion = (e: React.MouseEvent, prompt: string) => {
    e.stopPropagation();
    vibrateSelection();
    onSendMessage?.(prompt);
  };

  const TimeIcon = timeContext.icon;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center px-5 py-6",
      "min-h-[50vh]",
      className
    )}>
      {/* Hero section - compact */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        {/* Smaller icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
          className="relative inline-flex items-center justify-center mb-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/20">
            <Brain className="w-7 h-7 text-primary" />
          </div>
        </motion.div>
        
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <TimeIcon className="w-4 h-4 text-muted-foreground" />
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {timeContext.greeting}, {firstName}
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Comment puis-je vous aider ?
          </p>
        </motion.div>
      </motion.div>

      {/* Suggestions grid - compact */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="grid grid-cols-2 gap-2.5">
          {suggestions.map((suggestion, index) => {
            const Icon = suggestion.icon;
            const isHovered = hoveredSuggestion === suggestion.id;
            
            return (
              <motion.button
                key={suggestion.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + index * 0.06 }}
                onClick={(e) => handleSuggestion(e, suggestion.prompt)}
                onMouseEnter={() => setHoveredSuggestion(suggestion.id)}
                onMouseLeave={() => setHoveredSuggestion(null)}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "relative group p-3 rounded-xl text-left",
                  "bg-gradient-to-br",
                  suggestion.gradient,
                  "border border-border/40 hover:border-primary/30",
                  "transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                )}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    "bg-background/80 shadow-sm",
                    "group-hover:bg-background group-hover:shadow-md",
                    "transition-all duration-200"
                  )}>
                    <Icon className="w-4 h-4 text-foreground" />
                  </div>
                  
                  <motion.div
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : -5 }}
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-primary" />
                  </motion.div>
                </div>
                
                <h3 className="font-semibold text-[13px] text-foreground mb-0.5 leading-tight">
                  {suggestion.label}
                </h3>
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  {suggestion.description}
                </p>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Recent conversations */}
      {recentConversations.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 w-full max-w-md"
        >
          <div className="flex items-center gap-2 mb-2 px-1">
            <History className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Conversations récentes
            </span>
          </div>
          <div className="space-y-1.5">
            {recentConversations.slice(0, 3).map((conv, index) => (
              <motion.button
                key={conv.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.65 + index * 0.06 }}
                onClick={(e) => {
                  e.stopPropagation();
                  vibrateSelection();
                  onLoadConversation?.(conv.id);
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 p-2.5 rounded-lg",
                  "bg-muted/30 hover:bg-muted/50 border border-border/30",
                  "transition-all duration-200 text-left cursor-pointer"
                )}
              >
                <MessageCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-[13px] text-foreground truncate flex-1">
                  {conv.title}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {conv.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Footer hint - faster */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-6 text-[11px] text-muted-foreground/40 flex items-center gap-1.5"
      >
        <Sparkles className="w-3 h-3" />
        <span>Posez n'importe quelle question</span>
      </motion.p>
    </div>
  );
});
