/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  usePulseEntityLinksByMessage,
  usePulseMessagesByEntity,
  useCreatePulseEntityLinks,
  useDeletePulseEntityLink,
  extractEntityLinksFromContent,
  pulseEntityLinkKeys,
} from './usePulseEntityLinks';

const {
  MESSAGE_LINKS,
  ENTITY_LINKS,
  INSERTED_LINKS,
  PROFILE_DATA,
  mockFrom,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
} = vi.hoisted(() => ({
  MESSAGE_LINKS: [
    {
      id: 'link-1',
      message_id: 'msg-1',
      conversation_id: 'conv-1',
      entity_type: 'contact' as const,
      entity_id: 'contact-1',
      entity_name: 'Alice',
      created_by: 'profile-1',
      created_at: '2024-01-01T10:00:00Z',
    },
    {
      id: 'link-2',
      message_id: 'msg-1',
      conversation_id: 'conv-1',
      entity_type: 'groupe' as const,
      entity_id: 'group-1',
      entity_name: 'Equipe Produit',
      created_by: 'profile-1',
      created_at: '2024-01-01T10:05:00Z',
    },
  ],
  ENTITY_LINKS: [
    {
      id: 'link-3',
      message_id: 'msg-2',
      conversation_id: 'conv-2',
      entity_type: 'contact' as const,
      entity_id: 'contact-1',
      entity_name: 'Alice',
      created_by: 'profile-1',
      created_at: '2024-01-02T09:00:00Z',
    },
  ],
  INSERTED_LINKS: [
    {
      id: 'inserted-1',
      message_id: 'msg-9',
      conversation_id: 'conv-9',
      entity_type: 'contact' as const,
      entity_id: 'contact-9',
      entity_name: 'Bob',
      created_by: 'profile-1',
      created_at: '2024-01-03T09:00:00Z',
    },
    {
      id: 'inserted-2',
      message_id: 'msg-9',
      conversation_id: 'conv-9',
      entity_type: 'todo' as const,
      entity_id: 'todo-4',
      entity_name: 'Relancer',
      created_by: 'profile-1',
      created_at: '2024-01-03T09:01:00Z',
    },
  ],
  PROFILE_DATA: { id: 'profile-1' },
  mockFrom: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockDebugError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: vi.fn(() => ({
    data: PROFILE_DATA,
  })),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

type BuilderResult = {
  data: unknown;
  error: { message: string } | null;
};

function createSupabaseBuilder(result: BuilderResult) {
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
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: BuilderResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
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

  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  return { Wrapper, queryClient, invalidateQueries };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pulseEntityLinkKeys', () => {
  it('construit les clés attendues', () => {
    expect(pulseEntityLinkKeys.all).toEqual(['pulse-entity-links']);
    expect(pulseEntityLinkKeys.byMessage('m1')).toEqual(['pulse-entity-links', 'message', 'm1']);
    expect(pulseEntityLinkKeys.byEntity('contact', 'c1')).toEqual(['pulse-entity-links', 'entity', 'contact', 'c1']);
    expect(pulseEntityLinkKeys.byConversation('conv1')).toEqual(['pulse-entity-links', 'conversation', 'conv1']);
  });
});

describe('extractEntityLinksFromContent', () => {
  it('extrait uniquement les entités supportées depuis le contenu', () => {
    const content =
      'Bonjour #[Alice](contact:contact-1) puis #[ACME](etablissement:eta-3) et #[Sprint](groupe:grp-5) mais pas #[X](unknown:1)';

    expect(extractEntityLinksFromContent(content)).toEqual([
      {
        entity_type: 'contact',
        entity_id: 'contact-1',
        entity_name: 'Alice',
      },
      {
        entity_type: 'etablissement',
        entity_id: 'eta-3',
        entity_name: 'ACME',
      },
      {
        entity_type: 'groupe',
        entity_id: 'grp-5',
        entity_name: 'Sprint',
      },
    ]);
  });

  it('retourne un tableau vide quand aucun lien valide n’est présent', () => {
    expect(extractEntityLinksFromContent('Texte sans motif valide')).toEqual([]);
  });
});

describe('usePulseEntityLinksByMessage', () => {
  it('charge puis retourne les liens d’un message', async () => {
    const builder = createSupabaseBuilder({ data: MESSAGE_LINKS, error: null });
    mockFrom.mockReturnValue(builder);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePulseEntityLinksByMessage('msg-1'), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('pulse_message_entity_links');
    expect(builder.select).toHaveBeenCalledWith(
      'id, message_id, conversation_id, entity_type, entity_id, entity_name, created_by, created_at'
    );
    expect(builder.eq).toHaveBeenCalledWith('message_id', 'msg-1');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(result.current.data).toEqual(MESSAGE_LINKS);
    expect(result.current.data?.[0].entity_name).toBe('Alice');
    expect(result.current.data?.[1].entity_type).toBe('groupe');
  });

  it('passe en erreur quand la requête échoue', async () => {
    const builder = createSupabaseBuilder({ data: null, error: { message: 'x' } });
    mockFrom.mockReturnValue(builder);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePulseEntityLinksByMessage('msg-err'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(mockFrom).toHaveBeenCalledWith('pulse_message_entity_links');
  });
});

describe('usePulseMessagesByEntity', () => {
  it('charge puis retourne les messages liés à une entité', async () => {
    const builder = createSupabaseBuilder({ data: ENTITY_LINKS, error: null });
    mockFrom.mockReturnValue(builder);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePulseMessagesByEntity('contact', 'contact-1'), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('pulse_message_entity_links');
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'entity_type', 'contact');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'entity_id', 'contact-1');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result.current.data).toEqual(ENTITY_LINKS);
    expect(result.current.data?.[0].message_id).toBe('msg-2');
  });

  it('passe en erreur quand la récupération échoue', async () => {
    const builder = createSupabaseBuilder({ data: null, error: { message: 'x' } });
    mockFrom.mockReturnValue(builder);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePulseMessagesByEntity('contact', 'contact-404'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });
});

describe('useCreatePulseEntityLinks', () => {
  it('insère les liens puis invalide les bonnes queries', async () => {
    const builder = createSupabaseBuilder({ data: INSERTED_LINKS, error: null });
    mockFrom.mockReturnValue(builder);

    const { Wrapper, invalidateQueries } = createWrapper();
    const { result } = renderHook(() => useCreatePulseEntityLinks(), { wrapper: Wrapper });

    const variables = {
      messageId: 'msg-9',
      conversationId: 'conv-9',
      entityLinks: [
        { entity_type: 'contact' as const, entity_id: 'contact-9', entity_name: 'Bob' },
        { entity_type: 'todo' as const, entity_id: 'todo-4', entity_name: 'Relancer' },
      ],
    };

    await act(async () => {
      await result.current.mutateAsync(variables);
    });

    expect(mockFrom).toHaveBeenCalledWith('pulse_message_entity_links');
    expect(builder.insert).toHaveBeenCalledWith([
      {
        message_id: 'msg-9',
        conversation_id: 'conv-9',
        entity_type: 'contact',
        entity_id: 'contact-9',
        entity_name: 'Bob',
        created_by: 'profile-1',
      },
      {
        message_id: 'msg-9',
        conversation_id: 'conv-9',
        entity_type: 'todo',
        entity_id: 'todo-4',
        entity_name: 'Relancer',
        created_by: 'profile-1',
      },
    ]);
    expect(builder.select).toHaveBeenCalledWith();
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: pulseEntityLinkKeys.byMessage('msg-9'),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: pulseEntityLinkKeys.byConversation('conv-9'),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: pulseEntityLinkKeys.byEntity('contact', 'contact-9'),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: pulseEntityLinkKeys.byEntity('todo', 'todo-4'),
    });
  });

  it('passe en erreur et affiche un toast si l’insertion échoue', async () => {
    const builder = createSupabaseBuilder({ data: null, error: { message: 'x' } });
    mockFrom.mockReturnValue(builder);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreatePulseEntityLinks(), { wrapper: Wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          messageId: 'msg-err',
          conversationId: 'conv-err',
          entityLinks: [{ entity_type: 'contact', entity_id: 'contact-1', entity_name: 'Alice' }],
        })
      ).rejects.toEqual({ message: 'x' });
    });

    expect(mockDebugError).toHaveBeenCalledWith('Error creating entity links:', { message: 'x' });
    expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la liaison des entités');
  });
});

describe('useDeletePulseEntityLink', () => {
  it('supprime un lien, invalide le cache global et affiche un toast de succès', async () => {
    const builder = createSupabaseBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const { Wrapper, invalidateQueries } = createWrapper();
    const { result } = renderHook(() => useDeletePulseEntityLink(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync('link-1');
    });

    expect(mockFrom).toHaveBeenCalledWith('pulse_message_entity_links');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'link-1');
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: pulseEntityLinkKeys.all,
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Lien supprimé');
  });

  it('passe en erreur et affiche un toast si la suppression échoue', async () => {
    const builder = createSupabaseBuilder({ data: null, error: { message: 'x' } });
    mockFrom.mockReturnValue(builder);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeletePulseEntityLink(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('link-bad')).rejects.toEqual({ message: 'x' });
    });

    expect(mockDebugError).toHaveBeenCalledWith('Error deleting entity link:', { message: 'x' });
    expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la suppression du lien');
  });
});