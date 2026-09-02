// @vitest-environment jsdom

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useErrorHandler } from './useErrorHandler';
import { toast } from 'sonner';
import { debug } from '@/lib/debug';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

const {
  SANITIZED_MESSAGE,
  ALT_SANITIZED_MESSAGE,
  UNKNOWN_MESSAGE,
  CONTEXT_NAME,
  ALT_CONTEXT_NAME,
  RAW_ERROR,
  NULL_ERROR,
  mockToastError,
  mockToastSuccess,
  mockDebugError,
  mockDebugLog,
  mockDebugWarn,
  mockDebugInfo,
  mockSanitizeSupabaseError,
} = vi.hoisted(() => ({
  SANITIZED_MESSAGE: 'Erreur traitée',
  ALT_SANITIZED_MESSAGE: 'Message utilisateur sécurisé',
  UNKNOWN_MESSAGE: 'Erreur inconnue',
  CONTEXT_NAME: 'chargement profil',
  ALT_CONTEXT_NAME: 'sauvegarde',
  RAW_ERROR: { message: 'db failed', code: '500' } as unknown,
  NULL_ERROR: null as unknown,
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockDebugError: vi.fn(),
  mockDebugLog: vi.fn(),
  mockDebugWarn: vi.fn(),
  mockDebugInfo: vi.fn(),
  mockSanitizeSupabaseError: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
    log: mockDebugLog,
    warn: mockDebugWarn,
    info: mockDebugInfo,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSanitizeSupabaseError.mockReturnValue(SANITIZED_MESSAGE);
  });

  it('expose handleError et le hook se monte correctement', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    await waitFor(() => {
      expect(typeof result.current.handleError).toBe('function');
    });

    expect(result.current).toEqual({
      handleError: expect.any(Function),
    });
  });

  it('sanitise l’erreur, log le contexte et affiche le toast avec la description attendue', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    await act(async () => {
      result.current.handleError(RAW_ERROR, CONTEXT_NAME);
    });

    expect(sanitizeSupabaseError).toHaveBeenCalledTimes(1);
    expect(sanitizeSupabaseError).toHaveBeenCalledWith(RAW_ERROR);

    expect(debug.error).toHaveBeenCalledTimes(1);
    expect(debug.error).toHaveBeenCalledWith(`[${CONTEXT_NAME}]`, RAW_ERROR);

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(SANITIZED_MESSAGE, {
      description: `Contexte : ${CONTEXT_NAME}`,
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(debug.log).not.toHaveBeenCalled();
    expect(debug.warn).not.toHaveBeenCalled();
    expect(debug.info).not.toHaveBeenCalled();
  });

  it('utilise exactement le message renvoyé par le sanitizer pour un autre contexte métier', async () => {
    const wrapper = createWrapper();
    mockSanitizeSupabaseError.mockReturnValueOnce(ALT_SANITIZED_MESSAGE);

    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    await act(async () => {
      result.current.handleError(new Error('message brut'), ALT_CONTEXT_NAME);
    });

    expect(sanitizeSupabaseError).toHaveBeenCalledWith(expect.any(Error));
    expect(debug.error).toHaveBeenCalledWith(`[${ALT_CONTEXT_NAME}]`, expect.any(Error));
    expect(toast.error).toHaveBeenCalledWith(ALT_SANITIZED_MESSAGE, {
      description: `Contexte : ${ALT_CONTEXT_NAME}`,
    });
  });

  it('gère une erreur inconnue ou nulle en s’appuyant sur le sanitizer', async () => {
    const wrapper = createWrapper();
    mockSanitizeSupabaseError.mockReturnValueOnce(UNKNOWN_MESSAGE);

    const { result } = renderHook(() => useErrorHandler(), { wrapper });

    await act(async () => {
      result.current.handleError(NULL_ERROR, 'suppression');
    });

    expect(sanitizeSupabaseError).toHaveBeenCalledWith(NULL_ERROR);
    expect(debug.error).toHaveBeenCalledWith('[suppression]', NULL_ERROR);
    expect(toast.error).toHaveBeenCalledWith(UNKNOWN_MESSAGE, {
      description: 'Contexte : suppression',
    });
  });

  it('garde une référence stable de handleError entre deux rerenders', async () => {
    const wrapper = createWrapper();

    const { result, rerender } = renderHook(() => useErrorHandler(), { wrapper });

    const firstHandleError = result.current.handleError;

    rerender();

    await waitFor(() => {
      expect(result.current.handleError).toBe(firstHandleError);
    });
  });
});