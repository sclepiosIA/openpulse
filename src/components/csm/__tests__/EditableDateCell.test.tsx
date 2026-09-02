import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableDateCell } from '../EditableDateCell';

describe('EditableDateCell', () => {
  it('renders placeholder when no value', () => {
    render(<EditableDateCell value={null} onSave={vi.fn()} />);
    expect(screen.getByText('Sélectionner...')).toBeInTheDocument();
  });

  it('renders formatted date value', () => {
    render(<EditableDateCell value="2026-03-10" onSave={vi.fn()} />);
    expect(screen.getByText('10/03/2026')).toBeInTheDocument();
  });

  it('enters edit mode on click', () => {
    const { container } = render(<EditableDateCell value="2026-03-10" onSave={vi.fn()} />);
    fireEvent.click(screen.getByText('10/03/2026'));
    const input = container.querySelector('input[type="date"]');
    expect(input).toBeInTheDocument();
  });
});
