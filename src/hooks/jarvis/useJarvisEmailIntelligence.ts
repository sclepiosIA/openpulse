 /**
  * JARVIS V12.0 - Hook pour l'intelligence email
  */
 
 import { useQuery, useMutation } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/hooks/shared/useAuth';
 import { debug } from '@/lib/debug';
 
 export interface EmailAnalysis {
   threadId: string;
   priorityScore: number;
   sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
   suggestedResponseTone: string;
   keyTopics: string[];
   actionRequired: boolean;
   estimatedResponseTime: number;
 }
 
 export interface SentimentAlert {
   threadId: string;
   subject: string;
   sentiment: string;
   priorityScore: number;
   actionRequired: boolean;
   alert: string;
 }
 
 export function useJarvisEmailIntelligence() {
   const { user } = useAuth();
 
   // Get priority inbox
   const { data: priorityInbox = [], isLoading: inboxLoading, refetch: refetchInbox } = useQuery({
     queryKey: ['jarvis-priority-inbox', user?.id],
     queryFn: async () => {
       if (!user?.id) return [];
 
       const { data, error } = await supabase.functions.invoke('jarvis-email-intelligence', {
         body: { action: 'get_priority_inbox', userId: user.id }
       });
 
       if (error) {
         debug.error('Failed to fetch priority inbox:', error);
         return [];
       }
 
       return data?.emails || [];
     },
     enabled: !!user?.id,
     staleTime: 5 * 60 * 1000, // 5 minutes
   });
 
   // Get sentiment alerts
   const { data: sentimentAlerts = [], isLoading: alertsLoading } = useQuery({
     queryKey: ['jarvis-sentiment-alerts', user?.id],
     queryFn: async () => {
       if (!user?.id) return [];
 
       const { data, error } = await supabase.functions.invoke('jarvis-email-intelligence', {
         body: { action: 'detect_sentiment_alerts', userId: user.id }
       });
 
       if (error) {
         debug.error('Failed to fetch sentiment alerts:', error);
         return [];
       }
 
       return (data?.alerts || []) as SentimentAlert[];
     },
     enabled: !!user?.id,
     staleTime: 5 * 60 * 1000,
   });
 
   // Analyze single thread
   const analyzeThreadMutation = useMutation({
     mutationFn: async (threadId: string) => {
       const { data, error } = await supabase.functions.invoke('jarvis-email-intelligence', {
         body: { action: 'analyze_thread', threadId }
       });
 
       if (error) throw error;
       return data?.analysis as EmailAnalysis;
     }
   });
 
   // Get response suggestion
   const suggestResponseMutation = useMutation({
     mutationFn: async (threadId: string) => {
       const { data, error } = await supabase.functions.invoke('jarvis-email-intelligence', {
         body: { action: 'suggest_response', threadId }
       });
 
       if (error) throw error;
       return data?.suggestion;
     }
   });
 
   // Stats
   const urgentCount = sentimentAlerts.filter(a => a.sentiment === 'urgent').length;
   const negativeCount = sentimentAlerts.filter(a => a.sentiment === 'negative').length;
 
   return {
     priorityInbox,
     sentimentAlerts,
     isLoading: inboxLoading || alertsLoading,
     
     // Stats
     urgentCount,
     negativeCount,
     hasAlerts: sentimentAlerts.length > 0,
     
     // Actions
     analyzeThread: analyzeThreadMutation.mutateAsync,
     suggestResponse: suggestResponseMutation.mutateAsync,
     refetchInbox,
     
     // Loading states
     isAnalyzing: analyzeThreadMutation.isPending,
     isSuggestingResponse: suggestResponseMutation.isPending
   };
 }