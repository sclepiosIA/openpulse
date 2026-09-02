import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { useVisibilityAwareInterval } from '@/hooks/ui/useVisibilityAwareInterval';
import type { PresenceStatus } from '@/types/pulse';

interface GlobalPresence {
  user_id: string;
  status: PresenceStatus;
  last_seen_at: string;
  custom_status?: string | null;
  custom_status_emoji?: string | null;
  calendar_event_id?: string | null;
}

/**
 * Hook pour récupérer le statut en ligne de tous les utilisateurs actifs sur Pulse,
 * indépendamment de la conversation sélectionnée.
 * Permet d'afficher le point vert/rouge/jaune sur tous les DMs dans la liste.
 */
export function useGlobalUserPresence() {
  const { data: currentProfile } = useCurrentProfile();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [userStatuses, setUserStatuses] = useState<Map<string, GlobalPresence>>(new Map());

  // Load active users function (memoized)
  const loadActiveUsers = useCallback(async () => {
    if (!currentProfile?.id) return;
    
    const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
    
    const { data, error } = await supabase
      .from('pulse_presence')
      .select('user_id, status, last_seen_at, custom_status, custom_status_emoji, calendar_event_id')
      .neq('status', 'offline')
      .gte('last_seen_at', twoMinutesAgo)
      .neq('user_id', currentProfile.id);

    if (!error && data) {
      // Créer un Set des user_ids uniques en ligne
      const activeIds = new Set<string>();
      const statusMap = new Map<string, GlobalPresence>();
      
      data.forEach(p => {
        activeIds.add(p.user_id);
        statusMap.set(p.user_id, p as GlobalPresence);
      });
      
      setOnlineUserIds(activeIds);
      setUserStatuses(statusMap);
    }
  }, [currentProfile?.id]);

  // Use visibility-aware interval - pauses when tab is hidden
  useVisibilityAwareInterval(loadActiveUsers, 30000, {
    runImmediately: true,
    enabled: !!currentProfile?.id,
  });

  // Debounce ref for batching rapid presence updates
  const pendingUpdatesRef = useRef<Map<string, GlobalPresence | null>>(new Map());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Apply batched updates
  const applyPendingUpdates = useCallback(() => {
    const updates = pendingUpdatesRef.current;
    if (updates.size === 0) return;

    setOnlineUserIds(prev => {
      const next = new Set(prev);
      updates.forEach((presence, userId) => {
        if (presence === null || presence.status === 'offline') {
          next.delete(userId);
        } else {
          next.add(userId);
        }
      });
      return next;
    });

    setUserStatuses(prev => {
      const next = new Map(prev);
      updates.forEach((presence, userId) => {
        if (presence === null || presence.status === 'offline') {
          next.delete(userId);
        } else {
          next.set(userId, presence);
        }
      });
      return next;
    });

    pendingUpdatesRef.current.clear();
  }, []);

  useEffect(() => {
    if (!currentProfile?.id) return;
    // Generate a fresh unique id on every effect run to avoid collisions
    // with a channel still being torn down (StrictMode, rapid remounts).
    const uniqueId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(`global-presence-tracking-${currentProfile.id}-${uniqueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pulse_presence',
        },
        (payload) => {
          const presence = payload.new as GlobalPresence | null;
          const oldPresence = payload.old as GlobalPresence | null;
          
          // Collect update in pending batch
          if (payload.eventType === 'DELETE' && oldPresence) {
            pendingUpdatesRef.current.set(oldPresence.user_id, null);
          } else if (presence && presence.user_id !== currentProfile.id) {
            pendingUpdatesRef.current.set(presence.user_id, presence);
          }

          // Debounce: apply all pending updates after 500ms of quiet
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(applyPendingUpdates, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [currentProfile?.id, applyPendingUpdates]);

  // Fonction helper pour vérifier si un utilisateur est en ligne
  const isUserOnline = (userId: string) => onlineUserIds.has(userId);
  
  // Fonction helper pour obtenir le statut complet d'un utilisateur
  const getUserStatus = (userId: string): GlobalPresence | undefined => userStatuses.get(userId);

  return { onlineUserIds, isUserOnline, userStatuses, getUserStatus };
}
