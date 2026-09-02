import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableSelectCell } from '../EditableSelectCell';

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

describe('EditableSelectCell', () => {
  it('renders select with placeholder', () => {
    render(<EditableSelectCell value={null} options={options} onSave={vi.fn()} />);
    expect(screen.getByDisplayValue('Sélectionner')).toBeInTheDocument();
  });

  it('renders custom placeholder', () => {
    render(<EditableSelectCell value={null} options={options} onSave={vi.fn()} placeholder="Choisir" />);
    expect(screen.getByDisplayValue('Choisir')).toBeInTheDocument();
  });

  it('renders all options', () => {
    render(<EditableSelectCell value={null} options={options} onSave={vi.fn()} />);
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
  });

  it('shows selected value', () => {
    render(<EditableSelectCell value="b" options={options} onSave={vi.fn()} />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('b');
  });

  it('calls onSave on change', () => {
    const onSave = vi.fn();
    render(<EditableSelectCell value="a" options={options} onSave={onSave} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c' } });
    expect(onSave).toHaveBeenCalledWith('c');
  });

  it('applies custom className', () => {
    const { container } = render(<EditableSelectCell value={null} options={options} onSave={vi.fn()} className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
