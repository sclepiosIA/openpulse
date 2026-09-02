import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EnhancedEtablissementCard } from '../EnhancedEtablissementCard';

vi.mock('@/hooks/shared/useSmartNavigation', () => ({
  useSmartNavigation: () => ({
    smartNavigate: vi.fn(),
    navigate: vi.fn(),
  }),
}));

const etablissement = {
  id: 'etab1',
  nom: 'CHU Test',
  statut: 'Production',
  region: 'Île-de-France',
  type: 'CHU',
  ville: 'Paris',
  progression: 75,
  commercial_id: null,
  ca_potentiel: 50000,
  offre: 'Standard',
  type_offre: 'Licence',
  groupe_id: null,
  groupe_nom: null,
  groupe_logo_url: null,
} as any;

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('EnhancedEtablissementCard', () => {
  const renderCard = (props = {}) =>
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <TooltipProvider>
            <EnhancedEtablissementCard etablissement={etablissement} {...props} />
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders establishment name', () => {
    renderCard();
    expect(screen.getByText('CHU Test')).toBeInTheDocument();
  });

  it('renders statut badge', () => {
    renderCard();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('renders ville', () => {
    renderCard();
    expect(screen.getByText(/Paris/)).toBeInTheDocument();
  });

  it('renders container', () => {
    const { container } = renderCard();
    expect(container.firstChild).toBeInTheDocument();
  });
});
