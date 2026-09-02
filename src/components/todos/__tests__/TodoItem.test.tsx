import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const chainable: any = new Proxy({}, {
  get: () => (..._args: any[]) => chainable,
});
chainable.maybeSingle = () => Promise.resolve({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => chainable },
}));

vi.mock('@/hooks/tasks/usePersonalTodos', () => ({
  useTogglePersonalTodo: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/hooks/pulse/usePulseTodos', () => ({
  useToggleTodoItem: () => ({ mutate: vi.fn() }),
}));

import { TodoItem } from '../TodoItem';
import type { UnifiedTodo } from '@/hooks/tasks/useUnifiedTodos';
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const todo: UnifiedTodo = {
  id: 't1',
  title: 'Appeler le CHU',
  description: 'Suivi mensuel',
  is_done: false,
  done_at: null,
  due_date: '2026-03-15',
  priority: 'high',
  source: 'personal',
  project_id: null,
  project_name: null,
  project_color: null,
  etablissement_id: null,
  etablissement_name: null,
  conversation_id: null,
  conversation_name: null,
  pulse_item_id: undefined,
  pulse_list_id: undefined,
  created_at: '2026-03-01',
  assigned_to_id: null,
  assigned_to_name: null,
  rd_user_story_id: null,
  rd_user_story_title: null,
  support_ticket_id: null,
  support_ticket_title: null,
  visibility: 'personal',
};

describe('TodoItem', () => {
  const wrap = (ui: React.ReactElement) => (
    <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
  );

  it('renders todo title', () => {
    render(wrap(<TodoItem todo={todo} />));
    expect(screen.getByText('Appeler le CHU')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(wrap(<TodoItem todo={todo} onClick={onClick} />));
    fireEvent.click(screen.getByText('Appeler le CHU'));
    expect(onClick).toHaveBeenCalled();
  });
});
