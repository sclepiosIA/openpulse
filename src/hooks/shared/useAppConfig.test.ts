// @vitest-environment jsdom
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useAppConfig,
  useAllAppConfigs,
  useCompanyInfo,
  useEmailSenderConfig,
  useDocumentFooterConfig,
  useProductionUrl,
  useVapidPublicKey,
  useInternalTeamEmails,
  useInfraUrls,
  useQontoConfig,
  useUpdateAppConfig,
} from './useAppConfig';

const {
  APP_CONFIG_ROWS,
  UPDATE_RESULT_OK,
  SELECT_ERROR_RESULT,
  UPDATE_ERROR_RESULT,
  toastMock,
  sanitizeSupabaseErrorMock,
  mockFrom,
} = vi.hoisted(() => {
  const APP_CONFIG_ROWS = [
    {
      key: 'company_info',
      value: {
        name: 'Marque IA',
        address: '10 rue de Paris',
        city: 'Lyon',
        siret: '12345678901234',
        tva_intracom: 'FR00123456789',
        email: 'contact@marque.test',
        phone: '0102030405',
        iban: 'FR7612345678901234567890123',
        bic: 'ABCDFRPP',
        logo_url: 'https://cdn.test/logo.png',
      },
      category: 'company',
      description: 'Infos société',
      updated_at: '2024-01-01T00:00:00.000Z',
      updated_by: 'u1',
    },
    {
      key: 'email_sender',
      value: {
        default_from: 'noreply@marque.test',
        notifications_from: 'notifications@marque.test',
        formations_from: 'formations@marque.test',
        support_from: 'support@marque.test',
      },
      category: 'email',
      description: 'Expéditeurs email',
      updated_at: '2024-01-02T00:00:00.000Z',
      updated_by: 'u1',
    },
    {
      key: 'document_footer',
      value: {
        company_name: 'Marque IA',
        email: 'legal@marque.test',
        phone: '0504030201',
        confidential_text: 'Document confidentiel',
      },
      category: 'documents',
      description: 'Pied de page',
      updated_at: '2024-01-03T00:00:00.000Z',
      updated_by: 'u1',
    },
    {
      key: 'production_url',
      value: { url: 'https://prod.marque.test' },
      category: 'infra',
      description: null,
      updated_at: '2024-01-04T00:00:00.000Z',
      updated_by: 'u1',
    },
    {
      key: 'vapid_public_key',
      value: { key: 'pubkey-test' },
      category: 'push',
      description: null,
      updated_at: '2024-01-05T00:00:00.000Z',
      updated_by: 'u1',
    },
    {
      key: 'internal_team_emails',
      value: { emails: ['ops@marque.test', 'admin@marque.test'] },
      category: 'team',
      description: null,
      updated_at: '2024-01-06T00:00:00.000Z',
      updated_by: 'u1',
    },
    {
      key: 'infrastructure_urls',
      value: {
        cdn_url: 'https://cdn.custom.test',
        jitsi_url: 'https://meet.custom.test',
        nextcloud_url: 'https://cloud.custom.test',
        passbolt_url: 'https://vault.custom.test',
      },
      category: 'infra',
      description: null,
      updated_at: '2024-01-07T00:00:00.000Z',
      updated_by: 'u1',
    },
    {
      key: 'qonto_config',
      value: {
        dashboard_url: 'https://qonto.custom.test',
        organization_id: 'org-42',
      },
      category: 'finance',
      description: null,
      updated_at: '2024-01-08T00:00:00.000Z',
      updated_by: 'u1',
    },
  ];

  const UPDATE_RESULT_OK = { data: null, error: null };
  const SELECT_ERROR_RESULT = { data: null, error: { message: 'x' } };
  const UPDATE_ERROR_RESULT = { data: null, error: { message: 'update failed' } };
  const toastMock = vi.fn();
  const sanitizeSupabaseErrorMock = vi.fn((error: Error | { message?: string }) => error.message ?? 'Erreur');
  const mockFrom = vi.fn();

  return {
    APP_CONFIG_ROWS,
    UPDATE_RESULT_OK,
    SELECT_ERROR_RESULT,
    UPDATE_ERROR_RESULT,
    toastMock,
    sanitizeSupabaseErrorMock,
    mockFrom,
  };
});

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createSelectBuilder(result: { data: typeof APP_CONFIG_ROWS | null; error: { message: string } | null }) {
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
    then: (onFulfilled?: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return builder;
}

function createUpdateBuilder(result: { data: null; error: { message: string } | null }) {
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
    then: (onFulfilled?: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0, retryDelay: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useAppConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge toutes les configs puis expose la valeur et l’entrée brute pour une clé donnée', async () => {
    const builder = createSelectBuilder({ data: APP_CONFIG_ROWS, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useAppConfig<{ url: string }>('production_url'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.rawEntry).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('app_config');
    expect(builder.select).toHaveBeenCalledWith('key, value, category, description, updated_at, updated_by');
    expect(builder.order).toHaveBeenCalledWith('key');
    expect(result.current.data).toEqual({ url: 'https://prod.marque.test' });
    expect(result.current.rawEntry).toEqual(
      expect.objectContaining({
        key: 'production_url',
        category: 'infra',
        value: { url: 'https://prod.marque.test' },
      })
    );
  });

  it('expose isError quand la requête Supabase échoue', async () => {
    const builder = createSelectBuilder(SELECT_ERROR_RESULT);
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useAllAppConfigs(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(expect.objectContaining({ message: 'x' }));
  });

  it('retourne les helpers typés avec les valeurs métier attendues', async () => {
    const builder = createSelectBuilder({ data: APP_CONFIG_ROWS, error: null });
    mockFrom.mockReturnValue(builder);

    const { result: company } = renderHook(() => useCompanyInfo(), { wrapper: createWrapper() });
    const { result: email } = renderHook(() => useEmailSenderConfig(), { wrapper: createWrapper() });
    const { result: footer } = renderHook(() => useDocumentFooterConfig(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(company.current.isSuccess).toBe(true);
      expect(email.current.isSuccess).toBe(true);
      expect(footer.current.isSuccess).toBe(true);
    });

    expect(company.current.data).toEqual({
      name: 'Marque IA',
      address: '10 rue de Paris',
      city: 'Lyon',
      siret: '12345678901234',
      tva_intracom: 'FR00123456789',
      email: 'contact@marque.test',
      phone: '0102030405',
      iban: 'FR7612345678901234567890123',
      bic: 'ABCDFRPP',
      logo_url: 'https://cdn.test/logo.png',
    });

    expect(email.current.data).toEqual({
      default_from: 'noreply@marque.test',
      notifications_from: 'notifications@marque.test',
      formations_from: 'formations@marque.test',
      support_from: 'support@marque.test',
    });

    expect(footer.current.data).toEqual({
      company_name: 'Marque IA',
      email: 'legal@marque.test',
      phone: '0504030201',
      confidential_text: 'Document confidentiel',
    });
  });

  it('retourne les valeurs dérivées et les fallbacks par défaut', async () => {
    const builderWithData = createSelectBuilder({ data: APP_CONFIG_ROWS, error: null });
    mockFrom.mockReturnValue(builderWithData);

    const { result: productionUrl } = renderHook(() => useProductionUrl(), { wrapper: createWrapper() });
    const { result: vapidKey } = renderHook(() => useVapidPublicKey(), { wrapper: createWrapper() });
    const { result: teamEmails } = renderHook(() => useInternalTeamEmails(), { wrapper: createWrapper() });
    const { result: infraUrls } = renderHook(() => useInfraUrls(), { wrapper: createWrapper() });
    const { result: qontoConfig } = renderHook(() => useQontoConfig(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(productionUrl.current).toBe('https://prod.marque.test');
      expect(vapidKey.current).toBe('pubkey-test');
      expect(teamEmails.current).toEqual(['ops@marque.test', 'admin@marque.test']);
      expect(infraUrls.current).toEqual({
        cdn_url: 'https://cdn.custom.test',
        jitsi_url: 'https://meet.custom.test',
        nextcloud_url: 'https://cloud.custom.test',
        passbolt_url: 'https://vault.custom.test',
      });
      expect(qontoConfig.current).toEqual({
        dashboard_url: 'https://qonto.custom.test',
        organization_id: 'org-42',
      });
    });

    const builderWithoutMatches = createSelectBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builderWithoutMatches);

    const { result: fallbackProductionUrl } = renderHook(() => useProductionUrl(), { wrapper: createWrapper() });
    const { result: fallbackVapidKey } = renderHook(() => useVapidPublicKey(), { wrapper: createWrapper() });
    const { result: fallbackTeamEmails } = renderHook(() => useInternalTeamEmails(), { wrapper: createWrapper() });
    const { result: fallbackInfraUrls } = renderHook(() => useInfraUrls(), { wrapper: createWrapper() });
    const { result: fallbackQontoConfig } = renderHook(() => useQontoConfig(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(fallbackProductionUrl.current).toBe('');
      expect(fallbackVapidKey.current).toBe('');
      expect(fallbackTeamEmails.current).toEqual([]);
      expect(fallbackInfraUrls.current).toEqual({
        cdn_url: '',
        jitsi_url: '',
        nextcloud_url: '',
        passbolt_url: '',
      });
      expect(fallbackQontoConfig.current).toEqual({
        dashboard_url: '',
        organization_id: '',
      });
    });
  });

  it('met à jour une config, invalide le cache et affiche un toast de succès', async () => {
    const updateBuilder = createUpdateBuilder(UPDATE_RESULT_OK);
    mockFrom.mockReturnValue(updateBuilder);

    const invalidateQueriesSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateAppConfig(), {
      wrapper: createWrapper(),
    });

    const payload = {
      key: 'company_info',
      value: {
        name: 'Marque IA 2',
        city: 'Paris',
      },
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockFrom).toHaveBeenCalledWith('app_config');
    expect(updateBuilder.update).toHaveBeenCalledTimes(1);
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        value: payload.value,
        updated_at: expect.any(String),
      })
    );
    expect(updateBuilder.eq).toHaveBeenCalledWith('key', 'company_info');
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['app-config'] });
    expect(toastMock).toHaveBeenCalledWith({ title: 'Configuration mise à jour' });

    invalidateQueriesSpy.mockRestore();
  });

  it('gère les erreurs de mutation avec sanitation et toast destructif', async () => {
    const updateBuilder = createUpdateBuilder(UPDATE_ERROR_RESULT);
    mockFrom.mockReturnValue(updateBuilder);

    const { result } = renderHook(() => useUpdateAppConfig(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          key: 'email_sender',
          value: { default_from: 'bad@marque.test' },
        })
      ).rejects.toEqual(expect.objectContaining({ message: 'update failed' }));
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(sanitizeSupabaseErrorMock).toHaveBeenCalledWith(expect.objectContaining({ message: 'update failed' }));
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'update failed',
      variant: 'destructive',
    });
  });
});