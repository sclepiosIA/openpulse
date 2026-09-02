import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContratMobileCard } from '../ContratMobileCard';

describe('ContratMobileCard', () => {
  const contrat = {
    id: 'c1',
    numero: 'CTR-001',
    titre: 'Contrat de maintenance',
    client_nom: 'CHU Lyon',
    montant_annuel: 24000,
    date_debut: '2026-01-01',
    date_fin: '2027-01-01',
    statut: 'actif',
    type_contrat: 'maintenance',
    etablissement: { nom: 'Hôpital Nord' },
  };

  it('renders numero and titre', () => {
    render(<ContratMobileCard contrat={contrat} />);
    expect(screen.getByText('CTR-001')).toBeInTheDocument();
    expect(screen.getByText('Contrat de maintenance')).toBeInTheDocument();
  });

  it('renders client and etablissement', () => {
    render(<ContratMobileCard contrat={contrat} />);
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument();
    expect(screen.getByText('Hôpital Nord')).toBeInTheDocument();
  });

  it('renders formatted montant', () => {
    render(<ContratMobileCard contrat={contrat} />);
    expect(screen.getByText(/24[\s\u202f]?000/)).toBeInTheDocument();
  });

  it('renders statut badge', () => {
    render(<ContratMobileCard contrat={contrat} />);
    expect(screen.getByText('Actif')).toBeInTheDocument();
  });

  it('renders type badge', () => {
    render(<ContratMobileCard contrat={contrat} />);
    expect(screen.getByText('maintenance')).toBeInTheDocument();
  });

  it('renders brouillon label', () => {
    render(<ContratMobileCard contrat={{ ...contrat, statut: 'brouillon' }} />);
    expect(screen.getByText('Brouillon')).toBeInTheDocument();
  });

  it('highlights expiring soon contracts', () => {
    const expiring = {
      ...contrat,
      date_fin: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const { container } = render(<ContratMobileCard contrat={expiring} />);
    expect(container.querySelector('.border-l-amber-500')).toBeTruthy();
  });
});
