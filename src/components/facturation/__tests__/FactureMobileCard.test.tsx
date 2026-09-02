import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FactureMobileCard } from '../FactureMobileCard';

vi.mock('@/lib/formatters', () => ({
  formatCurrency: (v: number) => `${v.toLocaleString('fr-FR')} €`,
}));

vi.mock('@/lib/tresorerie-labels', () => ({
  STATUT_FACTURE_LABELS: {
    brouillon: 'Brouillon',
    envoyee: 'Envoyée',
    payee: 'Payée',
    en_retard: 'En retard',
  },
  STATUT_FACTURE_COLORS: {
    brouillon: 'bg-gray-100 text-gray-700',
    envoyee: 'bg-blue-100 text-blue-700',
    payee: 'bg-green-100 text-green-700',
    en_retard: 'bg-red-100 text-red-700',
  },
}));

const baseFacture = {
  id: 'f1',
  numero: 'FAC-2026-001',
  client_nom: 'CHU Lyon',
  montant_ttc: 15000,
  date_emission: '2026-02-01',
  date_echeance: '2026-03-01',
  statut: 'envoyee',
  etablissement: { nom: 'CHU Lyon Sud' },
};

describe('FactureMobileCard', () => {
  it('renders facture numero', () => {
    render(<FactureMobileCard facture={baseFacture} />);
    expect(screen.getByText('FAC-2026-001')).toBeInTheDocument();
  });

  it('renders client name', () => {
    render(<FactureMobileCard facture={baseFacture} />);
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument();
  });

  it('renders montant', () => {
    render(<FactureMobileCard facture={baseFacture} />);
    expect(screen.getByText('15 000 €')).toBeInTheDocument();
  });

  it('renders statut badge', () => {
    render(<FactureMobileCard facture={baseFacture} />);
    expect(screen.getByText('Envoyée')).toBeInTheDocument();
  });

  it('renders etablissement name', () => {
    render(<FactureMobileCard facture={baseFacture} />);
    expect(screen.getByText('CHU Lyon Sud')).toBeInTheDocument();
  });

  it('renders overdue indicator for past due factures', () => {
    const overdue = { ...baseFacture, date_echeance: '2025-01-01', statut: 'envoyee' };
    const { container } = render(<FactureMobileCard facture={overdue} />);
    expect(container.querySelector('.border-l-red-500')).toBeTruthy();
  });

  it('does not show overdue for paid factures', () => {
    const paid = { ...baseFacture, date_echeance: '2025-01-01', statut: 'payee' };
    const { container } = render(<FactureMobileCard facture={paid} />);
    expect(container.querySelector('.border-l-red-500')).toBeNull();
  });
});
