import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SortMenu } from '@/components/etablissement/SortMenu';

describe('SortMenu', () => {
  it('should render sort button', () => {
    render(<SortMenu sortField="nom" sortDirection="asc" onSortChange={vi.fn()} />);
    expect(screen.getByText('Nom (A-Z)')).toBeInTheDocument();
  });

  it('should open popover on click and show options', async () => {
    render(<SortMenu sortField="nom" sortDirection="asc" onSortChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Nom (A-Z)'));
    // Popover should show other sort options
    expect(await screen.findByText('Nom (Z-A)')).toBeInTheDocument();
    expect(screen.getByText('Plus récents')).toBeInTheDocument();
    expect(screen.getByText('Progression ↓')).toBeInTheDocument();
  });

  it('should call onSortChange when option clicked', async () => {
    const onChange = vi.fn();
    render(<SortMenu sortField="nom" sortDirection="asc" onSortChange={onChange} />);
    fireEvent.click(screen.getByText('Nom (A-Z)'));
    fireEvent.click(await screen.findByText('Plus récents'));
    expect(onChange).toHaveBeenCalledWith('date_creation', 'desc');
  });
});
