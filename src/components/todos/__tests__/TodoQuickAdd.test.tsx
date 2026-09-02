import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TodoQuickAdd } from '../TodoQuickAdd';

vi.mock('@/hooks/tasks/usePersonalTodos', () => ({
  useCreatePersonalTodo: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

describe('TodoQuickAdd', () => {
  it('renders collapsed button by default', () => {
    render(<TodoQuickAdd />);
    expect(screen.getByText('Ajouter une tâche')).toBeInTheDocument();
  });

  it('expands on click', () => {
    render(<TodoQuickAdd />);
    fireEvent.click(screen.getByText('Ajouter une tâche'));
    expect(screen.getByPlaceholderText('Que devez-vous faire ?')).toBeInTheDocument();
  });

  it('shows cancel button when expanded', () => {
    render(<TodoQuickAdd />);
    fireEvent.click(screen.getByText('Ajouter une tâche'));
    expect(screen.getByText('Annuler')).toBeInTheDocument();
  });

  it('collapses on cancel', () => {
    render(<TodoQuickAdd />);
    fireEvent.click(screen.getByText('Ajouter une tâche'));
    fireEvent.click(screen.getByText('Annuler'));
    expect(screen.getByText('Ajouter une tâche')).toBeInTheDocument();
  });

  it('shows add button when expanded', () => {
    render(<TodoQuickAdd />);
    fireEvent.click(screen.getByText('Ajouter une tâche'));
    expect(screen.getByText('Ajouter')).toBeInTheDocument();
  });

  it('shows keyboard shortcut hint', () => {
    render(<TodoQuickAdd />);
    expect(screen.getByText('Q')).toBeInTheDocument();
  });
});
