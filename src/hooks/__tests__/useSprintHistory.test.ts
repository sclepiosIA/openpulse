import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RDSprint, RDUserStory } from '@/types/rd';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  },
}));

import { useSprintBurndown, useCumulativeFlowData } from '../rd/useSprintHistory';
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: any) => React.createElement(QueryClientProvider, { client: qc }, children);

const sprint: RDSprint = {
  id: 's1',
  projet_id: 'p1',
  nom: 'Sprint 1',
  numero: 1,
  date_debut: '2026-03-01',
  date_fin: '2026-03-14',
  objectif: 'Test',
  statut: 'actif',
  velocity_prevue: 20,
  velocity_reelle: null,
  created_at: '',
  updated_at: '',
};

const stories: RDUserStory[] = [
  { id: 'us1', titre: 'Story 1', points: 5, statut: 'done' } as any,
  { id: 'us2', titre: 'Story 2', points: 8, statut: 'in_progress' } as any,
  { id: 'us3', titre: 'Story 3', points: 3, statut: 'backlog' } as any,
];

describe('useSprintBurndown', () => {
  it('returns burndown data when sprint and stories are provided', async () => {
    const { result } = renderHook(() => useSprintBurndown(sprint, stories), { wrapper });
    // Wait for query to resolve
    await vi.waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const data = result.current.data!;
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('date');
    expect(data[0]).toHaveProperty('ideal');
    expect(data[0]).toHaveProperty('actual');
    // First day ideal should equal total points (16)
    expect(data[0].ideal).toBe(16);
  });

  it('returns empty array when sprint is null', async () => {
    const { result } = renderHook(() => useSprintBurndown(null, stories), { wrapper });
    // Disabled query returns undefined data
    expect(result.current.data).toBeUndefined();
  });
});

describe('useCumulativeFlowData', () => {
  it('returns CFD data for 14 days', async () => {
    qc.clear();
    const { result } = renderHook(() => useCumulativeFlowData('p1', stories), { wrapper });
    await vi.waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const data = result.current.data!;
    expect(data.length).toBe(14);
    expect(data[0]).toHaveProperty('backlog');
    expect(data[0]).toHaveProperty('done');
  });

  it('returns empty when no stories', async () => {
    qc.clear();
    const { result } = renderHook(() => useCumulativeFlowData('p1', []), { wrapper });
    await vi.waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data).toEqual([]);
  });
});
