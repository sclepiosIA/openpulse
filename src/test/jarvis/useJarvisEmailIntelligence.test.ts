 /**
  * Tests for useJarvisEmailIntelligence hook (JARVIS V12.0)
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
 
 import { useJarvisEmailIntelligence } from '@/hooks/jarvis/useJarvisEmailIntelligence';
 
 describe('useJarvisEmailIntelligence', () => {
   let queryClient: QueryClient;
 
   beforeEach(() => {
     queryClient = new QueryClient({ 
       defaultOptions: { queries: { retry: false, gcTime: 0 } } 
     });
     vi.clearAllMocks();
     
     mockInvoke.mockImplementation(async (fnName: string, options: { body: { action: string } }) => {
       if (options.body.action === 'get_priority_inbox') {
         return { data: { emails: [
           { threadId: 't1', subject: 'Urgent', priorityScore: 95 },
           { threadId: 't2', subject: 'Normal', priorityScore: 50 }
         ]}, error: null };
       }
       if (options.body.action === 'detect_sentiment_alerts') {
         return { data: { alerts: [
           { threadId: 't1', sentiment: 'urgent', priorityScore: 95, actionRequired: true, subject: 'Urgent', alert: 'High priority' },
           { threadId: 't3', sentiment: 'negative', priorityScore: 70, actionRequired: true, subject: 'Complaint', alert: 'Negative sentiment' }
         ]}, error: null };
       }
       if (options.body.action === 'analyze_thread') {
         return { data: { analysis: {
           threadId: 't1',
           priorityScore: 95,
           sentiment: 'urgent',
           suggestedResponseTone: 'professional',
           keyTopics: ['deadline', 'contract'],
           actionRequired: true,
           estimatedResponseTime: 15
         }}, error: null };
       }
       if (options.body.action === 'suggest_response') {
         return { data: { suggestion: 'Thank you for your email...' }, error: null };
       }
       return { data: null, error: null };
     });
   });
 
   const wrapper = ({ children }: { children: React.ReactNode }) => 
     React.createElement(QueryClientProvider, { client: queryClient }, children);
 
   it('should fetch priority inbox', async () => {
     const { result } = renderHook(() => useJarvisEmailIntelligence(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     expect(result.current.priorityInbox).toHaveLength(2);
     expect(result.current.priorityInbox[0].subject).toBe('Urgent');
   });
 
   it('should fetch sentiment alerts', async () => {
     const { result } = renderHook(() => useJarvisEmailIntelligence(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     expect(result.current.sentimentAlerts).toHaveLength(2);
     expect(result.current.hasAlerts).toBe(true);
   });
 
   it('should calculate urgent and negative counts', async () => {
     const { result } = renderHook(() => useJarvisEmailIntelligence(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     expect(result.current.urgentCount).toBe(1);
     expect(result.current.negativeCount).toBe(1);
   });
 
   it('should provide analyzeThread function', async () => {
     const { result } = renderHook(() => useJarvisEmailIntelligence(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     expect(typeof result.current.analyzeThread).toBe('function');
   });
 
   it('should provide suggestResponse function', async () => {
     const { result } = renderHook(() => useJarvisEmailIntelligence(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     expect(typeof result.current.suggestResponse).toBe('function');
   });
 
   it('should provide refetchInbox function', async () => {
     const { result } = renderHook(() => useJarvisEmailIntelligence(), { wrapper });
     
     await waitFor(() => {
       expect(result.current.isLoading).toBe(false);
     });
     
     expect(typeof result.current.refetchInbox).toBe('function');
   });
 });