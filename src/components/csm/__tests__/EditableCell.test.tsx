import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableCell } from '../EditableCell';

describe('EditableCell', () => {
  it('renders value text', () => {
    render(<EditableCell value="Hello" onSave={vi.fn()} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders placeholder when value is null', () => {
    render(<EditableCell value={null} onSave={vi.fn()} placeholder="Cliquer" />);
    expect(screen.getByText('Cliquer')).toBeInTheDocument();
  });

  it('enters edit mode on click', () => {
    render(<EditableCell value="Test" onSave={vi.fn()} />);
    fireEvent.click(screen.getByText('Test'));
    expect(screen.getByDisplayValue('Test')).toBeInTheDocument();
  });

  it('calls onSave on blur with new value', () => {
    const onSave = vi.fn();
    render(<EditableCell value="Old" onSave={onSave} />);
    fireEvent.click(screen.getByText('Old'));
    const input = screen.getByDisplayValue('Old');
    fireEvent.change(input, { target: { value: 'New' } });
    fireEvent.blur(input);
    expect(onSave).toHaveBeenCalledWith('New');
  });

  it('does not call onSave if value unchanged', () => {
    const onSave = vi.fn();
    render(<EditableCell value="Same" onSave={onSave} />);
    fireEvent.click(screen.getByText('Same'));
    fireEvent.blur(screen.getByDisplayValue('Same'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves on Enter key', () => {
    const onSave = vi.fn();
    render(<EditableCell value="Val" onSave={onSave} />);
    fireEvent.click(screen.getByText('Val'));
    const input = screen.getByDisplayValue('Val');
    fireEvent.change(input, { target: { value: 'New' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith('New');
  });

  it('cancels on Escape key', () => {
    const onSave = vi.fn();
    render(<EditableCell value="Val" onSave={onSave} />);
    fireEvent.click(screen.getByText('Val'));
    const input = screen.getByDisplayValue('Val');
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Val')).toBeInTheDocument();
  });

  it('renders suffix with value', () => {
    render(<EditableCell value="42" onSave={vi.fn()} suffix="%" />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });
});
