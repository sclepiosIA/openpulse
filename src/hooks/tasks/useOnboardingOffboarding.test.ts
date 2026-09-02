// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useOnboardingOffboarding,
  useOnboardingByProfile,
  useUpsertOnboarding,
  useDeleteOnboarding,
} from './useOnboardingOffboarding';

const {
  LIST_DATA,
  SINGLE_DATA,
  AUTH_STATE,
  mockFrom,
  mockToastSuccess,
  mockToastError,
  mockSanitizeSupabaseError,
  mockDebugError,
} = vi.hoisted(() => ({
  LIST_DATA: [
    {
      id: 'oo-1',
      profile_id: 'p-1',
      date_entree: '2024-01-10',
      date_sortie: null,
      statut: 'actif' as const,
      motif_sortie: null,
      dossier_rh: {
        cv: { status: true, ref: 'cv-1', date: '2024-01-01' },
        contrat: { status: true, ref: 'ctr-1', type: 'CDI', date: '2024-01-05' },
        mutuelle: { status: false, ref: null, organisme: null, date: null },
        charte: { status: true, date: '2024-01-06' },
        solde_tout_compte: { status: null, date: null },
        autre: [{ label: 'badge', description: 'remis' }],
      },
      comptes_acces: { google: true, notion: false },
      materiel: {
        pc_mac: { assigne: true, numero_serie: 'mac-1', modele: 'MacBook' },
        laptop: { assigne: false, numero_serie: null, modele: null },
        smartphone: { assigne: true, numero_serie: 'ph-1', modele: 'Pixel', numero: '01' },
        licences: [{ nom: 'Office', numero: 'lic-1' }],
      },
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-02T10:00:00Z',
      created_by: 'u-1',
      updated_by: 'u-1',
      profiles: {
        prenom: 'Ada',
        nom: 'Lovelace',
        email: 'ada@example.test',
        fonction: 'Engineer',
      },
    },
  ],
  SINGLE_DATA: {
    id: 'oo-2',
    profile_id: 'p-2',
    date_entree: '2024-02-01',
    date_sortie: null,
    statut: 'en_cours' as const,
    motif_sortie: null,
    dossier_rh: {
      cv: { status: true, ref: 'cv-2', date: '2024-01-20' },
      contrat: { status: false, ref: null, type: null, date: null },
      mutuelle: { status: false, ref: null, organisme: null, date: null },
      charte: { status: false, date: null },
      solde_tout_compte: { status: null, date: null },
    },
    comptes_acces: { slack: true },
    materiel: {
      pc_mac: { assigne: false, numero_serie: null, modele: null },
      laptop: { assigne: true, numero_serie: 'lap-2', modele: 'ThinkPad' },
      smartphone: { assigne: false, numero_serie: null, modele: null, numero: null },
      licences: [],
    },
    created_at: '2024-02-01T08:00:00Z',
    updated_at: '2024-02-02T08:00:00Z',
    created_by: 'u-1',
    updated_by: 'u-2',
  },
  AUTH_STATE: {
    user: { id: 'u-1', email: 'tester@example.test' },
    session: { user: { id: 'u-1' } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockSanitizeSupabaseError: vi.fn(),
  mockDebugError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper(client?: QueryClient) {
  const queryClient = client ?? createQueryClient();
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

type BuilderResponse = { data: unknown; error: { message: string } | null };

function createBuilder(response: BuilderResponse) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => Promise.resolve(response)),
    single: vi.fn(() => Promise.resolve(response)),
    maybeSingle: vi.fn(() => Promise.resolve(response)),
    then: (
      onFulfilled?: (value: BuilderResponse) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(response).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(response).catch(onRejected),
  };
  return builder;
}

describe('useOnboardingOffboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSanitizeSupabaseError.mockImplementation((error: { message?: string }) => `sanitized:${error.message ?? 'unknown'}`);
  });

  it('charge la liste puis retourne les données métier attendues', async () => {
    const builder = createBuilder({ data: LIST_DATA, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useOnboardingOffboarding(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('rh_onboarding_offboarding');
    expect(builder.select).toHaveBeenCalledWith('*, profiles!inner(prenom, nom, email, fonction)');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });

    expect(result.current.data).toEqual(LIST_DATA);
    expect(result.current.data?.[0].profiles.prenom).toBe('Ada');
    expect(result.current.data?.[0].profiles.nom).toBe('Lovelace');
    expect(result.current.data?.[0].statut).toBe('actif');
    expect(result.current.data?.[0].dossier_rh.contrat.type).toBe('CDI');
    expect(result.current.data?.[0].materiel.smartphone.modele).toBe('Pixel');
    expect(result.current.data?.[0].comptes_acces.google).toBe(true);
  });

  it('passe en erreur si la récupération de la liste échoue', async () => {
    const builder = createBuilder({ data: null, error: { message: 'list failed' } });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useOnboardingOffboarding(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('list failed');
  });

  it('récupère une fiche par profile_id', async () => {
    const builder = createBuilder({ data: SINGLE_DATA, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useOnboardingByProfile('p-2'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('rh_onboarding_offboarding');
    expect(builder.select).toHaveBeenCalledWith(
      'id, profile_id, date_entree, date_sortie, statut, motif_sortie, dossier_rh, comptes_acces, materiel, created_at, updated_at, created_by, updated_by'
    );
    expect(builder.eq).toHaveBeenCalledWith('profile_id', 'p-2');
    expect(builder.maybeSingle).toHaveBeenCalled();

    expect(result.current.data).toEqual(SINGLE_DATA);
    expect(result.current.data?.profile_id).toBe('p-2');
    expect(result.current.data?.statut).toBe('en_cours');
    expect(result.current.data?.materiel.laptop.modele).toBe('ThinkPad');
    expect(result.current.data?.comptes_acces.slack).toBe(true);
  });

  it('n’exécute pas la requête par profile_id quand profileId est null', () => {
    const { result } = renderHook(() => useOnboardingByProfile(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.status).toBe('pending');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('passe en erreur si la récupération par profile_id échoue', async () => {
    const builder = createBuilder({ data: null, error: { message: 'single failed' } });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useOnboardingByProfile('p-2'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('single failed');
  });

  it('upsert une fiche, invalide le cache et affiche un toast de succès', async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const builder = createBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const payload = {
      profile_id: 'p-3',
      date_entree: '2024-03-01',
      statut: 'actif' as const,
      dossier_rh: {
        cv: { status: true, ref: 'cv-3', date: '2024-02-20' },
        contrat: { status: true, ref: 'ctr-3', type: 'CDD', date: '2024-02-25' },
        mutuelle: { status: false, ref: null, organisme: null, date: null },
        charte: { status: true, date: '2024-02-26' },
        solde_tout_compte: { status: null, date: null },
      },
      comptes_acces: { jira: true, figma: true },
      materiel: {
        pc_mac: { assigne: false, numero_serie: null, modele: null },
        laptop: { assigne: true, numero_serie: 'lap-3', modele: 'Dell' },
        smartphone: { assigne: true, numero_serie: 'ph-3', modele: 'iPhone', numero: '02' },
        licences: [{ nom: 'Figma', numero: 'lic-3' }],
      },
    };

    const { result } = renderHook(() => useUpsertOnboarding(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockFrom).toHaveBeenCalledWith('rh_onboarding_offboarding');
    expect(builder.upsert).toHaveBeenCalledWith(
      [
        {
          ...payload,
          dossier_rh: JSON.parse(JSON.stringify(payload.dossier_rh)),
          comptes_acces: JSON.parse(JSON.stringify(payload.comptes_acces)),
          materiel: JSON.parse(JSON.stringify(payload.materiel)),
        },
      ],
      { onConflict: 'profile_id' }
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['onboarding-offboarding'] });
    expect(mockToastSuccess).toHaveBeenCalledWith('Fiche mise à jour avec succès');
  });

  it('gère l’erreur de upsert avec message sanitizé et debug', async () => {
    const builder = createBuilder({ data: null, error: { message: 'upsert failed' } });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useUpsertOnboarding(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ profile_id: 'p-4' });
      } catch {}
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(expect.objectContaining({ message: 'upsert failed' }));
    expect(mockToastError).toHaveBeenCalledWith('sanitized:upsert failed');
    expect(mockDebugError).toHaveBeenCalledWith(
      'Onboarding upsert error:',
      expect.objectContaining({ message: 'upsert failed' })
    );
  });

  it('supprime une fiche, invalide le cache et affiche un toast de succès', async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const builder = createBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useDeleteOnboarding(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('oo-9');
    });

    expect(mockFrom).toHaveBeenCalledWith('rh_onboarding_offboarding');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'oo-9');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['onboarding-offboarding'] });
    expect(mockToastSuccess).toHaveBeenCalledWith('Fiche supprimée');
  });

  it('gère l’erreur de suppression avec message sanitizé et debug', async () => {
    const builder = createBuilder({ data: null, error: { message: 'delete failed' } });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useDeleteOnboarding(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync('oo-10');
      } catch {}
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(expect.objectContaining({ message: 'delete failed' }));
    expect(mockToastError).toHaveBeenCalledWith('sanitized:delete failed');
    expect(mockDebugError).toHaveBeenCalledWith(
      'Onboarding delete error:',
      expect.objectContaining({ message: 'delete failed' })
    );
  });
});