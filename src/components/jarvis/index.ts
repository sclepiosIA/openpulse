/**
 * Jarvis Components - Index
 * 
 * V12.0: Multi-Agent, Azure Monitoring, Gamification
 */

export { JarvisAssistantPanel } from './JarvisAssistantPanel';
export { JarvisActionCard } from './JarvisActionCard';
export { JarvisSourceBadge } from './JarvisSourceBadge';
export { JarvisVoiceInterface, JarvisVoiceButton } from './JarvisVoiceInterface';
export { JarvisSettingsSheet } from './JarvisSettingsSheet';
export { JarvisSettingsContent } from './JarvisSettingsContent';
export { JarvisHistorySheet } from './JarvisHistorySheet';
export { JarvisModifyDialog } from './JarvisModifyDialog';
export { JarvisConversation } from './JarvisConversation';
export { JarvisTriggerButton } from './JarvisTriggerButton';
export { JarvisLogoTrigger } from './JarvisLogoTrigger';
export { JarvisTemplates } from './JarvisTemplates';
export { JarvisAnalyticsDashboard } from './JarvisAnalyticsDashboard';
export { JarvisFocusIndicator } from './JarvisFocusIndicator';
export { JarvisProactiveSuggestions } from './JarvisProactiveSuggestions';
export { JarvisQuickActions } from './JarvisQuickActions';
export { JarvisQuickActionsContextual } from './JarvisQuickActionsContextual';
export { JarvisContextualSuggestions } from './JarvisContextualSuggestions';
export { JarvisThinkingIndicator } from './JarvisThinkingIndicator';
export { JarvisMessageFeedback } from './JarvisMessageFeedback';
export { JarvisCommandPalette } from './JarvisCommandPalette';
export { JarvisShortcutsHelp } from './JarvisShortcutsHelp';

// V3.2 - Dashboard Widget + Vision
export { JarvisDashboardWidget } from './JarvisDashboardWidget';
export { JarvisImageUpload } from './JarvisImageUpload';

// V3.3 - Background execution & memory
export { JarvisBackgroundIndicator } from './JarvisBackgroundIndicator';
export { JarvisMemoryManager } from './JarvisMemoryManager';

// V4.0 - Predictive Intelligence + Global Overlay
export { JarvisOverlay } from './JarvisOverlay';

// V5.0 - Multi-Agent Team
export { JarvisAgentAvatar, JarvisAgentRow } from './JarvisAgentAvatar';
export { JarvisTeamPanel } from './JarvisTeamPanel';
export { JarvisTeamSettings } from './JarvisTeamSettings';

// V6.0 - Omniscient & Unified
export { JarvisUnifiedPanel } from './JarvisUnifiedPanel';
export { JarvisAgentAnalytics } from './JarvisAgentAnalytics';

// V7.0 - Daily Briefing
export { JarvisDailyBriefing } from './JarvisDailyBriefing';

// V9.0 - Performance & Workflows
export { JarvisWorkflowPanel } from './JarvisWorkflowPanel';
export { JarvisPredictionsPanel } from './JarvisPredictionsPanel';
export { JarvisPerformanceWidget } from './JarvisPerformanceWidget';

// V10.0 - Enterprise Resilience
export { JarvisHealthDashboard } from './JarvisHealthDashboard';
export { JarvisConnectionStatus } from './JarvisConnectionStatus';

// V10.5 - Reasoning & Intelligence
export { JarvisReasoningIndicator, useReasoningSteps } from './JarvisReasoningIndicator';

// V10.5 - Global Alert Indicator
export { JarvisGlobalAlertIndicator } from './JarvisGlobalAlertIndicator';

// V12.1 - Email Preview
export { JarvisEmailPreview } from './JarvisEmailPreview';

// V12.2 - Azure GPT-5 Monitoring
export { JarvisAzureMonitoring } from './JarvisAzureMonitoring';

// V12.3 - Performance & UX Improvements
export { JarvisSkeletonLoader, JarvisTypingIndicator } from './JarvisSkeletonLoader';
export { JarvisEnhancedInput } from './JarvisEnhancedInput';
export { JarvisQuickActionsBar } from './JarvisQuickActionsBar';

// V12.5 - Ultra Premium UI/UX
export { JarvisWelcomeScreen } from './JarvisWelcomeScreen';
export { JarvisMessageBubble } from './JarvisMessageBubble';
export { JarvisDataCard } from './JarvisDataCard';
export { 
  JarvisImmersiveMode, 
  ImmersiveToggle 
} from './JarvisImmersiveMode';
export { 
  FadeTransition,
  SlideUpTransition,
  ScaleTransition,
  BounceTransition,
  PageTransition,
  StaggerList,
  StaggerItem,
  JarvisSkeleton,
  HapticButton,
  PresenceWrapper,
} from './JarvisTransitions';

// V11.0 - Document RAG, Objectives & Favorites
export { useJarvisDocumentRAG } from '@/hooks/jarvis/useJarvisDocumentRAG';
export { JarvisObjectivesPanel } from './JarvisObjectivesPanel';
export { JarvisFavoritesBar } from './JarvisFavoritesBar';

// Hooks V6.0
export { useJarvisMultiChannel } from '@/hooks/jarvis/useJarvisMultiChannel';
export { useJarvisAgentNegotiation } from '@/hooks/jarvis/useJarvisAgentNegotiation';
export { useJarvisVoiceConference } from '@/hooks/jarvis/useJarvisVoiceConference';
export { useJarvisGestures } from '@/hooks/jarvis/useJarvisGestures';

// Hooks V7.0
export { useJarvisPageContext, useJarvisContextText, useJarvisHasEntityContext } from '@/hooks/jarvis/useJarvisPageContext';
export { useJarvisContextualSuggestions } from '@/hooks/jarvis/useJarvisContextualSuggestions';

// Hooks V9.0
export { useJarvisOptimisticUI } from '@/hooks/jarvis/useJarvisOptimisticUI';
export { useJarvisPerformanceMetrics } from '@/hooks/jarvis/useJarvisPerformanceMetrics';
export { useJarvisEnhanced } from '@/hooks/jarvis/useJarvisEnhanced';
// useJarvisStreamingV2 supprimé - consolidé dans useJarvisStreaming

// Hooks V10.0 - Enterprise Resilience
export { useJarvisCircuitState } from '@/hooks/jarvis/useJarvisCircuitState';
export { useJarvisOfflineQueue } from '@/hooks/jarvis/useJarvisOfflineQueue';
export { useJarvisResponseCache } from '@/hooks/jarvis/useJarvisResponseCache';

// Hooks V10.5 - Realtime & Learning (useJarvisRealtimeAlerts merged into JarvisProactiveAlertsContext)
export { useJarvisProactiveAlertsContext as useJarvisRealtimeAlerts } from '@/contexts/JarvisProactiveAlertsContext';
export { useJarvisDriftDetection } from '@/hooks/jarvis/useJarvisDriftDetection';
export { useJarvisSemanticMemory } from '@/hooks/jarvis/useJarvisSemanticMemory';
export { useJarvisMetricsHistory } from '@/hooks/jarvis/useJarvisMetricsHistory';

// V11.0 - Conversation Search
export { useJarvisConversationSearch } from '@/hooks/jarvis/useJarvisConversationSearch';

// V10.5 - Autopilot
export { JarvisAutopilotPanel } from './JarvisAutopilotPanel';
export { JarvisAutopilotTemplates } from './JarvisAutopilotTemplates';
export { useJarvisAutopilot } from '@/hooks/jarvis/useJarvisAutopilot';

// V11.0 - Wake Word Detection
export { useJarvisWakeWord } from '@/hooks/jarvis/useJarvisWakeWord';
export { JarvisWakeWordIndicator } from './JarvisWakeWordIndicator';

// V12.0 - Game Changer Edition (Phase 1-2)
export { useJarvisCognitiveSession } from '@/hooks/jarvis/useJarvisCognitiveSession';
export { JarvisClarificationDialog, JarvisClarificationInline } from './JarvisClarificationDialog';
export { JarvisSmartBriefing } from './JarvisSmartBriefing';
export { JarvisProductivityScore } from './JarvisProductivityScore';
export { useJarvisGamification } from '@/hooks/jarvis/useJarvisGamification';

// V12.0 - Phase 3-4: Workflows & Immersive Interface
export { JarvisPictureInPicture, useJarvisPiP } from './JarvisPictureInPicture';
export { JarvisWorkflowSuggestion, useWorkflowSuggestions } from './JarvisWorkflowSuggestion';
export { useJarvisPreemptiveActions, usePreemptiveActionNotifications } from '@/hooks/jarvis/useJarvisPreemptiveActions';

// V12.0 - Phase 5: Intelligence Collective
export { useJarvisCollectiveLearning } from '@/hooks/jarvis/useJarvisCollectiveLearning';
export { JarvisCollectiveInsights } from './JarvisCollectiveInsights';

// V12.0 - Phase 6: Intégrations Avancées (Email + Calendar Intelligence)
export { useJarvisEmailIntelligence } from '@/hooks/jarvis/useJarvisEmailIntelligence';
export { useJarvisCalendarIntelligence } from '@/hooks/jarvis/useJarvisCalendarIntelligence';

// V12.0 - Phase 7: Gamification Challenges
export { JarvisChallenges } from './JarvisChallenges';

// V12.4 - Unified Coherence System
export { JarvisProactiveNudge } from './JarvisProactiveNudge';
export { JarvisAlertBadge } from './JarvisAlertBadge';
export { JarvisAlertCard } from './JarvisAlertCard';
export { useJarvisSmartTriggers } from '@/hooks/jarvis/useJarvisSmartTriggers';
export { useJarvisIntentPrediction } from '@/hooks/jarvis/useJarvisIntentPrediction';
export { 
  JarvisUnifiedProvider, 
  useJarvisUnified, 
  useJarvisUnifiedOptional,
  JARVIS_COLORS,
  JARVIS_ANIMATIONS,
  type JarvisAlert,
  type JarvisAlertType,
  type JarvisAlertPriority,
  type JarvisTab,
} from '@/contexts/JarvisUnifiedContext';
export {
  type JarvisReasoningStep,
  type JarvisStreamState,
} from '@/contexts/JarvisConversationContext';

// V12.7 - Enhanced Status Indicator
export { JarvisStatusIndicator, JarvisStatusDot } from './JarvisStatusIndicator';
export { DNAHelix, AudioWave } from './JarvisThinkingIndicator';

// V13.0 - Apple-like Design System
export { JarvisApplePanel } from './JarvisApplePanel';
export { JarvisAppleHeader } from './JarvisAppleHeader';
export { JarvisAppleWelcome } from './JarvisAppleWelcome';
export { JarvisAppleInput } from './JarvisAppleInput';
export { JarvisAppleMessage } from './JarvisAppleMessage';
export { JarvisAppleThinking, JarvisAppleThinkingPulse } from './JarvisAppleThinking';
export { JarvisFloatingButton } from './JarvisFloatingButton';

// V14.0 - Ultra Premium Design System
export { JARVIS_DESIGN, JARVIS_COLORS as JARVIS_DESIGN_COLORS, JARVIS_ANIMATIONS as JARVIS_DESIGN_ANIMATIONS, JARVIS_LAYOUT, JARVIS_TYPOGRAPHY, JARVIS_COMPONENTS } from './JarvisDesignSystem';
export { JarvisGlassHeader } from './JarvisGlassHeader';
export { JarvisSmartInput } from './JarvisSmartInput';
export { JarvisPremiumMessage } from './JarvisPremiumMessage';
export { JarvisIntelligentThinking, JarvisDNAThinking } from './JarvisIntelligentThinking';
export { JarvisEnhancedWelcome } from './JarvisEnhancedWelcome';
export { JarvisPremiumPanel } from './JarvisPremiumPanel';
export { JarvisContextBadge } from './JarvisContextBadge';

// V14.0 - Animations & Voice
export { JarvisTypingDots, JarvisWaveIndicator, JarvisOrbitalLoader, JarvisPulseRing } from './JarvisAnimations';
export { JarvisVoiceWave, JarvisVoiceOverlay } from './JarvisVoiceWave';
export { JarvisCommandBar, useJarvisCommandBar } from './JarvisCommandBar';

// V15.0 - Premium Components
export { JarvisStreamingMessage, JarvisProgressBar } from './JarvisStreamingMessage';
export { JarvisProactiveCard, JarvisProactiveStack } from './JarvisProactiveCard';
export { JarvisAvatarAnimated, JarvisAvatarMini } from './JarvisAvatarAnimated';
export { JarvisMiniFab } from './JarvisMiniFab';
export { JarvisCapabilities } from './JarvisCapabilities';
export { JarvisKeyboardShortcuts, useJarvisKeyboardShortcuts } from './JarvisKeyboardShortcuts';

// Config V6.0
export { 
  JARVIS_AGENTS, 
  AGENT_VOICE_MAP,
  HANDOFF_TRIGGER_PHRASES,
  detectAgentFromText,
  getAgentVoicePrompt,
  getRandomHandoffPhrase 
} from '@/lib/jarvis-agents-config';

// Types V6.0
export type * from '@/types/jarvis-v6';
