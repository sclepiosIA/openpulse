/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useEmailsByPartenaire } from './useEmailsByPartenaire';

const {
  EMAIL_ROWS,
  EMPTY_ROWS,
  QUERY_ERROR,
  mockFrom,
  mockSelect,
  mockEq,
  mockOrder,
  mockThen,
  mockCatch,
} = vi.hoisted(() => {
  const EMAIL_ROWS = [
    {
      id: 'thread-1',
      subject: 'Sujet A',
      last_message_date: '2024-05-10T09:00:00Z',
      message_count: 3,
      ai_summary: 'Résumé A',
      participants: [{ name: 'Alice', email: 'alice@acme.co' }],
      category: 'support',
      priority: 'high',
    },
    {
      id: 'thread-2',
      subject: 'Sujet B',
      last_message_date: '2024-05-09T08:00:00Z',
      message_count: 1,
      ai_summary: null,
      participants: [{ email: 'bob@acme.co' }],
      category: null,
      priority: 'low',
    },
  ];

  const EMPTY_ROWS: Array<{
    id: string;
    subject: string;
    last_message_date: string;
    message_count: number;
    ai_summary: string | null;
    participants: Array<{ name?: string; email?: string }> | null;
    category: string | null;
    priority: string | null;
  }> = [];

  const QUERY_ERROR = { message: 'x' };

  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockOrder = vi.fn();
  const mockThen = vi.fn();
  const mockCatch = vi.fn();

  return {
    EMAIL_ROWS,
    EMPTY_ROWS,
    QUERY_ERROR,
    mockFrom,
    mockSelect,
    mockEq,
    mockOrder,
    mockThen,
    mockCatch,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    then: mockThen,
    catch: mockCatch,
  };

  mockFrom.mockImplementation(() => builder);
  mockSelect.mockImplementation(() => builder);
  mockEq.mockImplementation(() => builder);
  mockOrder.mockImplementation(() => builder);
  mockCatch.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

describe('useEmailsByPartenaire', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne un état de chargement puis les emails transformés avec is_read à false', async () => {
    mockThen.mockImplementation((resolve: (value: { data: typeof EMAIL_ROWS; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: EMAIL_ROWS, error: null }))
    );

    const { result } = renderHook(() => useEmailsByPartenaire('part-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.emails).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(mockSelect).toHaveBeenCalledWith(`
          id,
          subject,
          last_message_date,
          message_count,
          ai_summary,
          participants,
          category,
          priority
        `);
    expect(mockEq).toHaveBeenNthCalledWith(1, 'partenaire_id', 'part-1');
    expect(mockEq).toHaveBeenNthCalledWith(2, 'is_archived', false);
    expect(mockEq).toHaveBeenNthCalledWith(3, 'is_spam', false);
    expect(mockOrder).toHaveBeenCalledWith('last_message_date', { ascending: false });

    expect(result.current.error).toBeNull();
    expect(result.current.emails).toHaveLength(2);
    expect(result.current.emails[0]).toEqual({
      id: 'thread-1',
      subject: 'Sujet A',
      last_message_date: '2024-05-10T09:00:00Z',
      message_count: 3,
      ai_summary: 'Résumé A',
      participants: [{ name: 'Alice', email: 'alice@acme.co' }],
      category: 'support',
      priority: 'high',
      is_read: false,
    });
    expect(result.current.emails[1]).toEqual({
      id: 'thread-2',
      subject: 'Sujet B',
      last_message_date: '2024-05-09T08:00:00Z',
      message_count: 1,
      ai_summary: null,
      participants: [{ email: 'bob@acme.co' }],
      category: null,
      priority: 'low',
      is_read: false,
    });
  });

  it('nexécute pas la requête si partenaireId est vide', async () => {
    const { result } = renderHook(() => useEmailsByPartenaire(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.emails).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('retourne une liste vide quand supabase renvoie data null ou vide', async () => {
    mockThen.mockImplementation((resolve: (value: { data: typeof EMPTY_ROWS; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: EMPTY_ROWS, error: null }))
    );

    const { result } = renderHook(() => useEmailsByPartenaire('part-empty'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.emails).toEqual([]);
    expect(mockEq).toHaveBeenNthCalledWith(1, 'partenaire_id', 'part-empty');
  });

  it('remonte une erreur quand supabase renvoie error', async () => {
    mockThen.mockImplementation(
      (resolve: (value: { data: null; error: typeof QUERY_ERROR }) => unknown) =>
        Promise.resolve(resolve({ data: null, error: QUERY_ERROR }))
    );

    const { result } = renderHook(() => useEmailsByPartenaire('part-error'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.emails).toEqual([]);
    expect(result.current.error).toMatchObject({ message: 'x' });
    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(mockEq).toHaveBeenNthCalledWith(1, 'partenaire_id', 'part-error');
    expect(mockEq).toHaveBeenNthCalledWith(2, 'is_archived', false);
    expect(mockEq).toHaveBeenNthCalledWith(3, 'is_spam', false);
  });
});