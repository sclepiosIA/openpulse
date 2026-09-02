/**
 * useJarvisSmartTriggers - Détection temps réel d'événements critiques
 * 
 * Écoute les changements Realtime pour déclencher des alertes intelligentes
 * IMMÉDIATEMENT quand un événement important se produit
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/shared/useAuth';
import { useToast } from '@/hooks/shared/use-toast';
import { subscribeSmartTriggers } from '@/lib/jarvisSmartTriggersChannel';

export interface SmartTrigger {
  id: string;
  type: 'urgent' | 'opportunity' | 'risk' | 'reminder' | 'insight';
  source: string;
  title: string;
  message: string;
  priority: 1 | 2 | 3 | 4 | 5;
  actionLabel?: string;
  actionCommand?: string;
  entityType?: string;
  entityId?: string;
  timestamp: Date;
  expiresAt?: Date;
  autoDismissSeconds?: number;
}

interface TriggerRule {
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  condition: (payload: any, userId: string) => SmartTrigger | null;
}

export function useJarvisSmartTriggers(options?: { enabled?: boolean; isStreaming?: boolean }) {
  const enabled = options?.enabled ?? true;
  const isStreaming = options?.isStreaming ?? false;
  const { user } = useAuth();
  const { toast } = useToast();
  const [triggers, setTriggers] = useState<SmartTrigger[]>([]);
  const [isListening, setIsListening] = useState(false);
  const processedIdsRef = useRef<Set<string>>(new Set());
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;

  // Stabilize toast ref
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Règles de déclenchement intelligentes
  const triggerRules: TriggerRule[] = [
    // 1. Email urgent reçu
    {
      table: 'email_messages',
      event: 'INSERT',
      condition: (payload, userId) => {
        const msg = payload.new;
        const subject = (msg.subject || '').toLowerCase();
        const isUrgent = subject.includes('urgent') || 
                         subject.includes('asap') || 
                         subject.includes('important') ||
                         subject.includes('immédiat');
        
        if (isUrgent) {
          return {
            id: `email_urgent_${msg.id}`,
            type: 'urgent',
            source: 'email',
            title: '📧 Email urgent reçu',
            message: msg.subject?.substring(0, 60) || 'Nouveau message urgent',
            priority: 1,
            actionLabel: 'Voir l\'email',
            actionCommand: 'Montre-moi cet email urgent',
            entityType: 'email_message',
            entityId: msg.id,
            timestamp: new Date(),
            autoDismissSeconds: 300
          };
        }
        return null;
      }
    },
    // 2. Facture impayée critique
    {
      table: 'factures',
      event: 'UPDATE',
      condition: (payload) => {
        const oldStatus = payload.old?.statut;
        const newStatus = payload.new?.statut;
        const montant = payload.new?.montant_ttc || 0;
        
        if (oldStatus !== 'En retard' && newStatus === 'En retard' && montant > 1000) {
          return {
            id: `facture_retard_${payload.new.id}`,
            type: 'risk',
            source: 'tresorerie',
            title: '💰 Facture en retard',
            message: `${payload.new.numero}: ${montant.toLocaleString('fr-FR')}€ passée en retard`,
            priority: 2,
            actionLabel: 'Envoyer relance',
            actionCommand: `Prépare un email de relance pour la facture ${payload.new.numero}`,
            entityType: 'facture',
            entityId: payload.new.id,
            timestamp: new Date()
          };
        }
        return null;
      }
    },
    // 3. Tâche assignée
    {
      table: 'taches',
      event: 'INSERT',
      condition: (payload, userId) => {
        if (payload.new?.responsable_id === userId) {
          return {
            id: `tache_new_${payload.new.id}`,
            type: 'reminder',
            source: 'taches',
            title: '📋 Nouvelle tâche assignée',
            message: payload.new.titre?.substring(0, 50) || 'Nouvelle tâche',
            priority: 3,
            actionLabel: 'Voir la tâche',
            entityType: 'tache',
            entityId: payload.new.id,
            timestamp: new Date(),
            autoDismissSeconds: 60
          };
        }
        return null;
      }
    },
    // 4. Tâche passée en retard
    {
      table: 'taches',
      event: 'UPDATE',
      condition: (payload, userId) => {
        const wasNotOverdue = payload.old?.echeance && new Date(payload.old.echeance) >= new Date();
        const isNowOverdue = payload.new?.echeance && new Date(payload.new.echeance) < new Date();
        const isAssignedToUser = payload.new?.responsable_id === userId;
        
        if (wasNotOverdue && isNowOverdue && isAssignedToUser) {
          return {
            id: `tache_overdue_${payload.new.id}`,
            type: 'risk',
            source: 'taches',
            title: '⏰ Tâche en retard',
            message: payload.new.titre?.substring(0, 50) || 'Tâche expirée',
            priority: 2,
            actionLabel: 'Traiter maintenant',
            entityType: 'tache',
            entityId: payload.new.id,
            timestamp: new Date()
          };
        }
        return null;
      }
    },
    // 5. Nouveau ticket support critique
    {
      table: 'support_tickets',
      event: 'INSERT',
      condition: (payload, userId) => {
        const priority = payload.new?.priority;
        if (priority === 'urgent' || priority === 'critical') {
          return {
            id: `ticket_urgent_${payload.new.id}`,
            type: 'urgent',
            source: 'support',
            title: '🎫 Ticket urgent',
            message: payload.new.subject?.substring(0, 50) || 'Nouveau ticket prioritaire',
            priority: 1,
            actionLabel: 'Voir le ticket',
            entityType: 'support_ticket',
            entityId: payload.new.id,
            timestamp: new Date()
          };
        }
        return null;
      }
    },
    // 6. Prospect converti
    {
      table: 'etablissements',
      event: 'UPDATE',
      condition: (payload, userId) => {
        const oldStatus = payload.old?.statut;
        const newStatus = payload.new?.statut;
        const isMyProspect = payload.new?.commercial_id === userId || 
                            payload.new?.chef_projet_id === userId;
        
        if (oldStatus === 'Prospect' && newStatus === 'Contractuel' && isMyProspect) {
          return {
            id: `prospect_converted_${payload.new.id}`,
            type: 'opportunity',
            source: 'crm',
            title: '🎉 Prospect converti !',
            message: `${payload.new.nom} est passé en Contractuel`,
            priority: 4,
            actionLabel: 'Voir les détails',
            entityType: 'etablissement',
            entityId: payload.new.id,
            timestamp: new Date(),
            autoDismissSeconds: 120
          };
        }
        return null;
      }
    },
    // 7. Grosse opération bancaire
    {
      table: 'tresorerie_operations_bancaires',
      event: 'INSERT',
      condition: (payload) => {
        const montant = Math.abs(payload.new?.montant || 0);
        const isDebit = payload.new?.type === 'debit';
        
        if (isDebit && montant > 5000) {
          return {
            id: `depense_importante_${payload.new.id}`,
            type: 'insight',
            source: 'tresorerie',
            title: '💸 Dépense importante',
            message: `${montant.toLocaleString('fr-FR')}€ - ${payload.new.libelle?.substring(0, 30) || 'Transaction'}`,
            priority: 3,
            actionLabel: 'Voir la trésorerie',
            actionCommand: 'Analyse ma situation de trésorerie',
            entityType: 'transaction',
            entityId: payload.new.id,
            timestamp: new Date(),
            autoDismissSeconds: 180
          };
        }
        return null;
      }
    },
    // 8. Réunion imminente
    {
      table: 'calendar_events',
      event: 'UPDATE',
      condition: (payload, userId) => {
        const startTime = new Date(payload.new?.start_time);
        const now = new Date();
        const diffMinutes = (startTime.getTime() - now.getTime()) / (1000 * 60);
        
        if (diffMinutes > 0 && diffMinutes <= 15 && payload.new?.created_by === userId) {
          return {
            id: `meeting_soon_${payload.new.id}`,
            type: 'reminder',
            source: 'calendar',
            title: '📅 Réunion imminente',
            message: `${payload.new.title} dans ${Math.round(diffMinutes)} min`,
            priority: 2,
            actionLabel: 'Préparer un briefing',
            actionCommand: `Prépare-moi un briefing pour ma réunion "${payload.new.title}"`,
            entityType: 'calendar_event',
            entityId: payload.new.id,
            timestamp: new Date(),
            expiresAt: startTime,
            autoDismissSeconds: 900
          };
        }
        return null;
      }
    }
  ];

  // Stable processPayload via ref
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  const processPayloadRef = useRef((
    tableName: string, 
    eventType: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: any
  ) => {
    const userId = userIdRef.current;
    if (!userId) return;

    const matchingRules = triggerRules.filter(
      r => r.table === tableName && r.event === eventType
    );

    for (const rule of matchingRules) {
      const trigger = rule.condition(payload, userId);
      if (trigger && !processedIdsRef.current.has(trigger.id)) {
        processedIdsRef.current.add(trigger.id);
        
        setTriggers(prev => {
          if (prev.some(t => t.id === trigger.id)) return prev;
          return [trigger, ...prev].slice(0, 10);
        });

        if (trigger.priority <= 2) {
          toastRef.current({
            title: trigger.title,
            description: trigger.message,
            variant: trigger.type === 'urgent' ? 'destructive' : 'default',
            duration: 8000
          });
        }

        if (trigger.autoDismissSeconds) {
          setTimeout(() => {
            dismissTrigger(trigger.id);
          }, trigger.autoDismissSeconds * 1000);
        }
      }
    }
  });

  const dismissTrigger = useCallback((triggerId: string) => {
    setTriggers(prev => prev.filter(t => t.id !== triggerId));
  }, []);

  // Nettoyer les triggers expirés
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTriggers(prev => prev.filter(t => !t.expiresAt || t.expiresAt > now));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Souscription Realtime via singleton refcount partagé entre toutes les instances du hook.
  // isStreaming est lu via ref pour ne pas re-souscrire au moindre toggle.
  useEffect(() => {
    if (!user?.id || !enabled) return;
    const tables = [...new Set(triggerRules.map(r => r.table))];

    const unsubscribe = subscribeSmartTriggers(
      user.id,
      tables,
      {
        onPayload: (tableName, eventType, payload) => {
          processPayloadRef.current(tableName, eventType, payload);
        },
        onStatus: (status) => {
          setIsListening(status === 'SUBSCRIBED');
        },
      },
      isStreamingRef,
    );

    return () => {
      unsubscribe();
      setIsListening(false);
    };
  }, [user?.id, enabled]);

  const urgentTriggers = triggers.filter(t => t.type === 'urgent');
  const riskTriggers = triggers.filter(t => t.type === 'risk');
  const opportunityTriggers = triggers.filter(t => t.type === 'opportunity');
  const reminderTriggers = triggers.filter(t => t.type === 'reminder');
  const insightTriggers = triggers.filter(t => t.type === 'insight');

  return {
    triggers,
    isListening,
    urgentTriggers,
    riskTriggers,
    opportunityTriggers,
    reminderTriggers,
    insightTriggers,
    hasUrgent: urgentTriggers.length > 0,
    totalCount: triggers.length,
    highPriorityCount: triggers.filter(t => t.priority <= 2).length,
    dismissTrigger,
    dismissAll: () => setTriggers([]),
  };
}
