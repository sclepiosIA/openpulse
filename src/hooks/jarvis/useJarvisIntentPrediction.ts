/**
 * useJarvisIntentPrediction - Prédiction d'intention utilisateur
 * 
 * Analyse le comportement utilisateur pour anticiper ses besoins
 * et proposer des actions proactives AVANT qu'il ne les demande
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/hooks/shared/useAuth';
import { debug } from '@/lib/debug';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export interface PredictedIntent {
  id: string;
  intent: string;
  confidence: number; // 0-1
  reasoning: string;
  suggestedPrompt: string;
  suggestedAction?: {
    type: 'navigate' | 'open_jarvis' | 'quick_action';
    data: Record<string, any>;
  };
  context: {
    timeOfDay: 'morning' | 'afternoon' | 'evening';
    dayOfWeek: string;
    currentPage: string;
    recentActivity: string[];
  };
}

interface UserBehaviorPattern {
  hourlyActivity: Record<number, number>;
  pageTransitions: Record<string, string[]>; // page -> next pages
  commonSequences: string[][];
  averageSessionDuration: number;
  preferredQuickActions: string[];
}

export function useJarvisIntentPrediction(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [predictions, setPredictions] = useState<PredictedIntent[]>([]);
  const [behaviorPattern, setBehaviorPattern] = useState<UserBehaviorPattern | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const pageHistoryRef = useRef<Array<{ path: string; timestamp: Date }>>([]);
  
  // Persistance des dismiss dans sessionStorage avec TTL de 4h
  const getDismissedIds = useCallback((): Set<string> => {
    try {
      const raw = sessionStorage.getItem('jarvis_dismissed_predictions');
      if (!raw) return new Set();
      const parsed = JSON.parse(raw) as { ids: string[]; timestamp: number };
      // TTL 4h
      if (Date.now() - parsed.timestamp > 4 * 60 * 60 * 1000) {
        sessionStorage.removeItem('jarvis_dismissed_predictions');
        return new Set();
      }
      return new Set(parsed.ids);
    } catch {
      return new Set();
    }
  }, []);
  
  const addDismissedId = useCallback((id: string) => {
    const current = getDismissedIds();
    current.add(id);
    sessionStorage.setItem('jarvis_dismissed_predictions', JSON.stringify({
      ids: Array.from(current),
      timestamp: Date.now()
    }));
  }, [getDismissedIds]);
  const lastPredictionRef = useRef<Date | null>(null);

  // Tracker la navigation
  useEffect(() => {
    pageHistoryRef.current.push({
      path: location.pathname,
      timestamp: new Date()
    });
    
    // Garder les 20 dernières pages
    if (pageHistoryRef.current.length > 20) {
      pageHistoryRef.current.shift();
    }
  }, [location.pathname]);

  // Analyser les patterns comportementaux
  const analyzePatterns = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Récupérer l'historique des conversations Jarvis
      const { data: conversations } = await supabase
        .from('jarvis_conversations')
        .select('created_at, messages')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      // Récupérer les actions récentes
      const { data: actions } = await supabase
        .from('jarvis_pending_actions')
        .select('trigger_type, proposed_action, created_at, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      // Calculer les patterns
      const hourlyActivity: Record<number, number> = {};
      const quickActions: Record<string, number> = {};

      for (const conv of conversations || []) {
        if (!conv.created_at) continue;
        const hour = new Date(conv.created_at).getHours();
        hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
        
        // Analyser les messages pour trouver les quick actions
        const messages = (conv.messages as Array<{ role?: string; content?: string }>) || [];
        for (const msg of messages) {
          if (msg.role === 'user') {
            const content = (msg.content || '').toLowerCase();
            if (content.includes('email')) quickActions['emails'] = (quickActions['emails'] || 0) + 1;
            if (content.includes('tâche') || content.includes('task')) quickActions['tasks'] = (quickActions['tasks'] || 0) + 1;
            if (content.includes('réunion') || content.includes('meeting')) quickActions['calendar'] = (quickActions['calendar'] || 0) + 1;
            if (content.includes('prospect') || content.includes('client')) quickActions['crm'] = (quickActions['crm'] || 0) + 1;
            if (content.includes('trésorerie') || content.includes('facture')) quickActions['treasury'] = (quickActions['treasury'] || 0) + 1;
          }
        }
      }

      const preferredQuickActions = Object.entries(quickActions)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([action]) => action);

      setBehaviorPattern({
        hourlyActivity,
        pageTransitions: {}, // Simplified for now
        commonSequences: [],
        averageSessionDuration: 30, // minutes
        preferredQuickActions
      });
    } catch (error) {
      debug.error('[IntentPrediction] Pattern analysis error:', error);
    }
  }, [user?.id]);

  // Générer des prédictions d'intention
  const generatePredictions = useCallback(async () => {
    if (!user?.id || isAnalyzing || !enabled) return;
    
    // Limiter à 1 prédiction par minute
    if (lastPredictionRef.current && 
        Date.now() - lastPredictionRef.current.getTime() < 60000) {
      return;
    }

    setIsAnalyzing(true);
    lastPredictionRef.current = new Date();

    const newPredictions: PredictedIntent[] = [];
    const currentHour = new Date().getHours();
    const currentPath = location.pathname;
    const dayOfWeek = new Date().toLocaleDateString('fr-FR', { weekday: 'long' });
    const timeOfDay = currentHour < 12 ? 'morning' : currentHour < 18 ? 'afternoon' : 'evening';

    const recentPages = pageHistoryRef.current.slice(-5).map(p => p.path);

    try {
      // ====== PRÉDICTIONS CONTEXTUELLES ======

      // 1. Début de journée → Briefing
      if (currentHour >= 8 && currentHour <= 10 && currentPath === '/') {
        newPredictions.push({
          id: 'morning_briefing',
          intent: 'daily_briefing',
          confidence: 0.85,
          reasoning: 'Début de journée, l\'utilisateur consulte probablement son tableau de bord',
          suggestedPrompt: 'Quel est mon briefing du jour ?',
          suggestedAction: {
            type: 'open_jarvis',
            data: { prompt: 'Donne-moi mon briefing du jour avec les priorités' }
          },
          context: { timeOfDay, dayOfWeek, currentPage: currentPath, recentActivity: recentPages }
        });
      }

      // 2. Sur la page emails → Résumé
      if (currentPath.includes('/emails')) {
        const { count } = await supabase
          .from('email_threads')
          .select('id', { count: 'exact', head: true })
          .gt('unread_count', 0);

        if (count && count > 5) {
          newPredictions.push({
            id: 'email_summary',
            intent: 'summarize_emails',
            confidence: 0.78,
            reasoning: `${count} emails non lus, l'utilisateur pourrait vouloir un résumé`,
            suggestedPrompt: 'Résume mes emails importants',
            suggestedAction: {
              type: 'open_jarvis',
              data: { prompt: `J'ai ${count} emails non lus, résume les plus importants` }
            },
            context: { timeOfDay, dayOfWeek, currentPage: currentPath, recentActivity: recentPages }
          });
        }
      }

      // 3. Sur un établissement → Actions CRM
      const etablissementMatch = currentPath.match(/\/etablissements\/([^/]+)/);
      if (etablissementMatch) {
        const etablissementId = etablissementMatch[1];
        
        newPredictions.push({
          id: `crm_actions_${etablissementId}`,
          intent: 'crm_analysis',
          confidence: 0.72,
          reasoning: 'Consultation d\'un établissement, actions CRM probables',
          suggestedPrompt: 'Analyse la santé de ce client',
          suggestedAction: {
            type: 'open_jarvis',
            data: { prompt: `Analyse la santé et les opportunités pour cet établissement` }
          },
          context: { timeOfDay, dayOfWeek, currentPage: currentPath, recentActivity: recentPages }
        });
      }

      // 4. Fin de journée → Bilan
      if (currentHour >= 17 && currentHour <= 19) {
        newPredictions.push({
          id: 'end_of_day_summary',
          intent: 'daily_summary',
          confidence: 0.68,
          reasoning: 'Fin de journée, bilan probable',
          suggestedPrompt: 'Fais le bilan de ma journée',
          suggestedAction: {
            type: 'open_jarvis',
            data: { prompt: 'Fais le bilan de ma journée de travail' }
          },
          context: { timeOfDay, dayOfWeek, currentPage: currentPath, recentActivity: recentPages }
        });
      }

      // 5. Page trésorerie → Analyse financière
      if (currentPath.includes('/tresorerie')) {
        newPredictions.push({
          id: 'treasury_analysis',
          intent: 'financial_analysis',
          confidence: 0.75,
          reasoning: 'Consultation trésorerie, analyse financière probable',
          suggestedPrompt: 'Analyse ma situation financière',
          suggestedAction: {
            type: 'open_jarvis',
            data: { prompt: 'Analyse ma situation de trésorerie et identifie les risques' }
          },
          context: { timeOfDay, dayOfWeek, currentPage: currentPath, recentActivity: recentPages }
        });
      }

      // 6. Page R&D → Sprint status
      if (currentPath.includes('/rd')) {
        newPredictions.push({
          id: 'sprint_status',
          intent: 'sprint_analysis',
          confidence: 0.7,
          reasoning: 'Consultation R&D, suivi sprint probable',
          suggestedPrompt: 'Quel est l\'état du sprint actuel ?',
          suggestedAction: {
            type: 'open_jarvis',
            data: { prompt: 'Analyse l\'avancement du sprint actuel et identifie les blocages' }
          },
          context: { timeOfDay, dayOfWeek, currentPage: currentPath, recentActivity: recentPages }
        });
      }

      // 7. Lundi matin → Planification semaine
      if (dayOfWeek === 'lundi' && currentHour >= 8 && currentHour <= 11) {
        newPredictions.push({
          id: 'weekly_planning',
          intent: 'week_planning',
          confidence: 0.82,
          reasoning: 'Lundi matin, planification de la semaine probable',
          suggestedPrompt: 'Aide-moi à planifier ma semaine',
          suggestedAction: {
            type: 'open_jarvis',
            data: { prompt: 'Planifie ma semaine en fonction de mes priorités et réunions' }
          },
          context: { timeOfDay, dayOfWeek, currentPage: currentPath, recentActivity: recentPages }
        });
      }

      // 8. Vendredi après-midi → Bilan hebdo
      if (dayOfWeek === 'vendredi' && currentHour >= 15) {
        newPredictions.push({
          id: 'weekly_summary',
          intent: 'week_summary',
          confidence: 0.76,
          reasoning: 'Vendredi après-midi, bilan hebdomadaire probable',
          suggestedPrompt: 'Fais le bilan de ma semaine',
          suggestedAction: {
            type: 'open_jarvis',
            data: { prompt: 'Résume ma semaine et prépare les priorités pour lundi' }
          },
          context: { timeOfDay, dayOfWeek, currentPage: currentPath, recentActivity: recentPages }
        });
      }

      // Filtrer les predictions déjà dismissées
      const dismissed = getDismissedIds();
      const filtered = newPredictions.filter(p => !dismissed.has(p.id));
      
      // Trier par confiance
      filtered.sort((a, b) => b.confidence - a.confidence);
      
      // Garder les top 3
      setPredictions(filtered.slice(0, 3));

    } catch (error) {
      debug.error('[IntentPrediction] Error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [user?.id, location.pathname, isAnalyzing, enabled, getDismissedIds]);

  // Analyser les patterns au démarrage (une seule fois, pas à chaque mount)
  const hasAnalyzedRef = useRef(false);
  useEffect(() => {
    if (user?.id && enabled && !hasAnalyzedRef.current) {
      hasAnalyzedRef.current = true;
      analyzePatterns();
    }
  }, [user?.id, analyzePatterns, enabled]);

  // Régénérer les prédictions lors des changements de page (délai 5s pour laisser la page se stabiliser)
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      generatePredictions();
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [location.pathname, generatePredictions, enabled]);

  // Refresh périodique (toutes les 3 minutes)
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      generatePredictions();
    }, 3 * 60 * 1000);

    return () => clearInterval(interval);
  }, [generatePredictions, enabled]);

  // Top prediction
  const topPrediction = predictions[0] || null;

  // Memoized helpers
  const highConfidencePredictions = useMemo(
    () => predictions.filter(p => p.confidence >= 0.7),
    [predictions]
  );

  return {
    predictions,
    topPrediction,
    behaviorPattern,
    isAnalyzing,
    
    // Helpers
    hasPredictions: predictions.length > 0,
    highConfidencePredictions,
    
    // Actions
    refreshPredictions: generatePredictions,
    dismissPrediction: (id: string) => {
      addDismissedId(id);
      setPredictions(prev => prev.filter(p => p.id !== id));
    }
  };
}
