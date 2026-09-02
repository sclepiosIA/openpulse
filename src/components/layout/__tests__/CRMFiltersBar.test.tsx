import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CRMFiltersBar } from '../CRMFiltersBar';

describe('CRMFiltersBar', () => {
  const filterConfigs = [
    { key: 'statut', label: 'Statut', options: [{ value: 'actif', label: 'Actif' }] },
    { key: 'type', label: 'Type', options: [{ value: 'chu', label: 'CHU' }] },
  ];

  const defaultProps = {
    filters: {} as Record<string, string[]>,
    filterConfigs,
    onFiltersChange: vi.fn(),
  };

  it('renders search input when provided', () => {
    render(<CRMFiltersBar {...defaultProps} searchValue="" onSearchChange={vi.fn()} searchPlaceholder="Rechercher..." />);
    expect(screen.getByPlaceholderText('Rechercher...')).toBeInTheDocument();
  });

  it('renders filter buttons', () => {
    render(<CRMFiltersBar {...defaultProps} />);
    expect(screen.getByText('Statut')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('renders without search', () => {
    const { container } = render(<CRMFiltersBar {...defaultProps} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
