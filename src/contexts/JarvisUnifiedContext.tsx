/**
 * JarvisUnifiedContext - Contexte centralisé pour tout l'écosystème Jarvis 12.4
 * 
 * Unifie:
 * - État de conversation (messages, streaming)
 * - Triggers temps réel (smart triggers)
 * - Prédictions d'intentions
 * - État UI (panel ouvert/fermé, onglet actif)
 * 
 * Garantit une cohérence parfaite entre tous les composants Jarvis
 */

import React, { createContext, useContext, useState, useCallback, useRef, useMemo, ReactNode } from 'react';
import { useAuth } from '@/hooks/shared/useAuth';
import { useToast } from '@/hooks/shared/use-toast';
import { debug } from '@/lib/debug';
import { supabase } from '@/integrations/supabase/client';
import { JarvisConversationProvider } from '@/contexts/JarvisConversationContext';
import type { ToolCall } from '@/types/jarvis';

// ============================================================
// Types unifiés pour la cohérence
// ============================================================

export type JarvisTab = 'chat' | 'team' | 'actions' | 'templates' | 'analytics' | 'settings';

export type JarvisAlertType = 'urgent' | 'opportunity' | 'risk' | 'reminder' | 'insight' | 'prediction';
export type JarvisAlertPriority = 1 | 2 | 3 | 4 | 5; // 1 = max urgence

export interface JarvisAlert {
  id: string;
  type: JarvisAlertType;
  source: string;
  title: string;
  message: string;
  priority: JarvisAlertPriority;
  actionLabel?: string;
  actionCommand?: string;
  entityType?: string;
  entityId?: string;
  timestamp: Date;
  expiresAt?: Date;
  autoDismissSeconds?: number;
  dismissed: boolean;
}

// Re-export streaming types from conversation context for backward compatibility
export type { JarvisStreamState, JarvisReasoningStep } from '@/contexts/JarvisConversationContext';

// ============================================================
// Constantes de design unifiées
// ============================================================

export const JARVIS_COLORS = {
  urgent: { border: 'border-destructive/50', bg: 'bg-destructive/5', icon: 'text-destructive' },
  risk: { border: 'border-orange-500/50', bg: 'bg-orange-500/5', icon: 'text-orange-500' },
  opportunity: { border: 'border-emerald-500/50', bg: 'bg-emerald-500/5', icon: 'text-emerald-500' },
  reminder: { border: 'border-blue-500/50', bg: 'bg-blue-500/5', icon: 'text-blue-500' },
  insight: { border: 'border-purple-500/50', bg: 'bg-purple-500/5', icon: 'text-purple-500' },
  prediction: { border: 'border-primary/50', bg: 'bg-primary/5', icon: 'text-primary' },
} as const;

export const JARVIS_ANIMATIONS = {
  fadeIn: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  slideUp: { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 20 } },
  scale: { initial: { scale: 0.9, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.9, opacity: 0 } },
  pulse: { animate: { scale: [1, 1.05, 1] }, transition: { duration: 2, repeat: Infinity } },
} as const;

// ============================================================
// Interface du contexte
// ============================================================

interface JarvisUnifiedContextValue {
  // UI State
  isPanelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  activeTab: JarvisTab;
  setActiveTab: (tab: JarvisTab) => void;
  
  // Minimized State (background mode)
  isMinimized: boolean;
  hasCompletedResponse: boolean;
  isProcessingInBackground: boolean;
  minimizePanel: () => void;
  restorePanel: () => void;
  markResponseReady: () => void;
  clearMinimizedState: () => void;
  
  // Alerts State (unified triggers + predictions)
  alerts: JarvisAlert[];
  addAlert: (alert: Omit<JarvisAlert, 'id' | 'timestamp' | 'dismissed'>) => void;
  dismissAlert: (id: string) => void;
  dismissAllAlerts: () => void;
  urgentAlerts: JarvisAlert[];
  hasUrgentAlerts: boolean;
  alertCount: number;
  
  // Tool Confirmation State
  pendingToolCall: ToolCall | null;
  setPendingToolCall: (tc: ToolCall | null) => void;
  isConfirming: boolean;
  setIsConfirming: (confirming: boolean) => void;
  
  // Quick Actions - now with registration system
  executeQuickAction: (command: string) => Promise<void>;
  registerChatHandler: (handler: (message: string) => Promise<unknown>) => void;
  pendingQuickCommand: string | null;
  clearPendingQuickCommand: () => void;
  
  // Proactive Scan
  triggerProactiveScan: () => Promise<void>;
  isScanning: boolean;
  
  // Feature Flags
  isEnabled: boolean;
  voiceEnabled: boolean;
}

const JarvisUnifiedContext = createContext<JarvisUnifiedContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface JarvisUnifiedProviderProps {
  children: ReactNode;
}

export function JarvisUnifiedProvider({ children }: JarvisUnifiedProviderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // UI State
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<JarvisTab>('chat');
  
  // Minimized State (background mode)
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasCompletedResponse, setHasCompletedResponse] = useState(false);
  const [isProcessingInBackground, setIsProcessingInBackground] = useState(false);
  
  // Alerts State
  const [alerts, setAlerts] = useState<JarvisAlert[]>([]);
  const alertIdCounter = useRef(0);
  
  // Tool Confirmation State
  const [pendingToolCall, setPendingToolCall] = useState<ToolCall | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  
  // Scanning State
  const [isScanning, setIsScanning] = useState(false);
  
  // Feature flags (simplified)
  const isEnabled = true;
  const voiceEnabled = true;
  
  // ============================================================
  // UI Actions
  // ============================================================
  
  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);
  const togglePanel = useCallback(() => setIsPanelOpen(p => !p), []);
  
  // Minimized mode actions
  const minimizePanel = useCallback(() => {
    setIsMinimized(true);
    setIsProcessingInBackground(true);
    setHasCompletedResponse(false);
    setIsPanelOpen(false);
  }, []);
  
  const restorePanel = useCallback(() => {
    setIsMinimized(false);
    setHasCompletedResponse(false);
    setIsProcessingInBackground(false);
    setIsPanelOpen(true);
  }, []);
  
  const markResponseReady = useCallback(() => {
    setIsProcessingInBackground(false);
    setHasCompletedResponse(true);
  }, []);
  
  const clearMinimizedState = useCallback(() => {
    setIsMinimized(false);
    setHasCompletedResponse(false);
    setIsProcessingInBackground(false);
  }, []);
  
  // ============================================================
  // Alerts Actions
  // ============================================================
  
  const addAlert = useCallback((alertData: Omit<JarvisAlert, 'id' | 'timestamp' | 'dismissed'>) => {
    const newAlert: JarvisAlert = {
      ...alertData,
      id: `alert_${++alertIdCounter.current}_${Date.now()}`,
      timestamp: new Date(),
      dismissed: false,
    };
    
    setAlerts(prev => {
      // Éviter les doublons (même entityId + type)
      if (alertData.entityId && prev.some(a => a.entityId === alertData.entityId && a.type === alertData.type)) {
        return prev;
      }
      // Garder max 15 alertes
      return [newAlert, ...prev].slice(0, 15);
    });
    
    // Toast pour alertes prioritaires
    if (newAlert.priority <= 2) {
      toast({
        title: newAlert.title,
        description: newAlert.message,
        variant: newAlert.type === 'urgent' ? 'destructive' : 'default',
        duration: 8000,
      });
    }
    
    // Auto-dismiss si configuré
    if (newAlert.autoDismissSeconds) {
      setTimeout(() => {
        dismissAlert(newAlert.id);
      }, newAlert.autoDismissSeconds * 1000);
    }
  }, [toast]);
  
  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);
  
  const dismissAllAlerts = useCallback(() => {
    setAlerts([]);
  }, []);
  
  // Computed alerts
  const urgentAlerts = useMemo(() => alerts.filter(a => a.type === 'urgent'), [alerts]);
  const hasUrgentAlerts = urgentAlerts.length > 0;
  const alertCount = alerts.length;
  
  // ============================================================
  // Quick Actions with Registration System
  // ============================================================
  
  // Store pending quick command and registered handler
  const [pendingQuickCommand, setPendingQuickCommand] = useState<string | null>(null);
  const chatHandlerRef = useRef<((message: string) => Promise<unknown>) | null>(null);
  
  // Allow panel to register its chat handler
  const registerChatHandler = useCallback((handler: (message: string) => Promise<unknown>) => {
    chatHandlerRef.current = handler;
  }, []);
  
  const clearPendingQuickCommand = useCallback(() => {
    setPendingQuickCommand(null);
  }, []);
  
  const executeQuickAction = useCallback(async (command: string) => {
    if (!user?.id) return;
    
    // Ouvrir le panel si fermé
    if (!isPanelOpen) {
      setIsPanelOpen(true);
      setActiveTab('chat');
    }
    
    // Si un handler est enregistré, l'utiliser directement
    if (chatHandlerRef.current) {
      await chatHandlerRef.current(command);
    } else {
      // Sinon, stocker la commande pour exécution différée
      // quand le panel s'ouvrira et enregistrera son handler
      setPendingQuickCommand(command);
    }
  }, [user?.id, isPanelOpen]);
  
  // ============================================================
  // Proactive Scan
  // ============================================================
  
  const triggerProactiveScan = useCallback(async () => {
    if (isScanning || !user?.id) return;
    setIsScanning(true);
    
    toast({
      title: '🔍 Analyse en cours...',
      description: 'Jarvis recherche des actions à vous proposer',
    });
    
    try {
      const { error } = await supabase.functions.invoke('jarvis-proactive-scan-v2');
      if (error) throw error;
      
      toast({
        title: '✅ Analyse terminée',
        description: 'Les nouvelles suggestions apparaîtront sous peu',
      });
    } catch (error) {
      debug.error('[JarvisContext] Proactive scan error:', error);
      toast({
        title: '❌ Erreur',
        description: 'Impossible de lancer l\'analyse proactive',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, user?.id, toast]);
  
  // ============================================================
  // Context Value (memoized)
  // ============================================================
  
  const contextValue = useMemo<JarvisUnifiedContextValue>(() => ({
    // UI
    isPanelOpen,
    openPanel,
    closePanel,
    togglePanel,
    activeTab,
    setActiveTab,
    
    // Minimized
    isMinimized,
    hasCompletedResponse,
    isProcessingInBackground,
    minimizePanel,
    restorePanel,
    markResponseReady,
    clearMinimizedState,
    
    // Alerts
    alerts,
    addAlert,
    dismissAlert,
    dismissAllAlerts,
    urgentAlerts,
    hasUrgentAlerts,
    alertCount,
    
    // Tool Confirmation
    pendingToolCall,
    setPendingToolCall,
    isConfirming,
    setIsConfirming,
    
    // Quick Actions
    executeQuickAction,
    registerChatHandler,
    pendingQuickCommand,
    clearPendingQuickCommand,
    
    // Proactive Scan
    triggerProactiveScan,
    isScanning,
    
    // Feature Flags
    isEnabled,
    voiceEnabled,
  }), [
    isPanelOpen, openPanel, closePanel, togglePanel, activeTab,
    isMinimized, hasCompletedResponse, isProcessingInBackground, minimizePanel, restorePanel, markResponseReady, clearMinimizedState,
    alerts, addAlert, dismissAlert, dismissAllAlerts, urgentAlerts, hasUrgentAlerts, alertCount,
    alerts, addAlert, dismissAlert, dismissAllAlerts, urgentAlerts, hasUrgentAlerts, alertCount,
    pendingToolCall, isConfirming,
    executeQuickAction, registerChatHandler, pendingQuickCommand, clearPendingQuickCommand,
    triggerProactiveScan, isScanning,
    isEnabled, voiceEnabled,
  ]);
  
  return (
    <JarvisConversationProvider>
      <JarvisUnifiedContext.Provider value={contextValue}>
        {children}
      </JarvisUnifiedContext.Provider>
    </JarvisConversationProvider>
  );
}

// ============================================================
// Hook d'accès
// ============================================================

export function useJarvisUnified() {
  const context = useContext(JarvisUnifiedContext);
  if (!context) {
    throw new Error('useJarvisUnified must be used within JarvisUnifiedProvider');
  }
  return context;
}

// ============================================================
// Hook optionnel (ne throw pas si hors contexte)
// ============================================================

export function useJarvisUnifiedOptional() {
  return useContext(JarvisUnifiedContext);
}
