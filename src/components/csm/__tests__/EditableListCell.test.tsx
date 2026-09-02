import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditableListCell, ActionItem } from '../EditableListCell';

describe('EditableListCell', () => {
  it('renders add button when no items', () => {
    render(<EditableListCell items={null} onSave={vi.fn()} />);
    expect(screen.getByText('Ajouter')).toBeInTheDocument();
  });

  it('renders existing items', () => {
    const items: ActionItem[] = [
      { text: 'Tâche 1', date: null, done: false },
      { text: 'Tâche 2', date: '2026-03-15', done: true },
    ];
    render(<EditableListCell items={items} onSave={vi.fn()} />);
    expect(screen.getByText('Tâche 1')).toBeInTheDocument();
    expect(screen.getByText('Tâche 2')).toBeInTheDocument();
  });

  it('shows add button with empty array', () => {
    render(<EditableListCell items={[]} onSave={vi.fn()} />);
    expect(screen.getByText('Ajouter')).toBeInTheDocument();
  });
});
