import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewSelectorGroupes } from '../ViewSelectorGroupes';

describe('ViewSelectorGroupes', () => {
  const onViewChange = vi.fn();
  beforeEach(() => vi.clearAllMocks());

  it('renders 4 view buttons', () => {
    render(<ViewSelectorGroupes currentView="grid" onViewChange={onViewChange} />);
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('calls onViewChange when clicking a view', () => {
    render(<ViewSelectorGroupes currentView="grid" onViewChange={onViewChange} />);
    fireEvent.click(screen.getAllByRole('button')[1]); // table
    expect(onViewChange).toHaveBeenCalledWith('table');
  });

  it('applies glassmorphism variant by default', () => {
    const { container } = render(<ViewSelectorGroupes currentView="grid" onViewChange={onViewChange} />);
    expect(container.querySelector('.backdrop-blur-sm')).toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    const { container } = render(<ViewSelectorGroupes currentView="grid" onViewChange={onViewChange} variant="default" />);
    expect(container.querySelector('.bg-muted\\/50')).toBeInTheDocument();
  });
});
