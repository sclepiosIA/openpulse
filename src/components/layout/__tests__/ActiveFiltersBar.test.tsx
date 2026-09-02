import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActiveFiltersBar } from '../ActiveFiltersBar';

describe('ActiveFiltersBar', () => {
  const filters = [
    { key: 'statut', label: 'Statut', value: 'Production', onRemove: vi.fn() },
    { key: 'region', label: 'Région', value: 'Île-de-France', onRemove: vi.fn() },
  ];

  it('renders nothing when no filters', () => {
    const { container } = render(<ActiveFiltersBar filters={[]} onClearAll={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders active filters', () => {
    render(<ActiveFiltersBar filters={filters} onClearAll={vi.fn()} />);
    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(screen.getByText('Île-de-France')).toBeInTheDocument();
  });

  it('renders filter labels', () => {
    render(<ActiveFiltersBar filters={filters} onClearAll={vi.fn()} />);
    expect(screen.getByText('Statut:')).toBeInTheDocument();
    expect(screen.getByText('Région:')).toBeInTheDocument();
  });

  it('shows clear all button when multiple filters', () => {
    render(<ActiveFiltersBar filters={filters} onClearAll={vi.fn()} />);
    expect(screen.getByText('Tout effacer')).toBeInTheDocument();
  });

  it('calls onClearAll when clicking clear all', () => {
    const onClearAll = vi.fn();
    render(<ActiveFiltersBar filters={filters} onClearAll={onClearAll} />);
    fireEvent.click(screen.getByText('Tout effacer'));
    expect(onClearAll).toHaveBeenCalled();
  });

  it('hides clear all with single filter', () => {
    render(<ActiveFiltersBar filters={[filters[0]]} onClearAll={vi.fn()} />);
    expect(screen.queryByText('Tout effacer')).not.toBeInTheDocument();
  });
});
