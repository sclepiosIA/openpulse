/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useUserEmailAccountIds } from './useUserEmailAccountIds';

const {
  PROFILE,
  EMPTY_PROFILE,
  ROWS,
  ERROR_RESULT,
  currentProfileState,
  mockUseCurrentProfile,
  mockOr,
  mockEq,
  mockSelect,
  mockFromExtended,
} = vi.hoisted(() => {
  const PROFILE = { id: 'profile-1' };
  const EMPTY_PROFILE = undefined;
  const ROWS = [{ id: 'acc-1' }, { id: 'acc-2' }];
  const ERROR_RESULT = { data: null, error: { message: 'x' } };

  const currentProfileState: {
    value: { data: { id: string } | undefined };
  } = {
    value: { data: PROFILE },
  };

  const mockOr = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockFromExtended = vi.fn();
  const mockUseCurrentProfile = vi.fn(() => currentProfileState.value);

  return {
    PROFILE,
    EMPTY_PROFILE,
    ROWS,
    ERROR_RESULT,
    currentProfileState,
    mockUseCurrentProfile,
    mockOr,
    mockEq,
    mockSelect,
    mockFromExtended,
  };
});

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: mockUseCurrentProfile,
}));

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: mockFromExtended,
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
  const queryClient = createQueryClient();

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function setupSuccessBuilder() {
  const builder = {
    select: mockSelect,
    eq: mockEq,
    or: mockOr,
    then: (onFulfilled: (value: { data: typeof ROWS; error: null }) => unknown) =>
      Promise.resolve(onFulfilled({ data: ROWS, error: null })),
    catch: () => Promise.resolve(),
  };

  mockSelect.mockImplementation(() => builder);
  mockEq.mockImplementation(() => builder);
  mockOr.mockImplementation(() => Promise.resolve({ data: ROWS, error: null }));
  mockFromExtended.mockImplementation(() => builder);
}

function setupErrorBuilder() {
  const builder = {
    select: mockSelect,
    eq: mockEq,
    or: mockOr,
    then: (onFulfilled: (value: typeof ERROR_RESULT) => unknown) =>
      Promise.resolve(onFulfilled(ERROR_RESULT)),
    catch: () => Promise.resolve(),
  };

  mockSelect.mockImplementation(() => builder);
  mockEq.mockImplementation(() => builder);
  mockOr.mockImplementation(() => Promise.resolve(ERROR_RESULT));
  mockFromExtended.mockImplementation(() => builder);
}

describe('useUserEmailAccountIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentProfileState.value = { data: PROFILE };
  });

  it('expose un état de chargement puis retourne les ids de comptes actifs personnels et partagés', async () => {
    setupSuccessBuilder();

    const { result } = renderHook(() => useUserEmailAccountIds(), {
      wrapper: createWrapper(),
    });

    expect(result.current.accountIds).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasAccounts).toBe(false);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFromExtended).toHaveBeenCalledWith('user_email_accounts_safe');
    expect(mockSelect).toHaveBeenCalledWith('id');
    expect(mockEq).toHaveBeenCalledWith('is_active', true);
    expect(mockOr).toHaveBeenCalledWith(`profile_id.eq.${PROFILE.id},is_shared.eq.true`);

    expect(result.current.accountIds).toEqual(['acc-1', 'acc-2']);
    expect(result.current.hasAccounts).toBe(true);
  });

  it('ne lance pas la requête et retourne des valeurs vides quand le profil courant est absent', async () => {
    currentProfileState.value = { data: EMPTY_PROFILE };
    setupSuccessBuilder();

    const { result } = renderHook(() => useUserEmailAccountIds(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFromExtended).not.toHaveBeenCalled();
    expect(result.current.accountIds).toEqual([]);
    expect(result.current.hasAccounts).toBe(false);
  });

  it('retourne une liste vide et hasAccounts=false si la requête renvoie data:null avec une erreur', async () => {
    setupErrorBuilder();

    const { result } = renderHook(() => useUserEmailAccountIds(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFromExtended).toHaveBeenCalledWith('user_email_accounts_safe');
    expect(mockSelect).toHaveBeenCalledWith('id');
    expect(mockEq).toHaveBeenCalledWith('is_active', true);
    expect(mockOr).toHaveBeenCalledWith(`profile_id.eq.${PROFILE.id},is_shared.eq.true`);

    expect(result.current.accountIds).toEqual([]);
    expect(result.current.hasAccounts).toBe(false);
  });
});