// @vitest-environment jsdom
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActiveEmailTemplates } from './useActiveEmailTemplates';

const {
  ACTIVE_TEMPLATES,
  SUCCESS_RESULT,
  EMPTY_RESULT,
  ERROR_RESULT,
  mockFrom,
  mockSelect,
  mockEq,
  mockOrder,
  mockGte,
  mockLte,
  mockIn,
  mockLimit,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockSingle,
  mockMaybeSingle,
  mockThen,
  mockCatch,
} = vi.hoisted(() => {
  const ACTIVE_TEMPLATES = [
    {
      id: 'tpl-1',
      name: 'Bienvenue',
      subject: 'Bienvenue à bord',
      content: '<p>Bonjour</p>',
      category: 'onboarding',
      is_active: true,
      created_at: '2026-01-01',
    },
    {
      id: 'tpl-2',
      name: 'Relance',
      subject: 'On reprend contact',
      content: '<p>Relance</p>',
      category: null,
      is_active: true,
      created_at: '2026-01-02',
    },
  ];

  const SUCCESS_RESULT = { data: ACTIVE_TEMPLATES, error: null };
  const EMPTY_RESULT = { data: null, error: null };
  const ERROR_RESULT = { data: null, error: { message: 'x' } };

  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockOrder = vi.fn();
  const mockGte = vi.fn();
  const mockLte = vi.fn();
  const mockIn = vi.fn();
  const mockLimit = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockThen = vi.fn();
  const mockCatch = vi.fn();

  return {
    ACTIVE_TEMPLATES,
    SUCCESS_RESULT,
    EMPTY_RESULT,
    ERROR_RESULT,
    mockFrom,
    mockSelect,
    mockEq,
    mockOrder,
    mockGte,
    mockLte,
    mockIn,
    mockLimit,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockSingle,
    mockMaybeSingle,
    mockThen,
    mockCatch,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: mockSelect,
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
    in: mockIn,
    order: mockOrder,
    limit: mockLimit,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    then: mockThen,
    catch: mockCatch,
  };

  mockSelect.mockImplementation(() => builder);
  mockEq.mockImplementation(() => builder);
  mockGte.mockImplementation(() => builder);
  mockLte.mockImplementation(() => builder);
  mockIn.mockImplementation(() => builder);
  mockOrder.mockImplementation(() => builder);
  mockLimit.mockImplementation(() => builder);
  mockInsert.mockImplementation(() => builder);
  mockUpdate.mockImplementation(() => builder);
  mockDelete.mockImplementation(() => builder);
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockCatch.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

function createWrapper(): React.ComponentType<{ children: React.ReactNode }> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useActiveEmailTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockImplementation(() => ({
      select: mockSelect,
      eq: mockEq,
      gte: mockGte,
      lte: mockLte,
      in: mockIn,
      order: mockOrder,
      limit: mockLimit,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      then: mockThen,
      catch: mockCatch,
    }));

    mockEq.mockImplementation(() => ({
      select: mockSelect,
      eq: mockEq,
      gte: mockGte,
      lte: mockLte,
      in: mockIn,
      order: mockOrder,
      limit: mockLimit,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      then: mockThen,
      catch: mockCatch,
    }));

    mockOrder.mockImplementation(() => ({
      select: mockSelect,
      eq: mockEq,
      gte: mockGte,
      lte: mockLte,
      in: mockIn,
      order: mockOrder,
      limit: mockLimit,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      then: mockThen,
      catch: mockCatch,
    }));

    mockFrom.mockImplementation(() => ({
      select: mockSelect,
      eq: mockEq,
      gte: mockGte,
      lte: mockLte,
      in: mockIn,
      order: mockOrder,
      limit: mockLimit,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      then: mockThen,
      catch: mockCatch,
    }));

    mockThen.mockImplementation((onFulfilled: (value: typeof SUCCESS_RESULT) => unknown) =>
      Promise.resolve(onFulfilled(SUCCESS_RESULT)),
    );
  });

  it('charge puis retourne les templates actifs avec les bons paramètres de requête', async () => {
    const { result } = renderHook(() => useActiveEmailTemplates(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('email_templates');
    expect(mockSelect).toHaveBeenCalledWith(
      'id, name, subject, content, category, is_active, created_at',
    );
    expect(mockEq).toHaveBeenCalledWith('is_active', true);
    expect(mockOrder).toHaveBeenCalledWith('name');

    expect(result.current.data).toEqual(ACTIVE_TEMPLATES);
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.map((template) => template.name)).toEqual(['Bienvenue', 'Relance']);
    expect(result.current.data?.map((template) => template.category)).toEqual([
      'onboarding',
      null,
    ]);
    expect(result.current.data?.[0]).toMatchObject({
      id: 'tpl-1',
      subject: 'Bienvenue à bord',
      content: '<p>Bonjour</p>',
    });
    expect(result.current.data?.[1]).toMatchObject({
      id: 'tpl-2',
      subject: 'On reprend contact',
      content: '<p>Relance</p>',
    });
    expect(result.current.error).toBeNull();
  });

  it('retourne un tableau vide quand supabase renvoie data null sans erreur', async () => {
    mockThen.mockImplementation((onFulfilled: (value: typeof EMPTY_RESULT) => unknown) =>
      Promise.resolve(onFulfilled(EMPTY_RESULT)),
    );

    const { result } = renderHook(() => useActiveEmailTemplates(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith('email_templates');
    expect(mockEq).toHaveBeenCalledWith('is_active', true);
    expect(mockOrder).toHaveBeenCalledWith('name');
  });

  it("passe en erreur quand supabase renvoie une erreur", async () => {
    mockThen.mockImplementation((onFulfilled: (value: typeof ERROR_RESULT) => unknown) =>
      Promise.resolve(onFulfilled(ERROR_RESULT)),
    );

    const { result } = renderHook(() => useActiveEmailTemplates(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.isSuccess).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('x');
    expect(mockFrom).toHaveBeenCalledWith('email_templates');
    expect(mockSelect).toHaveBeenCalledWith(
      'id, name, subject, content, category, is_active, created_at',
    );
    expect(mockEq).toHaveBeenCalledWith('is_active', true);
    expect(mockOrder).toHaveBeenCalledWith('name');
  });
});