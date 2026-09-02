import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CRMToolbar } from '../CRMToolbar';

describe('CRMToolbar', () => {
  it('renders search slot', () => {
    render(<CRMToolbar searchSlot={<input placeholder="Rechercher..." />} />);
    expect(screen.getByPlaceholderText('Rechercher...')).toBeInTheDocument();
  });

  it('renders unified filters mode', () => {
    render(
      <CRMToolbar
        searchSlot={<div>Search</div>}
        unifiedFilters={<div>Filters</div>}
        moreActions={<div>Actions</div>}
      />
    );
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders legacy mode without unified filters', () => {
    render(
      <CRMToolbar
        searchSlot={<div>Search</div>}
        quickFilters={<div>Quick</div>}
        exportButton={<div>Export</div>}
      />
    );
    expect(screen.getByText('Quick')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
  });
});
