const {
  ROWS,
  IMPORT_RESPONSE,
  IMPORT_SUCCESS_RESULT,
  IMPORT_EMPTY_RESULT,
  IMPORT_ERROR,
  IMPORT_ERROR_RESULT,
  AUTOLOGIN_URL,
  AUTOLOGIN_SUCCESS_RESULT,
  AUTOLOGIN_ERROR,
  AUTOLOGIN_ERROR_RESULT,
  AUTOLOGIN_INVALID_RESULT,
  mockFrom,
  mockInvoke,
} = vi.hoisted(() => {
  type QueryRow = { id: string };
  type QueryResponse = { data: QueryRow[]; error: null };
  type QueryBuilder = {
    select: (...args: unknown[]) => QueryBuilder;
    eq: (...args: unknown[]) => QueryBuilder;
    gte: (...args: unknown[]) => QueryBuilder;
    lte: (...args: unknown[]) => QueryBuilder;
    in: (...args: unknown[]) => QueryBuilder;
    order: (...args: unknown[]) => QueryBuilder;
    limit: (...args: unknown[]) => QueryBuilder;
    insert: (...args: unknown[]) => QueryBuilder;
    update: (...args: unknown[]) => QueryBuilder;
    delete: (...args: unknown[]) => QueryBuilder;
    upsert: (...args: unknown[]) => QueryBuilder;
    single: () => Promise<QueryResponse>;
    maybeSingle: () => Promise<QueryResponse>;
    then: (
      onFulfilled?: ((value: QueryResponse) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) => Promise<unknown>;
    catch: (onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>;
  };

  const ROWS = [{ id: '1' }];
  const QUERY_RESPONSE: QueryResponse = { data: ROWS, error: null };

  let builder: QueryBuilder;

  const chain = (..._args: unknown[]) => builder;

  builder = {
    select: vi.fn(chain),
    eq: vi.fn(chain),
    gte: vi.fn(chain),
    lte: vi.fn(chain),
    in: vi.fn(chain),
    order: vi.fn(chain),
    limit: vi.fn(chain),
    insert: vi.fn(chain),
    update: vi.fn(chain),
    delete: vi.fn(chain),
    upsert: vi.fn(chain),
    single: vi.fn(() => Promise.resolve(QUERY_RESPONSE)),
    maybeSingle: vi.fn(() => Promise.resolve(QUERY_RESPONSE)),
    then: vi.fn(
      (
        onFulfilled?: ((value: QueryResponse) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null,
      ) =>
        Promise.resolve(QUERY_RESPONSE).then(
          (value) => (onFulfilled ? onFulfilled(value) : value),
          (reason: unknown) => {
            if (onRejected) return onRejected(reason);
            throw reason;
          },
        ),
    ),
    catch: vi.fn((onRejected?: ((reason: unknown) => unknown) | null) =>
      Promise.resolve(QUERY_RESPONSE).catch((reason: unknown) => {
        if (onRejected) return onRejected(reason);
        throw reason;
      }),
    ),
  };

  const IMPORT_RESPONSE = {
    report: {
      importedEtablissements: 2,
      importedPartenaires: 1,
    },
    status: 'ok',
  };
  const IMPORT_SUCCESS_RESULT = { data: IMPORT_RESPONSE, error: null };
  const IMPORT_EMPTY_RESULT = { data: null, error: null };
  const IMPORT_ERROR = { message: 'import failed' };
  const IMPORT_ERROR_RESULT = { data: null, error: IMPORT_ERROR };

  const AUTOLOGIN_URL = 'https://app.test/login';
  const AUTOLOGIN_SUCCESS_RESULT = { data: { url: AUTOLOGIN_URL }, error: null };
  const AUTOLOGIN_ERROR = { message: 'autologin failed' };
  const AUTOLOGIN_ERROR_RESULT = { data: null, error: AUTOLOGIN_ERROR };
  const AUTOLOGIN_INVALID_RESULT = { data: { url: '' }, error: null };

  return {
    ROWS,
    IMPORT_RESPONSE,
    IMPORT_SUCCESS_RESULT,
    IMPORT_EMPTY_RESULT,
    IMPORT_ERROR,
    IMPORT_ERROR_RESULT,
    AUTOLOGIN_URL,
    AUTOLOGIN_SUCCESS_RESULT,
    AUTOLOGIN_ERROR,
    AUTOLOGIN_ERROR_RESULT,
    AUTOLOGIN_INVALID_RESULT,
    mockFrom: vi.fn((_table: string) => builder),
    mockInvoke: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

import {
  fetchBackendAutologinUrl,
  importCommercialData,
  type ImportCommercialInput,
} from './backendTools';

describe('backendTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockReset();
  });

  describe('importCommercialData', () => {
    it('appelle la fonction Edge import-commercial-data avec le payload et retourne le rapport métier', async () => {
      mockInvoke.mockResolvedValueOnce(IMPORT_SUCCESS_RESULT);

      const input: ImportCommercialInput = {
        etablissements: [{ siret: '123' }, { siret: '456' }],
        partenaires: [{ name: 'Acme' }],
        commercial_category_id: 'cat',
        tasks_only: true,
      };

      const result = await importCommercialData(input);

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('import-commercial-data', {
        body: input,
      });
      expect(result).toBe(IMPORT_RESPONSE);
      expect(result).toEqual({
        report: {
          importedEtablissements: 2,
          importedPartenaires: 1,
        },
        status: 'ok',
      });
      expect(mockFrom).not.toHaveBeenCalled();
      expect(ROWS).toEqual([{ id: '1' }]);
    });

    it('retourne un objet vide quand la fonction Edge réussit sans data', async () => {
      mockInvoke.mockResolvedValueOnce(IMPORT_EMPTY_RESULT);

      const input: ImportCommercialInput = {
        etablissements: [],
        partenaires: [],
        commercial_category_id: 'cat',
      };

      const result = await importCommercialData(input);

      expect(mockInvoke).toHaveBeenCalledWith('import-commercial-data', {
        body: input,
      });
      expect(result).toEqual({});
    });

    it('propage l erreur Supabase quand l import échoue', async () => {
      mockInvoke.mockResolvedValueOnce(IMPORT_ERROR_RESULT);

      const input: ImportCommercialInput = {
        etablissements: [{ siret: '789' }],
        partenaires: [],
        commercial_category_id: 'cat',
        tasks_only: false,
      };

      await expect(importCommercialData(input)).rejects.toEqual(IMPORT_ERROR);

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('import-commercial-data', {
        body: input,
      });
    });
  });

  describe('fetchBackendAutologinUrl', () => {
    it('appelle la fonction demandée avec la clé backend et retourne l URL signée', async () => {
      mockInvoke.mockResolvedValueOnce(AUTOLOGIN_SUCCESS_RESULT);

      const result = await fetchBackendAutologinUrl('backend-login', 'crm');

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('backend-login', {
        body: { backend: 'crm' },
      });
      expect(result).toBe(AUTOLOGIN_URL);
    });

    it('propage l erreur Supabase quand la génération autologin échoue', async () => {
      mockInvoke.mockResolvedValueOnce(AUTOLOGIN_ERROR_RESULT);

      await expect(fetchBackendAutologinUrl('backend-login', 'crm')).rejects.toEqual(
        AUTOLOGIN_ERROR,
      );

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('backend-login', {
        body: { backend: 'crm' },
      });
    });

    it('rejette une réponse autologin sans URL exploitable', async () => {
      mockInvoke.mockResolvedValueOnce(AUTOLOGIN_INVALID_RESULT);

      await expect(fetchBackendAutologinUrl('backend-login', 'crm')).rejects.toThrow(
        'Réponse autologin invalide.',
      );

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('backend-login', {
        body: { backend: 'crm' },
      });
    });
  });
});