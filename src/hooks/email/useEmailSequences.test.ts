/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useEmailSequences,
  useSequenceEnrollments,
  useCreateSequence,
  useUpdateSequence,
  useDeleteSequence,
  useEnrollInSequence,
  useCancelEnrollment,
} from './useEmailSequences';

const {
  USER,
  SEQUENCES,
  ENROLLMENTS,
  CREATED_SEQUENCE,
  SEQUENCE_ETAPES_ROW,
  toastSuccess,
  toastError,
  mockUseAuth,
  mockFrom,
} = vi.hoisted(() => ({
  USER: { id: 'u1', email: 'user@test.co' },
  SEQUENCES: [
    {
      id: 'seq1',
      nom: 'Relance écoles',
      description: 'Suite de relance',
      etapes: [
        { delay_days: 0, subject: 'Bonjour', body_html: '<p>Salut</p>', condition: 'always' as const },
        { delay_days: 3, subject: 'Relance', body_html: '<p>Relance</p>', condition: 'no_reply' as const },
      ],
      statut: 'active' as const,
      created_by: 'u1',
      created_at: '2024-01-02T10:00:00.000Z',
      updated_at: '2024-01-03T10:00:00.000Z',
    },
    {
      id: 'seq2',
      nom: 'Nurture',
      description: null,
      etapes: [{ delay_days: 1, subject: 'Step 1', body_html: '<p>A</p>', condition: 'always' as const }],
      statut: 'draft' as const,
      created_by: 'u1',
      created_at: '2024-01-01T10:00:00.000Z',
      updated_at: '2024-01-01T12:00:00.000Z',
    },
  ],
  ENROLLMENTS: [
    {
      id: 'en1',
      sequence_id: 'seq1',
      etablissement_id: 'eta1',
      contact_email: 'lead@test.co',
      contact_name: 'Lead',
      etape_courante: 0,
      statut: 'active' as const,
      prochaine_action_at: '2024-01-05T10:00:00.000Z',
      derniere_action_at: null,
      metadata: {},
      created_at: '2024-01-04T10:00:00.000Z',
      updated_at: '2024-01-04T10:00:00.000Z',
      etablissement: { id: 'eta1', nom: 'Lycée A' },
    },
  ],
  CREATED_SEQUENCE: {
    id: 'seq-created',
    nom: 'Nouvelle séquence',
    description: 'Desc',
    etapes: [{ delay_days: 2, subject: 'Intro', body_html: '<p>Intro</p>', condition: 'always' as const }],
    statut: 'draft' as const,
    created_by: 'u1',
    created_at: '2024-02-01T09:00:00.000Z',
    updated_at: '2024-02-01T09:00:00.000Z',
  },
  SEQUENCE_ETAPES_ROW: {
    etapes: [{ delay_days: 2, subject: 'J+2', body_html: '<p>Body</p>', condition: 'always' as const }],
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  mockUseAuth: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

type SupabaseResponse = { data: unknown; error: { message: string } | null };

function createThenableBuilder(response: SupabaseResponse) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(response)),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(response)),
    maybeSingle: vi.fn(() => Promise.resolve(response)),
    then: (
      onFulfilled?: (value: SupabaseResponse) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(response).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(response).catch(onRejected),
  };
  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { wrapper, queryClient };
}

describe('useEmailSequences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: USER,
      session: { user: { id: USER.id } },
      isLoading: false,
    });
  });

  it('charge les séquences et retourne les valeurs métier attendues', async () => {
    const builder = createThenableBuilder({ data: SEQUENCES, error: null });
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useEmailSequences(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('email_sequences');
    expect(builder.select).toHaveBeenCalledWith(
      'id, nom, description, etapes, statut, created_by, created_at, updated_at'
    );
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(200);
    expect(result.current.data).toEqual(SEQUENCES);
    expect(result.current.data?.[0]?.nom).toBe('Relance écoles');
    expect(result.current.data?.[0]?.etapes[1]?.delay_days).toBe(3);
    expect(result.current.data?.[1]?.description).toBeNull();
  });

  it('passe en erreur quand la requête des séquences échoue', async () => {
    const builder = createThenableBuilder({ data: null, error: { message: 'fetch failed' } });
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useEmailSequences(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('fetch failed');
  });

  it('charge les inscriptions d’une séquence avec le filtre sequence_id', async () => {
    const builder = createThenableBuilder({ data: ENROLLMENTS, error: null });
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSequenceEnrollments('seq1'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('email_sequence_enrollments');
    expect(builder.select).toHaveBeenCalledWith('*, etablissement:etablissements(id, nom)');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.eq).toHaveBeenCalledWith('sequence_id', 'seq1');
    expect(result.current.data).toEqual(ENROLLMENTS);
    expect(result.current.data?.[0]?.etablissement?.nom).toBe('Lycée A');
    expect(result.current.data?.[0]?.contact_email).toBe('lead@test.co');
  });

  it('passe en erreur quand le chargement des inscriptions échoue', async () => {
    const builder = createThenableBuilder({ data: null, error: { message: 'enrollments failed' } });
    mockFrom.mockReturnValue(builder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSequenceEnrollments('seq1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('enrollments failed');
  });

  it('crée une séquence, invalide le cache et affiche un toast de succès', async () => {
    const insertBuilder = createThenableBuilder({ data: CREATED_SEQUENCE, error: null });
    mockFrom.mockReturnValue(insertBuilder);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateSequence(), { wrapper });

    const payload = {
      nom: 'Nouvelle séquence',
      description: 'Desc',
      etapes: [{ delay_days: 2, subject: 'Intro', body_html: '<p>Intro</p>', condition: 'always' as const }],
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_sequences');
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      {
        nom: 'Nouvelle séquence',
        description: 'Desc',
        etapes: payload.etapes,
        statut: 'draft',
        created_by: 'u1',
      },
    ]);
    expect(insertBuilder.select).toHaveBeenCalledWith();
    expect(insertBuilder.single).toHaveBeenCalledWith();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['email-sequences'] });
    expect(toastSuccess).toHaveBeenCalledWith('Séquence créée avec succès');
  });

  it('gère l’erreur de création avec un toast error', async () => {
    const insertBuilder = createThenableBuilder({ data: null, error: { message: 'insert failed' } });
    mockFrom.mockReturnValue(insertBuilder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateSequence(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          nom: 'Nouvelle séquence',
          etapes: [{ delay_days: 1, subject: 'S', body_html: '<p>B</p>' }],
        })
      ).rejects.toMatchObject({ message: 'insert failed' });
    });

    expect(toastError).toHaveBeenCalledWith('Erreur: insert failed');
  });

  it('met à jour une séquence avec le bon payload et notifie le succès', async () => {
    const updateBuilder = createThenableBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(updateBuilder);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateSequence(), { wrapper });

    const payload = {
      id: 'seq1',
      nom: 'Relance modifiée',
      description: 'Desc modifiée',
      etapes: [{ delay_days: 4, subject: 'Nouveau', body_html: '<p>Body</p>' }],
      statut: 'paused',
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_sequences');
    expect(updateBuilder.update).toHaveBeenCalledWith({
      nom: 'Relance modifiée',
      description: 'Desc modifiée',
      etapes: payload.etapes,
      statut: 'paused',
    });
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'seq1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['email-sequences'] });
    expect(toastSuccess).toHaveBeenCalledWith('Séquence mise à jour');
  });

  it('gère l’erreur de mise à jour', async () => {
    const updateBuilder = createThenableBuilder({ data: null, error: { message: 'update failed' } });
    mockFrom.mockReturnValue(updateBuilder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateSequence(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'seq1', nom: 'X' })).rejects.toMatchObject({
        message: 'update failed',
      });
    });

    expect(toastError).toHaveBeenCalledWith('Erreur: update failed');
  });

  it('supprime une séquence et invalide la liste', async () => {
    const deleteBuilder = createThenableBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(deleteBuilder);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteSequence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('seq1');
    });

    expect(mockFrom).toHaveBeenCalledWith('email_sequences');
    expect(deleteBuilder.delete).toHaveBeenCalledWith();
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'seq1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['email-sequences'] });
    expect(toastSuccess).toHaveBeenCalledWith('Séquence supprimée');
  });

  it('inscrit un contact dans une séquence avec la prochaine action calculée et notifie le succès', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-10T08:00:00.000Z'));

    const sequenceBuilder = createThenableBuilder({ data: SEQUENCE_ETAPES_ROW, error: null });
    const insertBuilder = createThenableBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(sequenceBuilder).mockReturnValueOnce(insertBuilder);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useEnrollInSequence(), { wrapper });

    const payload = {
      sequence_id: 'seq1',
      etablissement_id: 'eta1',
      contact_email: 'new@test.co',
      contact_name: 'Nouveau Contact',
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'email_sequences');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'email_sequence_enrollments');
    expect(sequenceBuilder.select).toHaveBeenCalledWith('etapes');
    expect(sequenceBuilder.eq).toHaveBeenCalledWith('id', 'seq1');
    expect(sequenceBuilder.maybeSingle).toHaveBeenCalledWith();

    const insertArg = insertBuilder.insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArg.sequence_id).toBe('seq1');
    expect(insertArg.etablissement_id).toBe('eta1');
    expect(insertArg.contact_email).toBe('new@test.co');
    expect(insertArg.contact_name).toBe('Nouveau Contact');
    expect(insertArg.etape_courante).toBe(0);
    expect(insertArg.statut).toBe('active');
    expect(insertArg.created_by).toBe('u1');
    expect(typeof insertArg.prochaine_action_at).toBe('string');
    expect(new Date(String(insertArg.prochaine_action_at)).toISOString()).toBe('2024-03-12T08:00:00.000Z');

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['sequence-enrollments'] });
    expect(toastSuccess).toHaveBeenCalledWith('Contact inscrit dans la séquence');

    vi.useRealTimers();
  });

  it('gère l’erreur d’inscription dans une séquence', async () => {
    const sequenceBuilder = createThenableBuilder({ data: SEQUENCE_ETAPES_ROW, error: null });
    const insertBuilder = createThenableBuilder({ data: null, error: { message: 'enroll failed' } });
    mockFrom.mockReturnValueOnce(sequenceBuilder).mockReturnValueOnce(insertBuilder);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useEnrollInSequence(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          sequence_id: 'seq1',
          etablissement_id: 'eta1',
          contact_email: 'new@test.co',
        })
      ).rejects.toMatchObject({ message: 'enroll failed' });
    });

    expect(toastError).toHaveBeenCalledWith('Erreur: enroll failed');
  });

  it('annule une inscription et invalide la liste des enrollments', async () => {
    const updateBuilder = createThenableBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(updateBuilder);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCancelEnrollment(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('en1');
    });

    expect(mockFrom).toHaveBeenCalledWith('email_sequence_enrollments');
    expect(updateBuilder.update).toHaveBeenCalledWith({ statut: 'cancelled' });
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'en1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['sequence-enrollments'] });
    expect(toastSuccess).toHaveBeenCalledWith('Inscription annulée');
  });
});