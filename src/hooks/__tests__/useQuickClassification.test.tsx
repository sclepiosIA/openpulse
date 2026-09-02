import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuickClassification } from '../email/useQuickClassification';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';

// Mock supabase
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: mockUpdate.mockReturnValue({
        eq: mockEq,
      }),
    })),
  },
}));

// Mock toast
vi.mock('@/hooks/shared/use-toast', () => ({
  toast: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useQuickClassification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockResolvedValue({ error: null });
  });

  it('should classify thread with etablissement', async () => {
    const { result } = renderHook(() => useQuickClassification(), {
      wrapper: createWrapper(),
    });

    result.current.classifyThread({
      threadId: 'thread-123',
      etablissementId: 'etab-456',
      etablissementNom: 'CHU Test',
    });

    await waitFor(() => {
      expect(result.current.isClassifying).toBe(false);
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      etablissement_id: 'etab-456',
    });
    expect(mockEq).toHaveBeenCalledWith('id', 'thread-123');
  });

  it('should classify thread with partenaire', async () => {
    const { result } = renderHook(() => useQuickClassification(), {
      wrapper: createWrapper(),
    });

    result.current.classifyThread({
      threadId: 'thread-123',
      partenaireId: 'part-789',
      partenaireNom: 'Partenaire Test',
    });

    await waitFor(() => {
      expect(result.current.isClassifying).toBe(false);
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      partenaire_id: 'part-789',
    });
  });

  it('should classify thread with groupe', async () => {
    const { result } = renderHook(() => useQuickClassification(), {
      wrapper: createWrapper(),
    });

    result.current.classifyThread({
      threadId: 'thread-123',
      groupeId: 'groupe-abc',
      groupeNom: 'Groupe Hospitalier',
    });

    await waitFor(() => {
      expect(result.current.isClassifying).toBe(false);
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      groupe_id: 'groupe-abc',
    });
  });

  it('should handle null values for declassification', async () => {
    const { result } = renderHook(() => useQuickClassification(), {
      wrapper: createWrapper(),
    });

    result.current.classifyThread({
      threadId: 'thread-123',
      etablissementId: null,
      partenaireId: null,
      groupeId: null,
    });

    await waitFor(() => {
      expect(result.current.isClassifying).toBe(false);
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      etablissement_id: null,
      partenaire_id: null,
      groupe_id: null,
    });
  });

  it('should handle errors gracefully', async () => {
    mockEq.mockResolvedValue({ error: new Error('Database error') });

    const { result } = renderHook(() => useQuickClassification(), {
      wrapper: createWrapper(),
    });

    result.current.classifyThread({
      threadId: 'thread-123',
      etablissementId: 'etab-456',
    });

    await waitFor(() => {
      expect(result.current.isClassifying).toBe(false);
    });

    // Error should be handled (toast shown) without throwing
  });

  it('should not include undefined values in update', async () => {
    const { result } = renderHook(() => useQuickClassification(), {
      wrapper: createWrapper(),
    });

    result.current.classifyThread({
      threadId: 'thread-123',
      etablissementId: 'etab-456',
      // partenaireId and groupeId are undefined - should not be in update
    });

    await waitFor(() => {
      expect(result.current.isClassifying).toBe(false);
    });

    // Should only include etablissement_id, not partenaire_id or groupe_id
    expect(mockUpdate).toHaveBeenCalledWith({
      etablissement_id: 'etab-456',
    });
  });
});
