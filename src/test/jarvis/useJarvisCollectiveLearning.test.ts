 /**
  * Tests for useJarvisCollectiveLearning hook (JARVIS V12.0)
  */
 
 import { describe, it, expect, vi, beforeEach } from 'vitest';
 import { renderHook, act, waitFor } from '@testing-library/react';
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
 
 import { useJarvisCollectiveLearning } from '@/hooks/jarvis/useJarvisCollectiveLearning';
 
 describe('useJarvisCollectiveLearning', () => {
   let queryClient: QueryClient;
 
   beforeEach(() => {
     queryClient = new QueryClient({ 
       defaultOptions: { queries: { retry: false, gcTime: 0 } } 
     });
     vi.clearAllMocks();
     
     mockInvoke.mockImplementation(async (fnName: string, options: { body: { action: string } }) => {
       if (options.body.action === 'get_suggestions') {
         return { data: { suggestions: [
           { 
             id: 's1', 
             type: 'workflow', 
             title: 'Relance automatique', 
             description: 'Relancer les factures à J+30',
             effectiveness: 0.92,
             adoptionRate: 0.85,
             sourceCount: 45,
             actionable: true,
             data: {}
           },
           { 
             id: 's2', 
             type: 'email', 
             title: 'Email de suivi', 
             description: 'Envoyer un email dans les 24h',
             effectiveness: 0.78,
             adoptionRate: 0.65,
             sourceCount: 32,
             actionable: true,
             data: {}
           }
         ]}, error: null };
       }
       if (options.body.action === 'get_top_performer_insights') {
         return { data: { insights: [
           { 
             insight: 'top_performers_follow_up', 
             title: 'Suivi rapide', 
             recommendations: ['Répondre aux emails dans les 2h']
           }
         ]}, error: null };
       }
       if (options.body.action === 'record_action') {
         return { data: { success: true }, error: null };
       }
       return { data: null, error: null };
     });
   });
 
   const wrapper = ({ children }: { children: React.ReactNode }) => 
     React.createElement(QueryClientProvider, { client: queryClient }, children);
 
   it('should fetch collective suggestions', async () => {
     const { result } = renderHook(() => useJarvisCollectiveLearning(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     expect(result.current.suggestions).toHaveLength(2);
     expect(result.current.hasSuggestions).toBe(true);
   });
 
   it('should fetch top performer insights', async () => {
     const { result } = renderHook(() => useJarvisCollectiveLearning(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     expect(result.current.insights).toHaveLength(1);
     expect(result.current.insights[0].title).toBe('Suivi rapide');
   });
 
   it('should provide topSuggestions sorted by effectiveness', async () => {
     const { result } = renderHook(() => useJarvisCollectiveLearning(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     expect(result.current.topSuggestions).toBeDefined();
     expect(result.current.topSuggestions[0].effectiveness).toBeGreaterThanOrEqual(
       result.current.topSuggestions[1]?.effectiveness || 0
     );
   });
 
   it('should provide getSuggestionsByType function', async () => {
     const { result } = renderHook(() => useJarvisCollectiveLearning(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     const workflowSuggestions = result.current.getSuggestionsByType('workflow');
     expect(workflowSuggestions).toHaveLength(1);
     expect(workflowSuggestions[0].type).toBe('workflow');
   });
 
   it('should provide recordAction function', async () => {
     const { result } = renderHook(() => useJarvisCollectiveLearning(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     expect(typeof result.current.recordAction).toBe('function');
     
     await act(async () => {
       await result.current.recordAction('task_created', { taskId: 't1' }, true);
     });
     
     expect(mockInvoke).toHaveBeenCalledWith('jarvis-collective-learning', {
       body: {
         action: 'record_action',
         userId: 'test-user-id',
         actionType: 'task_created',
         actionData: { taskId: 't1' },
         success: true
       }
     });
   });
 });