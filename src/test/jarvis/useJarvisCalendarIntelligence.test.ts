 /**
  * Tests for useJarvisCalendarIntelligence hook (JARVIS V12.0)
  */
 
 import { describe, it, expect, vi, beforeEach } from 'vitest';
 import { renderHook, waitFor } from '@testing-library/react';
 import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
 import React from 'react';
 
 // Mock Supabase
 const mockInvoke = vi.fn();
 vi.mock('@/integrations/supabase/client', () => ({
   supabase: {
     functions: { invoke: (...args: unknown[]) => mockInvoke(...args) }
   }
 }));
 
 // Mock auth
 vi.mock('@/hooks/shared/useAuth', () => ({
   useAuth: () => ({ user: { id: 'test-user-id' } })
 }));
 
 import { useJarvisCalendarIntelligence } from '@/hooks/jarvis/useJarvisCalendarIntelligence';
 
 describe('useJarvisCalendarIntelligence', () => {
   let queryClient: QueryClient;
 
   beforeEach(() => {
     queryClient = new QueryClient({ 
       defaultOptions: { queries: { retry: false, gcTime: 0 } } 
     });
     vi.clearAllMocks();
     
     mockInvoke.mockImplementation(async (fnName: string, options: { body: { action: string } }) => {
       if (options.body.action === 'analyze_availability') {
         return { data: {
           patterns: {
             totalMeetings: 45,
             avgMeetingsPerWeek: 12,
             busiestDay: 'Tuesday',
             busiestHour: '10:00',
             quietestHour: '08:00'
           },
           insights: ['Most productive in the morning', 'Tuesday is busiest'],
           recommendations: ['Block focus time on Friday']
         }, error: null };
       }
       if (options.body.action === 'get_weekly_summary') {
         return { data: { summary: {
           totalMeetings: 8,
           totalHours: 12,
           freeSlots: 15
         }}, error: null };
       }
       if (options.body.action === 'detect_conflicts') {
         return { data: { conflicts: [
           { type: 'overlap', severity: 'high', events: [{ id: 'e1', title: 'Meeting 1' }], message: 'Overlap detected' },
           { type: 'back_to_back', severity: 'low', events: [{ id: 'e2', title: 'Meeting 2' }], message: 'Back-to-back meetings' }
         ]}, error: null };
       }
       if (options.body.action === 'suggest_best_slots') {
         return { data: { slots: [
           { start: new Date(), end: new Date(), score: 95, label: 'Optimal slot' }
         ]}, error: null };
       }
       if (options.body.action === 'prepare_meeting') {
         return { data: { preparation: {
           event: { title: 'Team Sync', startTime: '10:00', endTime: '11:00' },
           context: {},
           suggestions: [{ type: 'agenda', title: 'Agenda', items: ['Review goals'] }],
           documents: []
         }}, error: null };
       }
       return { data: null, error: null };
     });
   });
 
   const wrapper = ({ children }: { children: React.ReactNode }) => 
     React.createElement(QueryClientProvider, { client: queryClient }, children);
 
   it('should fetch availability patterns', async () => {
     const { result } = renderHook(() => useJarvisCalendarIntelligence(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     expect(result.current.patterns).toBeDefined();
     expect(result.current.patterns?.busiestDay).toBe('Tuesday');
   });
 
   it('should fetch weekly summary', async () => {
     const { result } = renderHook(() => useJarvisCalendarIntelligence(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     expect(result.current.weeklySummary).toBeDefined();
   });
 
   it('should detect conflicts', async () => {
     const { result } = renderHook(() => useJarvisCalendarIntelligence(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     expect(result.current.conflicts).toHaveLength(2);
     expect(result.current.hasConflicts).toBe(true);
     expect(result.current.highSeverityConflictsCount).toBe(1);
   });
 
   it('should provide suggestSlots function', async () => {
     const { result } = renderHook(() => useJarvisCalendarIntelligence(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     expect(typeof result.current.suggestSlots).toBe('function');
   });
 
   it('should provide prepareMeeting function', async () => {
     const { result } = renderHook(() => useJarvisCalendarIntelligence(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     expect(typeof result.current.prepareMeeting).toBe('function');
   });
 
   it('should provide insights and recommendations', async () => {
     const { result } = renderHook(() => useJarvisCalendarIntelligence(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     expect(result.current.insights).toBeDefined();
     expect(Array.isArray(result.current.insights)).toBe(true);
   });
 });