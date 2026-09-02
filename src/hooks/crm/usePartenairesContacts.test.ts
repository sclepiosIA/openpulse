/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  usePartenairesContacts,
  useCreatePartenaireContact,
  useUpdatePartenaireContact,
  useDeletePartenaireContact,
} from './usePartenairesContacts';

const { CONTACTS, SUCCESS_RESULT, ERROR_RESULT, TOAST_FN, mockFrom, mockSanitizeSupabaseError, queryPresetsReference } = vi.hoisted(() => {
  const CONTACTS = [
    {
      id: 'c1',
      partenaire_id: 'p1',
      nom: 'Alpha',
      prenom: 'Anne',
      fonction: 'Direction',
      email: 'anne@example.test',
      telephone: '0101',
      est_contact_principal: true,
      notes: 'principal',
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
      created_source: 'app',
      created_metadata: { imported: false },
    },
    {
      id: 'c2',
      partenaire_id: 'p1',
      nom: 'Beta',
      prenom: null,
      fonction: null,
      email: null,
      telephone: null,
      est_contact_principal: false,
      notes: null,
      created_at: '2024-01-03',
      updated_at: '2024-01-04',
      created_source: 'app',
      created_metadata: null,
    },
  ];

  const SUCCESS_RESULT = { data: CONTACTS, error: null };
  const ERROR_RESULT = { data: null, error: { message: 'x' } };
  const TOAST_FN = vi.fn();
  const mockFrom = vi.fn();
  const mockSanitizeSupabaseError = vi.fn(() => 'Erreur nettoyée');
  const queryPresetsReference = { staleTime: 30 * 60 * 1000 };

  return {
    CONTACTS,
    SUCCESS_RESULT,
    ERROR_RESULT,
    TOAST_FN,
    mockFrom,
    mockSanitizeSupabaseError,
    queryPresetsReference,
  };
});

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: TOAST_FN }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    reference: queryPresetsReference,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
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
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown) => Promise.resolve(result).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return builder;
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client },
      children,
    );
  };
}

describe('usePartenairesContacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge puis retourne les contacts triés/filtrés du partenaire', async () => {
    const builder = createBuilder(SUCCESS_RESULT);
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    const { result } = renderHook(() => usePartenairesContacts('p1'), {
      wrapper: createWrapper(client),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.contacts).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('partenaires_contacts');
    expect(builder.select).toHaveBeenCalledWith(
      'id, partenaire_id, nom, prenom, fonction, email, telephone, est_contact_principal, notes, created_at, updated_at, created_source, created_metadata',
    );
    expect(builder.eq).toHaveBeenCalledWith('partenaire_id', 'p1');
    expect(builder.order).toHaveBeenNthCalledWith(1, 'est_contact_principal', { ascending: false });
    expect(builder.order).toHaveBeenNthCalledWith(2, 'nom', { ascending: true });

    expect(result.current.error).toBeNull();
    expect(result.current.contacts).toEqual(CONTACTS);
    expect(result.current.contacts[0].est_contact_principal).toBe(true);
    expect(result.current.contacts[0].nom).toBe('Alpha');
    expect(result.current.contacts[1].nom).toBe('Beta');
  });

  it('retourne une erreur de query quand supabase échoue', async () => {
    const builder = createBuilder(ERROR_RESULT);
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    const { result } = renderHook(() => usePartenairesContacts('p1'), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.contacts).toEqual([]);
    expect(result.current.error?.message).toBe('x');
  });
});

describe('useCreatePartenaireContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('insère un contact, invalide la query associée et affiche un toast de succès', async () => {
    const builder = createBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const invalidateQueriesSpy = vi.spyOn(client, 'invalidateQueries');

    const payload = {
      partenaire_id: 'p1',
      nom: 'Gamma',
      prenom: 'Luc',
      est_contact_principal: false,
      email: 'luc@example.test',
    };

    const { result } = renderHook(() => useCreatePartenaireContact(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockFrom).toHaveBeenCalledWith('partenaires_contacts');
    expect(builder.insert).toHaveBeenCalledWith([payload]);
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Contact créé',
      description: 'Le contact a été ajouté avec succès.',
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['partenaires-contacts', 'p1'] });
  });

  it('gère une erreur de création avec message sanitizé', async () => {
    const builder = createBuilder({ data: null, error: { message: 'x' } });
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    const payload = {
      partenaire_id: 'p1',
      nom: 'Gamma',
    };

    const { result } = renderHook(() => useCreatePartenaireContact(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync(payload);
      } catch {}
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalled();
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur nettoyée',
      variant: 'destructive',
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdatePartenaireContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('met à jour un contact par id, invalide la bonne query et affiche un toast', async () => {
    const builder = createBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const invalidateQueriesSpy = vi.spyOn(client, 'invalidateQueries');

    const payload = {
      id: 'c1',
      partenaire_id: 'p1',
      nom: 'Alpha modifié',
      telephone: '0202',
    };

    const { result } = renderHook(() => useUpdatePartenaireContact(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockFrom).toHaveBeenCalledWith('partenaires_contacts');
    expect(builder.update).toHaveBeenCalledWith({
      nom: 'Alpha modifié',
      telephone: '0202',
    });
    expect(builder.eq).toHaveBeenCalledWith('id', 'c1');
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Contact mis à jour',
      description: 'Les modifications ont été enregistrées.',
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['partenaires-contacts', 'p1'] });
  });

  it('gère une erreur de mise à jour avec toast destructif', async () => {
    const builder = createBuilder({ data: null, error: { message: 'x' } });
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    const { result } = renderHook(() => useUpdatePartenaireContact(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          id: 'c1',
          partenaire_id: 'p1',
          nom: 'Alpha modifié',
        });
      } catch {}
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalled();
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur nettoyée',
      variant: 'destructive',
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeletePartenaireContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('supprime un contact par id, invalide la query et affiche un toast de succès', async () => {
    const builder = createBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const invalidateQueriesSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useDeletePartenaireContact(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 'c2', partenaire_id: 'p1' });
    });

    expect(mockFrom).toHaveBeenCalledWith('partenaires_contacts');
    expect(builder.delete).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith('id', 'c2');
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Contact supprimé',
      description: 'Le contact a été supprimé avec succès.',
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['partenaires-contacts', 'p1'] });
  });

  it('gère une erreur de suppression avec toast destructif', async () => {
    const builder = createBuilder({ data: null, error: { message: 'x' } });
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    const { result } = renderHook(() => useDeletePartenaireContact(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 'c2', partenaire_id: 'p1' });
      } catch {}
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalled();
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur nettoyée',
      variant: 'destructive',
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});