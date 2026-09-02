import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/config/phases', () => ({
  getGeoPhaseFromStatus: (s: string) => {
    if (s === 'Production' || s === 'Go-Live') return 'production';
    if (s === 'Déploiement' || s === 'Formation' || s === 'Conformité' || s === 'Contractuel') return 'deploiement';
    return 'prospects';
  },
}));

import { GeographicStatsHeader } from '../GeographicStatsHeader';

const etabs = [
  { id: '1', statut: 'Production', region: 'IDF' },
  { id: '2', statut: 'Prospect', region: 'PACA' },
  { id: '3', statut: 'Déploiement', region: 'IDF' },
];

describe('GeographicStatsHeader', () => {
  it('renders total count', () => {
    render(
      <GeographicStatsHeader
        etablissements={etabs}
        filteredEtablissements={etabs}
        mapFilter="all"
        selectedRegion={null}
        onFilterChange={vi.fn()}
        onClearRegion={vi.fn()}
      />
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders phase filter buttons', () => {
    render(
      <GeographicStatsHeader
        etablissements={etabs}
        filteredEtablissements={etabs}
        mapFilter="all"
        selectedRegion={null}
        onFilterChange={vi.fn()}
        onClearRegion={vi.fn()}
      />
    );
    expect(screen.getByText('Prospects')).toBeInTheDocument();
    expect(screen.getByText('Déploiement')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('calls onFilterChange when clicking phase', () => {
    const onFilterChange = vi.fn();
    render(
      <GeographicStatsHeader
        etablissements={etabs}
        filteredEtablissements={etabs}
        mapFilter="all"
        selectedRegion={null}
        onFilterChange={onFilterChange}
        onClearRegion={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Production'));
    expect(onFilterChange).toHaveBeenCalledWith('production');
  });
});
