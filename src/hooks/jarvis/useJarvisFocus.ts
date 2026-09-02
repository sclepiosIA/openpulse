/**
 * useJarvisFocus - Mode Focus/Contexte intelligent de Jarvis
 * 
 * Comprend le contexte de travail actuel pour des suggestions plus pertinentes.
 * V11.0: Persistance localStorage + option Pin
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import { safeStorage } from '@/lib/safeStorage';
import { debug } from '@/lib/debug';

export type JarvisFocusMode = 
  | 'general'
  | 'emails'
  | 'tasks'
  | 'support'
  | 'crm'
  | 'calendar'
  | 'tresorerie'
  | 'rd'
  | 'formation';

interface FocusContext {
  mode: JarvisFocusMode;
  etablissement_id?: string;
  etablissement_name?: string;
  thread_id?: string;
  task_id?: string;
  ticket_id?: string;
  event_id?: string;
  additional_context?: Record<string, unknown>;
  isPinned?: boolean; // V11: Focus épinglé (persiste après navigation)
}

interface RecentActivity {
  type: 'view' | 'action';
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  timestamp: Date;
}

const STORAGE_KEY = 'jarvis_focus_context';
const ACTIVITIES_KEY = 'jarvis_recent_activities';

// Charger depuis localStorage
function loadPersistedFocus(): FocusContext | null {
  try {
    const stored = safeStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ne restaurer que si épinglé
      if (parsed.isPinned) {
        return parsed;
      }
    }
  } catch (e) {
    debug.warn('[JarvisFocus] Failed to load persisted focus:', e);
  }
  return null;
}

function loadPersistedActivities(): RecentActivity[] {
  try {
    const stored = safeStorage.getItem(ACTIVITIES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Restaurer les dates
      return parsed.map((a: { timestamp: string | number | Date } & Record<string, unknown>) => ({
        ...a,
        timestamp: new Date(a.timestamp),
      }));
    }
  } catch (e) {
    debug.warn('[JarvisFocus] Failed to load activities:', e);
  }
  return [];
}

export function useJarvisFocus() {
  const { user } = useAuth();
  const location = useLocation();
  const initialFocus = useRef(loadPersistedFocus());
  
  const [focusContext, setFocusContext] = useState<FocusContext>(
    initialFocus.current || { mode: 'general' }
  );
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>(
    loadPersistedActivities()
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Persister le focus quand il change
  useEffect(() => {
    if (focusContext.isPinned) {
      safeStorage.setItem(STORAGE_KEY, JSON.stringify(focusContext));
    } else {
      safeStorage.removeItem(STORAGE_KEY);
    }
  }, [focusContext]);

  // Persister les activités récentes
  useEffect(() => {
    if (recentActivities.length > 0) {
      safeStorage.setItem(ACTIVITIES_KEY, JSON.stringify(recentActivities.slice(0, 20)));
    }
  }, [recentActivities]);

  // Déterminer le mode focus basé sur la route
  const detectModeFromRoute = useCallback((pathname: string): JarvisFocusMode => {
    if (pathname.includes('/emails')) return 'emails';
    if (pathname.includes('/taches') || pathname.includes('/tasks')) return 'tasks';
    if (pathname.includes('/support')) return 'support';
    if (pathname.includes('/etablissement')) return 'crm';
    if (pathname.includes('/calendrier') || pathname.includes('/calendar')) return 'calendar';
    if (pathname.includes('/tresorerie')) return 'tresorerie';
    if (pathname.includes('/rd')) return 'rd';
    return 'general';
  }, []);

  // Extraire les IDs de la route
  const extractIdsFromRoute = useCallback((pathname: string): Partial<FocusContext> => {
    const ids: Partial<FocusContext> = {};
    
    // Pattern: /etablissements/:id
    const etablissementMatch = pathname.match(/\/etablissements?\/([a-f0-9-]+)/i);
    if (etablissementMatch) {
      ids.etablissement_id = etablissementMatch[1];
    }

    // Pattern: /emails/:threadId
    const emailMatch = pathname.match(/\/emails?\/([a-f0-9-]+)/i);
    if (emailMatch) {
      ids.thread_id = emailMatch[1];
    }

    // Pattern: /taches/:taskId
    const taskMatch = pathname.match(/\/taches?\/([a-f0-9-]+)/i);
    if (taskMatch) {
      ids.task_id = taskMatch[1];
    }

    return ids;
  }, []);

  // Mettre à jour le contexte quand la route change
  useEffect(() => {
    // Si le focus est épinglé, ne pas le remplacer automatiquement
    if (focusContext.isPinned) {
      return;
    }

    const mode = detectModeFromRoute(location.pathname);
    const ids = extractIdsFromRoute(location.pathname);
    
    setFocusContext(prev => ({
      ...prev,
      mode,
      ...ids,
    }));

    // Enregistrer l'activité
    if (ids.etablissement_id || ids.thread_id || ids.task_id) {
      const activity: RecentActivity = {
        type: 'view',
        entity_type: ids.etablissement_id ? 'etablissement' : ids.thread_id ? 'email' : 'task',
        entity_id: ids.etablissement_id || ids.thread_id || ids.task_id || '',
        timestamp: new Date(),
      };
      setRecentActivities(prev => [activity, ...prev.slice(0, 19)]);
    }
  }, [location.pathname, detectModeFromRoute, extractIdsFromRoute, focusContext.isPinned]);

  // Épingler/désépingler le focus actuel
  const togglePin = useCallback(() => {
    setFocusContext(prev => ({
      ...prev,
      isPinned: !prev.isPinned,
    }));
  }, []);

  // Définir manuellement le focus sur un établissement (avec option pin)
  const focusOnEtablissement = useCallback(async (etablissementId: string, pin = false) => {
    try {
      const { data } = await supabase
        .from('etablissements')
        .select('id, nom')
        .eq('id', etablissementId)
        .maybeSingle();

      if (data) {
        setFocusContext(prev => ({
          ...prev,
          mode: 'crm',
          etablissement_id: data.id,
          etablissement_name: data.nom,
          isPinned: pin,
        }));
      }
    } catch (error) {
      debug.error('[JarvisFocus] Error focusing on etablissement:', error);
    }
  }, []);

  // Définir manuellement le focus sur un thread email
  const focusOnThread = useCallback(async (threadId: string, pin = false) => {
    try {
      const { data } = await supabase
        .from('email_threads')
        .select('id, subject, ai_generated_title, etablissement_id')
        .eq('id', threadId)
        .maybeSingle();

      if (data) {
        setFocusContext(prev => ({
          ...prev,
          mode: 'emails',
          thread_id: data.id,
          etablissement_id: data.etablissement_id || prev.etablissement_id,
          isPinned: pin,
          additional_context: {
            email_subject: data.ai_generated_title || data.subject,
          },
        }));
      }
    } catch (error) {
      debug.error('[JarvisFocus] Error focusing on thread:', error);
    }
  }, []);

  // Analyser le contexte actuel pour enrichir les suggestions
  const analyzeCurrentContext = useCallback(async (): Promise<Record<string, unknown>> => {
    setIsAnalyzing(true);
    const context: Record<string, unknown> = {
      current_mode: focusContext.mode,
      current_route: location.pathname,
      is_pinned: focusContext.isPinned || false,
    };

    try {
      // Ajouter les activités récentes
      context.recent_activities = recentActivities.slice(0, 5).map(a => ({
        type: a.type,
        entity_type: a.entity_type,
        entity_id: a.entity_id,
        minutes_ago: Math.round((Date.now() - a.timestamp.getTime()) / 60000),
      }));

      // Si focus sur un établissement, enrichir avec ses données
      if (focusContext.etablissement_id) {
        const { data: etab } = await supabase
          .from('etablissements')
          .select('id, nom, statut, ville, dpi, module_actif')
          .eq('id', focusContext.etablissement_id)
          .maybeSingle();

        if (etab) {
          context.focused_etablissement = etab;

          // Récupérer les tâches ouvertes
          const { data: tasks } = await supabase
            .from('taches')
            .select('id, titre, priorite, echeance')
            .eq('etablissement_id', focusContext.etablissement_id)
            .eq('statut', 'A faire')
            .limit(5);

          if (tasks) {
            context.open_tasks = tasks;
          }

          // Récupérer les derniers emails
          const { data: threads } = await supabase
            .from('email_threads')
            .select('id, subject, ai_generated_title, last_message_date')
            .eq('etablissement_id', focusContext.etablissement_id)
            .order('last_message_date', { ascending: false })
            .limit(3);

          if (threads) {
            context.recent_emails = threads;
          }
        }
      }

      // Si mode emails, ajouter stats emails
      if (focusContext.mode === 'emails' && user?.id) {
        const { count: unreadCount } = await supabase
          .from('email_threads')
          .select('id', { count: 'exact', head: true })
          .gt('unread_count', 0);

        context.unread_emails_count = unreadCount || 0;
      }

      // Si mode support, ajouter stats tickets
      if (focusContext.mode === 'support') {
        const { count: openTickets } = await supabase
          .from('support_tickets')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'in_progress']);

        context.open_tickets_count = openTickets || 0;
      }

    } catch (error) {
      debug.error('[JarvisFocus] Error analyzing context:', error);
    } finally {
      setIsAnalyzing(false);
    }

    return context;
  }, [focusContext, recentActivities, location.pathname, user?.id]);

  // Obtenir le prompt de contexte pour Jarvis
  const getContextPrompt = useCallback((): string => {
    const parts: string[] = [];

    if (focusContext.isPinned) {
      parts.push(`[FOCUS ÉPINGLÉ]`);
    }

    parts.push(`L'utilisateur est actuellement en mode "${focusContext.mode}".`);

    if (focusContext.etablissement_name) {
      parts.push(`Il travaille sur l'établissement "${focusContext.etablissement_name}".`);
      if (focusContext.isPinned) {
        parts.push(`Toutes les requêtes sans contexte concernent cet établissement.`);
      }
    }

    if (focusContext.additional_context?.email_subject) {
      parts.push(`Il consulte un email : "${focusContext.additional_context.email_subject}".`);
    }

    if (recentActivities.length > 0) {
      const recentTypes = [...new Set(recentActivities.slice(0, 3).map(a => a.entity_type))];
      parts.push(`Récemment consulté : ${recentTypes.join(', ')}.`);
    }

    return parts.join(' ');
  }, [focusContext, recentActivities]);

  // Effacer le focus (et dé-épingler)
  const clearFocus = useCallback(() => {
    setFocusContext({ mode: 'general' });
    safeStorage.removeItem(STORAGE_KEY);
  }, []);

  // Enregistrer une action utilisateur
  const recordActivity = useCallback((
    entityType: string,
    entityId: string,
    entityName?: string,
    actionType: 'view' | 'action' = 'action'
  ) => {
    const activity: RecentActivity = {
      type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      timestamp: new Date(),
    };
    setRecentActivities(prev => [activity, ...prev.slice(0, 19)]);
  }, []);

  return {
    // État
    focusContext,
    recentActivities,
    isAnalyzing,
    
    // Actions de focus
    focusOnEtablissement,
    focusOnThread,
    clearFocus,
    togglePin,
    
    // Analyse
    analyzeCurrentContext,
    getContextPrompt,
    
    // Tracking
    recordActivity,
    
    // Helpers
    currentMode: focusContext.mode,
    hasFocus: focusContext.mode !== 'general' || !!focusContext.etablissement_id,
    isPinned: focusContext.isPinned || false,
  };
}
