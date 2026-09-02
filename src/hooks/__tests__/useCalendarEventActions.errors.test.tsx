import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () =>
  mockSupabaseModule({
    fromResults: {
      calendar_events: { data: null, error: { message: 'RLS: calendar_events forbidden' } },
      event_reminders: { data: null, error: { message: 'RLS: event_reminders forbidden' } },
    },
  }),
);

import { useCreateCalendarEvent } from '../calendar/useCalendarEventActions';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useCalendarEventActions (error paths)', () => {
  it('createEvent propage erreur RLS', async () => {
    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });
    await expect(
      result.current.createEvent({
        calendarId: 'c1',
        title: 'Test',
        startTime: '2026-06-10T10:00:00Z',
        endTime: '2026-06-10T11:00:00Z',
        createdBy: 'u1',
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining('RLS') });
  });

  it('addReminder propage erreur RLS', async () => {
    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });
    await expect(
      result.current.addReminder({ event_id: 'e1', user_id: 'u1', minutes_before: 15 }),
    ).rejects.toMatchObject({ message: expect.stringContaining('RLS') });
  });
});
