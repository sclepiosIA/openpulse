import { renderHook, act, waitFor } from '@testing-library/react';
import { usePulseAI } from './usePulseAI';

const {
  SUMMARY_RESULT,
  SUGGESTION_RESULT,
  ACTIONS_RESULT,
  mockInvoke,
  mockToast,
  mockSanitize,
  mockDebugError,
} = vi.hoisted(() => {
  const SUMMARY_RESULT = {
    summary: 'Résumé de la conversation',
    key_points: ['point 1', 'point 2'],
    decisions: ['décision A'],
    open_questions: ['question ouverte ?'],
  };
  const SUGGESTION_RESULT = {
    suggestions: [
      { tone: 'formel', text: 'Bonjour, voici ma réponse.' },
      { tone: 'amical', text: 'Salut, voilà !' },
    ],
  };
  const ACTIONS_RESULT = {
    actions: [
      {
        description: 'Envoyer le rapport',
        assignee_hint: 'Alice',
        priority: 'haute' as const,
        deadline_hint: 'vendredi',
      },
    ],
  };
  return {
    SUMMARY_RESULT,
    SUGGESTION_RESULT,
    ACTIONS_RESULT,
    mockInvoke: vi.fn(),
    mockToast: vi.fn(),
    mockSanitize: vi.fn(() => 'erreur nettoyée'),
    mockDebugError: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitize,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('usePulseAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expose un état initial correct', () => {
    const { result } = renderHook(() => usePulseAI());

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.lastResult).toBeNull();
    expect(typeof result.current.summarize).toBe('function');
    expect(typeof result.current.suggestResponse).toBe('function');
    expect(typeof result.current.extractActions).toBe('function');
    expect(typeof result.current.clearResult).toBe('function');
  });

  it('summarize appelle la fonction edge avec la bonne action et stocke le résultat', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { result: SUMMARY_RESULT }, error: null });

    const { result } = renderHook(() => usePulseAI());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.summarize('conv-1', ['m1', 'm2']);
    });

    expect(mockInvoke).toHaveBeenCalledWith('pulse-ai-summarize', {
      body: {
        conversation_id: 'conv-1',
        action: 'summarize',
        message_ids: ['m1', 'm2'],
      },
    });
    expect(returned).toEqual(SUMMARY_RESULT);
    expect(result.current.lastResult).toEqual(SUMMARY_RESULT);
    expect(result.current.isProcessing).toBe(false);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Analyse IA terminée',
      description: 'Résumé généré avec succès',
    });
  });

  it('passe isProcessing à true pendant le traitement puis à false', async () => {
    let resolveInvoke: (v: { data: { result: typeof SUMMARY_RESULT }; error: null }) => void = () => {};
    mockInvoke.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveInvoke = resolve;
      })
    );

    const { result } = renderHook(() => usePulseAI());

    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result.current.summarize('conv-1');
    });

    await waitFor(() => {
      expect(result.current.isProcessing).toBe(true);
    });

    await act(async () => {
      resolveInvoke({ data: { result: SUMMARY_RESULT }, error: null });
      await pending;
    });

    expect(result.current.isProcessing).toBe(false);
  });

  it('suggestResponse envoie l\'action suggest_response sans message_ids', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { result: SUGGESTION_RESULT }, error: null });

    const { result } = renderHook(() => usePulseAI());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.suggestResponse('conv-2');
    });

    expect(mockInvoke).toHaveBeenCalledWith('pulse-ai-summarize', {
      body: {
        conversation_id: 'conv-2',
        action: 'suggest_response',
        message_ids: undefined,
      },
    });
    expect(returned).toEqual(SUGGESTION_RESULT);
    expect(result.current.lastResult).toEqual(SUGGESTION_RESULT);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Analyse IA terminée',
      description: 'Suggestions de réponse générées',
    });
  });

  it('extractActions envoie l\'action extract_actions et le toast adéquat', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { result: ACTIONS_RESULT }, error: null });

    const { result } = renderHook(() => usePulseAI());

    await act(async () => {
      await result.current.extractActions('conv-3', ['m9']);
    });

    expect(mockInvoke).toHaveBeenCalledWith('pulse-ai-summarize', {
      body: {
        conversation_id: 'conv-3',
        action: 'extract_actions',
        message_ids: ['m9'],
      },
    });
    expect(result.current.lastResult).toEqual(ACTIONS_RESULT);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Analyse IA terminée',
      description: 'Actions extraites avec succès',
    });
  });

  it('en cas d\'erreur, retourne null, affiche un toast destructif et ne stocke pas de résultat', async () => {
    const invokeError = { message: 'x' };
    mockInvoke.mockResolvedValueOnce({ data: null, error: invokeError });

    const { result } = renderHook(() => usePulseAI());

    let returned: unknown = 'sentinel';
    await act(async () => {
      returned = await result.current.summarize('conv-err');
    });

    expect(returned).toBeNull();
    expect(result.current.lastResult).toBeNull();
    expect(result.current.isProcessing).toBe(false);
    expect(mockDebugError).toHaveBeenCalledWith('AI processing error:', invokeError);
    expect(mockSanitize).toHaveBeenCalledWith(invokeError);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur IA',
      description: 'erreur nettoyée',
      variant: 'destructive',
    });
  });

  it('clearResult remet lastResult à null après un succès', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { result: SUMMARY_RESULT }, error: null });

    const { result } = renderHook(() => usePulseAI());

    await act(async () => {
      await result.current.summarize('conv-1');
    });
    expect(result.current.lastResult).toEqual(SUMMARY_RESULT);

    act(() => {
      result.current.clearResult();
    });

    expect(result.current.lastResult).toBeNull();
  });
});