/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useDefaultEmailAccount } from './useDefaultEmailAccount';

type EmailAccountRow = {
  id: string;
  email_address: string;
  is_active: boolean;
  profile_id: string | null;
  is_shared: boolean;
};

type ProfileRow = {
  id: string;
  prenom: string;
  nom: string;
};

const {
  PROFILE,
  PROFILE_NO_NAME,
  ACCOUNTS_MATCHING,
  ACCOUNTS_WITH_MARQUE_FALLBACK,
  ACCOUNTS_SINGLE,
  ACCOUNTS_EMPTY,
  QUERY_ERROR,
  mockUseCurrentProfile,
  mockFromExtended,
} = vi.hoisted(() => {
  const PROFILE: ProfileRow = {
    id: 'profile-1',
    prenom: 'Jean',
    nom: 'Dupont',
  };

  const PROFILE_NO_NAME: ProfileRow = {
    id: 'profile-1',
    prenom: '',
    nom: '',
  };

  const ACCOUNTS_MATCHING: EmailAccountRow[] = [
    {
      id: 'acc-other',
      email_address: 'other@example.com',
      is_active: true,
      profile_id: 'profile-1',
      is_shared: false,
    },
    {
      id: 'acc-match',
      email_address: 'jean.dupont@exploitant.example.org',
      is_active: true,
      profile_id: 'profile-1',
      is_shared: false,
    },
    {
      id: 'acc-shared',
      email_address: 'shared@exploitant.example.org',
      is_active: true,
      profile_id: null,
      is_shared: true,
    },
  ];

  const ACCOUNTS_WITH_MARQUE_FALLBACK: EmailAccountRow[] = [
    {
      id: 'acc-first',
      email_address: 'alpha@example.com',
      is_active: true,
      profile_id: 'profile-1',
      is_shared: false,
    },
    {
      id: 'acc-marque',
      email_address: 'team@exploitant.example.org',
      is_active: true,
      profile_id: null,
      is_shared: true,
    },
  ];

  const ACCOUNTS_SINGLE: EmailAccountRow[] = [
    {
      id: 'acc-single',
      email_address: 'solo@example.com',
      is_active: true,
      profile_id: 'profile-1',
      is_shared: false,
    },
  ];

  const ACCOUNTS_EMPTY: EmailAccountRow[] = [];

  const QUERY_ERROR = { message: 'x' };

  return {
    PROFILE,
    PROFILE_NO_NAME,
    ACCOUNTS_MATCHING,
    ACCOUNTS_WITH_MARQUE_FALLBACK,
    ACCOUNTS_SINGLE,
    ACCOUNTS_EMPTY,
    QUERY_ERROR,
    mockUseCurrentProfile: vi.fn(),
    mockFromExtended: vi.fn(),
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
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createThenableBuilder(result: { data: EmailAccountRow[] | null; error: { message: string } | null }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    in: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (
      onFulfilled?: ((value: typeof result) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) => Promise.resolve(result).then(onFulfilled ?? undefined, onRejected ?? undefined),
    catch: (onRejected?: ((reason: unknown) => unknown) | null) =>
      Promise.resolve(result).catch(onRejected ?? undefined),
  };

  return builder;
}

describe('useDefaultEmailAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCurrentProfile.mockReturnValue({
      data: PROFILE,
    });
  });

  it('retourne directement accountId quand il est fourni et différent de all', async () => {
    const builder = createThenableBuilder({ data: ACCOUNTS_MATCHING, error: null });
    mockFromExtended.mockReturnValue(builder);

    const { result } = renderHook(() => useDefaultEmailAccount('explicit-id'), {
      wrapper: createWrapper(),
    });

    expect(result.current.resolvedAccountId).toBe('explicit-id');
    expect(result.current.resolvedAccount).toBeNull();
    expect(result.current.accounts).toBeUndefined();

    await waitFor(() => {
      expect(result.current.accounts).toEqual(ACCOUNTS_MATCHING);
    });

    expect(mockFromExtended).toHaveBeenCalledWith('user_email_accounts_safe');
    expect(builder.select).toHaveBeenCalledWith('id, email_address, is_active, profile_id, is_shared');
    expect(builder.eq).toHaveBeenCalledWith('is_active', true);
    expect(builder.or).toHaveBeenCalledWith('profile_id.eq.profile-1,is_shared.eq.true');
    expect(builder.order).toHaveBeenCalledWith('email_address');
    expect(result.current.resolvedAccountId).toBe('explicit-id');
    expect(result.current.resolvedAccount).toBeNull();
  });

  it('expose undefined pendant le chargement puis sélectionne le compte marque correspondant au prénom/nom', async () => {
    const builder = createThenableBuilder({ data: ACCOUNTS_MATCHING, error: null });
    mockFromExtended.mockReturnValue(builder);

    const { result } = renderHook(() => useDefaultEmailAccount('all'), {
      wrapper: createWrapper(),
    });

    expect(result.current.accounts).toBeUndefined();
    expect(result.current.resolvedAccountId).toBeNull();
    expect(result.current.resolvedAccount).toBeNull();

    await waitFor(() => {
      expect(result.current.accounts).toEqual(ACCOUNTS_MATCHING);
    });

    expect(result.current.resolvedAccountId).toBe('acc-match');
    expect(result.current.resolvedAccount).toEqual(ACCOUNTS_MATCHING[1]);
  });

  it('fallback sur un compte @exploitant.example.org s’il n’y a pas de correspondance exacte', async () => {
    const builder = createThenableBuilder({ data: ACCOUNTS_WITH_MARQUE_FALLBACK, error: null });
    mockFromExtended.mockReturnValue(builder);

    const { result } = renderHook(() => useDefaultEmailAccount('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.accounts).toEqual(ACCOUNTS_WITH_MARQUE_FALLBACK);
    });

    expect(result.current.resolvedAccountId).toBe('acc-marque');
    expect(result.current.resolvedAccount).toEqual(ACCOUNTS_WITH_MARQUE_FALLBACK[1]);
  });

  it('retourne le seul compte disponible quand la liste contient un seul élément', async () => {
    const builder = createThenableBuilder({ data: ACCOUNTS_SINGLE, error: null });
    mockFromExtended.mockReturnValue(builder);

    const { result } = renderHook(() => useDefaultEmailAccount('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.accounts).toEqual(ACCOUNTS_SINGLE);
    });

    expect(result.current.resolvedAccountId).toBe('acc-single');
    expect(result.current.resolvedAccount).toEqual(ACCOUNTS_SINGLE[0]);
  });

  it('retourne null quand aucun compte n’est disponible', async () => {
    const builder = createThenableBuilder({ data: ACCOUNTS_EMPTY, error: null });
    mockFromExtended.mockReturnValue(builder);

    const { result } = renderHook(() => useDefaultEmailAccount('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.accounts).toEqual(ACCOUNTS_EMPTY);
    });

    expect(result.current.resolvedAccountId).toBeNull();
    expect(result.current.resolvedAccount).toBeNull();
  });

  it('fallback sur le premier compte disponible quand le profil n’a pas prénom/nom', async () => {
    const builder = createThenableBuilder({ data: ACCOUNTS_WITH_MARQUE_FALLBACK, error: null });
    mockFromExtended.mockReturnValue(builder);
    mockUseCurrentProfile.mockReturnValue({
      data: PROFILE_NO_NAME,
    });

    const { result } = renderHook(() => useDefaultEmailAccount('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.accounts).toEqual(ACCOUNTS_WITH_MARQUE_FALLBACK);
    });

    expect(result.current.resolvedAccountId).toBe('acc-first');
    expect(result.current.resolvedAccount).toEqual(ACCOUNTS_WITH_MARQUE_FALLBACK[0]);
  });

  it('remonte une erreur react-query quand la requête échoue', async () => {
    const builder = createThenableBuilder({ data: null, error: QUERY_ERROR });
    mockFromExtended.mockReturnValue(builder);

    const { result } = renderHook(() => useDefaultEmailAccount('all'), {
      wrapper: createWrapper(),
    });

    expect(result.current.accounts).toBeUndefined();
    expect(result.current.resolvedAccountId).toBeNull();
    expect(result.current.resolvedAccount).toBeNull();

    await waitFor(() => {
      expect(result.current.accounts).toBeUndefined();
      expect(result.current.resolvedAccountId).toBeNull();
      expect(result.current.resolvedAccount).toBeNull();
      expect(mockFromExtended).toHaveBeenCalledWith('user_email_accounts_safe');
      expect(builder.select).toHaveBeenCalledWith('id, email_address, is_active, profile_id, is_shared');
      expect(builder.eq).toHaveBeenCalledWith('is_active', true);
      expect(builder.or).toHaveBeenCalledWith('profile_id.eq.profile-1,is_shared.eq.true');
      expect(builder.order).toHaveBeenCalledWith('email_address');
    });
  });
});