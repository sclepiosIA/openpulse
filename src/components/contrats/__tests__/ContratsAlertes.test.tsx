import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ContratsAlertes from '@/components/contrats/ContratsAlertes';

vi.mock('@/hooks/contracts/useContrats', () => ({
  useContratAlertes: vi.fn(),
  useTraiterAlerte: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { useContratAlertes } from '@/hooks/contracts/useContrats';

describe('ContratsAlertes', () => {
  it('should show loading state', () => {
    (useContratAlertes as any).mockReturnValue({ data: null, isLoading: true });
    render(<ContratsAlertes />);
    expect(screen.getByText('Alertes et échéances')).toBeInTheDocument();
  });

  it('should show empty state', () => {
    (useContratAlertes as any).mockReturnValue({ data: [], isLoading: false });
    render(<ContratsAlertes />);
    expect(screen.getByText('Aucune alerte en attente')).toBeInTheDocument();
  });

  it('should render alerts grouped by urgency', () => {
    const today = new Date();
    const pastDate = new Date(today.getTime() - 3 * 86400000).toISOString();
    const soonDate = new Date(today.getTime() + 3 * 86400000).toISOString();
    
    (useContratAlertes as any).mockReturnValue({
      data: [
        { id: '1', titre: 'Alerte passée', type: 'echeance', date_alerte: pastDate, est_traitee: false },
        { id: '2', titre: 'Alerte proche', type: 'renouvellement', date_alerte: soonDate, est_traitee: false },
      ],
      isLoading: false,
    });
    render(<ContratsAlertes />);
    expect(screen.getByText('Alerte passée')).toBeInTheDocument();
    expect(screen.getByText('Alerte proche')).toBeInTheDocument();
  });

  it('should render alert type badge', () => {
    const futureDate = new Date(Date.now() + 86400000 * 2).toISOString();
    (useContratAlertes as any).mockReturnValue({
      data: [
        { id: '1', titre: 'Renouvellement', type: 'renouvellement', date_alerte: futureDate, est_traitee: false },
      ],
      isLoading: false,
    });
    render(<ContratsAlertes />);
    expect(screen.getByText('renouvellement')).toBeInTheDocument();
  });

  it('should render traiter button for non-treated alerts', () => {
    const futureDate = new Date(Date.now() + 86400000 * 2).toISOString();
    (useContratAlertes as any).mockReturnValue({
      data: [
        { id: '1', titre: 'Test', type: 'echeance', date_alerte: futureDate, est_traitee: false },
      ],
      isLoading: false,
    });
    render(<ContratsAlertes />);
    expect(screen.getByText('Traiter')).toBeInTheDocument();
  });
});
