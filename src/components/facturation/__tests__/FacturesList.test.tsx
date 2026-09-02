import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, mockAuthModule } from '@/test-utils/renderWithProviders';
import { FacturesList } from '../FacturesList';

vi.mock('@/components/AuthProvider', () => mockAuthModule());

vi.mock('@/hooks/billing/useFactures', () => ({
  useFactures: () => ({
    factures: [
      {
        id: 'f1',
        numero: 'FAC-2026-001',
        client_nom: 'CHU Lyon',
        montant_ht: 5000,
        montant_ttc: 6000,
        statut: 'brouillon',
        date_emission: '2026-01-15',
        date_echeance: '2026-02-15',
        etablissement: { nom: 'CHU Lyon' },
      },
    ],
    deleteFacture: vi.fn(),
    isDeleting: false,
  }),
  useFactureDetail: () => ({ data: null, isLoading: false }),
}));

describe('FacturesList', () => {
  it('renders search input', () => {
    renderWithProviders(<FacturesList onCreateNew={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Rechercher/)).toBeInTheDocument();
  });

  it('renders facture number', () => {
    renderWithProviders(<FacturesList onCreateNew={vi.fn()} />);
    expect(screen.getByText('FAC-2026-001')).toBeInTheDocument();
  });

  it('renders create button', () => {
    renderWithProviders(<FacturesList onCreateNew={vi.fn()} />);
    expect(screen.getByText('Nouvelle facture')).toBeInTheDocument();
  });
});
