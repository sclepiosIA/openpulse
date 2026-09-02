import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RapportsControlsCompact } from '../RapportsControlsCompact';

describe('RapportsControlsCompact', () => {
  const baseProps = {
    activeView: 'table',
    period: 'month',
    onViewChange: vi.fn(),
    onPeriodChange: vi.fn(),
  };

  beforeEach(() => {
    baseProps.onViewChange.mockClear();
    baseProps.onPeriodChange.mockClear();
  });

  it('renders the 5 view buttons with titles', () => {
    render(<RapportsControlsCompact {...baseProps} />);
    ['Tableau', 'Cartes', 'Carte', 'Barres', 'Camembert'].forEach((label) => {
      expect(screen.getByTitle(label)).toBeInTheDocument();
    });
  });

  it('clicking a view button triggers onViewChange with its id', async () => {
    const user = userEvent.setup();
    render(<RapportsControlsCompact {...baseProps} />);
    await user.click(screen.getByTitle('Cartes'));
    expect(baseProps.onViewChange).toHaveBeenCalledWith('cards');
  });

  it('renders the Filters button only when onFiltersClick is provided, with aria-pressed reflecting hasActiveFilters', async () => {
    const onFiltersClick = vi.fn();
    const { rerender } = render(
      <RapportsControlsCompact {...baseProps} onFiltersClick={onFiltersClick} hasActiveFilters />
    );
    const filterBtn = screen.getByRole('button', { name: /Filtres actifs/i });
    expect(filterBtn).toHaveAttribute('aria-pressed', 'true');
    await userEvent.setup().click(filterBtn);
    expect(onFiltersClick).toHaveBeenCalledTimes(1);

    rerender(<RapportsControlsCompact {...baseProps} />);
    expect(screen.queryByRole('button', { name: /Filtres? actifs?|Filtrer/i })).not.toBeInTheDocument();
  });
});
