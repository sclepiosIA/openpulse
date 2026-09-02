import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authUser: { id: 'user-1' } as null | { id: string },
  profile: { id: 'profile-1' } as null | { id: string },
  calendarResult: { count: 3 as number | null, error: null as null | Error },
  emailRows: [{ id: 'account-1' }, { id: 'account-2' }] as null | Array<{ id: string }>,
  from: vi.fn(),
  fromExtended: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: mocks.authUser }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: mocks.profile }),
}));

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: (...args: unknown[]) => mocks.fromExtended(...args),
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: mocks.debugError },
}));

import { useCalendarTodayCount } from '../calendar/useCalendarTodayCount';
import { useUserEmailAccountIds } from '../shared/useUserEmailAccountIds';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

function calendarChain() {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    get count() {
      return mocks.calendarResult.count;
    },
    get error() {
      return mocks.calendarResult.error;
    },
  };
  return chain;
}

function emailAccountsChain() {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    or: vi.fn(async () => ({ data: mocks.emailRows })),
  };
  return chain;
}

describe('calendar and email account hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authUser = { id: 'user-1' };
    mocks.profile = { id: 'profile-1' };
    mocks.calendarResult = { count: 3, error: null };
    mocks.emailRows = [{ id: 'account-1' }, { id: 'account-2' }];
    mocks.from.mockImplementation(() => calendarChain());
    mocks.fromExtended.mockImplementation(() => emailAccountsChain());
  });

  it('useCalendarTodayCount retourne le count des événements confirmés du jour', async () => {
    const { result } = renderHook(() => useCalendarTodayCount(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current).toBe(3));

    expect(mocks.from).toHaveBeenCalledWith('calendar_events');
  });

  it('useCalendarTodayCount retourne 0 et journalise en cas d’erreur Supabase', async () => {
    const error = new Error('RLS denied');
    mocks.calendarResult = { count: null, error };

    const { result } = renderHook(() => useCalendarTodayCount(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current).toBe(0));
    expect(mocks.debugError).toHaveBeenCalledWith('[CalendarTodayCount] Error:', error);
  });

  it('useCalendarTodayCount reste à 0 sans utilisateur authentifié', () => {
    mocks.authUser = null;

    const { result } = renderHook(() => useCalendarTodayCount(), { wrapper: createWrapper() });

    expect(result.current).toBe(0);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('useUserEmailAccountIds retourne les comptes personnels et partagés actifs', async () => {
    const { result } = renderHook(() => useUserEmailAccountIds(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.accountIds).toEqual(['account-1', 'account-2']));

    expect(result.current.hasAccounts).toBe(true);
    expect(mocks.fromExtended).toHaveBeenCalledWith('user_email_accounts_safe');
  });

  it('useUserEmailAccountIds expose une liste vide quand aucun profil courant n’est disponible', () => {
    mocks.profile = null;

    const { result } = renderHook(() => useUserEmailAccountIds(), { wrapper: createWrapper() });

    expect(result.current.accountIds).toEqual([]);
    expect(result.current.hasAccounts).toBe(false);
    expect(mocks.fromExtended).not.toHaveBeenCalled();
  });
});