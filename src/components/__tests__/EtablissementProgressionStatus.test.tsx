import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import React from 'react';
import { EtablissementProgressionStatus } from '@/components/etablissement/EtablissementProgressionStatus';

vi.mock('@/config/phases', () => ({
  PHASE_GROUPS: {
    commercial: {
      label: 'Commercial',
      icon: () => React.createElement('span', null, '📋'),
      color: '#3b82f6',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      statuts: ['Prospect', 'Contacté', 'Attente RDV', 'RDV pris'],
    },
    deploiement: {
      label: 'Déploiement',
      icon: () => React.createElement('span', null, '🚀'),
      color: '#f59e0b',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      statuts: ['Contractuel', 'Conformité', 'Déploiement', 'Formation', 'Go-Live'],
    },
    production: {
      label: 'Production',
      icon: () => React.createElement('span', null, '✅'),
      color: '#10b981',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      statuts: ['Production'],
    },
  },
  getPhaseByStatus: (statut: string) => {
    if (['Prospect', 'Contacté', 'Attente RDV', 'RDV pris'].includes(statut)) return 'commercial';
    if (['Contractuel', 'Conformité', 'Déploiement', 'Formation', 'Go-Live'].includes(statut)) return 'deploiement';
    if (statut === 'Production') return 'production';
    return null;
  },
}));

describe('EtablissementProgressionStatus', () => {
  it('should render global progression', () => {
    render(
      <EtablissementProgressionStatus
        statut="Prospect"
        progression={25}
        etablissementId="etab-1"
      />
    );

    expect(screen.getByText('Progression globale')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('should render all 3 phase cards', () => {
    render(
      <EtablissementProgressionStatus
        statut="Contractuel"
        progression={50}
        etablissementId="etab-1"
      />
    );

    expect(screen.getByText('Commercial')).toBeInTheDocument();
    // Phase names also appear as sub-statuses, so use getAllByText
    expect(screen.getAllByText('Déploiement').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Production').length).toBeGreaterThanOrEqual(1);
  });

  it('should show "En cours" badge for current phase', () => {
    render(
      <EtablissementProgressionStatus
        statut="Déploiement"
        progression={60}
        etablissementId="etab-1"
      />
    );

    expect(screen.getByText('En cours')).toBeInTheDocument();
  });

  it('should display tasks breakdown when provided', () => {
    render(
      <EtablissementProgressionStatus
        statut="Contractuel"
        progression={40}
        etablissementId="etab-1"
        tasksBreakdown={{
          commercial: { total: 10, completed: 8 },
          contractuel: { total: 5, completed: 2 },
        }}
      />
    );

    expect(screen.getByText('8/10')).toBeInTheDocument();
  });

  it('should call onPhaseClick when a phase is clicked', () => {
    const onPhaseClick = vi.fn();

    render(
      <EtablissementProgressionStatus
        statut="Prospect"
        progression={10}
        etablissementId="etab-1"
        onPhaseClick={onPhaseClick}
      />
    );

    fireEvent.click(screen.getByText('Commercial'));
    expect(onPhaseClick).toHaveBeenCalledWith('commercial');
  });

  it('should handle 0% progression', () => {
    render(
      <EtablissementProgressionStatus
        statut="Prospect"
        progression={0}
        etablissementId="etab-1"
      />
    );

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should handle 100% progression', () => {
    render(
      <EtablissementProgressionStatus
        statut="Production"
        progression={100}
        etablissementId="etab-1"
      />
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
