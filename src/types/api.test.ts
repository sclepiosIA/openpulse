import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import React from 'react'
import * as api from './api'

const {
  AUTH_STATE,
  toastSuccess,
  toastError,
  navigateMock,
  mockFrom,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  navigateMock: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: AUTH_STATE.session }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: AUTH_STATE.user }, error: null }),
    },
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAdminRole', () => ({
  useAdminRole: () => true,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('api.ts', () => {
  it('expose les unions littérales attendues via compatibilité de types runtime-free', () => {
    const readPermission: api.ApiPermission = 'read'
    const adminPermission: api.ApiPermission = 'admin'
    const webhookEvent: api.WebhookEvent = 'invoice.paid'
    const oauthScope: api.OAuthScope = 'write'
    const connectorCategory: api.ConnectorCategory = 'crm'
    const connectorPriceType: api.ConnectorPriceType = 'freemium'
    const syncStatus: api.SyncStatus = 'success'

    expect(readPermission).toBe('read')
    expect(adminPermission).toBe('admin')
    expect(webhookEvent).toBe('invoice.paid')
    expect(oauthScope).toBe('write')
    expect(connectorCategory).toBe('crm')
    expect(connectorPriceType).toBe('freemium')
    expect(syncStatus).toBe('success')
  })

  it('permet de manipuler un objet ApiKey avec les champs métier attendus', () => {
    const key: api.ApiKey = {
      id: 'k1',
      nom: 'Clé production',
      description: 'Accès principal',
      key_hash: 'hash-value',
      key_prefix: 'pk_live',
      permissions: ['read', 'write'],
      rate_limit_per_minute: 120,
      rate_limit_per_day: 5000,
      expires_at: null,
      last_used_at: '2024-01-02T10:00:00Z',
      total_requests: 321,
      est_active: true,
      created_by: 'u1',
      created_at: '2024-01-01T00:00:00Z',
      revoked_at: null,
      revoked_by: null,
    }

    expect(key.permissions).toEqual(['read', 'write'])
    expect(key.key_prefix).toBe('pk_live')
    expect(key.rate_limit_per_minute).toBe(120)
    expect(key.total_requests).toBe(321)
    expect(key.est_active).toBe(true)
  })

  it('permet de manipuler un objet ApiLog avec la relation api_key', () => {
    const log: api.ApiLog = {
      id: 'l1',
      api_key_id: 'k1',
      endpoint: '/v1/contacts',
      method: 'POST',
      status_code: 201,
      request_body: { nom: 'Jean' },
      response_body: { id: 'c1' },
      ip_address: '127.0.0.1',
      user_agent: 'vitest',
      duration_ms: 85,
      error_message: null,
      created_at: '2024-01-03T09:00:00Z',
      api_key: {
        nom: 'Clé prod',
        key_prefix: 'pk_live',
      },
    }

    expect(log.endpoint).toBe('/v1/contacts')
    expect(log.method).toBe('POST')
    expect(log.status_code).toBe(201)
    expect(log.api_key?.nom).toBe('Clé prod')
    expect(log.duration_ms).toBe(85)
  })

  it('permet de manipuler un objet Webhook avec configuration avancée', () => {
    const webhook: api.Webhook = {
      id: 'w1',
      nom: 'Webhook factures',
      url: 'https://example.test/webhook',
      secret: 'secret',
      events: ['invoice.created', 'invoice.paid'],
      est_actif: true,
      retry_count: 3,
      timeout_seconds: 15,
      headers: { 'X-App': 'marketplace' },
      last_triggered_at: null,
      last_status: null,
      failure_count: 0,
      created_by: 'u1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    }

    expect(webhook.events).toContain('invoice.paid')
    expect(webhook.retry_count).toBe(3)
    expect(webhook.timeout_seconds).toBe(15)
    expect(webhook.headers['X-App']).toBe('marketplace')
    expect(webhook.est_actif).toBe(true)
  })

  it('permet de manipuler un objet WebhookLog avec résultat de tentative', () => {
    const webhookLog: api.WebhookLog = {
      id: 'wl1',
      webhook_id: 'w1',
      event_type: 'invoice.paid',
      payload: { invoiceId: 'i1' },
      response_status: 200,
      response_body: 'ok',
      duration_ms: 140,
      attempt_number: 2,
      success: true,
      error_message: null,
      created_at: '2024-01-04T08:30:00Z',
    }

    expect(webhookLog.event_type).toBe('invoice.paid')
    expect(webhookLog.response_status).toBe(200)
    expect(webhookLog.attempt_number).toBe(2)
    expect(webhookLog.success).toBe(true)
  })

  it('permet de manipuler un objet OAuthApp et OAuthToken liés', () => {
    const app: api.OAuthApp = {
      id: 'oa1',
      nom: 'App partenaire',
      description: 'Synchronisation CRM',
      client_id: 'client-id',
      client_secret_hash: 'secret-hash',
      redirect_uris: ['https://example.test/callback'],
      scopes: ['read', 'write'],
      logo_url: null,
      website_url: 'https://example.test',
      privacy_policy_url: 'https://example.test/privacy',
      est_active: true,
      est_verified: false,
      created_by: 'u1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-05T00:00:00Z',
    }

    const token: api.OAuthToken = {
      id: 'ot1',
      oauth_app_id: app.id,
      user_id: 'u1',
      access_token_hash: 'access-hash',
      refresh_token_hash: null,
      scopes: ['read'],
      expires_at: '2024-02-01T00:00:00Z',
      created_at: '2024-01-10T00:00:00Z',
      revoked_at: null,
      oauth_app: app,
    }

    expect(app.redirect_uris[0]).toBe('https://example.test/callback')
    expect(app.scopes).toEqual(['read', 'write'])
    expect(token.oauth_app?.nom).toBe('App partenaire')
    expect(token.scopes).toEqual(['read'])
    expect(token.user_id).toBe('u1')
  })

  it('permet de manipuler un MarketplaceConnector et une installation', () => {
    const connector: api.MarketplaceConnector = {
      id: 'mc1',
      nom: 'Hub CRM',
      slug: 'hub-crm',
      description: 'Connecteur CRM',
      description_longue: 'Synchronise les clients et opportunités',
      categorie: 'crm',
      logo_url: null,
      developer_name: 'Acme',
      developer_url: 'https://acme.test',
      documentation_url: 'https://docs.test/hub-crm',
      prix_type: 'paid',
      prix_mensuel: 29,
      est_actif: true,
      est_certifie: true,
      note_moyenne: 4.8,
      nombre_installations: 142,
      configuration_schema: {
        fields: ['apiKey', 'accountId'],
      },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-06T00:00:00Z',
    }

    const installation: api.ConnectorInstallation = {
      id: 'ci1',
      connector_id: connector.id,
      installed_by: 'u1',
      configuration: { apiKey: 'set', accountId: 'acc1' },
      est_active: true,
      installed_at: '2024-01-07T00:00:00Z',
      last_sync_at: '2024-01-08T10:00:00Z',
      sync_status: 'success',
      sync_error: null,
      connector,
    }

    expect(connector.slug).toBe('hub-crm')
    expect(connector.prix_mensuel).toBe(29)
    expect(connector.est_certifie).toBe(true)
    expect(installation.sync_status).toBe('success')
    expect(installation.connector?.nombre_installations).toBe(142)
  })

  it('permet de manipuler un objet ApiStats et de calculer un ratio métier simple', () => {
    const stats: api.ApiStats = {
      total_requests_today: 240,
      total_requests_month: 7200,
      active_api_keys: 4,
      active_webhooks: 6,
      installed_connectors: 9,
      avg_response_time_ms: 180,
      error_rate: 2.5,
    }

    const requestsPerKey = stats.total_requests_today / stats.active_api_keys

    expect(stats.total_requests_month).toBe(7200)
    expect(stats.avg_response_time_ms).toBe(180)
    expect(stats.error_rate).toBe(2.5)
    expect(requestsPerKey).toBe(60)
  })

  it('crée correctement le wrapper QueryClientProvider pour renderHook', () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => 42, { wrapper })

    expect(result.current).toBe(42)
  })

  it('fournit un mock supabase chaînable et thenable utilisable sans réseau', async () => {
    const resolved = { data: [{ id: '1' }], error: null }

    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      then: vi.fn(),
      catch: vi.fn(),
    }

    builder.select.mockReturnValue(builder)
    builder.eq.mockReturnValue(builder)
    builder.gte.mockReturnValue(builder)
    builder.lte.mockReturnValue(builder)
    builder.in.mockReturnValue(builder)
    builder.order.mockReturnValue(builder)
    builder.limit.mockReturnValue(builder)
    builder.insert.mockReturnValue(builder)
    builder.update.mockReturnValue(builder)
    builder.delete.mockReturnValue(builder)
    builder.single.mockResolvedValue(resolved)
    builder.maybeSingle.mockResolvedValue(resolved)
    builder.then.mockImplementation((onFulfilled: (value: typeof resolved) => unknown) => Promise.resolve(onFulfilled(resolved)))
    builder.catch.mockImplementation(() => Promise.resolve(resolved))

    mockFrom.mockReturnValue(builder)

    const response = await mockFrom('api_keys')
      .select('*')
      .eq('created_by', 'u1')
      .order('created_at', { ascending: false })
      .limit(10)

    expect(mockFrom).toHaveBeenCalledWith('api_keys')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.eq).toHaveBeenCalledWith('created_by', 'u1')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(builder.limit).toHaveBeenCalledWith(10)
    expect(response).toEqual(resolved)
  })
})