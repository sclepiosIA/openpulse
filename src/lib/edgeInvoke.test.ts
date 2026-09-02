// @vitest-environment jsdom

const {
  mockInvoke,
  SUCCESS_DATA,
  RETRIED_DATA,
  BODY,
  HEADERS,
  ERROR_X,
  RETRYABLE_ERROR,
  SECOND_RETRYABLE_ERROR,
  NON_RETRYABLE_ERROR,
  THROWN_RETRYABLE_ERROR,
  THROWN_FINAL_ERROR,
} = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  SUCCESS_DATA: { jobId: 'j1', accepted: true, count: 2 },
  RETRIED_DATA: { jobId: 'j2', accepted: true, count: 1 },
  BODY: { userId: 'u1', action: 'ping' },
  HEADERS: { 'x-test-mode': 'true' },
  ERROR_X: { message: 'x' },
  RETRYABLE_ERROR: Object.assign(new Error('temporary'), { status: 503 }),
  SECOND_RETRYABLE_ERROR: Object.assign(new Error('busy'), { context: { status: 429 } }),
  NON_RETRYABLE_ERROR: Object.assign(new Error('bad request'), { status: 400 }),
  THROWN_RETRYABLE_ERROR: Object.assign(new Error('gateway'), { status: 502 }),
  THROWN_FINAL_ERROR: new Error('final failure'),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

import { invokeWithRetry } from './edgeInvoke';

describe('invokeWithRetry', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockInvoke.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockInvoke.mockReset();
  });

  it('appelle supabase.functions.invoke avec le nom, le body et les headers puis retourne les données', async () => {
    mockInvoke.mockResolvedValueOnce({ data: SUCCESS_DATA, error: null });

    const result = await invokeWithRetry<typeof SUCCESS_DATA>('edge-job', {
      body: BODY,
      headers: HEADERS,
      retries: 0,
    });

    expect(result).toEqual({ data: SUCCESS_DATA, error: null });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('edge-job', {
      body: BODY,
      headers: HEADERS,
    });
  });

  it('normalise une réponse sans data en data null quand il n’y a pas d’erreur', async () => {
    mockInvoke.mockResolvedValueOnce({ data: undefined, error: null });

    const result = await invokeWithRetry('empty-edge-job', { retries: 0 });

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('empty-edge-job', {
      body: undefined,
      headers: undefined,
    });
  });

  it('retourne une erreur Supabase { data:null, error:{ message:"x" } } sans données', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: ERROR_X });

    const result = await invokeWithRetry('failing-edge-job', { retries: 0 });

    expect(result.data).toBeNull();
    expect(result.error).toBe(ERROR_X);
    expect(result.error?.message).toBe('x');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('réessaie une erreur retryable puis retourne le succès', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockInvoke
      .mockResolvedValueOnce({ data: null, error: RETRYABLE_ERROR })
      .mockResolvedValueOnce({ data: RETRIED_DATA, error: null });

    const pending = invokeWithRetry<typeof RETRIED_DATA>('retry-edge-job', {
      retries: 1,
      baseDelayMs: 100,
      maxDelayMs: 500,
    });

    await Promise.resolve();

    expect(mockInvoke).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(49);
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);

    const result = await pending;

    expect(result).toEqual({ data: RETRIED_DATA, error: null });
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'retry-edge-job', {
      body: undefined,
      headers: undefined,
    });
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'retry-edge-job', {
      body: undefined,
      headers: undefined,
    });
  });

  it('applique un backoff exponentiel plafonné entre plusieurs retries', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockInvoke
      .mockResolvedValueOnce({ data: null, error: RETRYABLE_ERROR })
      .mockResolvedValueOnce({ data: null, error: SECOND_RETRYABLE_ERROR })
      .mockResolvedValueOnce({ data: SUCCESS_DATA, error: null });

    const pending = invokeWithRetry<typeof SUCCESS_DATA>('capped-retry-job', {
      retries: 2,
      baseDelayMs: 100,
      maxDelayMs: 120,
    });

    await Promise.resolve();
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(50);
    expect(mockInvoke).toHaveBeenCalledTimes(2);

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(59);
    expect(mockInvoke).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);

    const result = await pending;

    expect(result.data).toBe(SUCCESS_DATA);
    expect(result.error).toBeNull();
    expect(mockInvoke).toHaveBeenCalledTimes(3);
  });

  it('ne réessaie pas une erreur non retryable', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: NON_RETRYABLE_ERROR });

    const result = await invokeWithRetry('bad-request-job', {
      retries: 3,
      baseDelayMs: 10,
    });

    expect(result.data).toBeNull();
    expect(result.error).toBe(NON_RETRYABLE_ERROR);
    expect(result.error?.message).toBe('bad request');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('réessaie une exception retryable puis retourne les données', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockInvoke
      .mockRejectedValueOnce(THROWN_RETRYABLE_ERROR)
      .mockResolvedValueOnce({ data: RETRIED_DATA, error: null });

    const pending = invokeWithRetry<typeof RETRIED_DATA>('thrown-retry-job', {
      retries: 1,
      baseDelayMs: 20,
      maxDelayMs: 100,
    });

    await Promise.resolve();
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10);

    const result = await pending;

    expect(result.data).toBe(RETRIED_DATA);
    expect(result.error).toBeNull();
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('retourne une Error quand supabase.functions.invoke rejette définitivement', async () => {
    mockInvoke.mockRejectedValueOnce(THROWN_FINAL_ERROR);

    const result = await invokeWithRetry('throwing-job', { retries: 0 });

    expect(result.data).toBeNull();
    expect(result.error).toBe(THROWN_FINAL_ERROR);
    expect(result.error?.message).toBe('final failure');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('n’appelle pas Supabase si le signal est déjà annulé', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await invokeWithRetry('aborted-before-job', {
      signal: controller.signal,
      retries: 2,
    });

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('Aborted');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('retourne Aborted si le signal est annulé pendant l’attente avant retry', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const controller = new AbortController();
    mockInvoke.mockResolvedValueOnce({ data: null, error: RETRYABLE_ERROR });

    const pending = invokeWithRetry('abort-during-sleep-job', {
      retries: 1,
      baseDelayMs: 100,
      maxDelayMs: 100,
      signal: controller.signal,
    });

    await Promise.resolve();
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    controller.abort();

    const result = await pending;

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('Aborted');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});