import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EnrichedDeploymentCard } from '../EnrichedDeploymentCard';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const etablissement = {
  id: 'e1',
  nom: 'CHU Bordeaux',
  statut: 'Déploiement',
  type: 'CHU',
  ville: 'Bordeaux',
  region: 'Nouvelle-Aquitaine',
  progression: 60,
  commercial_id: null,
  ca_potentiel: 30000,
  logo_url: null,
} as any;

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TooltipProvider>{ui}</TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('EnrichedDeploymentCard', () => {
  it('renders establishment name', () => {
    wrap(<EnrichedDeploymentCard etablissement={etablissement} />);
    expect(screen.getByText('CHU Bordeaux')).toBeInTheDocument();
  });

  it('renders statut badge', () => {
    wrap(<EnrichedDeploymentCard etablissement={etablissement} />);
    expect(screen.getByText('Déploiement')).toBeInTheDocument();
  });

  it('renders ville', () => {
    wrap(<EnrichedDeploymentCard etablissement={etablissement} />);
    expect(screen.getByText(/Bordeaux/)).toBeInTheDocument();
  });

  it('renders checkbox when onSelectionChange provided', () => {
    wrap(<EnrichedDeploymentCard etablissement={etablissement} onSelectionChange={vi.fn()} />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('does not render checkbox by default', () => {
    wrap(<EnrichedDeploymentCard etablissement={etablissement} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
