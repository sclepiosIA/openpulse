import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./GeographicFilters', () => ({
  GeographicFilters: () => <div data-testid="geo-filters" />,
}));

vi.mock('../GeographicFilters', () => ({
  GeographicFilters: () => <div data-testid="geo-filters" />,
}));

vi.mock('@/hooks/geography/useGeographicFilters', () => ({
  useGeographicFilters: () => ({
    filters: {},
    updateFilter: vi.fn(),
    resetFilters: vi.fn(),
    hasActiveFilters: false,
  }),
}));

import { MobileFiltersSheet } from '../MobileFiltersSheet';

describe('MobileFiltersSheet', () => {
  it('renders filter button', () => {
    render(<MobileFiltersSheet onFiltersChange={vi.fn()} activeCount={0} />);
    expect(screen.getByText('Filtres')).toBeInTheDocument();
  });

  it('renders active count badge when > 0', () => {
    render(<MobileFiltersSheet onFiltersChange={vi.fn()} activeCount={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
