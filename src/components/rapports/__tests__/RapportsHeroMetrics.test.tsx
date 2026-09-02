import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/analytics/useDrilldown', () => ({
  useDrilldown: () => ({
    drillDown: vi.fn(),
    breadcrumbs: [{ label: 'Global', level: 0 }],
    goToLevel: vi.fn(),
    resetDrilldown: vi.fn(),
    drilldownTo: vi.fn(),
  }),
}));

import { RapportsHeroMetrics } from '../RapportsHeroMetrics';

const stats = {
  totalEtablissements: 25,
  prospects: 8,
  enProduction: 15,
  enDeploiement: 5,
  totalTaches: 100,
  tachesTerminees: 60,
  progressionMoyenne: 72,
  totalPassages: 5000,
  totalValeur: 150000,
  caRealise: 120000,
  caPrevisionnel: 180000,
  tauxConversion: 45,
  pipelineValue: 300000,
  passagesProduction: 3000,
  partMarcheActuelle: 12,
  partMarchePotentielle: 25,
  passagesRestants: 2000,
  potentielMarcheRestant: 500000,
  passagesNationaux: 50000,
};

describe('RapportsHeroMetrics', () => {
  it('renders the 10 metric titles', () => {
    render(<RapportsHeroMetrics stats={stats} />);
    [
      'Total Établissements',
      'CA Réalisé',
      'CA Prévisionnel',
      'Taux de Conversion',
      'Pipeline Value',
      'Taux de Réalisation',
      'Passages Urgences',
      'Part de Marché Actuelle',
      'Part de Marché Potentielle',
      'En Production',
    ].forEach((title) => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });

  it('renders the tauxConversion as %', () => {
    render(<RapportsHeroMetrics stats={stats} />);
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('computes "Taux de Réalisation" from tachesTerminees / totalTaches', () => {
    render(<RapportsHeroMetrics stats={stats} />);
    // 60/100 = 60%
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('60/100 tâches')).toBeInTheDocument();
  });
});
