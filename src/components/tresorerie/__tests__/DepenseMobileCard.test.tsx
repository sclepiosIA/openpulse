import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DepenseMobileCard } from '../DepenseMobileCard';

const baseDepense = {
  id: 'd1',
  libelle: 'Fournitures bureau',
  montant: 1500,
  date_operation: '2026-02-15',
  categorie: 'Fournitures',
  sous_categorie: null,
  statut: 'realise',
  fournisseur: 'Office Depot',
};

describe('DepenseMobileCard', () => {
  it('renders libelle and montant', () => {
    render(<DepenseMobileCard depense={baseDepense} />);
    expect(screen.getByText('Fournitures bureau')).toBeInTheDocument();
    expect(screen.getByText(/-1\s*500/)).toBeInTheDocument();
  });

  it('renders fournisseur', () => {
    render(<DepenseMobileCard depense={baseDepense} />);
    expect(screen.getByText('Office Depot')).toBeInTheDocument();
  });

  it('renders categorie', () => {
    render(<DepenseMobileCard depense={baseDepense} />);
    expect(screen.getByText('Fournitures')).toBeInTheDocument();
  });

  it('renders statut badge', () => {
    render(<DepenseMobileCard depense={baseDepense} />);
    expect(screen.getByText('Réalisé')).toBeInTheDocument();
  });

  it('renders prevu statut', () => {
    render(<DepenseMobileCard depense={{ ...baseDepense, statut: 'prevu' }} />);
    expect(screen.getByText('Prévu')).toBeInTheDocument();
  });

  it('applies overdue style for past prevu depenses', () => {
    const { container } = render(
      <DepenseMobileCard depense={{ ...baseDepense, statut: 'prevu', date_operation: '2024-01-01' }} />
    );
    expect(container.querySelector('.border-l-red-500')).toBeInTheDocument();
  });

  it('renders date', () => {
    render(<DepenseMobileCard depense={baseDepense} />);
    expect(screen.getByText(/15 févr/i)).toBeInTheDocument();
  });
});
