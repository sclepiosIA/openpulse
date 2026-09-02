import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewSelectorPartenaires } from '../ViewSelectorPartenaires';

describe('ViewSelectorPartenaires', () => {
  const onViewChange = vi.fn();

  it('renders 3 view buttons', () => {
    render(<ViewSelectorPartenaires currentView="grid" onViewChange={onViewChange} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('calls onViewChange when clicking a view', () => {
    render(<ViewSelectorPartenaires currentView="grid" onViewChange={onViewChange} />);
    fireEvent.click(screen.getAllByRole('button')[1]); // table
    expect(onViewChange).toHaveBeenCalledWith('table');
  });

  it('applies glassmorphism variant by default', () => {
    const { container } = render(<ViewSelectorPartenaires currentView="grid" onViewChange={onViewChange} />);
    expect(container.querySelector('.backdrop-blur-sm')).toBeInTheDocument();
  });

  it('supports default variant', () => {
    const { container } = render(<ViewSelectorPartenaires currentView="table" onViewChange={onViewChange} variant="default" />);
    expect(container.querySelector('.bg-muted\\/50')).toBeInTheDocument();
  });
});
