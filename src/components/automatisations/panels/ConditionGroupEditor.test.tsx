import React from 'react';
import { render, fireEvent, screen, waitFor, renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';

// Stable mocks and helpers must be hoisted
const {
  ButtonMock,
  InputMock,
  LabelMock,
  SelectMock,
  SelectContentMock,
  SelectItemMock,
  SelectTriggerMock,
  SelectValueMock,
  PlusMock,
  Trash2Mock,
  mockFrom,
  supabaseMock,
  mutationFnMock
} = vi.hoisted(() => {
  const ButtonMock = (props: Record<string, unknown>) =>
    React.createElement(
      'button',
      // ensure it's a button element so click semantics work
      { type: (props as any).type ?? 'button', ...props, 'data-testid': (props as any)['data-testid'] },
      (props as any).children
    );

  const InputMock = (props: Record<string, unknown>) =>
    React.createElement('input', { ...props, 'data-testid': (props as any)['data-testid'] });

  const LabelMock = (props: Record<string, unknown>) =>
    React.createElement('label', { ...props, 'data-testid': (props as any)['data-testid'] }, (props as any).children);

  // Select mock: clicking a child with data-value triggers onValueChange
  const SelectMock = ({ children, onValueChange, ...props }: { children?: React.ReactNode; onValueChange?: (v: string) => void }) =>
    React.createElement(
      'div',
      {
        ...props,
        onClick: (e: React.MouseEvent) => {
          const target = e.target as HTMLElement | null;
          const el = target?.closest('[data-value]') as HTMLElement | null;
          const val = el?.getAttribute('data-value') ?? null;
          if (val && typeof onValueChange === 'function') onValueChange(val);
        },
        'data-testid': (props as Record<string, unknown>)['data-testid']
      },
      children
    );

  const SelectContentMock = (props: Record<string, unknown>) =>
    React.createElement('div', { ...props, 'data-testid': (props as any)['data-testid'] }, (props as any).children);

  const SelectItemMock = ({ value, children, ...props }: { value: string; children?: React.ReactNode }) =>
    React.createElement('div', { 'data-value': value, role: 'option', ...props, 'data-testid': `select-item-${value}` }, children);

  const SelectTriggerMock = (props: Record<string, unknown>) => React.createElement('div', { ...props }, (props as any).children);
  const SelectValueMock = (props: Record<string, unknown>) => React.createElement('span', { ...props }, (props as any).children);

  const PlusMock = () => React.createElement('span', null, '+');
  const Trash2Mock = () => React.createElement('span', null, 'x');

  // Minimal supabase builder mock (thenable) as required by rules
  const builder: Record<string, unknown> = {
    select: function () { return this; },
    eq: function () { return this; },
    gte: function () { return this; },
    lte: function () { return this; },
    "in": function () { return this; },
    order: function () { return this; },
    limit: function () { return this; },
    insert: function () { return this; },
    update: function () { return this; },
    delete: function () { return this; },
    single: function () { return Promise.resolve({ data: null, error: null }); },
    maybeSingle: function () { return Promise.resolve({ data: null, error: null }); },
    then: function (cb: unknown) { return Promise.resolve({ data: null, error: null }).then(cb as any); },
    catch: function (cb: unknown) { return Promise.resolve({ data: null, error: null }).catch(cb as any); },
  };

  const mockFrom = vi.fn(() => builder);
  const supabaseMock = { from: mockFrom };

  const mutationFnMock = vi.fn(async (payload: unknown) => {
    return { ok: true, payload };
  });

  return {
    ButtonMock,
    InputMock,
    LabelMock,
    SelectMock,
    SelectContentMock,
    SelectItemMock,
    SelectTriggerMock,
    SelectValueMock,
    PlusMock,
    Trash2Mock,
    mockFrom,
    supabaseMock,
    mutationFnMock
  };
});

// Mock ui components and icons
vi.mock('@/components/ui/button', () => ({ Button: (props: Record<string, unknown>) => React.createElement(ButtonMock, props) }));
vi.mock('@/components/ui/input', () => ({ Input: (props: Record<string, unknown>) => React.createElement(InputMock, props) }));
vi.mock('@/components/ui/label', () => ({ Label: (props: Record<string, unknown>) => React.createElement(LabelMock, props) }));
vi.mock('@/components/ui/select', () => ({
  Select: (props: Record<string, unknown>) => React.createElement(SelectMock as any, props),
  SelectContent: (props: Record<string, unknown>) => React.createElement(SelectContentMock, props),
  SelectItem: (props: Record<string, unknown>) => React.createElement(SelectItemMock as any, props),
  SelectTrigger: (props: Record<string, unknown>) => React.createElement(SelectTriggerMock, props),
  SelectValue: (props: Record<string, unknown>) => React.createElement(SelectValueMock, props),
}));
vi.mock('lucide-react', () => ({ Plus: (props: Record<string, unknown>) => React.createElement(PlusMock, props), Trash2: (props: Record<string, unknown>) => React.createElement(Trash2Mock, props) }));

// Mock supabase client per mandatory rule
vi.mock('@/integrations/supabase/client', () => ({ supabase: supabaseMock }));

// Import the component under test after mocks are defined
import { ConditionGroupEditor } from './ConditionGroupEditor';

// Helper to create QueryClient per test with required defaults
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

describe('ConditionGroupEditor', () => {
  it('renders empty initial LeafEditor and promotes to group on button click', async () => {
    const client = createQueryClient();
    const onChange = vi.fn();
    render(
      React.createElement(QueryClientProvider, { client },
        React.createElement(ConditionGroupEditor, { value: undefined as unknown, onChange })
      )
    );

    // Should render input with placeholder from component
    const fieldInput = screen.getByPlaceholderText('ex: trigger.statut_new') as HTMLInputElement;
    expect(fieldInput).toBeTruthy();
    expect(fieldInput.value).toBe('');

    // Button label should be present
    const promoteBtn = screen.getByText('Convertir en groupe ET/OU', { selector: 'button' });
    expect(promoteBtn).toBeTruthy();

    // Click to promote to group
    fireEvent.click(promoteBtn);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ all: [{ field: '', operator: 'equals', value: '' }] });
  });

  it('renders a Leaf value, updates field on input change and promotes to group preserving leaf', async () => {
    const client = createQueryClient();
    const leaf = { field: 'status', operator: 'equals', value: 'ok' };
    const onChange = vi.fn();
    render(
      React.createElement(QueryClientProvider, { client },
        React.createElement(ConditionGroupEditor, { value: leaf, onChange })
      )
    );

    // Field input should reflect initial value
    const fieldInput = screen.getByDisplayValue('status') as HTMLInputElement;
    expect(fieldInput).toBeTruthy();

    // Change field value
    fireEvent.change(fieldInput, { target: { value: 'state' } });
    expect(onChange).toHaveBeenCalledWith({ field: 'state', operator: 'equals', value: 'ok' });

    // Click promote to group (button text includes 'Ajouter une autre règle')
    const promoteBtn = screen.getByText('Ajouter une autre règle (ET/OU)', { selector: 'button' });
    fireEvent.click(promoteBtn);
    expect(onChange).toHaveBeenCalledWith({ all: [leaf] });
  });

  it('renders a Group, can add rule, add subgroup and remove item', async () => {
    const client = createQueryClient();
    const initialLeaf = { field: 'f1', operator: 'equals', value: 'v1' };
    const onChange = vi.fn();
    render(
      React.createElement(QueryClientProvider, { client },
        React.createElement(ConditionGroupEditor, { value: { all: [initialLeaf] }, onChange })
      )
    );

    // The "Logique" label must be present
    expect(screen.getByText('Logique')).toBeTruthy();

    // Add rule
    const addRuleBtn = screen.getByText('Règle', { selector: 'button' });
    fireEvent.click(addRuleBtn);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      all: [
        initialLeaf,
        { field: '', operator: 'equals', value: '' }
      ]
    });

    // Add subgroup (depth starts at 0 so button should exist)
    const addGroupBtn = screen.getByText('Sous-groupe', { selector: 'button' });
    fireEvent.click(addGroupBtn);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledWith({
      all: [
        initialLeaf,
        { all: [{ field: '', operator: 'equals', value: '' }] }
      ]
    });

    // Remove the first item: find the remove button with aria-label "Supprimer" (one per item)
    const removeButtons = screen.getAllByLabelText('Supprimer', { selector: 'button' });
    // There should be at least one remove button
    expect(removeButtons.length).toBeGreaterThan(0);
    fireEvent.click(removeButtons[0]);
    // onChange must be called and result should remove first item -> depends on current items; check last call
    expect(onChange).toHaveBeenCalled();
    const lastCallArg = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(Array.isArray(lastCallArg.all)).toBe(true);
    // Removing the first item from the single-item initial all yields empty array
    expect(lastCallArg).toEqual({ all: [] });
  });
});

describe('react-query hook behavior (renderHook with QueryClientProvider)', () => {
  it('query success sets isSuccess and data', async () => {
    const client = createQueryClient();
    const wrapper = ({ children }: { children?: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children);

    const { result } = renderHook(() => useQuery({
      queryKey: ['test-success'],
      queryFn: async () => 'payload',
      retry: 0
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toBe('payload');
    });
  });

  it('query error sets isError and exposes error message', async () => {
    const client = createQueryClient();
    const wrapper = ({ children }: { children?: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children);

    const { result } = renderHook(() => useQuery({
      queryKey: ['test-error'],
      queryFn: async () => {
        throw new Error('boom-error');
      },
      retry: 0
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect((result.current.error as Error).message).toBe('boom-error');
    });
  });

  it('mutation executes provided mutationFn and returns result', async () => {
    const client = createQueryClient();
    const wrapper = ({ children }: { children?: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children);

    const { result } = renderHook(() => useMutation({
      mutationFn: mutationFnMock,
    }), { wrapper });

    await act(async () => {
      const res = await result.current.mutateAsync({ id: 42 });
      expect(res).toEqual({ ok: true, payload: { id: 42 } });
    });

    expect(mutationFnMock).toHaveBeenCalledTimes(1);
    expect(mutationFnMock).toHaveBeenCalledWith({ id: 42 });
  });
});