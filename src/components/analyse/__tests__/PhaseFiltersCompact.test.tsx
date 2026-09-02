import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhaseFiltersCompact } from '../PhaseFiltersCompact';

const baseCounts = { all: 100, prospects: 40, deploiement: 35, production: 25 };

describe('PhaseFiltersCompact', () => {
  it('renders all filter buttons with counts', () => {
    render(<PhaseFiltersCompact mapFilter="all" onFilterChange={vi.fn()} counts={baseCounts} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('calls onFilterChange when clicked', () => {
    const onChange = vi.fn();
    render(<PhaseFiltersCompact mapFilter="all" onFilterChange={onChange} counts={baseCounts} />);
    fireEvent.click(screen.getByText('40')); // prospects count
    expect(onChange).toHaveBeenCalledWith('prospects');
  });

  it('highlights active filter', () => {
    const { container } = render(
      <PhaseFiltersCompact mapFilter="deploiement" onFilterChange={vi.fn()} counts={baseCounts} />
    );
    const buttons = container.querySelectorAll('button');
    const deplBtn = Array.from(buttons).find(b => b.textContent?.includes('35'));
    expect(deplBtn?.className).toContain('bg-blue-500');
  });

  it('shows region badge when selected', () => {
    render(
      <PhaseFiltersCompact
        mapFilter="all"
        onFilterChange={vi.fn()}
        counts={baseCounts}
        selectedRegion="Île-de-France"
        onClearRegion={vi.fn()}
      />
    );
    expect(screen.getByText('Île-de-France')).toBeInTheDocument();
  });

  it('calls onClearRegion when badge clicked', () => {
    const onClear = vi.fn();
    render(
      <PhaseFiltersCompact
        mapFilter="all"
        onFilterChange={vi.fn()}
        counts={baseCounts}
        selectedRegion="PACA"
        onClearRegion={onClear}
      />
    );
    fireEvent.click(screen.getByText('PACA'));
    expect(onClear).toHaveBeenCalled();
  });

  it('hides region badge when no region selected', () => {
    render(
      <PhaseFiltersCompact mapFilter="all" onFilterChange={vi.fn()} counts={baseCounts} />
    );
    expect(screen.queryByText('Île-de-France')).toBeNull();
  });
});
