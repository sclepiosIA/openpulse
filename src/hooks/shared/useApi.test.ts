/* @vitest-environment jsdom */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  useApiLogs,
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useWebhookLogs,
  useOAuthApps,
  useCreateOAuthApp,
  useMyOAuthTokens,
  useRevokeOAuthToken,
  useMarketplaceConnectors,
  useMyConnectorInstallations,
  useInstallConnector,
  useUninstallConnector,
} from './useApi'

const {
  AUTH_STATE,
  toastFn,
  sanitizeSupabaseErrorMock,
  mockFrom,
  mockDigest,
  randomUUIDMock,
  API_KEYS_ROWS,
  API_KEY_INSERT_ROW,
  API_KEY_REVOKED_ROW,
  API_LOGS_ROWS,
  WEBHOOK_ROWS,
  WEBHOOK_INSERT_ROW,
  WEBHOOK_UPDATED_ROW,
  WEBHOOK_LOGS_ROWS,
  OAUTH_APPS_ROWS,
  OAUTH_APP_INSERT_ROW,
  OAUTH_TOKENS_ROWS,
  MARKETPLACE_ROWS,
  INSTALLATIONS_ROWS,
  INSTALL_INSERT_ROW,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  toastFn: vi.fn(),
  sanitizeSupabaseErrorMock: vi.fn((error: Error | { message?: string }) => error.message ?? 'Erreur'),
  mockFrom: vi.fn(),
  mockDigest: vi.fn(async () => new Uint8Array([1, 2, 3, 4]).buffer),
  randomUUIDMock: vi.fn(() => '11111111-2222-3333-4444-555555555555'),
  API_KEYS_ROWS: [
    {
      id: 'k1',
      nom: 'Primary key',
      description: 'desc',
      key_prefix: 'sk_live_1111',
      est_active: true,
      permissions: ['read:orders'],
      rate_limit_per_minute: 100,
      rate_limit_per_day: 1000,
      expires_at: null,
      created_at: '2024-01-01T00:00:00.000Z',
      revoked_at: null,
      last_used_at: null,
      total_requests: 42,
      created_by: 'u1',
    },
  ],
  API_KEY_INSERT_ROW: {
    id: 'k2',
    nom: 'Created key',
    description: 'created desc',
    key_prefix: 'sk_live_1111',
    est_active: true,
    permissions: ['read:orders'],
    rate_limit_per_minute: 50,
    rate_limit_per_day: 500,
    expires_at: null,
    created_at: '2024-01-02T00:00:00.000Z',
    revoked_at: null,
    last_used_at: null,
    total_requests: 0,
    created_by: 'u1',
  },
  API_KEY_REVOKED_ROW: {
    id: 'k1',
    est_active: false,
    revoked_by: 'u1',
  },
  API_LOGS_ROWS: [
    {
      id: 'l1',
      method: 'GET',
      path: '/orders',
      status_code: 200,
      created_at: '2024-01-01T12:00:00.000Z',
      api_key: { nom: 'Primary key', key_prefix: 'sk_live_1111' },
    },
  ],
  WEBHOOK_ROWS: [
    {
      id: 'w1',
      nom: 'Order webhook',
      url: 'https://example.test/hook',
      events: ['order.created'],
      secret: 'whsec_x',
      est_actif: true,
      retry_count: 3,
      timeout_seconds: 30,
      headers: { 'x-env': 'test' },
      created_at: '2024-01-03T00:00:00.000Z',
      created_by: 'u1',
    },
  ],
  WEBHOOK_INSERT_ROW: {
    id: 'w2',
    nom: 'Created webhook',
    url: 'https://example.test/new-hook',
    events: ['order.updated'],
    est_actif: true,
    retry_count: 5,
    timeout_seconds: 20,
    headers: { 'x-app': 'demo' },
    created_at: '2024-01-04T00:00:00.000Z',
    created_by: 'u1',
  },
  WEBHOOK_UPDATED_ROW: {
    id: 'w1',
    nom: 'Updated webhook',
    url: 'https://example.test/hook-2',
  },
  WEBHOOK_LOGS_ROWS: [
    {
      id: 'wl1',
      webhook_id: 'w1',
      event_type: 'order.created',
      payload: { id: 'o1' },
      response_status: 200,
      response_body: 'ok',
      error_message: null,
      duration_ms: 120,
      created_at: '2024-01-05T00:00:00.000Z',
    },
  ],
  OAUTH_APPS_ROWS: [
    {
      id: 'oa1',
      nom: 'CRM App',
      description: 'sync crm',
      client_id: 'client_1',
      redirect_uris: ['https://example.test/callback'],
      scopes: ['contacts:read'],
      logo_url: null,
      website_url: null,
      privacy_policy_url: null,
      est_active: true,
      created_at: '2024-01-06T00:00:00.000Z',
      created_by: 'u1',
    },
  ],
  OAUTH_APP_INSERT_ROW: {
    id: 'oa2',
    nom: 'Created OAuth',
    description: 'new app',
    client_id: 'client_11111111222233334444555555555555',
    redirect_uris: ['https://example.test/cb'],
    scopes: ['contacts:read'],
    logo_url: null,
    website_url: null,
    privacy_policy_url: null,
    est_active: true,
    created_at: '2024-01-07T00:00:00.000Z',
    created_by: 'u1',
  },
  OAUTH_TOKENS_ROWS: [
    {
      id: 'ot1',
      user_id: 'u1',
      oauth_app: { nom: 'CRM App', logo_url: null },
      revoked_at: null,
    },
  ],
  MARKETPLACE_ROWS: [
    {
      id: 'mc1',
      nom: 'Slack',
      slug: 'slack',
      description: 'chat',
      description_longue: 'chat app',
      categorie: 'communication',
      logo_url: null,
      documentation_url: null,
      developer_name: 'Acme',
      developer_url: null,
      prix_mensuel: 9,
      prix_type: 'monthly',
      est_actif: true,
      est_certifie: true,
      nombre_installations: 12,
      note_moyenne: 4.6,
      configuration_schema: {},
      created_at: '2024-01-08T00:00:00.000Z',
      updated_at: '2024-01-08T00:00:00.000Z',
    },
  ],
  INSTALLATIONS_ROWS: [
    {
      id: 'ci1',
      connector_id: 'mc1',
      installed_by: 'u1',
      connector: { id: 'mc1', nom: 'Slack' },
    },
  ],
  INSTALL_INSERT_ROW: {
    id: 'ci2',
    connector_id: 'mc1',
    installed_by: 'u1',
    configuration: { api_key: 'abc', sync_interval: 15 },
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastFn }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

type SupabaseResponse = { data: unknown; error: { message: string } | null }

function createThenableBuilder(response: SupabaseResponse) {
  const state = { response }

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
    is: vi.fn(() => builder),
    single: vi.fn(async () => state.response),
    maybeSingle: vi.fn(async () => state.response),
    then: (
      onFulfilled?: (value: SupabaseResponse) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(state.response).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(state.response).catch(onRejected),
  }

  return builder
}

function setFromImplementation(map: Record<string, SupabaseResponse>) {
  mockFrom.mockImplementation((table: string) => createThenableBuilder(map[table] ?? { data: null, error: null }))
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  }
}

beforeAll(() => {
  vi.stubGlobal('crypto', {
    randomUUID: randomUUIDMock,
    subtle: {
      digest: mockDigest,
    },
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  setFromImplementation({
    api_keys: { data: API_KEYS_ROWS, error: null },
    api_logs: { data: API_LOGS_ROWS, error: null },
    webhooks: { data: WEBHOOK_ROWS, error: null },
    webhook_logs: { data: WEBHOOK_LOGS_ROWS, error: null },
    oauth_apps: { data: OAUTH_APPS_ROWS, error: null },
    oauth_tokens: { data: OAUTH_TOKENS_ROWS, error: null },
    marketplace_connectors: { data: MARKETPLACE_ROWS, error: null },
    connector_installations: { data: INSTALLATIONS_ROWS, error: null },
  })
})

describe('useApi', () => {
  it('useApiKeys charge puis renvoie les clés API', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useApiKeys(), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(API_KEYS_ROWS)
    expect(result.current.data?.[0].nom).toBe('Primary key')
    expect(mockFrom).toHaveBeenCalledWith('api_keys')
  })

  it('useApiKeys passe en erreur quand supabase renvoie une erreur', async () => {
    setFromImplementation({
      api_keys: { data: null, error: { message: 'x' } },
    })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useApiKeys(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('x')
  })

  it('useCreateApiKey crée une clé API et appelle insert avec les bonnes données', async () => {
    const insertBuilder = createThenableBuilder({ data: API_KEY_INSERT_ROW, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'api_keys') {
        return insertBuilder
      }
      return createThenableBuilder({ data: null, error: null })
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateApiKey(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        nom: 'Created key',
        description: 'created desc',
        permissions: ['read:orders'],
        rate_limit_per_minute: 50,
        rate_limit_per_day: 500,
      })
    })

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        nom: 'Created key',
        description: 'created desc',
        permissions: ['read:orders'],
        rate_limit_per_minute: 50,
        rate_limit_per_day: 500,
        created_by: 'u1',
        key_prefix: 'sk_live_1111',
        key_hash: '01020304',
      })
    )
    expect(toastFn).toHaveBeenCalledWith({ title: 'Clé API créée avec succès' })
  })

  it('useCreateApiKey remonte une erreur et affiche un toast destructif', async () => {
    const failingBuilder = createThenableBuilder({ data: null, error: { message: 'x' } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'api_keys') return failingBuilder
      return createThenableBuilder({ data: null, error: null })
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateApiKey(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          nom: 'Bad key',
          permissions: ['read:orders'],
        })
      ).rejects.toMatchObject({ message: 'x' })
    })

    expect(sanitizeSupabaseErrorMock).toHaveBeenCalled()
    expect(toastFn).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'x',
      variant: 'destructive',
    })
  })

  it('useRevokeApiKey révoque une clé API', async () => {
    const builder = createThenableBuilder({ data: API_KEY_REVOKED_ROW, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'api_keys') return builder
      return createThenableBuilder({ data: null, error: null })
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useRevokeApiKey(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('k1')
    })

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        est_active: false,
        revoked_by: 'u1',
      })
    )
    expect(builder.eq).toHaveBeenCalledWith('id', 'k1')
    expect(toastFn).toHaveBeenCalledWith({ title: 'Clé API révoquée' })
  })

  it('useApiLogs renvoie les logs API avec la limite demandée', async () => {
    const builder = createThenableBuilder({ data: API_LOGS_ROWS, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'api_logs') return builder
      return createThenableBuilder({ data: null, error: null })
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useApiLogs(25), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.limit).toHaveBeenCalledWith(25)
    expect(result.current.data?.[0].api_key.nom).toBe('Primary key')
  })

  it('useWebhooks renvoie les webhooks', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useWebhooks(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(WEBHOOK_ROWS)
    expect(result.current.data?.[0].url).toBe('https://example.test/hook')
  })

  it('useCreateWebhook crée un webhook', async () => {
    const builder = createThenableBuilder({ data: WEBHOOK_INSERT_ROW, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'webhooks') return builder
      return createThenableBuilder({ data: null, error: null })
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateWebhook(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        nom: 'Created webhook',
        url: 'https://example.test/new-hook',
        events: ['order.updated'],
        retry_count: 5,
        timeout_seconds: 20,
        headers: { 'x-app': 'demo' },
      })
    })

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        nom: 'Created webhook',
        url: 'https://example.test/new-hook',
        events: ['order.updated'],
        retry_count: 5,
        timeout_seconds: 20,
        headers: { 'x-app': 'demo' },
        created_by: 'u1',
        secret: 'test-webhook-signing-secret',
      })
    )
    expect(toastFn).toHaveBeenCalledWith({ title: 'Webhook créé avec succès' })
  })

  it('useUpdateWebhook met à jour un webhook', async () => {
    const builder = createThenableBuilder({ data: WEBHOOK_UPDATED_ROW, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'webhooks') return builder
      return createThenableBuilder({ data: null, error: null })
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useUpdateWebhook(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'w1',
        nom: 'Updated webhook',
        url: 'https://example.test/hook-2',
      })
    })

    expect(builder.update).toHaveBeenCalledWith({
      nom: 'Updated webhook',
      url: 'https://example.test/hook-2',
    })
    expect(builder.eq).toHaveBeenCalledWith('id', 'w1')
    expect(toastFn).toHaveBeenCalledWith({ title: 'Webhook mis à jour' })
  })

  it('useDeleteWebhook supprime un webhook', async () => {
    const builder = createThenableBuilder({ data: null, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'webhooks') return builder
      return createThenableBuilder({ data: null, error: null })
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useDeleteWebhook(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('w1')
    })

    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'w1')
    expect(toastFn).toHaveBeenCalledWith({ title: 'Webhook supprimé' })
  })

  it('useWebhookLogs charge les logs d’un webhook précis', async () => {
    const builder = createThenableBuilder({ data: WEBHOOK_LOGS_ROWS, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'webhook_logs') return builder
      return createThenableBuilder({ data: null, error: null })
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useWebhookLogs('w1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq).toHaveBeenCalledWith('webhook_id', 'w1')
    expect(builder.limit).toHaveBeenCalledWith(50)
    expect(result.current.data?.[0].event_type).toBe('order.created')
  })

  it('useOAuthApps renvoie les apps OAuth', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useOAuthApps(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].nom).toBe('CRM App')
  })

  it('useCreateOAuthApp crée une app OAuth et hash le secret', async () => {
    const builder = createThenableBuilder({ data: OAUTH_APP_INSERT_ROW, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'oauth_apps') return builder
      return createThenableBuilder({ data: null, error: null })
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateOAuthApp(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        nom: 'Created OAuth',
        description: 'new app',
        redirect_uris: ['https://example.test/cb'],
        scopes: ['contacts:read'],
      })
    })

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        nom: 'Created OAuth',
        description: 'new app',
        redirect_uris: ['https://example.test/cb'],
        scopes: ['contacts:read'],
        created_by: 'u1',
        client_id: 'client_11111111222233334444555555555555',
        client_secret_hash: '01020304',
      })
    )
    expect(toastFn).toHaveBeenCalledWith({ title: 'Application OAuth créée' })
  })

  it('useMyOAuthTokens renvoie les tokens de l’utilisateur courant', async () => {
    const builder = createThenableBuilder({ data: OAUTH_TOKENS_ROWS, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'oauth_tokens') return builder
      return createThenableBuilder({ data: null, error: null })
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useMyOAuthTokens(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(builder.is).toHaveBeenCalledWith('revoked_at', null)
    expect(result.current.data?.[0].oauth_app.nom).toBe('CRM App')
  })

  it('useRevokeOAuthToken révoque un token OAuth', async () => {
    const builder = createThenableBuilder({ data: null, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'oauth_tokens') return builder
      return createThenableBuilder({ data: null, error: null })
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useRevokeOAuthToken(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('ot1')
    })

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        revoked_at: expect.any(String),
      })
    )
    expect(builder.eq).toHaveBeenCalledWith('id', 'ot1')
    expect(toastFn).toHaveBeenCalledWith({ title: 'Accès révoqué' })
  })

  it('useMarketplaceConnectors renvoie les connecteurs filtrés par catégorie', async () => {
    const builder = createThenableBuilder({ data: MARKETPLACE_ROWS, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'marketplace_connectors') return builder
      return createThenableBuilder({ data: null, error: null })
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useMarketplaceConnectors('communication'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq).toHaveBeenCalledWith('est_actif', true)
    expect(builder.eq).toHaveBeenCalledWith('categorie', 'communication')
    expect(result.current.data?.[0].slug).toBe('slack')
  })

  it('useMyConnectorInstallations renvoie les installations utilisateur', async () => {
    const builder = createThenableBuilder({ data: INSTALLATIONS_ROWS, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'connector_installations') return builder
      return createThenableBuilder({ data: null, error: null })
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useMyConnectorInstallations(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq).toHaveBeenCalledWith('installed_by', 'u1')
    expect(result.current.data?.[0].connector.nom).toBe('Slack')
  })

  it('useInstallConnector installe un connecteur', async () => {
    const builder = createThenableBuilder({ data: INSTALL_INSERT_ROW, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'connector_installations') return builder
      return createThenableBuilder({ data: null, error: null })
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useInstallConnector(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        connector_id: 'mc1',
        configuration: { api_key: 'abc', sync_interval: 15 },
      })
    })

    expect(builder.insert).toHaveBeenCalledWith({
      connector_id: 'mc1',
      installed_by: 'u1',
      configuration: { api_key: 'abc', sync_interval: 15 },
    })
    expect(toastFn).toHaveBeenCalledWith({ title: 'Connecteur installé' })
  })

  it('useUninstallConnector désinstalle un connecteur', async () => {
    const builder = createThenableBuilder({ data: null, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'connector_installations') return builder
      return createThenableBuilder({ data: null, error: null })
    })

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useUninstallConnector(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('ci1')
    })

    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'ci1')
    expect(toastFn).toHaveBeenCalledWith({ title: 'Connecteur désinstallé' })
  })
})