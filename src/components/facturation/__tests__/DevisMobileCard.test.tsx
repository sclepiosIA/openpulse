import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DevisMobileCard } from '../DevisMobileCard';

const baseDevis = {
  id: 'd1',
  numero: 'DEV-2026-001',
  client_nom: 'Clinique Saint-Jean',
  montant_ttc: 8500,
  date_emission: '2026-02-15',
  date_validite: '2026-04-15',
  statut: 'envoye',
  etablissement: { nom: 'CHU Marseille' },
};

describe('DevisMobileCard', () => {
  it('renders devis numero', () => {
    render(<DevisMobileCard devis={baseDevis} />);
    expect(screen.getByText('DEV-2026-001')).toBeInTheDocument();
  });

  it('renders client name', () => {
    render(<DevisMobileCard devis={baseDevis} />);
    expect(screen.getByText('Clinique Saint-Jean')).toBeInTheDocument();
  });

  it('renders montant formatted', () => {
    render(<DevisMobileCard devis={baseDevis} />);
    // Intl.NumberFormat('fr-FR', EUR) → "8 500 €" (no decimals)
    expect(screen.getByText(/8[\s\u202f]500/)).toBeInTheDocument();
  });

  it('renders statut badge', () => {
    render(<DevisMobileCard devis={baseDevis} />);
    expect(screen.getByText('Envoyé')).toBeInTheDocument();
  });

  it('renders etablissement', () => {
    render(<DevisMobileCard devis={baseDevis} />);
    expect(screen.getByText('CHU Marseille')).toBeInTheDocument();
  });

  it('shows expired border for expired devis', () => {
    const expired = { ...baseDevis, date_validite: '2025-01-01', statut: 'envoye' };
    const { container } = render(<DevisMobileCard devis={expired} />);
    expect(container.querySelector('.border-l-amber-500')).toBeTruthy();
  });

  it('shows Accepté status', () => {
    render(<DevisMobileCard devis={{ ...baseDevis, statut: 'accepte' }} />);
    expect(screen.getByText('Accepté')).toBeInTheDocument();
  });

  it('shows Brouillon status', () => {
    render(<DevisMobileCard devis={{ ...baseDevis, statut: 'brouillon' }} />);
    expect(screen.getByText('Brouillon')).toBeInTheDocument();
  });
});
