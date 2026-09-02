import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableCheckboxCell } from '../EditableCheckboxCell';

describe('EditableCheckboxCell', () => {
  it('renders unchecked state', () => {
    const { container } = render(<EditableCheckboxCell value={false} onSave={vi.fn()} />);
    expect(container.querySelector('.lucide-check')).not.toBeInTheDocument();
  });

  it('renders checked state with check icon', () => {
    const { container } = render(<EditableCheckboxCell value={true} onSave={vi.fn()} />);
    expect(container.querySelector('.lucide-check')).toBeInTheDocument();
  });

  it('toggles on click - false to true', () => {
    const onSave = vi.fn();
    render(<EditableCheckboxCell value={false} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSave).toHaveBeenCalledWith(true);
  });

  it('toggles on click - true to false', () => {
    const onSave = vi.fn();
    render(<EditableCheckboxCell value={true} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSave).toHaveBeenCalledWith(false);
  });

  it('applies checked styles', () => {
    const { container } = render(<EditableCheckboxCell value={true} onSave={vi.fn()} />);
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('bg-primary');
  });

  it('applies custom className', () => {
    const { container } = render(<EditableCheckboxCell value={false} onSave={vi.fn()} className="custom" />);
    expect(container.querySelector('.custom')).toBeInTheDocument();
  });
});
