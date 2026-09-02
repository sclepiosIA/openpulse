import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';

const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
    in: vi.fn().mockResolvedValue({ error: null }),
  }),
  in: vi.fn().mockResolvedValue({ error: null }),
});

const mockDelete = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});

const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { tags: ['existing'] }, error: null }),
  }),
  count: vi.fn(),
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      update: mockUpdate,
      delete: mockDelete,
      select: mockSelect,
    }),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/hooks/shared/useErrorHandler', () => ({
  useErrorHandler: () => ({ handleError: vi.fn() }),
}));

describe('useEmailActions', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();
  });

  it('should return all action functions', async () => {
    const { useEmailActions } = await import('@/hooks/email/useEmailActions');
    const { result } = renderHook(() => useEmailActions(), { wrapper });

    expect(typeof result.current.archiveThread).toBe('function');
    expect(typeof result.current.unarchiveThread).toBe('function');
    expect(typeof result.current.markAsSpam).toBe('function');
    expect(typeof result.current.markAsNotSpam).toBe('function');
    expect(typeof result.current.deleteThread).toBe('function');
    expect(typeof result.current.restoreThread).toBe('function');
    expect(typeof result.current.markAsRead).toBe('function');
    expect(typeof result.current.markAsUnread).toBe('function');
    expect(typeof result.current.updateCategory).toBe('function');
    expect(typeof result.current.updatePriority).toBe('function');
    expect(typeof result.current.addTag).toBe('function');
    expect(typeof result.current.removeTag).toBe('function');
    expect(typeof result.current.bulkArchive).toBe('function');
    expect(typeof result.current.bulkDelete).toBe('function');
    expect(typeof result.current.bulkMarkAsRead).toBe('function');
  });

  it('should have 15 total action methods', async () => {
    const { useEmailActions } = await import('@/hooks/email/useEmailActions');
    const { result } = renderHook(() => useEmailActions(), { wrapper });

    const actions = Object.values(result.current);
    expect(actions.length).toBe(15);
    actions.forEach(action => expect(typeof action).toBe('function'));
  });
});
