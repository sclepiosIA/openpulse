import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/tasks/useUnifiedTodos', () => ({
  useUnifiedTodos: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  formatDueDate: (d: string) => d,
  getDueDateColor: () => 'text-muted-foreground',
}));

vi.mock('../TodoItem', () => ({
  TodoItem: ({ todo }: any) => <div data-testid="todo-item">{todo.title}</div>,
}));

import { TodoList } from '../TodoList';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('TodoList', () => {
  it('renders empty state when no todos', () => {
    render(
      <QueryClientProvider client={qc}>
        <TodoList
          filter="all"
          showDone={false}
          search=""
          onSelectTodo={vi.fn()}
        />
      </QueryClientProvider>
    );
    expect(screen.getByText('Tout est fait !')).toBeInTheDocument();
  });

  it('renders loading state', async () => {
    const { useUnifiedTodos } = await import('@/hooks/tasks/useUnifiedTodos');
    (useUnifiedTodos as any).mockReturnValue({ data: [], isLoading: true, error: null });

    const { container } = render(
      <QueryClientProvider client={qc}>
        <TodoList filter="all" showDone={false} search="" onSelectTodo={vi.fn()} />
      </QueryClientProvider>
    );
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();

    // Reset
    (useUnifiedTodos as any).mockReturnValue({ data: [], isLoading: false, error: null });
  });
});
