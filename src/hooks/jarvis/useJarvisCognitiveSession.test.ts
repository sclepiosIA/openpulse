import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisCognitiveSession } from './useJarvisCognitiveSession';

const { mockFrom, responseQueue, builder, user, debugError } = vi.hoisted(() => {
  const responseQueue: unknown[] = [];

  const debugError = vi.fn();

  const user = { id: 'user_1', email: 'test@example.com' };

  const builder: Record<string, unknown> = {};

  // Helper to cast builder to callable object
  const b: any = builder;

  b.select = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.gt = vi.fn(() => b);
  b.order = vi.fn(() => b);
  b.limit = vi.fn(() => b);
  b.insert = vi.fn(() => b);
  b.update = vi.fn(() => b);
  b.delete = vi.fn(() => b);
  b.single = vi.fn(() => {
    const res = responseQueue.shift();
    if (res && typeof res === 'object' && (res as any).throw) {
      return Promise.reject((res as any).error);
    }
    // single should resolve to an object possibly containing data and error
    return Promise.resolve(res ?? { data: null });
  });
  b.maybeSingle = vi.fn(() => {
    const res = responseQueue.shift();
    if (res && typeof res === 'object' && (res as any).throw) {
      return Promise.reject((res as any).error);
    }
    return Promise.resolve(res ?? { data: null });
  });
  // make builder thenable so awaiting it works
  b.then = function (onFulfilled: (v: unknown) => unknown) {
    const res = responseQueue.shift();
    if (res && typeof res === 'object' && (res as any).throw) {
      return Promise.reject((res as any).error);
    }
    return Promise.resolve(res ?? {}).then(onFulfilled);
  };
  b.catch = vi.fn((cb: (e: unknown) => unknown) => {
    return { then: () => ({ catch: () => {} }) };
  });

  const mockFrom = vi.fn(() => b);

  return { mockFrom, responseQueue, builder: b, user, debugError };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user }),
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: debugError },
}));

describe('useJarvisCognitiveSession', () => {
  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: createQueryClient() }, children);

  beforeEach(() => {
    // keep hoisted references stable but clear queued responses and spies
    responseQueue.length = 0;
    vi.clearAllMocks();
  });

  it('initializes existing session when supabase returns one', async () => {
    const existingSession = {
      id: 'sess_existing_1',
      working_memory: [
        {
          type: 'entity',
          key: 'person_name',
          value: 'Alice',
          timestamp: Date.now() - 1000,
          turnIndex: 1,
          confidence: 0.95,
        },
      ],
      clarifications_pending: [],
      emotional_state: { tone: 'neutral', urgency: 2, sentiment: 0.1 },
      turn_count: 3,
      last_intent_type: 'query',
    };

    // provide the response for maybeSingle
    responseQueue.push({ data: existingSession });

    const { result } = renderHook(() => useJarvisCognitiveSession(), { wrapper: Wrapper });

    let returned: unknown;
    await act(async () => {
      returned = await result.current.initSession();
    });

    // Ensure the session was mapped correctly
    expect(result.current.session).not.toBeNull();
    expect(result.current.session?.id).toBe(existingSession.id);
    expect(result.current.session?.turnCount).toBe(existingSession.turn_count);
    expect(result.current.session?.lastIntentType).toBe(existingSession.last_intent_type);
    expect(result.current.session?.workingMemory).toHaveLength(existingSession.working_memory.length);
    expect(result.current.isLoading).toBe(false);

    // returned value should match the session state
    expect((returned as any)?.id).toBe(existingSession.id);

    // ensure supabase was queried for that table
    expect(mockFrom).toHaveBeenCalledWith('jarvis_cognitive_sessions');
    // ensure query methods were invoked on builder
    expect(builder.eq).toHaveBeenCalled();
    expect(builder.gt).toHaveBeenCalled();
    expect(builder.order).toHaveBeenCalled();
    expect(builder.limit).toHaveBeenCalled();
    expect(builder.maybeSingle).toBeTruthy();
  });

  it('creates a new session when no existing session is found and calls insert with correct payload', async () => {
    // First call: maybeSingle -> no session
    responseQueue.push({ data: null });

    // Second call: insert().select().single() -> returns created session with id
    const createdSessionFromDb = { id: 'sess_created_1' };
    responseQueue.push({ data: createdSessionFromDb, error: null });

    const { result } = renderHook(() => useJarvisCognitiveSession(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.initSession();
    });

    // supabase.from should have been called at least twice (select and insert)
    expect(mockFrom).toHaveBeenCalled();
    // The builder.insert should have been called and receive an object containing user_id
    expect(builder.insert).toHaveBeenCalled();
    const insertCallArg = (builder.insert as unknown as (...args: unknown[]) => unknown).mock?.calls?.[0]?.[0];
    // Validate payload shape
    expect(insertCallArg).toBeTruthy();
    expect((insertCallArg as any).user_id).toBe(user.id);
    expect(Array.isArray((insertCallArg as any).working_memory)).toBe(true);
    expect(((insertCallArg as any).working_memory as unknown[]).length).toBe(0);

    // The hook should now have a session mapped from the created DB result
    expect(result.current.session).not.toBeNull();
    expect(result.current.session?.id).toBe(createdSessionFromDb.id);
  });

  it('falls back to a local session and logs error when supabase throws', async () => {
    // make maybeSingle reject
    responseQueue.push({ throw: true, error: new Error('supabase-failure') });

    const { result } = renderHook(() => useJarvisCognitiveSession(), { wrapper: Wrapper });

    await act(async () => {
      const local = await result.current.initSession();
      // returned session should be present and have an id
      expect(local).not.toBeNull();
      expect(typeof (local as any).id).toBe('string');
    });

    expect(debugError).toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.session).not.toBeNull();
    expect(result.current.session?.workingMemory).toHaveLength(0);
    expect(result.current.session?.lastIntentType).toBeNull();
  });

  it('saveSession sends updated working memory to supabase via update', async () => {
    // Create new session: maybeSingle -> null, insert.single -> created
    responseQueue.push({ data: null });
    const createdSession = { id: 'sess_save_1' };
    responseQueue.push({ data: createdSession, error: null });

    // When saveSession awaits the update, ensure thenable resolves
    responseQueue.push({ data: {} });

    const { result } = renderHook(() => useJarvisCognitiveSession(), { wrapper: Wrapper });

    // initialize session
    await act(async () => {
      await result.current.initSession();
    });

    // add an entity to memory
    await act(async () => {
      result.current.addToMemory({
        type: 'entity',
        key: 'person_42',
        value: 'Bob',
        confidence: 0.88,
      });
    });

    // call saveSession which should trigger builder.update with proper payload
    await act(async () => {
      await result.current.saveSession();
    });

    expect(builder.update).toHaveBeenCalled();
    const updateArg = (builder.update as unknown as (...args: unknown[]) => unknown).mock?.calls?.[0]?.[0];
    expect(updateArg).toBeTruthy();
    expect(Array.isArray((updateArg as any).working_memory)).toBe(true);
    expect(((updateArg as any).working_memory as unknown[]).length).toBe(1);
    expect(((updateArg as any).working_memory as any[])[0].key).toBe('person_42');
    expect(typeof (updateArg as any).turn_count).toBe('number');
    expect(typeof (updateArg as any).expires_at).toBe('string');
  });

  it('resolveCorefereces replaces demonstratives and pronouns using recent entities', async () => {
    // Create session (new)
    responseQueue.push({ data: null });
    const createdSession = { id: 'sess_coref_1' };
    responseQueue.push({ data: createdSession, error: null });

    const { result } = renderHook(() => useJarvisCognitiveSession(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.initSession();
    });

    // add a person entity so pronouns/demonstratives can resolve to it
    await act(async () => {
      result.current.addToMemory({
        type: 'entity',
        key: 'person_name',
        value: 'Claire',
        confidence: 0.9,
      });
    });

    // message containing a demonstrative and a pronoun
    const message = 'Regarde celui-ci, je pense il est disponible.';
    const out = result.current.resolveCorefereces(message);

    expect(out.resolutions.length).toBeGreaterThanOrEqual(1);
    // resolvedMessage should contain the entity value 'Claire'
    expect(out.resolvedMessage.toLowerCase()).toContain('claire');
    // ensure at least one resolution maps original token
    const originals = out.resolutions.map(r => r.original);
    expect(originals.some(o => o === 'celui-ci' || o === 'il')).toBe(true);
  });

  it('checkClarificationNeeded suggests contact clarification when message ambiguous and no contacts', async () => {
    responseQueue.push({ data: null });
    const createdSession = { id: 'sess_clarify_1' };
    responseQueue.push({ data: createdSession, error: null });

    const { result } = renderHook(() => useJarvisCognitiveSession(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.initSession();
    });

    const msg = 'Envoie un message s\'il te plaît';
    const clar = result.current.checkClarificationNeeded(msg);
    expect(clar).not.toBeNull();
    expect(clar?.context).toBe('contact_resolution');
    expect(clar?.priority).toBe('high');
    expect(typeof clar?.id).toBe('string');
  });

  it('addClarification and answerClarification manage clarificationsPending correctly', async () => {
    responseQueue.push({ data: null });
    const createdSession = { id: 'sess_clarify_2' };
    responseQueue.push({ data: createdSession, error: null });

    const { result } = renderHook(() => useJarvisCognitiveSession(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.initSession();
    });

    const clarification = {
      id: 'clar_1',
      question: 'Test ?',
      context: 'test',
      priority: 'low' as const,
      answered: false,
    };

    await act(async () => {
      result.current.addClarification(clarification);
    });

    expect(result.current.session?.clarificationsPending.length).toBe(1);
    expect(result.current.session?.clarificationsPending[0].id).toBe('clar_1');

    await act(async () => {
      result.current.answerClarification('clar_1', 'Oui');
    });

    const pending = result.current.session?.clarificationsPending.find(c => c.id === 'clar_1');
    expect(pending).toBeTruthy();
    expect(pending?.answered).toBe(true);
    expect(pending?.answer).toBe('Oui');
  });

  it('incrementTurn and getContextSummary reflect turn count and emotional state', async () => {
    responseQueue.push({ data: null });
    const createdSession = { id: 'sess_summary_1' };
    responseQueue.push({ data: createdSession, error: null });

    const { result } = renderHook(() => useJarvisCognitiveSession(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.initSession();
    });

    // update emotional state and increment turn
    await act(async () => {
      result.current.updateEmotionalState({ urgency: 8, sentiment: -0.5, tone: 'frustrated' });
      result.current.incrementTurn();
    });

    const summary = result.current.getContextSummary();
    expect(summary).toContain('Tour');
    expect(summary).toContain('Urgence détectée');
    expect(summary).toContain('frustré'.toLowerCase() || 'frustrated'); // tone presence not strictly required textually
  });
});