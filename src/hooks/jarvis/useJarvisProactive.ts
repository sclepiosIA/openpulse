/**
 * useJarvisProactive - Système de suggestions proactives de Jarvis
 * 
 * Analyse en temps réel le contexte utilisateur pour proposer des actions pertinentes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/shared/useAuth';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { debug } from '@/lib/debug';

export interface ProactiveSuggestion {
  id: string;
  type: 'tip' | 'action' | 'reminder' | 'insight' | 'warning';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  actionLabel?: string;
  actionCallback?: () => void;
  dismissable: boolean;
  expiresAt?: Date;
  context?: Record<string, unknown>;
}

interface DismissedEntry { id: string; dismissedAt: string }

interface WorkPattern {
  mostActiveHours: number[];
  preferredModules: string[];
  averageTasksPerDay: number;
  commonActions: string[];
}

export function useJarvisProactive(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { user } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [workPattern, setWorkPattern] = useState<WorkPattern | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const lastAnalysisRef = useRef<Date | null>(null);
  const dismissedSuggestionsRef = useRef<Set<string>>(new Set());

  // Analyser les patterns de travail de l'utilisateur
  const analyzeWorkPatterns = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Récupérer l'historique des actions Jarvis
      const { data: actions } = await supabase
        .from('jarvis_pending_actions')
        .select('trigger_type, proposed_action, created_at, status')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (actions && actions.length > 0) {
        // Analyser les heures d'activité
        const hours = actions
          .filter(a => a.created_at)
          .map(a => new Date(a.created_at!).getHours());
        const hourCounts: Record<number, number> = {};
        hours.forEach(h => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
        const mostActiveHours = Object.entries(hourCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([h]) => parseInt(h, 10));

        // Analyser les types d'actions préférées
        const actionTypes = actions.map(a => (a.proposed_action as { type?: string } | null)?.type).filter(Boolean) as string[];
        const actionCounts: Record<string, number> = {};
        actionTypes.forEach(t => { actionCounts[t] = (actionCounts[t] || 0) + 1; });
        const commonActions = Object.entries(actionCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([t]) => t);

        setWorkPattern({
          mostActiveHours,
          preferredModules: ['emails', 'crm', 'tasks'], // À enrichir
          averageTasksPerDay: actions.length / 30,
          commonActions,
        });
      }
    } catch (error) {
      debug.error('[JarvisProactive] Error analyzing patterns:', error);
    }
  }, [user?.id]);

  // Générer des suggestions contextuelles
  const generateContextualSuggestions = useCallback(async () => {
    if (!user?.id || isAnalyzing) return;
    
    // Limiter la fréquence d'analyse (max 1 fois par minute)
    if (lastAnalysisRef.current && Date.now() - lastAnalysisRef.current.getTime() < 60000) {
      return;
    }
    
    setIsAnalyzing(true);
    lastAnalysisRef.current = new Date();
    
    const newSuggestions: ProactiveSuggestion[] = [];
    
    try {
      const currentHour = new Date().getHours();
      const currentPath = location.pathname;

      // 1. Vérifier les emails non lus urgents
      const { data: urgentEmails, count: unreadCount } = await supabase
        .from('email_threads')
        .select('id, subject, ai_generated_title, last_message_date', { count: 'exact' })
        .gt('unread_count', 0)
        .order('last_message_at', { ascending: false })
        .limit(5);

      if (unreadCount && unreadCount > 10) {
        newSuggestions.push({
          id: 'unread-emails-high',
          type: 'warning',
          priority: 'high',
          title: `${unreadCount} emails non lus`,
          description: 'Vous avez beaucoup d\'emails en attente. Voulez-vous que je vous aide à les trier ?',
          actionLabel: 'Trier mes emails',
          dismissable: true,
        });
      } else if (unreadCount && unreadCount > 3) {
        newSuggestions.push({
          id: 'unread-emails-medium',
          type: 'tip',
          priority: 'medium',
          title: `${unreadCount} emails à consulter`,
          description: 'Je peux vous résumer les emails importants.',
          actionLabel: 'Résumer',
          dismissable: true,
        });
      }

      // 2. Vérifier les tâches en retard
      const { data: overdueTasks, count: overdueCount } = await supabase
        .from('taches')
        .select('id, titre, echeance, priorite', { count: 'exact' })
        .eq('statut', 'A faire')
        .not('echeance', 'is', null)
        .lt('echeance', new Date().toISOString())
        .order('echeance', { ascending: true })
        .limit(5);

      if (overdueCount && overdueCount > 0) {
        const firstTask = overdueTasks?.[0];
        newSuggestions.push({
          id: 'overdue-tasks',
          type: 'warning',
          priority: 'high',
          title: `${overdueCount} tâche${overdueCount > 1 ? 's' : ''} en retard`,
          description: firstTask?.titre 
            ? `Dont: "${firstTask.titre}"`
            : 'Certaines tâches nécessitent votre attention.',
          actionLabel: 'Voir les tâches',
          dismissable: true,
        });
      }

      // 3. Tâches dues aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { count: dueTodayCount } = await supabase
        .from('taches')
        .select('id', { count: 'exact', head: true })
        .eq('statut', 'A faire')
        .gte('echeance', today.toISOString())
        .lt('echeance', tomorrow.toISOString());

      if (dueTodayCount && dueTodayCount > 0 && currentHour >= 8 && currentHour < 18) {
        newSuggestions.push({
          id: 'due-today',
          type: 'reminder',
          priority: 'medium',
          title: `${dueTodayCount} tâche${dueTodayCount > 1 ? 's' : ''} à faire aujourd'hui`,
          description: 'Gardez le cap sur vos objectifs du jour !',
          dismissable: true,
        });
      }

      // 4. Suggestions de fin de journée
      if (currentHour >= 17 && currentHour < 19) {
        newSuggestions.push({
          id: 'end-of-day-summary',
          type: 'tip',
          priority: 'low',
          title: 'Bilan de la journée ?',
          description: 'Je peux vous préparer un résumé de votre journée de travail.',
          actionLabel: 'Générer un bilan',
          dismissable: true,
        });
      }

      // 5. Suggestion de début de journée
      if (currentHour >= 8 && currentHour < 10) {
        const { count: totalPendingCount } = await supabase
          .from('taches')
          .select('id', { count: 'exact', head: true })
          .eq('statut', 'A faire')
          .eq('responsable_id', user.id);

        if (totalPendingCount) {
          newSuggestions.push({
            id: 'morning-briefing',
            type: 'tip',
            priority: 'medium',
            title: 'Briefing du matin',
            description: `Vous avez ${totalPendingCount} tâches en cours. Souhaitez-vous commencer par les priorités ?`,
            actionLabel: 'Voir mes priorités',
            dismissable: true,
          });
        }
      }

      // 6. Tickets support ouverts
      if (currentPath.includes('/support') || currentPath === '/') {
        const { count: openTickets } = await supabase
          .from('support_tickets')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'in_progress']);

        if (openTickets && openTickets > 5) {
          newSuggestions.push({
            id: 'support-backlog',
            type: 'insight',
            priority: 'medium',
            title: `${openTickets} tickets support ouverts`,
            description: 'Le backlog support est élevé. Besoin d\'aide pour prioriser ?',
            actionLabel: 'Analyser le backlog',
            dismissable: true,
          });
        }
      }

      // 7. Conseil contextuel basé sur la page
      if (currentPath.includes('/etablissements/') && !currentPath.includes('/etablissements/')) {
        newSuggestions.push({
          id: 'crm-context-tip',
          type: 'tip',
          priority: 'low',
          title: 'Astuce CRM',
          description: 'Je peux analyser la santé de cet établissement et suggérer des actions.',
          actionLabel: 'Analyser',
          dismissable: true,
        });
      }

      // Filtrer les suggestions déjà dismissées
      const filteredSuggestions = newSuggestions.filter(
        s => !dismissedSuggestionsRef.current.has(s.id)
      );

      setSuggestions(filteredSuggestions);
      
    } catch (error) {
      debug.error('[JarvisProactive] Error generating suggestions:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [user?.id, location.pathname, isAnalyzing]);

  // Dismisser une suggestion
  const dismissSuggestion = useCallback((suggestionId: string) => {
    dismissedSuggestionsRef.current.add(suggestionId);
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    
    // Stocker en localStorage pour persistence
    try {
      const dismissed = JSON.parse(localStorage.getItem('jarvis_dismissed_suggestions') || '[]') as DismissedEntry[];
      dismissed.push({ id: suggestionId, dismissedAt: new Date().toISOString() });
      // Garder seulement les 7 derniers jours
      const recentDismissed = dismissed.filter((d) =>
        new Date(d.dismissedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
      );
      localStorage.setItem('jarvis_dismissed_suggestions', JSON.stringify(recentDismissed));
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  // Charger les suggestions dismissées au démarrage
  useEffect(() => {
    try {
      const dismissed = JSON.parse(localStorage.getItem('jarvis_dismissed_suggestions') || '[]') as DismissedEntry[];
      const recentDismissed = dismissed.filter((d) =>
        new Date(d.dismissedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
      );
      recentDismissed.forEach((d) => dismissedSuggestionsRef.current.add(d.id));

    } catch (e) {
      // Ignore
    }
  }, []);

  // Analyser les patterns au montage (seulement si enabled)
  useEffect(() => {
    if (user?.id && enabled) {
      analyzeWorkPatterns();
    }
  }, [user?.id, enabled, analyzeWorkPatterns]);

  // Générer des suggestions quand la route change (seulement si enabled)
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      generateContextualSuggestions();
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [location.pathname, enabled, generateContextualSuggestions]);

  // Rafraîchir périodiquement (toutes les 5 minutes, seulement si enabled)
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      generateContextualSuggestions();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [enabled, generateContextualSuggestions]);

  // Obtenir la suggestion la plus importante
  const topSuggestion = suggestions
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })[0] || null;

  return {
    suggestions,
    topSuggestion,
    workPattern,
    isAnalyzing,
    dismissSuggestion,
    refreshSuggestions: generateContextualSuggestions,
    hasSuggestions: suggestions.length > 0,
    highPrioritySuggestions: suggestions.filter(s => s.priority === 'high'),
  };
}
