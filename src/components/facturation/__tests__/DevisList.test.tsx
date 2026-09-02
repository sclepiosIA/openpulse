import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, mockAuthModule } from '@/test-utils/renderWithProviders';
import { DevisList } from '../DevisList';

vi.mock('@/components/AuthProvider', () => mockAuthModule());

vi.mock('@/hooks/contracts/useDevis', () => ({
  useDevis: () => ({
    devis: [
      {
        id: 'd1',
        numero: 'DEV-2026-001',
        client_nom: 'Clinique Pasteur',
        montant_ht: 3000,
        montant_ttc: 3600,
        statut: 'brouillon',
        date_emission: '2026-02-01',
        date_validite: '2026-03-01',
        etablissement: { nom: 'Clinique Pasteur' },
      },
    ],
    deleteDevis: vi.fn(),
    convertToFacture: vi.fn(),
    isDeleting: false,
    isConverting: false,
  }),
  useDevisDetail: () => ({ data: null, isLoading: false }),
}));

describe('DevisList', () => {
  it('renders search input', () => {
    renderWithProviders(<DevisList onCreateNew={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Rechercher/)).toBeInTheDocument();
  });

  it('renders devis number', () => {
    renderWithProviders(<DevisList onCreateNew={vi.fn()} />);
    expect(screen.getByText('DEV-2026-001')).toBeInTheDocument();
  });

  it('renders create button', () => {
    renderWithProviders(<DevisList onCreateNew={vi.fn()} />);
    expect(screen.getByText('Nouveau devis')).toBeInTheDocument();
  });
});
