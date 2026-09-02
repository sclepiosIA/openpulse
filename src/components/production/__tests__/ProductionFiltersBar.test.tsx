import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/crm/useCustomerHealth', () => ({
  getHealthLabel: (s: string) => s,
  getHealthIcon: () => 'heart',
}));

vi.mock('@/lib/productionUtils', () => ({
  DURATION_OPTIONS: [],
  ADOPTION_OPTIONS: [],
  NPS_OPTIONS: [],
  SUPPORT_OPTIONS: [],
  RENEWAL_OPTIONS: [],
}));

import { ProductionFiltersBar } from '../ProductionFiltersBar';

const defaultFilters = {
  search: '',
  regions: [],
  types: [],
  healthStatuses: [],
  csmIds: [],
  durationRanges: [],
  adoptionRanges: [],
  npsRanges: [],
  supportLevels: [],
  renewalPeriods: [],
};

const sortConfig = { field: 'nom' as any, direction: 'asc' as any };

describe('ProductionFiltersBar', () => {
  it('renders search input', () => {
    render(
      <ProductionFiltersBar
        filters={defaultFilters as any}
        onFiltersChange={vi.fn()}
        sortConfig={sortConfig}
        onSortChange={vi.fn()}
        availableRegions={['IDF', 'PACA']}
        availableTypes={['CH', 'CHU']}
        availableCsms={[{ id: 'u1', name: 'Jean Dupont' }]}
      />
    );
    expect(screen.getByPlaceholderText(/Rechercher/i)).toBeInTheDocument();
  });
});
