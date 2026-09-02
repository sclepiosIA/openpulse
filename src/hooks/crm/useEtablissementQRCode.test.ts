// @vitest-environment jsdom
import React, { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useEtablissementQRCode,
  useGenerateEtablissementQRToken,
  useVerifyEtablissementQRToken,
} from './useEtablissementQRCode';

const {
  ETABLISSEMENT_QR,
  VERIFIED_ETABLISSEMENT,
  GENERATED_TOKEN_RESULT,
  AUTH_STATE,
  sanitizeSupabaseErrorMock,
  toastSuccessMock,
  toastErrorMock,
  mockFrom,
  mockRpc,
  maybeSingleMock,
  thenMock,
  catchMock,
  selectMock,
  eqMock,
  gteMock,
  lteMock,
  inMock,
  orderMock,
  limitMock,
  insertMock,
  updateMock,
  deleteMock,
  singleMock,
  resetBuilderMocks,
} = vi.hoisted(() => {
  const ETABLISSEMENT_QR = {
    id: 'etab-1',
    nom: 'Lycée Horizon',
    qr_access_token: 'qr-token-1',
    qr_access_expires_at: '2099-01-01T00:00:00.000Z',
  };

  const VERIFIED_ETABLISSEMENT = {
    id: 'etab-2',
    nom: 'Collège des Arts',
    ville: 'Paris',
    qr_access_token: 'valid-token',
    qr_access_expires_at: '2099-01-01T00:00:00.000Z',
  };

  const GENERATED_TOKEN_RESULT = {
    token: 'generated-token',
    expires_at: '2099-01-02T00:00:00.000Z',
  };

  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const sanitizeSupabaseErrorMock = vi.fn((error: Error) => `sanitized:${error.message}`);
  const toastSuccessMock = vi.fn();
  const toastErrorMock = vi.fn();

  const maybeSingleMock = vi.fn();
  const singleMock = vi.fn();
  const thenMock = vi.fn(function (
    this: unknown,
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) {
    return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
  });
  const catchMock = vi.fn(function (this: unknown, onRejected?: (reason: unknown) => unknown) {
    return Promise.resolve({ data: null, error: null }).catch(onRejected);
  });

  const selectMock = vi.fn();
  const eqMock = vi.fn();
  const gteMock = vi.fn();
  const lteMock = vi.fn();
  const inMock = vi.fn();
  const orderMock = vi.fn();
  const limitMock = vi.fn();
  const insertMock = vi.fn();
  const updateMock = vi.fn();
  const deleteMock = vi.fn();

  const builder = {
    select: selectMock,
    eq: eqMock,
    gte: gteMock,
    lte: lteMock,
    in: inMock,
    order: orderMock,
    limit: limitMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
    maybeSingle: maybeSingleMock,
    single: singleMock,
    then: thenMock,
    catch: catchMock,
  };

  selectMock.mockImplementation(() => builder);
  eqMock.mockImplementation(() => builder);
  gteMock.mockImplementation(() => builder);
  lteMock.mockImplementation(() => builder);
  inMock.mockImplementation(() => builder);
  orderMock.mockImplementation(() => builder);
  limitMock.mockImplementation(() => builder);
  insertMock.mockImplementation(() => builder);
  updateMock.mockImplementation(() => builder);
  deleteMock.mockImplementation(() => builder);

  const mockFrom = vi.fn(() => builder);
  const mockRpc = vi.fn();

  const resetBuilderMocks = () => {
    mockFrom.mockClear();
    mockRpc.mockClear();
    maybeSingleMock.mockReset();
    singleMock.mockReset();
    thenMock.mockClear();
    catchMock.mockClear();
    selectMock.mockClear();
    eqMock.mockClear();
    gteMock.mockClear();
    lteMock.mockClear();
    inMock.mockClear();
    orderMock.mockClear();
    limitMock.mockClear();
    insertMock.mockClear();
    updateMock.mockClear();
    deleteMock.mockClear();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
    sanitizeSupabaseErrorMock.mockClear();
    sanitizeSupabaseErrorMock.mockImplementation((error: Error) => `sanitized:${error.message}`);
  };

  return {
    ETABLISSEMENT_QR,
    VERIFIED_ETABLISSEMENT,
    GENERATED_TOKEN_RESULT,
    AUTH_STATE,
    sanitizeSupabaseErrorMock,
    toastSuccessMock,
    toastErrorMock,
    mockFrom,
    mockRpc,
    maybeSingleMock,
    thenMock,
    catchMock,
    selectMock,
    eqMock,
    gteMock,
    lteMock,
    inMock,
    orderMock,
    limitMock,
    insertMock,
    updateMock,
    deleteMock,
    singleMock,
    resetBuilderMocks,
  };
});

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useEtablissementQRCode', () => {
  beforeEach(() => {
    resetBuilderMocks();
  });

  it('charge puis retourne les informations QR de l’établissement', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: ETABLISSEMENT_QR,
      error: null,
    });

    const { result } = renderHook(() => useEtablissementQRCode('etab-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(selectMock).toHaveBeenCalledWith('id, nom, qr_access_token, qr_access_expires_at');
    expect(eqMock).toHaveBeenCalledWith('id', 'etab-1');
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);

    expect(result.current.data).toEqual(ETABLISSEMENT_QR);
    expect(result.current.data?.nom).toBe('Lycée Horizon');
    expect(result.current.data?.qr_access_token).toBe('qr-token-1');
    expect(result.current.isError).toBe(false);
  });

  it('passe en erreur si la récupération du QR code échoue', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'x' },
    });

    const { result } = renderHook(() => useEtablissementQRCode('etab-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('x');
    expect(result.current.data).toBeUndefined();
  });
});

describe('useGenerateEtablissementQRToken', () => {
  beforeEach(() => {
    resetBuilderMocks();
  });

  it('génère un token QR, affiche un succès et invalide la query associée', async () => {
    mockRpc.mockResolvedValueOnce({
      data: GENERATED_TOKEN_RESULT,
      error: null,
    });

    const invalidateQueriesSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');

    const { result } = renderHook(() => useGenerateEtablissementQRToken(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('etab-1');
    });

    expect(mockRpc).toHaveBeenCalledWith('generate_etablissement_qr_token', {
      etablissement_id: 'etab-1',
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(GENERATED_TOKEN_RESULT);
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('QR Code généré avec succès !');
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['etablissement-qr-code', 'etab-1'],
    });

    invalidateQueriesSpy.mockRestore();
  });

  it('passe en erreur et affiche le message sanitizé si la génération échoue', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: new Error('x'),
    });

    const { result } = renderHook(() => useGenerateEtablissementQRToken(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync('etab-1')).rejects.toThrow('x');
    });

    expect(mockRpc).toHaveBeenCalledWith('generate_etablissement_qr_token', {
      etablissement_id: 'etab-1',
    });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(sanitizeSupabaseErrorMock).toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith('sanitized:x');
  });
});

describe('useVerifyEtablissementQRToken', () => {
  beforeEach(() => {
    resetBuilderMocks();
  });

  it('charge puis valide un token QR et retourne les infos publiques de l’établissement', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: VERIFIED_ETABLISSEMENT,
      error: null,
    });

    const { result } = renderHook(
      () => useVerifyEtablissementQRToken('college-des-arts', 'valid-token'),
      {
        wrapper: createWrapper(),
      },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(selectMock).toHaveBeenCalledWith('id, nom, ville, qr_access_token, qr_access_expires_at');
    expect(eqMock).toHaveBeenCalledWith('slug', 'college-des-arts');
    expect(result.current.data).toEqual({
      id: 'etab-2',
      nom: 'Collège des Arts',
      ville: 'Paris',
    });
    expect(result.current.data?.ville).toBe('Paris');
  });

  it('passe en erreur si la vérification du token échoue côté requête', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'x' },
    });

    const { result } = renderHook(
      () => useVerifyEtablissementQRToken('college-des-arts', 'valid-token'),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('x');
    expect(result.current.data).toBeUndefined();
  });
});
