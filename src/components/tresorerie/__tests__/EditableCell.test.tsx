import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditableCell } from '../EditableCell';

describe('EditableCell', () => {
  it('renders display value when not editing', () => {
    render(<EditableCell value="Test Value" onSave={vi.fn()} />);
    expect(screen.getByText('Test Value')).toBeInTheDocument();
  });

  it('renders formatted value when formatter provided', () => {
    render(<EditableCell value={1500} onSave={vi.fn()} formatDisplay={(v) => `${v} €`} />);
    expect(screen.getByText('1500 €')).toBeInTheDocument();
  });

  it('renders placeholder when value is null', () => {
    render(<EditableCell value={null} onSave={vi.fn()} placeholder="Saisir..." />);
    expect(screen.getByText('Saisir...')).toBeInTheDocument();
  });

  it('renders as non-editable when disabled', () => {
    const { container } = render(<EditableCell value="Static" onSave={vi.fn()} disabled />);
    expect(container.querySelector('input')).toBeNull();
  });
});
