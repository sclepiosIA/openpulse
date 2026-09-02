import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, mockAuthModule } from '@/test-utils/renderWithProviders';
import { PaiementDialog } from '../PaiementDialog';

vi.mock('@/components/AuthProvider', () => mockAuthModule());
vi.mock('@/hooks/billing/useFactures', () => ({
  useFactureDetail: () => ({
    data: { id: 'f1', numero: 'FAC-001', montant_ttc: 1000, montant_paye: 0, statut: 'envoyee' },
    isLoading: false,
  }),
  useFactures: () => ({
    addPaiement: vi.fn(),
    isAddingPaiement: false,
    updateFacture: vi.fn(),
  }),
}));

describe('PaiementDialog', () => {
  it('renders dialog title when open', () => {
    renderWithProviders(<PaiementDialog factureId="f1" open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Enregistrer un paiement')).toBeInTheDocument();
  });

  it('renders montant field', () => {
    renderWithProviders(<PaiementDialog factureId="f1" open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByLabelText(/Montant/)).toBeInTheDocument();
  });

  it('renders cancel button', () => {
    renderWithProviders(<PaiementDialog factureId="f1" open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderWithProviders(<PaiementDialog factureId="f1" open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('Enregistrer un paiement')).not.toBeInTheDocument();
  });
});
