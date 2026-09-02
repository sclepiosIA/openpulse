import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EtablissementStatsKPIs } from '../EtablissementStatsKPIs';

describe('EtablissementStatsKPIs', () => {
  const etablissements = [
    { id: 'e1', nom: 'CHU Lyon', statut: 'Production' },
    { id: 'e2', nom: 'CHU Bordeaux', statut: 'Prospect' },
    { id: 'e3', nom: 'CHU Paris', statut: 'Déploiement' },
  ] as any[];

  it('renders KPI labels', () => {
    render(<EtablissementStatsKPIs etablissements={etablissements} totalEtablissements={3} />);
    expect(screen.getByText('Établissements')).toBeInTheDocument();
    expect(screen.getByText('Taux conversion')).toBeInTheDocument();
    expect(screen.getByText('En déploiement')).toBeInTheDocument();
    expect(screen.getByText('Échéances 30j')).toBeInTheDocument();
  });

  it('renders total count', () => {
    render(<EtablissementStatsKPIs etablissements={etablissements} totalEtablissements={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders with empty etablissements', () => {
    render(<EtablissementStatsKPIs etablissements={[]} totalEtablissements={0} />);
    expect(screen.getByText('Établissements')).toBeInTheDocument();
  });
});
