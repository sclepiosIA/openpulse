 /**
  * JARVIS V12.0 - Hook pour l'intelligence collective
  * 
  * Récupère et affiche les insights basés sur l'apprentissage cross-utilisateur
  */
 
 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/hooks/shared/useAuth';
 import { debug } from '@/lib/debug';
 
 export interface CollectiveSuggestion {
   id: string;
   type: string;
   title: string;
   description: string;
   effectiveness: number;
   adoptionRate: number;
   sourceCount: number;
   actionable: boolean;
   data: Record<string, unknown>;
 }
 
 export interface TopPerformerInsight {
   insight: string;
   title: string;
   data?: Record<string, unknown>;
   recommendations: string[];
 }
 
 export function useJarvisCollectiveLearning() {
   const { user } = useAuth();
 
   // Fetch collective suggestions
   const { data: suggestions = [], isLoading: suggestionsLoading } = useQuery({
     queryKey: ['jarvis-collective-suggestions', user?.id],
     queryFn: async () => {
       if (!user?.id) return [];
 
       const { data, error } = await supabase.functions.invoke('jarvis-collective-learning', {
         body: { action: 'get_suggestions', userId: user.id }
       });
 
       if (error) {
         debug.error('Failed to fetch collective suggestions:', error);
         return [];
       }
 
       return (data?.suggestions || []) as CollectiveSuggestion[];
     },
     enabled: !!user?.id,
     staleTime: 10 * 60 * 1000, // 10 minutes
   });
 
   // Fetch top performer insights
   const { data: insights = [], isLoading: insightsLoading } = useQuery({
     queryKey: ['jarvis-top-performer-insights'],
     queryFn: async () => {
       const { data, error } = await supabase.functions.invoke('jarvis-collective-learning', {
         body: { action: 'get_top_performer_insights' }
       });
 
       if (error) {
         debug.error('Failed to fetch top performer insights:', error);
         return [];
       }
 
       return (data?.insights || []) as TopPerformerInsight[];
     },
     staleTime: 30 * 60 * 1000, // 30 minutes
   });
 
   // Record user action for collective learning
   const recordAction = async (
     actionType: string, 
     actionData: Record<string, unknown>, 
     success: boolean
   ) => {
     if (!user?.id) return;
 
     try {
       await supabase.functions.invoke('jarvis-collective-learning', {
         body: {
           action: 'record_action',
           userId: user.id,
           actionType,
           actionData,
           success
         }
       });
     } catch (error) {
       debug.error('Failed to record action:', error);
     }
   };
 
   // Get suggestions by type
   const getSuggestionsByType = (type: string) => {
     return suggestions.filter(s => s.type === type);
   };
 
   // Get most effective suggestions
   const topSuggestions = suggestions
     .sort((a, b) => b.effectiveness - a.effectiveness)
     .slice(0, 5);
 
   return {
     suggestions,
     insights,
     topSuggestions,
     isLoading: suggestionsLoading || insightsLoading,
     recordAction,
     getSuggestionsByType,
     hasSuggestions: suggestions.length > 0
   };
 }