import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeploymentMobileCard } from '../DeploymentMobileCard';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/production/useDeploymentHealth', () => ({
  getHealthIcon: (s: string) => s === 'healthy' ? '🟢' : '🔴',
  getHealthBadgeColor: () => 'text-green-500',
  getHealthLabel: (s: string) => s === 'healthy' ? 'Sain' : 'Risque',
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const baseEtab = {
  id: 'e1',
  nom: 'CHU Bordeaux',
  type: 'CHU',
  ville: 'Bordeaux',
  statut: 'Déploiement',
  progression: 65,
  date_signature: '2026-01-15',
  logo_url: null,
};

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );

describe('DeploymentMobileCard', () => {
  it('renders etablissement name', () => {
    wrap(<DeploymentMobileCard etablissement={baseEtab as any} health={undefined} />);
    expect(screen.getByText('CHU Bordeaux')).toBeInTheDocument();
  });

  it('renders type and ville', () => {
    wrap(<DeploymentMobileCard etablissement={baseEtab as any} health={undefined} />);
    expect(screen.getByText('CHU • Bordeaux')).toBeInTheDocument();
  });

  it('renders statut badge', () => {
    wrap(<DeploymentMobileCard etablissement={baseEtab as any} health={undefined} />);
    expect(screen.getByText('Déploiement')).toBeInTheDocument();
  });

  it('renders progression percentage', () => {
    wrap(<DeploymentMobileCard etablissement={baseEtab as any} health={undefined} />);
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('renders date signature', () => {
    wrap(<DeploymentMobileCard etablissement={baseEtab as any} health={undefined} />);
    expect(screen.getByText('15/01')).toBeInTheDocument();
  });

  it('renders health badge when provided', () => {
    const health = { status: 'healthy', score: 90, details: {} };
    wrap(<DeploymentMobileCard etablissement={baseEtab as any} health={health as any} />);
    expect(screen.getByText('🟢')).toBeInTheDocument();
  });
});
