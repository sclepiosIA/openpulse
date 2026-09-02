/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCalendarDragDrop } from './useCalendarDragDrop';

const {
  mockFrom,
  builder,
  toastSpy,
  debugErrorSpy,
  stableUser,
  useSensorSpy,
  useSensorsSpy,
  PointerSensorMock,
} = vi.hoisted(() => {
  const builderState = {
    data: { id: 'task-1', echeance: '2024-05-10' } as { id: string; echeance: string } | null,
    error: null as { message: string } | null,
  };

  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: builderState.data, error: builderState.error })),
    maybeSingle: vi.fn(async () => ({ data: builderState.data, error: builderState.error })),
    then: (onFulfilled: (value: { data: { id: string; echeance: string } | null; error: { message: string } | null }) => unknown) =>
      Promise.resolve({ data: builderState.data, error: builderState.error }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: builderState.data, error: builderState.error }).catch(onRejected),
    __setResult: (data: { id: string; echeance: string } | null, error: { message: string } | null) => {
      builderState.data = data;
      builderState.error = error;
    },
    __reset: () => {
      builderState.data = { id: 'task-1', echeance: '2024-05-10' };
      builderState.error = null;
      chain.select.mockClear();
      chain.eq.mockClear();
      chain.gte.mockClear();
      chain.lte.mockClear();
      chain.in.mockClear();
      chain.order.mockClear();
      chain.limit.mockClear();
      chain.insert.mockClear();
      chain.update.mockClear();
      chain.delete.mockClear();
      chain.single.mockClear();
      chain.maybeSingle.mockClear();
    },
  };

  const pointerSensor = function PointerSensor() {};
  const sensorSpy = vi.fn((sensor: unknown, options: unknown) => ({ sensor, options }));
  const sensorsSpy = vi.fn((...items: unknown[]) => items);

  return {
    mockFrom: vi.fn(() => chain),
    builder: chain,
    toastSpy: vi.fn(),
    debugErrorSpy: vi.fn(),
    stableUser: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    useSensorSpy: sensorSpy,
    useSensorsSpy: sensorsSpy,
    PointerSensorMock: pointerSensor,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorSpy,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableUser,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableUser,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => stableUser,
}));

vi.mock('@dnd-kit/core', () => ({
  PointerSensor: PointerSensorMock,
  useSensor: useSensorSpy,
  useSensors: useSensorsSpy,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const wrapper = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { wrapper, queryClient };
}

describe('useCalendarDragDrop', () => {
  beforeEach(() => {
    builder.__reset();
    mockFrom.mockClear();
    toastSpy.mockClear();
    debugErrorSpy.mockClear();
    useSensorSpy.mockClear();
    useSensorsSpy.mockClear();
  });

  it('configure les sensors et met à jour la date avec succès', async () => {
    const { wrapper } = createWrapper();
    const onDateChange = vi.fn();

    const { result } = renderHook(() => useCalendarDragDrop(), { wrapper });

    expect(useSensorSpy).toHaveBeenCalledWith(PointerSensorMock, {
      activationConstraint: {
        distance: 8,
      },
    });
    expect(useSensorsSpy).toHaveBeenCalledTimes(1);
    expect(Array.isArray(result.current.sensors)).toBe(true);
    expect(result.current.sensors).toHaveLength(1);
    expect(result.current.isUpdating).toBe(false);

    const event = {
      active: { id: 'task-1' },
      over: { id: '2024-05-10' },
    };

    await act(async () => {
      await result.current.handleDragEnd(
        event as unknown as import('@dnd-kit/core').DragEndEvent,
        onDateChange
      );
    });

    await waitFor(() => {
      expect(result.current.isUpdating).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('taches');
    expect(builder.update).toHaveBeenCalledWith({ echeance: '2024-05-10' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'task-1');
    expect(builder.select).toHaveBeenCalledTimes(1);
    expect(builder.single).toHaveBeenCalledTimes(1);
    expect(onDateChange).toHaveBeenCalledTimes(1);
    expect(onDateChange.mock.calls[0][0]).toBe('task-1');
    expect(onDateChange.mock.calls[0][1]).toBeInstanceOf(Date);
    expect((onDateChange.mock.calls[0][1] as Date).toISOString().slice(0, 10)).toBe('2024-05-10');
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Tâche déplacée',
      description: "L'échéance a été mise à jour avec succès",
    });
  });

  it('ne fait rien si over est absent ou si active.id est égal à over.id', async () => {
    const { wrapper } = createWrapper();
    const onDateChange = vi.fn();

    const { result } = renderHook(() => useCalendarDragDrop(), { wrapper });

    await act(async () => {
      await result.current.handleDragEnd(
        { active: { id: 'task-1' }, over: null } as unknown as import('@dnd-kit/core').DragEndEvent,
        onDateChange
      );
    });

    await act(async () => {
      await result.current.handleDragEnd(
        { active: { id: 'task-1' }, over: { id: 'task-1' } } as unknown as import('@dnd-kit/core').DragEndEvent,
        onDateChange
      );
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(onDateChange).not.toHaveBeenCalled();
    expect(toastSpy).not.toHaveBeenCalled();
    expect(debugErrorSpy).not.toHaveBeenCalled();
  });

  it('gère une erreur supabase et n appelle pas onDateChange', async () => {
    builder.__setResult(null, { message: 'x' });

    const { wrapper } = createWrapper();
    const onDateChange = vi.fn();

    const { result } = renderHook(() => useCalendarDragDrop(), { wrapper });

    await act(async () => {
      await result.current.handleDragEnd(
        { active: { id: 'task-2' }, over: { id: '2024-06-15' } } as unknown as import('@dnd-kit/core').DragEndEvent,
        onDateChange
      );
    });

    await waitFor(() => {
      expect(result.current.isUpdating).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('taches');
    expect(builder.update).toHaveBeenCalledWith({ echeance: '2024-06-15' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'task-2');
    expect(builder.select).toHaveBeenCalledTimes(1);
    expect(builder.single).toHaveBeenCalledTimes(1);
    expect(onDateChange).not.toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de déplacer la tâche',
      variant: 'destructive',
    });
    expect(debugErrorSpy).toHaveBeenCalledWith('Error updating task date:', { message: 'x' });
    expect(debugErrorSpy).toHaveBeenCalledWith('Drag drop error:', { message: 'x' });
  });
});