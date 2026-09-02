 /**
  * JARVIS V12.0 - Hook pour l'intelligence calendrier
  */
 
 import { useQuery, useMutation } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/hooks/shared/useAuth';
 import { debug } from '@/lib/debug';
 
 export interface AvailabilityPattern {
   totalMeetings: number;
   avgMeetingsPerWeek: number;
   busiestDay: string;
   busiestHour: string;
   quietestHour: string;
 }
 
 export interface SuggestedSlot {
   start: Date;
   end: Date;
   score: number;
   label: string;
 }
 
 export interface CalendarConflict {
   type: 'overlap' | 'back_to_back';
   severity: 'high' | 'low';
   events: Array<{ id: string; title: string; start?: string; end?: string }>;
   message: string;
 }
 
 export interface MeetingPreparation {
   event: {
     title: string;
     startTime: string;
     endTime: string;
     location?: string;
     description?: string;
   };
   context: Record<string, unknown>;
   suggestions: Array<{
     type: string;
     title: string;
     items: string[];
   }>;
   documents: unknown[];
 }
 
 export function useJarvisCalendarIntelligence() {
   const { user } = useAuth();
 
   // Get availability patterns
   const { data: patterns, isLoading: patternsLoading } = useQuery({
     queryKey: ['jarvis-calendar-patterns', user?.id],
     queryFn: async () => {
       if (!user?.id) return null;
 
       const { data, error } = await supabase.functions.invoke('jarvis-calendar-intelligence', {
         body: { action: 'analyze_availability', userId: user.id }
       });
 
       if (error) {
         debug.error('Failed to fetch calendar patterns:', error);
         return null;
       }
 
       return data;
     },
     enabled: !!user?.id,
     staleTime: 30 * 60 * 1000, // 30 minutes
   });
 
   // Get weekly summary
   const { data: weeklySummary, isLoading: summaryLoading } = useQuery({
     queryKey: ['jarvis-calendar-weekly', user?.id],
     queryFn: async () => {
       if (!user?.id) return null;
 
       const { data, error } = await supabase.functions.invoke('jarvis-calendar-intelligence', {
         body: { action: 'get_weekly_summary', userId: user.id }
       });
 
       if (error) {
         debug.error('Failed to fetch weekly summary:', error);
         return null;
       }
 
       return data?.summary;
     },
     enabled: !!user?.id,
     staleTime: 10 * 60 * 1000, // 10 minutes
   });
 
   // Detect conflicts
   const { data: conflicts = [], isLoading: conflictsLoading } = useQuery({
     queryKey: ['jarvis-calendar-conflicts', user?.id],
     queryFn: async () => {
       if (!user?.id) return [];
 
       const { data, error } = await supabase.functions.invoke('jarvis-calendar-intelligence', {
         body: { 
           action: 'detect_conflicts', 
           userId: user.id,
           dateRange: {
             start: new Date().toISOString(),
             end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
           }
         }
       });
 
       if (error) {
         debug.error('Failed to detect conflicts:', error);
         return [];
       }
 
       return (data?.conflicts || []) as CalendarConflict[];
     },
     enabled: !!user?.id,
     staleTime: 10 * 60 * 1000,
   });
 
   // Suggest best slots
   const suggestSlotsMutation = useMutation({
     mutationFn: async ({ 
       duration, 
       preferredTime,
       dateRange 
     }: { 
       duration?: number; 
       preferredTime?: 'morning' | 'afternoon';
       dateRange?: { start: string; end: string };
     }) => {
       if (!user?.id) throw new Error('Not authenticated');
 
       const { data, error } = await supabase.functions.invoke('jarvis-calendar-intelligence', {
         body: { 
           action: 'suggest_best_slots', 
           userId: user.id,
           duration: duration || 60,
           preferredTime,
           dateRange
         }
       });
 
       if (error) throw error;
       return (data?.slots || []) as SuggestedSlot[];
     }
   });
 
   // Prepare meeting context
   const prepareMeetingMutation = useMutation({
     mutationFn: async (eventId: string) => {
       const { data, error } = await supabase.functions.invoke('jarvis-calendar-intelligence', {
         body: { action: 'prepare_meeting', eventId }
       });
 
       if (error) throw error;
       return data?.preparation as MeetingPreparation;
     }
   });
 
   // Stats
   const highSeverityConflicts = conflicts.filter(c => c.severity === 'high');
 
   return {
     patterns: patterns?.patterns as AvailabilityPattern | undefined,
     insights: patterns?.insights as string[] | undefined,
     recommendations: patterns?.recommendations,
     weeklySummary,
     conflicts,
     isLoading: patternsLoading || summaryLoading || conflictsLoading,
     
     // Stats
     hasConflicts: conflicts.length > 0,
     highSeverityConflictsCount: highSeverityConflicts.length,
     
     // Actions
     suggestSlots: suggestSlotsMutation.mutateAsync,
     prepareMeeting: prepareMeetingMutation.mutateAsync,
     
     // Loading states
     isSuggestingSlots: suggestSlotsMutation.isPending,
     isPreparingMeeting: prepareMeetingMutation.isPending
   };
 }