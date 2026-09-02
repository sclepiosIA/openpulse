import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeploymentHeroMetrics } from '../DeploymentHeroMetrics';

describe('DeploymentHeroMetrics', () => {
  const etablissements = [
    { id: 'e1', nom: 'CHU Lyon', statut: 'Contractuel' },
    { id: 'e2', nom: 'CHU Paris', statut: 'Déploiement' },
    { id: 'e3', nom: 'CHU Bordeaux', statut: 'Formation' },
  ] as any[];

  const healthScores = new Map<string, any>([
    ['e1', { score: 80, status: 'on_track', reasons: [] }],
    ['e2', { score: 40, status: 'delayed', reasons: ['Retard planning'] }],
    ['e3', { score: 90, status: 'on_track', reasons: [] }],
  ]);

  it('renders total actifs card', () => {
    render(<DeploymentHeroMetrics etablissements={etablissements} healthScores={healthScores} />);
    expect(screen.getByText('Total actifs')).toBeInTheDocument();
  });

  it('renders phase labels', () => {
    render(<DeploymentHeroMetrics etablissements={etablissements} healthScores={healthScores} />);
    expect(screen.getByText('Contractuel')).toBeInTheDocument();
    expect(screen.getByText('Déploiement')).toBeInTheDocument();
  });

  it('renders with empty data', () => {
    render(<DeploymentHeroMetrics etablissements={[]} healthScores={new Map()} />);
    expect(screen.getByText('Total actifs')).toBeInTheDocument();
  });

  it('renders alerts section', () => {
    render(<DeploymentHeroMetrics etablissements={etablissements} healthScores={healthScores} />);
    expect(screen.getByText(/Alertes/i)).toBeInTheDocument();
  });
});
