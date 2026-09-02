import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RDDashboard } from '../RDDashboard';

vi.mock('@/hooks/rd/useRD', () => ({
  useProjetStats: () => ({
    data: { total_stories: 10, total_points: 42, done_stories: 5, done_points: 20 },
    isLoading: false,
  }),
  useActiveSprint: () => ({ data: null }),
  useSprintStats: () => ({ data: null }),
  useRDEpics: () => ({ data: [] }),
  useRDUserStories: () => ({ data: [] }),
}));

vi.mock('@/hooks/rd/useSprintHistory', () => ({
  useSprintBurndown: () => ({ data: [] }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('RDDashboard', () => {
  it('renders KPI cards', () => {
    render(
      <QueryClientProvider client={qc}>
        <RDDashboard projetId="p1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('User Stories')).toBeInTheDocument();
  });

  it('renders story points card', () => {
    render(
      <QueryClientProvider client={qc}>
        <RDDashboard projetId="p1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('Story Points')).toBeInTheDocument();
  });
});
