import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProspectsSortMenu } from '../ProspectsSortMenu';

describe('ProspectsSortMenu', () => {
  const defaultConfig = { field: 'nom' as const, direction: 'asc' as const };

  it('renders sort button with current label', () => {
    render(<ProspectsSortMenu sortConfig={defaultConfig} onSortChange={vi.fn()} />);
    expect(screen.getByText('Nom (A-Z)')).toBeInTheDocument();
  });

  it('renders trigger button with dropdown role', () => {
    render(<ProspectsSortMenu sortConfig={defaultConfig} onSortChange={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('hides label in compact mode', () => {
    render(<ProspectsSortMenu sortConfig={defaultConfig} onSortChange={vi.fn()} compact />);
    expect(screen.queryByText('Nom (A-Z)')).not.toBeInTheDocument();
  });

  it('renders correct label for different configs', () => {
    render(<ProspectsSortMenu sortConfig={{ field: 'ca_potentiel', direction: 'desc' }} onSortChange={vi.fn()} />);
    expect(screen.getByText('CA potentiel ↓')).toBeInTheDocument();
  });
});
