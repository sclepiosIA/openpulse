import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeploymentFiltersCompact } from '../DeploymentFiltersCompact';

const filterConfigs = [
  { key: 'regions', label: 'Régions', options: [{ value: 'IDF', label: 'Île-de-France' }, { value: 'ARA', label: 'Auvergne-RA' }] },
  { key: 'types', label: 'Types', options: [{ value: 'CHU', label: 'CHU' }] },
];

describe('DeploymentFiltersCompact', () => {
  it('renders filter triggers for each config', () => {
    const { container } = render(
      <DeploymentFiltersCompact filters={{}} onFiltersChange={vi.fn()} filterConfigs={filterConfigs} />
    );
    // Each filter config renders a dropdown trigger (Badge)
    expect(container.querySelectorAll('[data-state]').length).toBeGreaterThanOrEqual(2);
  });

  it('shows active count when filters selected', () => {
    render(
      <DeploymentFiltersCompact 
        filters={{ regions: ['IDF', 'ARA'] }} 
        onFiltersChange={vi.fn()} 
        filterConfigs={filterConfigs} 
      />
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('applies active styling when filter has values', () => {
    const { container } = render(
      <DeploymentFiltersCompact 
        filters={{ regions: ['IDF'] }} 
        onFiltersChange={vi.fn()} 
        filterConfigs={filterConfigs} 
      />
    );
    expect(container.querySelector('.text-primary')).toBeTruthy();
  });
});
