import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RapportsViewSelector } from '../RapportsViewSelector';

describe('RapportsViewSelector', () => {
  it('renders 5 view buttons', () => {
    render(<RapportsViewSelector currentView="dashboard" onViewChange={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('calls onViewChange when clicked', () => {
    const onChange = vi.fn();
    render(<RapportsViewSelector currentView="dashboard" onViewChange={onChange} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[2]); // 'table'
    expect(onChange).toHaveBeenCalledWith('table');
  });

  it('highlights active view with bg-background', () => {
    render(<RapportsViewSelector currentView="charts" onViewChange={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[1].className).toContain('bg-background');
  });

  it('renders container', () => {
    const { container } = render(<RapportsViewSelector currentView="dashboard" onViewChange={vi.fn()} />);
    expect(container.querySelector('.bg-muted\\/30')).toBeInTheDocument();
  });
});
