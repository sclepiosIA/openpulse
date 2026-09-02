import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityCard } from '../ActivityCard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );

describe('ActivityCard', () => {
  const activity = {
    id: 'a1',
    etablissementId: 'e1',
    etablissementNom: 'CHU Lyon',
    etablissementLogo: null,
    statut: 'Production',
    type: 'task_completed' as const,
    description: 'Tâche X terminée',
    timestamp: new Date().toISOString(),
    priority: 'high' as const,
    userName: 'Jean',
    tasksCompleted: 5,
    tasksPending: 2,
    tasksUrgent: 1,
  };

  it('renders etablissement name', () => {
    wrap(<ActivityCard activity={activity} />);
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument();
  });

  it('renders description', () => {
    wrap(<ActivityCard activity={activity} />);
    expect(screen.getByText('Tâche X terminée')).toBeInTheDocument();
  });

  it('shows statut badge', () => {
    wrap(<ActivityCard activity={activity} />);
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('shows user name', () => {
    wrap(<ActivityCard activity={activity} />);
    expect(screen.getByText(/Jean/)).toBeInTheDocument();
  });

  it('shows task metrics', () => {
    wrap(<ActivityCard activity={activity} />);
    expect(screen.getByText(/5 terminées/)).toBeInTheDocument();
    expect(screen.getByText(/1 urgentes/)).toBeInTheDocument();
  });

  it('renders type label', () => {
    wrap(<ActivityCard activity={activity} />);
    expect(screen.getByText('Tâche terminée')).toBeInTheDocument();
  });

  it('has accessible role button', () => {
    wrap(<ActivityCard activity={activity} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
