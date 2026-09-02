import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TodoInlineCard } from '../TodoInlineCard';

const mockTodoList = {
  id: 'todo1',
  title: 'Sprint tasks',
  items: [
    { id: 'i1', content: 'Setup CI', is_done: true },
    { id: 'i2', content: 'Write tests', is_done: false },
    { id: 'i3', content: 'Deploy', is_done: false },
  ],
};

vi.mock('@/hooks/pulse/usePulseTodos', () => ({
  usePulseTodoList: () => ({ data: mockTodoList, isLoading: false, error: null }),
  useToggleTodoItem: () => ({ mutate: vi.fn() }),
  useAddTodoItem: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTodoItem: () => ({ mutate: vi.fn() }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('TodoInlineCard', () => {
  it('renders todo title', () => {
    render(
      <QueryClientProvider client={qc}>
        <TodoInlineCard todoId="todo1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('Sprint tasks')).toBeInTheDocument();
  });

  it('renders items', () => {
    render(
      <QueryClientProvider client={qc}>
        <TodoInlineCard todoId="todo1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('Setup CI')).toBeInTheDocument();
    expect(screen.getByText('Write tests')).toBeInTheDocument();
    expect(screen.getByText('Deploy')).toBeInTheDocument();
  });

  it('shows progress count', () => {
    render(
      <QueryClientProvider client={qc}>
        <TodoInlineCard todoId="todo1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('shows add item button', () => {
    render(
      <QueryClientProvider client={qc}>
        <TodoInlineCard todoId="todo1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('Ajouter un élément')).toBeInTheDocument();
  });

  it('shows input on add click', () => {
    render(
      <QueryClientProvider client={qc}>
        <TodoInlineCard todoId="todo1" />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByText('Ajouter un élément'));
    expect(screen.getByPlaceholderText('Nouvel élément...')).toBeInTheDocument();
  });
});
