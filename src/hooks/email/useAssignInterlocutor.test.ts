import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useAssignInterlocutor, type AssignInterlocutorParams } from './useAssignInterlocutor';

const { state, mockFrom, mockInvoke } = vi.hoisted(() => {
  interface Res {
    data: unknown;
    error: unknown;
  }
  const state = {
    responses: {} as Record<string, Res[]>,
    builders: {} as Record<string, Array<Record<string, ReturnType<typeof vi.fn>>>>,
  };

  const makeBuilder = (table: string) => {
    const getRes = (): Res => {
      const queue = state.responses[table];
      if (queue && queue.length > 0) {
        return queue.shift() as Res;
      }
      return { data: null, error: null };
    };
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    const chainMethods = [
      'select',
      'eq',
      'neq',
      'in',
      'is',
      'gte',
      'lte',
      'order',
      'limit',
      'insert',
      'update',
      'upsert',
      'delete',
    ];
    for (const m of chainMethods) {
      builder[m] = vi.fn(() => builder);
    }
    builder.single = vi.fn(() => Promise.resolve(getRes()));
    builder.maybeSingle = vi.fn(() => Promise.resolve(getRes()));
    builder.then = vi.fn(
      (
        resolve?: (value: Res) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(getRes()).then(resolve, reject),
    );
    builder.catch = vi.fn(() => builder);

    if (!state.builders[table]) {
      state.builders[table] = [];
    }
    state.builders[table].push(builder);
    return builder;
  };

  const mockFrom = vi.fn((table: string) => makeBuilder(table));
  const mockInvoke = vi.fn(() =>
    Promise.resolve({ data: { tasks_created: 1 }, error: null }),
  );

  return { state, mockFrom, mockInvoke };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockInvoke },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};

const baseParams: AssignInterlocutorParams = {
  threadId: 't1',
  entityType: 'etablissement',
  entityId: 'e1',
  entityName: 'Clinique Azur',
  senderEmail: 'Jean.Dupont@Clinique-Azur.example.org',
  senderName: 'Jean Dupont',
};

describe('useAssignInterlocutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.responses = {};
    state.builders = {};
  });

  it('expose isAssigning=false au montage et une fonction assignInterlocutor', () => {
    const { result } = renderHook(() => useAssignInterlocutor(), {
      wrapper: createWrapper(),
    });
    expect(result.current.isAssigning).toBe(false);
    expect(typeof result.current.assignInterlocutor).toBe('function');
  });

  it('passe isAssigning a true pendant attribution puis revient a false', async () => {
    state.responses['email_threads'] = [
      { data: { id: 't1', ai_extracted_data: null }, error: null },
    ];

    const { result } = renderHook(() => useAssignInterlocutor(), {
      wrapper: createWrapper(),
    });

    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result.current
        .assignInterlocutor(baseParams)
        .catch(() => undefined);
    });

    expect(result.current.isAssigning).toBe(true);

    await act(async () => {
      await pending;
    });

    await waitFor(() => {
      expect(result.current.isAssigning).toBe(false);
    });
  });

  it('met a jour le thread, invoque la creation de taches IA, cree mapping email, contact et mapping domaine', async () => {
    state.responses['email_threads'] = [
      {
        data: {
          id: 't1',
          ai_extracted_data: {
            new_tasks_needed: [{ title: 'Relancer' }],
          },
        },
        error: null,
      },
    ];
    state.responses['email_messages'] = [
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ];

    const { result } = renderHook(() => useAssignInterlocutor(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.assignInterlocutor(baseParams).catch(() => undefined);
    });

    // 1. Mise a jour du thread courant
    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    const threadBuilder = state.builders['email_threads'][0];
    expect(threadBuilder.update).toHaveBeenCalledWith({
      etablissement_id: 'e1',
      partenaire_id: null,
      groupe_id: null,
      needs_manual_review: false,
      is_hors_etablissement: false,
    });
    expect(threadBuilder.eq).toHaveBeenCalledWith('id', 't1');
    expect(threadBuilder.single).toHaveBeenCalledTimes(1);

    // 1b. Creation des taches IA via edge function avec valeurs par defaut
    expect(mockInvoke).toHaveBeenCalledWith('create-tasks-from-email', {
      body: expect.objectContaining({
        thread_id: 't1',
        etablissement_id: 'e1',
        new_tasks_needed: [
          {
            task_title: 'Relancer',
            task_category: 'Suivi',
            priority: 'medium',
            deadline_days: 7,
          },
        ],
      }),
    });

    // 4. Mapping email specifique (email normalise en minuscules, domaine pro => medium)
    const mappingBuilders = state.builders['email_specific_mappings'];
    expect(mappingBuilders).toBeDefined();
    expect(mappingBuilders[0].upsert).toHaveBeenCalledWith(
      {
        email_address: 'jean.dupont@clinique-azur.example.org',
        etablissement_id: 'e1',
        partenaire_id: null,
        groupe_id: null,
        niveau_mapping: 'etablissement',
        verified: true,
        confidence_level: 'medium',
      },
      { onConflict: 'email_address' },
    );

    // 5. Creation du contact (nom/prenom parses depuis "Jean Dupont")
    const contactBuilders = state.builders['contacts'];
    expect(contactBuilders).toBeDefined();
    expect(contactBuilders[0].eq).toHaveBeenCalledWith(
      'email',
      'jean.dupont@clinique-azur.example.org',
    );
    expect(contactBuilders[0].maybeSingle).toHaveBeenCalledTimes(1);
    expect(contactBuilders[1].insert).toHaveBeenCalledWith({
      email: 'jean.dupont@clinique-azur.example.org',
      nom: 'Dupont',
      prenom: 'Jean',
      fonction: 'Contact email',
      created_source: 'email_attribution',
      niveau_contact: 'etablissement',
      etablissement_id: 'e1',
      groupe_id: null,
    });

    // 6. Creation du mapping domaine professionnel
    const domainBuilders = state.builders['email_domain_mappings'];
    expect(domainBuilders).toBeDefined();
    expect(domainBuilders[0].eq).toHaveBeenCalledWith('domain', 'clinique-azur.example.org');
    expect(domainBuilders[1].insert).toHaveBeenCalledWith({
      domain: 'clinique-azur.example.org',
      etablissement_id: 'e1',
      partenaire_id: null,
      groupe_id: null,
      niveau_mapping: 'etablissement',
      verified: true,
      confidence_level: 'high',
      is_excluded: false,
    });
  });

  it('ne cree pas de contact pour un domaine generique mais cree le mapping email en confiance haute', async () => {
    state.responses['email_threads'] = [
      { data: { id: 't1', ai_extracted_data: null }, error: null },
    ];

    const { result } = renderHook(() => useAssignInterlocutor(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current
        .assignInterlocutor({
          ...baseParams,
          senderEmail: 'paul@gmail.com',
          senderName: null,
        })
        .catch(() => undefined);
    });

    const mappingBuilders = state.builders['email_specific_mappings'];
    expect(mappingBuilders).toBeDefined();
    expect(mappingBuilders[0].upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email_address: 'paul@gmail.com',
        confidence_level: 'high',
      }),
      { onConflict: 'email_address' },
    );

    // Domaine generique => pas de contact ni de mapping domaine
    expect(state.builders['contacts']).toBeUndefined();
    expect(state.builders['email_domain_mappings']).toBeUndefined();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('cree un contact partenaire quand entityType=partenaire', async () => {
    state.responses['email_threads'] = [
      { data: { id: 't1', ai_extracted_data: null }, error: null },
    ];

    const { result } = renderHook(() => useAssignInterlocutor(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current
        .assignInterlocutor({
          ...baseParams,
          entityType: 'partenaire',
          entityId: 'p1',
          entityName: 'Partenaire X',
          senderEmail: 'marie.curie@labo-pro.fr',
          senderName: 'Marie Curie',
        })
        .catch(() => undefined);
    });

    const threadBuilder = state.builders['email_threads'][0];
    expect(threadBuilder.update).toHaveBeenCalledWith({
      etablissement_id: null,
      partenaire_id: 'p1',
      groupe_id: null,
      needs_manual_review: false,
      is_hors_etablissement: false,
    });

    const pcBuilders = state.builders['partenaires_contacts'];
    expect(pcBuilders).toBeDefined();
    expect(pcBuilders[0].eq).toHaveBeenCalledWith('email', 'marie.curie@labo-pro.fr');
    expect(pcBuilders[1].insert).toHaveBeenCalledWith({
      partenaire_id: 'p1',
      email: 'marie.curie@labo-pro.fr',
      nom: 'Curie',
      prenom: 'Marie',
      fonction: 'Contact email',
    });

    // Pas de contact "etablissement" pour un partenaire
    expect(state.builders['contacts']).toBeUndefined();
  });

  it('en cas d erreur sur la mise a jour du thread, aucune suite n est executee et isAssigning revient a false', async () => {
    state.responses['email_threads'] = [
      { data: null, error: { message: 'x' } },
    ];

    const { result } = renderHook(() => useAssignInterlocutor(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.assignInterlocutor(baseParams).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isAssigning).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(mockFrom).not.toHaveBeenCalledWith('email_specific_mappings');
    expect(mockFrom).not.toHaveBeenCalledWith('contacts');
    expect(mockFrom).not.toHaveBeenCalledWith('email_domain_mappings');
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});