import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProspectsMobileCard } from '../ProspectsMobileCard';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const prospect = {
  id: 'p1',
  nom: 'Hôpital Test',
  statut: 'Prospect',
  ville: 'Paris',
  commercial: { prenom: 'Jean', nom: 'Dupont' },
} as any;

const progressInfo = {
  progress: 45,
  totalTasks: 10,
  completedTasks: 4,
  potentialValue: 50000,
};

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );

describe('ProspectsMobileCard', () => {
  it('renders prospect name', () => {
    wrap(
      <ProspectsMobileCard
        prospect={prospect}
        progressInfo={progressInfo}
        isSelected={false}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('Hôpital Test')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    wrap(
      <ProspectsMobileCard
        prospect={prospect}
        progressInfo={progressInfo}
        isSelected={false}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('Prospect')).toBeInTheDocument();
  });

  it('renders ville', () => {
    wrap(
      <ProspectsMobileCard
        prospect={prospect}
        progressInfo={progressInfo}
        isSelected={false}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('Paris')).toBeInTheDocument();
  });

  it('renders progress percentage', () => {
    wrap(
      <ProspectsMobileCard
        prospect={prospect}
        progressInfo={progressInfo}
        isSelected={false}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('renders commercial name', () => {
    wrap(
      <ProspectsMobileCard
        prospect={prospect}
        progressInfo={progressInfo}
        isSelected={false}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
  });
});
