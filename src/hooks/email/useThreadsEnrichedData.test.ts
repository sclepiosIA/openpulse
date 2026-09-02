import React, { type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useThreadsEnrichedData } from './useThreadsEnrichedData';

const { responses, inCalls, mockFrom, THREADS, ETAB_ID } = vi.hoisted(() => {
  const ETAB_ID = '11111111-1111-4111-8111-111111111111';

  type Resp = { data: unknown; error: { message: string } | null };
  const responses: Record<string, Resp> = {};
  const inCalls: Array<{ table: string; column: unknown; values: unknown }> = [];
  const DEFAULT_RESP: Resp = { data: [], error: null };

  const makeBuilder = (table: string) => {
    const getResponse = () => responses[table] ?? DEFAULT_RESP;
    const builder: Record<string, unknown> = {};
    const chainMethods = [
      'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
      'or', 'is', 'not', 'order', 'limit', 'range', 'ilike', 'contains',
      'insert', 'update', 'delete', 'upsert',
    ];
    chainMethods.forEach((m) => {
      builder[m] = vi.fn(() => builder);
    });
    builder.in = vi.fn((column: unknown, values: unknown) => {
      inCalls.push({ table, column, values });
      return builder;
    });
    builder.single = vi.fn(() => Promise.resolve(getResponse()));
    builder.maybeSingle = vi.fn(() => Promise.resolve(getResponse()));
    builder.then = (
      onFulfilled?: (v: Resp) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(getResponse()).then(onFulfilled, onRejected);
    builder.catch = (onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(getResponse()).catch(onRejected);
    return builder;
  };

  const mockFrom = vi.fn((table: string) => makeBuilder(table));

  const THREADS = [
    {
      id: 't1',
      participants: [{ email: 'Jean.Dupont@Hopital.FR', name: 'Jean Dupont' }],
      etablissement: { id: ETAB_ID },
      account: { email_address: 'contact@exploitant.example.org' },
    },
  ];

  return { responses, inCalls, mockFrom, THREADS, ETAB_ID };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/sanitize', () => ({
  filterValidUUIDs: (values: string[]) =>
    values.filter((v) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
    ),
  isValidUUID: (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useThreadsEnrichedData', () => {
  beforeEach(() => {
    Object.keys(responses).forEach((k) => {
      delete responses[k];
    });
    inCalls.length = 0;
    mockFrom.mockClear();
  });

  it("retourne une Map vide sans aucune requête supabase quand il n'y a aucun thread", async () => {
    const { result } = renderHook(() => useThreadsEnrichedData([]), {
      wrapper: createWrapper(),
    });

    // placeholderData fournit une Map immédiatement (pas de blocage du rendu)
    expect(result.current.data).toBeInstanceOf(Map);

    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.data?.size).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('charge les données enrichies en batch (domaines, contacts, messages) et détecte les réponses', async () => {
    responses['email_messages'] = {
      data: [
        {
          thread_id: 't1',
          attachments_count: 0,
          from_address: 'contact@exploitant.example.org',
          is_sent: true,
          subject: 'Re: Demande',
          in_reply_to: 'mid-1',
        },
      ],
      error: null,
    };

    const { result } = renderHook(() => useThreadsEnrichedData(THREADS), {
      wrapper: createWrapper(),
    });

    // chargement: le fetch démarre dès le mount
    expect(result.current.isFetching).toBe(true);

    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(result.current.isError).toBe(false);

    const queriedTables = mockFrom.mock.calls.map((c) => c[0]);
    expect(queriedTables).toContain('email_domain_mappings');
    expect(queriedTables).toContain('etablissements');
    expect(queriedTables).toContain('contacts');
    expect(queriedTables).toContain('email_messages');
    expect(queriedTables).toContain('email_specific_mappings');

    // Le domaine du participant est extrait et normalisé en minuscules
    const domainCall = inCalls.find(
      (c) => c.table === 'email_domain_mappings' && c.column === 'domain',
    );
    expect(domainCall).toBeDefined();
    expect(domainCall?.values).toEqual(['hopital.fr']);

    // L'établissement du thread (UUID valide) est requêté pour son logo
    const etabCall = inCalls.find(
      (c) => c.table === 'etablissements' && c.column === 'id',
    );
    expect(etabCall).toBeDefined();
    expect(etabCall?.values).toEqual([ETAB_ID]);

    // L'email externe normalisé est requêté côté contacts
    const contactEmailCall = inCalls.find(
      (c) => c.table === 'contacts' && c.column === 'email',
    );
    expect(contactEmailCall?.values).toEqual(['jean.dupont@hopital.fr']);

    // Les messages du thread sont requêtés par chunk d'IDs de threads
    const messagesCall = inCalls.find(
      (c) => c.table === 'email_messages' && c.column === 'thread_id',
    );
    expect(messagesCall?.values).toEqual(['t1']);

    const data = result.current.data;
    expect(data).toBeInstanceOf(Map);
    expect(data?.has('t1')).toBe(true);

    const entry = data?.get('t1');
    expect(entry).toBeDefined();
    // is_sent === true sur un message du thread ⇒ le thread est marqué comme répondu
    expect(entry?.hasReply).toBe(true);
  });

  it('avale les erreurs supabase (data:null, error) et retourne quand même une Map exploitable', async () => {
    const errResp = { data: null, error: { message: 'x' } };
    responses['email_domain_mappings'] = errResp;
    responses['etablissements'] = errResp;
    responses['contacts'] = errResp;
    responses['email_messages'] = errResp;
    responses['email_specific_mappings'] = errResp;
    responses['groupes_etablissements'] = errResp;
    responses['partenaires'] = errResp;

    const { result } = renderHook(() => useThreadsEnrichedData(THREADS), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isFetching).toBe(false));

    // Le hook utilise `data || []` partout : pas d'état d'erreur, dégradation gracieuse
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeInstanceOf(Map);
    expect(result.current.data?.has('t1')).toBe(true);

    const entry = result.current.data?.get('t1');
    // Aucun message renvoyé ⇒ pas de réponse détectée
    expect(entry?.hasReply).toBe(false);
    // Aucun contact renvoyé ⇒ contact null
    expect(entry?.contact ?? null).toBeNull();
  });
});