import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ActivityCard, Activity } from '@/components/dashboard/ActivityCard';

vi.mock('@/hooks/profile/useProfileAvatarByEmail', () => ({
  useProfileAvatarByEmail: () => ({ data: null }),
}));

describe('ActivityCard', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  
  const baseActivity: Activity = {
    id: 'act-1',
    etablissementId: 'e1',
    etablissementNom: 'Hôpital Test',
    statut: 'Prospect',
    type: 'task_completed',
    description: 'La tâche X a été terminée',
    timestamp: new Date().toISOString(),
    priority: 'medium',
  };

  const renderCard = (activity: Activity = baseActivity) =>
    render(
      React.createElement(QueryClientProvider, { client: qc },
        React.createElement(MemoryRouter, null,
          React.createElement(ActivityCard, { activity, index: 0 })
        )
      )
    );

  it('should render etablissement name', () => {
    renderCard();
    expect(screen.getByText('Hôpital Test')).toBeInTheDocument();
  });

  it('should render activity description', () => {
    renderCard();
    expect(screen.getByText('La tâche X a été terminée')).toBeInTheDocument();
  });

  it('should render critical priority', () => {
    renderCard({ ...baseActivity, priority: 'critical' });
    expect(screen.getByText('Hôpital Test')).toBeInTheDocument();
  });

  it('should render high priority', () => {
    renderCard({ ...baseActivity, priority: 'high' });
    expect(screen.getByText('Hôpital Test')).toBeInTheDocument();
  });

  it('should render low priority', () => {
    renderCard({ ...baseActivity, priority: 'low' });
    expect(screen.getByText('Hôpital Test')).toBeInTheDocument();
  });
});
