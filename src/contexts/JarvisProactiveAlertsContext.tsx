/**
 * JarvisProactiveAlertsContext - Singleton pour alertes proactives JARVIS
 * 
 * Fusionne useJarvisProactiveAlerts + useJarvisRealtimeAlerts en un seul canal.
 * Un seul canal Realtime partagé par tous les composants consommateurs.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { debug } from '@/lib/debug';
import { useAuth } from '@/hooks/shared/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useDeferredReady } from '@/components/shared/DeferredProvider';

export interface ProactiveAlert {
  id: string;
  user_id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  action_type: string;
  action_data: Record<string, unknown>;
  read: boolean;
  dismissed: boolean;
  created_at: string;
  updated_at: string;
}

interface JarvisProactiveAlertsContextValue {
  alerts: ProactiveAlert[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (alertId: string) => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => Promise<void>;
}

const JarvisProactiveAlertsContext = createContext<JarvisProactiveAlertsContextValue | null>(null);

// Toast/push helpers
function getAlertIcon(priority: string): string {
  switch (priority) {
    case 'critical': return '🚨';
    case 'high': return '⚠️';
    case 'medium': return '📢';
    default: return 'ℹ️';
  }
}

function getToastVariant(priority: string): 'default' | 'destructive' {
  return priority === 'critical' ? 'destructive' : 'default';
}

function getToastDuration(priority: string): number {
  switch (priority) {
    case 'critical': return 15000;
    case 'high': return 10000;
    case 'medium': return 8000;
    default: return 5000;
  }
}

function showPushNotification(alert: ProactiveAlert) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(alert.title, {
      body: alert.message,
      icon: '/favicon.ico',
      tag: `jarvis-alert-${alert.id}`,
      requireInteraction: alert.priority === 'critical',
    });
  } catch (error) {
    debug.warn('[JarvisProactiveAlerts] Push notification failed:', error);
  }
}

export function JarvisProactiveAlertsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    if (!user?.id) {
      setAlerts([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('jarvis_proactive_alerts')
        .select('id, user_id, type, priority, title, message, action_type, action_data, read, dismissed, created_at, updated_at')
        .eq('user_id', user.id)
        .eq('dismissed', false)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        // Erreurs attendues (RLS, session absente, offline) — état vide silencieux
        debug.warn('[JarvisProactiveAlerts] Fetch skipped:', error?.code || error?.message);
        setAlerts([]);
        return;
      }

      setAlerts((data || []) as ProactiveAlert[]);
    } catch (error) {
      // Réseau/abort : garder état existant, log dev uniquement
      debug.warn('[JarvisProactiveAlerts] Transient error:', (error as Error)?.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Initial fetch
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Gate on deferred readiness
  const deferredReady = useDeferredReady();

  // Single realtime subscription (replaces both useJarvisProactiveAlerts + useJarvisRealtimeAlerts)
  useEffect(() => {
    if (!deferredReady || !user?.id) return;

    const channel = supabase
      .channel(`jarvis-proactive-alerts-singleton-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jarvis_proactive_alerts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<ProactiveAlert>) => {
          if (payload.eventType === 'INSERT') {
            const newAlert = payload.new as ProactiveAlert;
            setAlerts(prev => {
              if (prev.some(a => a.id === newAlert.id)) return prev;
              return [newAlert, ...prev];
            });

            // Toast (from useJarvisRealtimeAlerts)
            toastRef.current({
              title: `${getAlertIcon(newAlert.priority)} ${newAlert.title}`,
              description: newAlert.message,
              variant: getToastVariant(newAlert.priority),
              duration: getToastDuration(newAlert.priority),
            });

            // Push notification for high/critical
            if (newAlert.priority === 'critical' || newAlert.priority === 'high') {
              showPushNotification(newAlert);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedAlert = payload.new as ProactiveAlert;
            if (updatedAlert.dismissed) {
              setAlerts(prev => prev.filter(a => a.id !== updatedAlert.id));
            } else {
              setAlerts(prev =>
                prev.map(a => a.id === updatedAlert.id ? updatedAlert : a)
              );
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedAlert = payload.old as ProactiveAlert;
            setAlerts(prev => prev.filter(a => a.id !== deletedAlert.id));
          }
        }
      )
      .subscribe((status) => {
        debug.log(`[JarvisProactiveAlerts] Subscription: ${status}`);
        if (status === 'CHANNEL_ERROR') {
          debug.error('[JarvisProactiveAlerts] CHANNEL_ERROR - check supabase_realtime publication');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Request notification permission on mount
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Mark as read
  const markAsRead = useCallback(async (alertId: string) => {
    const { error } = await supabase
      .from('jarvis_proactive_alerts')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('id', alertId);

    if (!error) {
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
    }
  }, []);

  // Dismiss alert
  const dismissAlert = useCallback(async (alertId: string) => {
    const { error } = await supabase
      .from('jarvis_proactive_alerts')
      .update({ dismissed: true, updated_at: new Date().toISOString() })
      .eq('id', alertId);

    if (!error) {
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;

    const { error } = await supabase
      .from('jarvis_proactive_alerts')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('read', false);

    if (!error) {
      setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    }
  }, [user?.id]);

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <JarvisProactiveAlertsContext.Provider
      value={{
        alerts,
        unreadCount,
        isLoading,
        markAsRead,
        dismissAlert,
        markAllAsRead,
        refetch: fetchAlerts,
      }}
    >
      {children}
    </JarvisProactiveAlertsContext.Provider>
  );
}

// Default fallback value when provider is not yet mounted (deferred providers)
const FALLBACK_VALUE: JarvisProactiveAlertsContextValue = {
  alerts: [],
  unreadCount: 0,
  isLoading: false,
  markAsRead: async () => {},
  dismissAlert: async () => {},
  markAllAsRead: async () => {},
  refetch: async () => {},
};

export function useJarvisProactiveAlertsContext(): JarvisProactiveAlertsContextValue {
  const context = useContext(JarvisProactiveAlertsContext);
  // Return safe fallback when provider is not yet mounted (deferred initialization)
  if (!context) {
    return FALLBACK_VALUE;
  }
  return context;
}
