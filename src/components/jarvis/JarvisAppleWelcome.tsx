/**
 * JarvisAppleWelcome - Écran d'accueil style Apple (v13.0)
 * 
 * Design minimaliste, animations subtiles, focus sur l'essentiel
 * Avec suggestions contextuelles basées sur l'heure et la page
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Mail,
  Calendar,
  BarChart2,
  FileText,
  Sparkles,
  MessageCircle,
  CheckCircle2,
  Bell,
  TrendingUp,
  Users,
  Zap,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { vibrateSelection } from '@/lib/haptics';
import { useLocation } from 'react-router-dom';

interface SuggestionChip {
  id: string;
  label: string;
  icon: React.ElementType;
  prompt: string;
  priority: number;
}

function getGreeting(): { text: string; period: 'morning' | 'afternoon' | 'evening' } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Bonjour', period: 'morning' };
  if (hour < 18) return { text: 'Bon après-midi', period: 'afternoon' };
  return { text: 'Bonsoir', period: 'evening' };
}

function getContextualSuggestions(pathname: string, period: 'morning' | 'afternoon' | 'evening'): SuggestionChip[] {
  const baseSuggestions: SuggestionChip[] = [];
  
  // Suggestions basées sur l'heure
  if (period === 'morning') {
    baseSuggestions.push(
      { id: 'briefing', label: 'Briefing du jour', icon: Sparkles, prompt: 'Génère mon briefing quotidien', priority: 1 },
      { id: 'emails', label: 'Emails urgents', icon: Mail, prompt: 'Montre-moi les emails urgents non lus', priority: 2 }
    );
  } else if (period === 'afternoon') {
    baseSuggestions.push(
      { id: 'tasks', label: 'Tâches prioritaires', icon: CheckCircle2, prompt: 'Quelles sont mes tâches prioritaires ?', priority: 1 },
      { id: 'meetings', label: 'Réunions à venir', icon: Calendar, prompt: 'Quels sont mes prochains rendez-vous ?', priority: 2 }
    );
  } else {
    baseSuggestions.push(
      { id: 'summary', label: 'Bilan de la journée', icon: TrendingUp, prompt: 'Fais le bilan de ma journée', priority: 1 },
      { id: 'tomorrow', label: 'Préparer demain', icon: Clock, prompt: 'Aide-moi à préparer demain', priority: 2 }
    );
  }
  
  // Suggestions basées sur la page
  if (pathname.includes('/etablissements')) {
    baseSuggestions.push(
      { id: 'pipeline', label: 'Pipeline', icon: BarChart2, prompt: 'État du pipeline commercial', priority: 3 },
      { id: 'prospects', label: 'Prospects froids', icon: Users, prompt: 'Quels prospects relancer ?', priority: 4 }
    );
  } else if (pathname.includes('/emails')) {
    baseSuggestions.push(
      { id: 'unread', label: 'Non lus', icon: Mail, prompt: 'Résume mes emails non lus', priority: 3 },
      { id: 'respond', label: 'À répondre', icon: MessageCircle, prompt: 'Quels emails attendent une réponse ?', priority: 4 }
    );
  } else if (pathname.includes('/tresorerie')) {
    baseSuggestions.push(
      { id: 'solde', label: 'Solde actuel', icon: BarChart2, prompt: 'Quel est le solde bancaire actuel ?', priority: 3 },
      { id: 'factures', label: 'Factures en retard', icon: FileText, prompt: 'Y a-t-il des factures en retard ?', priority: 4 }
    );
  } else if (pathname.includes('/support')) {
    baseSuggestions.push(
      { id: 'tickets', label: 'Tickets critiques', icon: Bell, prompt: 'Quels tickets sont critiques ?', priority: 3 },
      { id: 'kpis', label: 'KPIs support', icon: TrendingUp, prompt: 'Montre les KPIs du support', priority: 4 }
    );
  } else if (pathname.includes('/rd')) {
    baseSuggestions.push(
      { id: 'sprint', label: 'Sprint actuel', icon: Zap, prompt: 'Quel est l\'état du sprint actuel ?', priority: 3 },
      { id: 'backlog', label: 'Backlog', icon: FileText, prompt: 'Quelles stories sont en attente ?', priority: 4 }
    );
  } else if (pathname.includes('/people')) {
    baseSuggestions.push(
      { id: 'absences', label: 'Absences', icon: Users, prompt: 'Qui est absent cette semaine ?', priority: 3 },
      { id: 'paie', label: 'KPIs RH', icon: BarChart2, prompt: 'Montre les KPIs RH du mois', priority: 4 }
    );
  } else {
    // Dashboard par défaut
    baseSuggestions.push(
      { id: 'actions', label: 'Actions prioritaires', icon: Zap, prompt: 'Suggère-moi les actions prioritaires', priority: 3 },
      { id: 'rapport', label: 'Rapport hebdo', icon: FileText, prompt: 'Génère un rapport hebdomadaire', priority: 4 }
    );
  }
  
  // Trier par priorité et limiter à 4
  return baseSuggestions.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

interface JarvisAppleWelcomeProps {
  userName?: string;
  onSendMessage?: (message: string) => void;
  className?: string;
}

export const JarvisAppleWelcome = memo(function JarvisAppleWelcome({
  userName = 'Utilisateur',
  onSendMessage,
  className,
}: JarvisAppleWelcomeProps) {
  const greeting = useMemo(() => getGreeting(), []);
  const firstName = userName.split(' ')[0];
  const location = useLocation();
  
  const suggestions = useMemo(
    () => getContextualSuggestions(location.pathname, greeting.period),
    [location.pathname, greeting.period]
  );
  
  const handleSuggestion = (prompt: string) => {
    vibrateSelection();
    onSendMessage?.(prompt);
  };

  return (
    <div className={cn(
      "flex flex-col items-center justify-center px-6 py-12",
      "min-h-[60vh]",
      className
    )}>
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="text-center mb-8"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 mb-6"
        >
          <Sparkles className="w-7 h-7 text-primary" />
        </motion.div>
        
        <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-2">
          {greeting.text}, {firstName}
        </h1>
        <p className="text-muted-foreground text-base">
          Comment puis-je vous aider ?
        </p>
      </motion.div>

      {/* Suggestion chips avec icônes colorées */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap justify-center gap-2.5 max-w-lg"
      >
        {suggestions.map((suggestion, index) => {
          const Icon = suggestion.icon;
          // Couleurs différentes par position pour variété visuelle
          const iconColors = [
            'bg-primary/15 text-primary',
            'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
            'bg-amber-500/15 text-amber-600 dark:text-amber-400',
            'bg-violet-500/15 text-violet-600 dark:text-violet-400',
          ];
          const iconColorClass = iconColors[index % iconColors.length];
          
          return (
            <motion.button
              key={suggestion.id}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ 
                delay: 0.35 + index * 0.1,
                type: 'spring',
                stiffness: 300,
                damping: 20
              }}
              onClick={() => handleSuggestion(suggestion.prompt)}
              whileHover={{ scale: 1.04, y: -3 }}
              whileTap={{ scale: 0.96 }}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2.5 rounded-full",
                "bg-muted/60 hover:bg-muted/80 border border-border/50 hover:border-border",
                "transition-all duration-200",
                "text-sm font-medium text-foreground",
                "shadow-sm hover:shadow-md"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full",
                iconColorClass
              )}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span>{suggestion.label}</span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-12 text-xs text-muted-foreground/60 flex items-center gap-2"
      >
        <MessageCircle className="w-3 h-3" />
        <span>Posez n'importe quelle question</span>
      </motion.p>
    </div>
  );
});
