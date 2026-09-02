import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { id: 'cal1' }, error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'evt1' }, error: null }),
        }),
      }),
    }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }),
    },
  },
}));

import { useCreateCalendarEvent, usePulseTaskCreate } from '../calendar/useCalendarEventActions';
import { supabase } from '@/integrations/supabase/client';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useCreateCalendarEvent', () => {
  it('returns createEvent and addAttendees functions', () => {
    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });
    expect(typeof result.current.createEvent).toBe('function');
    expect(typeof result.current.addAttendees).toBe('function');
    expect(typeof result.current.getOrCreateDefaultCalendar).toBe('function');
  });
});

describe('usePulseTaskCreate', () => {
  it('returns mutateAsync function', () => {
    const { result } = renderHook(() => usePulseTaskCreate(), { wrapper });
    expect(typeof result.current.mutateAsync).toBe('function');
  });
});
