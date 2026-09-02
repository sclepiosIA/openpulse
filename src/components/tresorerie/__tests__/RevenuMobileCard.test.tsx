import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RevenuMobileCard } from '../RevenuMobileCard';

const baseRevenu = {
  id: 'r1',
  mois: '2026-03',
  date_prevue: '2026-03-15',
  montant_prevu: 5000,
  notes: 'Abonnement mensuel',
  categorie_label: 'Abonnements',
};

describe('RevenuMobileCard', () => {
  it('renders montant formatted', () => {
    render(<RevenuMobileCard revenu={baseRevenu} />);
    expect(screen.getByText(/5\s*000/)).toBeInTheDocument();
  });

  it('renders categorie label', () => {
    render(<RevenuMobileCard revenu={baseRevenu} />);
    expect(screen.getByText('Abonnements')).toBeInTheDocument();
  });

  it('renders notes', () => {
    render(<RevenuMobileCard revenu={baseRevenu} />);
    expect(screen.getByText('Abonnement mensuel')).toBeInTheDocument();
  });

  it('renders date from date_prevue', () => {
    render(<RevenuMobileCard revenu={baseRevenu} />);
    expect(screen.getByText('15/03/2026')).toBeInTheDocument();
  });

  it('renders date from mois when no date_prevue', () => {
    render(<RevenuMobileCard revenu={{ ...baseRevenu, date_prevue: null }} />);
    expect(screen.getByText('01/03/2026')).toBeInTheDocument();
  });

  it('hides dropdown when no handlers', () => {
    const { container } = render(<RevenuMobileCard revenu={baseRevenu} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
