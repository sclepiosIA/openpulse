import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProspectsFiltersBar } from '../ProspectsFiltersBar';

const defaultFilters = {
  search: '',
  regions: [],
  types: [],
  statuts: [],
  commercialIds: [],
  progressionRange: [0, 100] as [number, number],
};

describe('ProspectsFiltersBar', () => {
  it('renders filter button', () => {
    render(
      <ProspectsFiltersBar
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        availableRegions={['IDF', 'PACA']}
        availableTypes={['CHU', 'CH']}
        availableStatuts={['Prospect', 'Prospect Actif']}
        availableCommercials={[{ id: 'c1', name: 'Jean' }]}
      />
    );
    expect(screen.getByText(/Filtres/i)).toBeInTheDocument();
  });

  it('shows active filters count', () => {
    const filters = { ...defaultFilters, regions: ['IDF'] };
    render(
      <ProspectsFiltersBar
        filters={filters}
        onFiltersChange={vi.fn()}
        availableRegions={['IDF', 'PACA']}
        availableTypes={[]}
        availableStatuts={[]}
        availableCommercials={[]}
      />
    );
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders compact mode', () => {
    const { container } = render(
      <ProspectsFiltersBar
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        availableRegions={[]}
        availableTypes={[]}
        availableStatuts={[]}
        availableCommercials={[]}
        compact
      />
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
