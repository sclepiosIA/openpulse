/**
 * JarvisDailyBriefing - Widget de briefing quotidien personnalisé
 * 
 * JARVIS 7.0 - Affiche le résumé matinal avec priorités, alertes et opportunités
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun,
  Moon,
  Cloud,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Calendar,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { invokeEdge } from "@/services/edgeFunctions";
import { useAuth } from '@/hooks/shared/useAuth';
import { useNavigate } from 'react-router-dom';

interface BriefingItem {
  text: string;
  type: 'alert' | 'info' | 'opportunity' | 'task';
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
}

interface BriefingSection {
  title: string;
  emoji: string;
  items: BriefingItem[];
  priority: 'high' | 'medium' | 'low';
}

interface DailyBriefing {
  greeting: string;
  date: string;
  sections: BriefingSection[];
  summary: {
    tasksToday: number;
    overdueItems: number;
    unreadEmails: number;
    upcomingMeetings: number;
  };
  generatedAt: string;
}

interface JarvisDailyBriefingProps {
  onClose?: () => void;
  compact?: boolean;
  className?: string;
}

export function JarvisDailyBriefing({ onClose, compact = false, className }: JarvisDailyBriefingProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['PRIORITÉS DU JOUR', 'ALERTES']));

  const { data: briefing, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['jarvis-daily-briefing', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const data = await invokeEdge<any>('jarvis-daily-briefing', { user_id: user.id });
      return data.briefing as DailyBriefing;
    },
    enabled: !!user?.id,
    staleTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });

  const toggleSection = (title: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const handleItemClick = (item: BriefingItem) => {
    if (!item.entityType || !item.entityId) return;
    
    // Navigation basée sur le type d'entité
    switch (item.entityType) {
      case 'tache':
        // Naviguer vers les tâches ou l'établissement associé
        navigate('/etablissements');
        break;
      case 'email_thread':
        navigate('/emails');
        break;
      case 'calendar_event':
        navigate('/calendrier');
        break;
      case 'facture':
        navigate('/tresorerie');
        break;
      case 'etablissement':
        navigate(`/etablissements/${item.entityId}`);
        break;
      case 'support_ticket':
        navigate('/support');
        break;
    }
    
    onClose?.();
  };

  const getTimeIcon = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return <Sun className="h-5 w-5 text-amber-500" />;
    if (hour >= 12 && hour < 18) return <Cloud className="h-5 w-5 text-blue-400" />;
    return <Moon className="h-5 w-5 text-indigo-400" />;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500 bg-red-500/5';
      case 'medium': return 'border-l-amber-500 bg-amber-500/5';
      default: return 'border-l-blue-500 bg-blue-500/5';
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />;
      case 'opportunity': return <TrendingUp className="h-4 w-4 text-emerald-500 flex-shrink-0" />;
      case 'task': return <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0" />;
      default: return <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />;
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <RefreshCw className="h-6 w-6 text-primary" />
        </motion.div>
        <span className="ml-3 text-muted-foreground">Préparation de votre briefing...</span>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
        <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Impossible de charger le briefing</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (compact) {
    // Version compacte pour le widget dashboard
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getTimeIcon()}
            <span className="text-sm font-medium">{briefing.greeting}</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => refetch()}
            disabled={isRefetching} aria-label="Actualiser">
            <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
          </Button>
        </div>
        
        {/* Mini résumé */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold text-primary">{briefing.summary.tasksToday}</div>
            <div className="text-[10px] text-muted-foreground">Tâches</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <div className={cn("text-lg font-bold", briefing.summary.overdueItems > 0 ? "text-red-500" : "text-emerald-500")}>
              {briefing.summary.overdueItems}
            </div>
            <div className="text-[10px] text-muted-foreground">Retards</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold text-blue-500">{briefing.summary.unreadEmails}</div>
            <div className="text-[10px] text-muted-foreground">Emails</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold text-purple-500">{briefing.summary.upcomingMeetings}</div>
            <div className="text-[10px] text-muted-foreground">RDV</div>
          </div>
        </div>

        {/* Première alerte si présente */}
        {briefing.sections.find(s => s.priority === 'high')?.items[0] && (
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span className="text-foreground line-clamp-2">
                {briefing.sections.find(s => s.priority === 'high')!.items[0].text}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Version complète
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-5 border-b border-border/50 bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {getTimeIcon()}
            <div>
              <h2 className="text-xl font-bold text-foreground">{briefing.greeting}</h2>
              <p className="text-sm text-muted-foreground capitalize">{briefing.date}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => refetch()}
              disabled={isRefetching} aria-label="Actualiser">
              <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Fermer">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-background/80">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {briefing.summary.tasksToday} tâches
          </Badge>
          {briefing.summary.overdueItems > 0 && (
            <Badge variant="destructive">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {briefing.summary.overdueItems} retards
            </Badge>
          )}
          <Badge variant="outline" className="bg-background/80">
            <Mail className="h-3 w-3 mr-1" />
            {briefing.summary.unreadEmails} emails
          </Badge>
          <Badge variant="outline" className="bg-background/80">
            <Calendar className="h-3 w-3 mr-1" />
            {briefing.summary.upcomingMeetings} réunions
          </Badge>
        </div>
      </div>

      {/* Sections */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {briefing.sections.map((section, idx) => {
            const isExpanded = expandedSections.has(section.title);
            
            return (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={cn(
                  "rounded-xl border-l-4 overflow-hidden",
                  getPriorityColor(section.priority)
                )}
              >
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                  onClick={() => toggleSection(section.title)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{section.emoji}</span>
                    <span className="font-semibold text-foreground">{section.title}</span>
                    <Badge variant="secondary" className="text-xs">
                      {section.items.length}
                    </Badge>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 space-y-2">
                        {section.items.map((item, itemIdx) => (
                          <motion.div
                            key={itemIdx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: itemIdx * 0.05 }}
                            className={cn(
                              "flex items-start gap-2 p-2 rounded-lg",
                              "hover:bg-muted/50 transition-colors group",
                              item.entityId && "cursor-pointer"
                            )}
                            onClick={() => handleItemClick(item)}
                          >
                            {getItemIcon(item.type)}
                            <span className="text-sm text-foreground flex-1 leading-relaxed">
                              {item.text}
                            </span>
                            {item.entityId && (
                              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {briefing.sections.length === 0 && (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-semibold text-foreground">Tout est sous contrôle ! 🎉</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Aucune alerte ou priorité particulière pour aujourd'hui.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border/50 bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          Généré à {new Date(briefing.generatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
