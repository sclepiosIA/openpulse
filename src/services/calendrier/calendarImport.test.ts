import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { fetchExistingEventKeys, importIcsEvents, createCalendarSubscription, syncCalendarSubscription } from './calendarImport';

const {
  mockFrom,
  mockFunctionsInvoke,
  builder,
  STUB_EVENTS_DATA,
  STUB_IMPORT_SUCCESS,
  STUB_IMPORT_ERROR,
  STUB_SYNC_SUCCESS,
  STUB_SYNC_ERROR,
} = vi.hoisted(() => {
  const STUB_EVENTS_DATA = [
    { title: 'Event A', start_time: '2026-01-01T10:00:00Z' },
    { title: 'Event B', start_time: '2026-01-02T11:00:00Z' },
  ];

  const STUB_IMPORT_SUCCESS = {
    data: { imported: 3, skipped: 1, extra: 'ok' },
    error: null,
  };

  const STUB_IMPORT_ERROR = {
    data: null,
    error: { message: 'import failed' },
  };

  const STUB_SYNC_SUCCESS = {
    data: { status: 'queued' },
    error: null,
  };

  const STUB_SYNC_ERROR = {
    data: null,
    error: { message: 'sync failed' },
  };

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  const mockFrom = vi.fn(() => builder);

  const mockFunctionsInvoke = vi.fn();

  return {
    mockFrom,
    mockFunctionsInvoke,
    builder,
    STUB_EVENTS_DATA,
    STUB_IMPORT_SUCCESS,
    STUB_IMPORT_ERROR,
    STUB_SYNC_SUCCESS,
    STUB_SYNC_ERROR,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockFunctionsInvoke,
    },
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const qc = createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc, children });
  };
}

describe('fetchExistingEventKeys', () => {
  it('returns a Set of concatenated title and start_time for matching calendar_id', async () => {
    builder.select.mockReturnValue(builder);
    builder.eq.mockImplementationOnce((_col: string, _val: string) =>
      Promise.resolve({ data: STUB_EVENTS_DATA, error: null }),
    );

    const result = await fetchExistingEventKeys('cal-1');

    expect(mockFrom).toHaveBeenCalledWith('calendar_events');
    expect(builder.select).toHaveBeenCalledWith('title, start_time');
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(2);
    expect(result.has('Event A|2026-01-01T10:00:00Z')).toBe(true);
    expect(result.has('Event B|2026-01-02T11:00:00Z')).toBe(true);
  });

  it('handles null data by returning an empty Set', async () => {
    builder.select.mockReturnValue(builder);
    builder.eq.mockImplementationOnce((_col: string, _val: string) =>
      Promise.resolve({ data: null, error: null }),
    );

    const result = await fetchExistingEventKeys('cal-empty');

    expect(result.size).toBe(0);
  });
});

describe('importIcsEvents', () => {
  it('calls supabase function and returns ImportIcsResult on success', async () => {
    mockFunctionsInvoke.mockResolvedValueOnce(STUB_IMPORT_SUCCESS);

    const params = {
      icsContent: 'BEGIN:VCALENDAR...',
      calendarId: 'cal-1',
      minDate: '2026-01-01',
    };

    const result = await importIcsEvents(params);

    expect(mockFunctionsInvoke).toHaveBeenCalledWith('import-ics-events', {
      body: params,
    });
    expect(result.imported).toBe(3);
    expect(result.skipped).toBe(1);
    expect(result.extra).toBe('ok');
  });

  it('throws when supabase function returns an error', async () => {
    mockFunctionsInvoke.mockResolvedValueOnce(STUB_IMPORT_ERROR);

    const params = {
      icsContent: 'BEGIN:VCALENDAR...',
      calendarId: 'cal-err',
      minDate: '2026-02-01',
    };

    await expect(importIcsEvents(params)).rejects.toEqual(STUB_IMPORT_ERROR.error);
  });
});

describe('createCalendarSubscription', () => {
  it('inserts a new subscription with mapped fields and resolves on success', async () => {
    builder.insert.mockImplementationOnce((payload: unknown) =>
      Promise.resolve({ data: null, error: null }),
    );

    const params = {
      userId: 'user-1',
      calendarId: 'cal-1',
      name: 'My Calendar',
      url: 'https://example.com/cal.ics',
      syncFrequency: 'daily',
    };

    await createCalendarSubscription(params);

    expect(mockFrom).toHaveBeenCalledWith('calendar_subscriptions');
    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      calendar_id: 'cal-1',
      name: 'My Calendar',
      url: 'https://example.com/cal.ics',
      sync_frequency: 'daily',
    });
  });

  it('throws when insert returns an error', async () => {
    const error = { message: 'insert failed' };

    builder.insert.mockImplementationOnce((_payload: unknown) =>
      Promise.resolve({ data: null, error }),
    );

    const params = {
      userId: 'user-2',
      calendarId: 'cal-2',
      name: 'Other Calendar',
      url: 'https://example.com/other.ics',
      syncFrequency: 'hourly',
    };

    await expect(createCalendarSubscription(params)).rejects.toEqual(error);
  });
});

describe('syncCalendarSubscription', () => {
  it('invokes function and returns error: null on success', async () => {
    mockFunctionsInvoke.mockResolvedValueOnce(STUB_SYNC_SUCCESS);

    const params = {
      subscriptionUrl: 'https://example.com/cal-sync.ics',
      calendarId: 'cal-sync',
    };

    const result = await syncCalendarSubscription(params);

    expect(mockFunctionsInvoke).toHaveBeenCalledWith('sync-calendar-subscription', {
      body: params,
    });
    expect(result).toEqual({ error: null });
  });

  it('returns error object when invocation fails', async () => {
    mockFunctionsInvoke.mockResolvedValueOnce(STUB_SYNC_ERROR);

    const params = {
      subscriptionUrl: 'https://example.com/cal-sync-fail.ics',
      calendarId: 'cal-sync-fail',
    };

    const result = await syncCalendarSubscription(params);

    expect(result.error).toEqual(STUB_SYNC_ERROR.error);
  });
});

describe('react-query integration smoke via renderHook', () => {
  it('can be used inside a QueryClientProvider without hanging (fetchExistingEventKeys)', async () => {
    const wrapper = createWrapper();

    builder.select.mockReturnValue(builder);
    builder.eq.mockImplementationOnce((_col: string, _val: string) =>
      Promise.resolve({ data: STUB_EVENTS_DATA, error: null }),
    );

    const { result } = renderHook(
      () => ({
        promise: fetchExistingEventKeys('cal-hook'),
      }),
      { wrapper },
    );

    await act(async () => {
      await result.current.promise;
    });

    expect(true).toBe(true);
  });
});