/**
 * Tests unitaires pour useApi (Module 10: API Publique & Marketplace).
 *
 * Les hooks exposés sont :
 *   useApiKeys, useCreateApiKey, useRevokeApiKey
 *   useApiLogs, useWebhooks, useCreateWebhook, useUpdateWebhook, useDeleteWebhook
 *   useWebhookLogs, useOAuthApps, useCreateOAuthApp
 *   useMyOAuthTokens, useRevokeOAuthToken
 *   useMarketplaceConnectors, useMyConnectorInstallations
 *   useInstallConnector, useUninstallConnector
 *   useApiStats
 *
 * Les tests couvrent :
 * — Queries : état loading, données retournées, erreur Supabase → isError=true
 * — Mutations : succès (toast + invalidation), erreur (toast destructive)
 * — useWebhookLogs : disabled quand webhookId vide
 * — useApiStats : calcul taux d'erreur depuis la structure Promise.all
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ApiKey, Webhook, WebhookEvent, ApiPermission } from '@/types/api'

// ─── Type helper ──────────────────────────────────────────────────────────────
type Chainable = { [k: string]: (...a: any[]) => Chainable | Promise<unknown> }

// ─── Références stables hoistées ─────────────────────────────────────────────
const { mockToast, mockFrom, mockRpc } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}))

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (err: Error) => err.message,
}))

vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    loading: false,
  }),
}))

// ─── Imports après mocks ──────────────────────────────────────────────────────
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
  useApiStats,
} from '@/hooks/shared/useApi'
import { supabase } from '@/integrations/supabase/client';

// ─── Wrapper ──────────────────────────────────────────────────────────────────
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// ─── Helper chaîne query builder ─────────────────────────────────────────────
function chainWith(data: unknown, error: unknown = null): Chainable {
  const chain: Chainable = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    is: () => chain,
    in: () => chain,
    not: () => chain,
    gte: () => chain,
    lte: () => chain,
    // limit doit etre thenable (c'est souvent le dernier appel dans les queries)
    limit: () => Promise.resolve({ data, error, count: null }) as unknown as Chainable,
    // order retourne chain (pas une Promise) pour permettre les appels subsequents comme .eq()
    order: () => chain,
    single: () => Promise.resolve({ data, error }) as unknown as Chainable,
    maybeSingle: () => Promise.resolve({ data, error }) as unknown as Chainable,
    insert: () =>
      ({
        select: () => ({
          single: () => Promise.resolve({ data, error }),
        }),
      }) as unknown as Chainable,
    update: () => chain,
    delete: () => Promise.resolve({ data, error }) as unknown as Chainable,
    upsert: () =>
      ({
        select: () => ({
          single: () => Promise.resolve({ data, error }),
        }),
      }) as unknown as Chainable,
    then: (cb: (v: unknown) => unknown) =>
      Promise.resolve({ data, error, count: null }).then(cb) as unknown as Chainable,
  }
  return chain
}

// ─── Données de test ─────────────────────────────────────────────────────────
const mockApiKey: ApiKey = {
  id: 'key-1',
  nom: 'Clé principale',
  description: null,
  key_hash: 'abc123',
  key_prefix: 'sk_live_0000',
  permissions: ['read'],
  rate_limit_per_minute: 60,
  rate_limit_per_day: 1000,
  expires_at: null,
  last_used_at: null,
  total_requests: 0,
  est_active: true,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  revoked_at: null,
  revoked_by: null,
}

const mockWebhook: Webhook = {
  id: 'wh-1',
  nom: 'Webhook test',
  url: 'https://hooks.example.com/test',
  secret: 'whsec_abc',
  events: ['etablissement.created' as WebhookEvent],
  est_actif: true,
  retry_count: 3,
  timeout_seconds: 30,
  headers: {},
  last_triggered_at: null,
  last_status: null,
  failure_count: 0,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

// ─── useApiKeys ────────────────────────────────────────────────────────────────
describe('useApiKeys', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne isLoading=true initialement', () => {
    mockFrom.mockReturnValue(chainWith([mockApiKey]))
    const { result } = renderHook(() => useApiKeys(), { wrapper: createWrapper() })
    expect(result.current.isLoading).toBe(true)
  })

  it('retourne les clés API après chargement', async () => {
    mockFrom.mockReturnValue(chainWith([mockApiKey]))
    const { result } = renderHook(() => useApiKeys(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([mockApiKey])
    expect(result.current.data?.[0].key_prefix).toBe('sk_live_0000')
  })

  it(`isError=true en cas d'erreur Supabase`, async () => {
    mockFrom.mockReturnValue(chainWith(null, { message: 'DB error' }))
    const { result } = renderHook(() => useApiKeys(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ─── useCreateApiKey ───────────────────────────────────────────────────────────
describe('useCreateApiKey', () => {
  beforeEach(() => vi.clearAllMocks())

  it('expose la mutation avec isPending=false initialement', () => {
    const { result } = renderHook(() => useCreateApiKey(), { wrapper: createWrapper() })
    expect(result.current.isPending).toBe(false)
    expect(typeof result.current.mutateAsync).toBe('function')
  })

  it('toast "Clé API créée avec succès" après succès', async () => {
    const created = { ...mockApiKey, id: 'key-new' }
    mockFrom.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: created, error: null })),
        })),
      })),
    })

    const { result } = renderHook(() => useCreateApiKey(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        nom: 'Nouvelle clé',
        permissions: ['read' as ApiPermission],
      })
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Clé API créée avec succès' })
    )
  })

  it('retourne la clé complète (full_key) en plus des données de la DB', async () => {
    const created = { ...mockApiKey, id: 'key-new' }
    mockFrom.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: created, error: null })),
        })),
      })),
    })

    const { result } = renderHook(() => useCreateApiKey(), { wrapper: createWrapper() })

    let mutResult: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      mutResult = await result.current.mutateAsync({
        nom: 'Nouvelle clé',
        permissions: ['read' as ApiPermission],
      })
    })

    expect(mutResult?.full_key).toMatch(/^sk_live_/)
  })

  it(`toast destructive en cas d'erreur Supabase`, async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: new Error('Insert failed') })),
        })),
      })),
    })

    const { result } = renderHook(() => useCreateApiKey(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ nom: 'Clé fail', permissions: [] }).catch(() => {})
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', title: 'Erreur' })
      )
    })
  })
})

// ─── useRevokeApiKey ───────────────────────────────────────────────────────────
describe('useRevokeApiKey', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Clé API révoquée" après succès', async () => {
    const revoked = { ...mockApiKey, est_active: false, revoked_at: '2026-01-02T00:00:00Z' }
    mockFrom.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: revoked, error: null })),
          })),
        })),
      })),
    })

    const { result } = renderHook(() => useRevokeApiKey(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('key-1')
    })

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Clé API révoquée' }))
  })

  it('toast destructive si erreur Supabase', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: new Error('Revoke failed') })),
          })),
        })),
      })),
    })

    const { result } = renderHook(() => useRevokeApiKey(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('key-fail').catch(() => {})
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    })
  })
})

// ─── useApiLogs ────────────────────────────────────────────────────────────────
describe('useApiLogs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne les logs en cas de succès', async () => {
    const logs = [
      {
        id: 'log-1',
        endpoint: '/api/v1/test',
        method: 'GET',
        status_code: 200,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    mockFrom.mockReturnValue(chainWith(logs))

    const { result } = renderHook(() => useApiLogs(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].id).toBe('log-1')
  })
})

// ─── useWebhooks ───────────────────────────────────────────────────────────────
describe('useWebhooks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne les webhooks après chargement', async () => {
    mockFrom.mockReturnValue(chainWith([mockWebhook]))

    const { result } = renderHook(() => useWebhooks(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].nom).toBe('Webhook test')
  })

  it(`isError=true en cas d'erreur`, async () => {
    mockFrom.mockReturnValue(chainWith(null, { message: 'DB error' }))
    const { result } = renderHook(() => useWebhooks(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ─── useCreateWebhook ──────────────────────────────────────────────────────────
describe('useCreateWebhook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Webhook créé avec succès" après succès', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: mockWebhook, error: null })),
        })),
      })),
    })

    const { result } = renderHook(() => useCreateWebhook(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        nom: 'Webhook test',
        url: 'https://hooks.example.com/test',
        events: ['etablissement.created' as WebhookEvent],
      })
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Webhook créé avec succès' })
    )
  })

  it('retourne le secret en clair dans la réponse', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: mockWebhook, error: null })),
        })),
      })),
    })

    const { result } = renderHook(() => useCreateWebhook(), { wrapper: createWrapper() })

    let mutResult: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      mutResult = await result.current.mutateAsync({
        nom: 'Webhook test',
        url: 'https://hooks.example.com/test',
        events: [],
      })
    })

    expect(mutResult?.secret).toMatch(/^whsec_/)
  })
})

// ─── useUpdateWebhook ──────────────────────────────────────────────────────────
describe('useUpdateWebhook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Webhook mis à jour" après succès', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({ data: { ...mockWebhook, nom: 'Updated' }, error: null })
            ),
          })),
        })),
      })),
    })

    const { result } = renderHook(() => useUpdateWebhook(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'wh-1', nom: 'Updated' })
    })

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Webhook mis à jour' }))
  })
})

// ─── useDeleteWebhook ──────────────────────────────────────────────────────────
describe('useDeleteWebhook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Webhook supprimé" après succès', async () => {
    mockFrom.mockReturnValue({
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })

    const { result } = renderHook(() => useDeleteWebhook(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('wh-1')
    })

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Webhook supprimé' }))
  })
})

// ─── useWebhookLogs ───────────────────────────────────────────────────────────
describe('useWebhookLogs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('query désactivée quand webhookId est vide', () => {
    mockFrom.mockReturnValue(chainWith([]))
    const { result } = renderHook(() => useWebhookLogs(''), { wrapper: createWrapper() })
    // enabled=false → isPending (mais pas fetching)
    expect(result.current.isFetching).toBe(false)
    expect(result.current.data).toBeUndefined()
  })

  it('retourne les logs quand webhookId est fourni', async () => {
    const logs = [
      {
        id: 'wl-1',
        webhook_id: 'wh-1',
        event_type: 'etablissement.created',
        response_status: 200,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    mockFrom.mockReturnValue(chainWith(logs))

    const { result } = renderHook(() => useWebhookLogs('wh-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].id).toBe('wl-1')
  })
})

// ─── useOAuthApps ──────────────────────────────────────────────────────────────
describe('useOAuthApps', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne les apps OAuth', async () => {
    const apps = [
      {
        id: 'app-1',
        nom: 'App Test',
        client_id: 'client_abc',
        est_active: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    mockFrom.mockReturnValue(chainWith(apps))

    const { result } = renderHook(() => useOAuthApps(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].nom).toBe('App Test')
  })
})

// ─── useCreateOAuthApp ─────────────────────────────────────────────────────────
describe('useCreateOAuthApp', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Application OAuth créée" après succès', async () => {
    const app = {
      id: 'app-new',
      nom: 'App Nouvelle',
      client_id: 'client_xyz',
      est_active: true,
      created_at: '2026-01-01T00:00:00Z',
    }
    mockFrom.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: app, error: null })),
        })),
      })),
    })

    const { result } = renderHook(() => useCreateOAuthApp(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        nom: 'App Nouvelle',
        redirect_uris: ['https://app.com/callback'],
        scopes: [],
      })
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Application OAuth créée' })
    )
  })

  it('retourne le client_secret en clair dans la réponse', async () => {
    const app = { id: 'app-new', nom: 'App', client_id: 'client_xyz' }
    mockFrom.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: app, error: null })),
        })),
      })),
    })

    const { result } = renderHook(() => useCreateOAuthApp(), { wrapper: createWrapper() })

    let mutResult: ({ client_secret: string } & Record<string, unknown>) | undefined
    await act(async () => {
      mutResult = await result.current.mutateAsync({
        nom: 'App',
        redirect_uris: [],
        scopes: [],
      })
    })

    expect(mutResult?.client_secret).toMatch(/^secret_/)
  })
})

// ─── useMyOAuthTokens ─────────────────────────────────────────────────────────
describe('useMyOAuthTokens', () => {
  beforeEach(() => vi.clearAllMocks())

  it(`retourne les tokens de l'utilisateur authentifié`, async () => {
    const tokens = [{ id: 'tok-1', user_id: 'user-1', revoked_at: null }]
    mockFrom.mockReturnValue(chainWith(tokens))

    const { result } = renderHook(() => useMyOAuthTokens(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].id).toBe('tok-1')
  })
})

// ─── useRevokeOAuthToken ──────────────────────────────────────────────────────
describe('useRevokeOAuthToken', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Accès révoqué" après succès', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })

    const { result } = renderHook(() => useRevokeOAuthToken(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('tok-1')
    })

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Accès révoqué' }))
  })
})

// ─── useMarketplaceConnectors ─────────────────────────────────────────────────
describe('useMarketplaceConnectors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne les connecteurs actifs sans filtre catégorie', async () => {
    const connectors = [
      { id: 'con-1', nom: 'Salesforce', est_actif: true, nombre_installations: 100 },
    ]
    mockFrom.mockReturnValue(chainWith(connectors))

    const { result } = renderHook(() => useMarketplaceConnectors(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].nom).toBe('Salesforce')
  })

  it('accepte un filtre catégorie', async () => {
    const filtered = [
      { id: 'con-2', nom: 'HubSpot', categorie: 'crm', est_actif: true, nombre_installations: 50 },
    ]
    mockFrom.mockReturnValue(chainWith(filtered))

    const { result } = renderHook(
      () => useMarketplaceConnectors('crm' as Parameters<typeof useMarketplaceConnectors>[0]),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].id).toBe('con-2')
  })
})

// ─── useMyConnectorInstallations ──────────────────────────────────────────────
describe('useMyConnectorInstallations', () => {
  beforeEach(() => vi.clearAllMocks())

  it(`retourne les installations de l'utilisateur courant`, async () => {
    const installs = [{ id: 'inst-1', connector_id: 'con-1', installed_by: 'user-1' }]
    mockFrom.mockReturnValue(chainWith(installs))

    const { result } = renderHook(() => useMyConnectorInstallations(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].id).toBe('inst-1')
  })
})

// ─── useInstallConnector ──────────────────────────────────────────────────────
describe('useInstallConnector', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Connecteur installé" après succès', async () => {
    const install = { id: 'inst-new', connector_id: 'con-1', installed_by: 'user-1' }
    mockFrom.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: install, error: null })),
        })),
      })),
    })

    const { result } = renderHook(() => useInstallConnector(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ connector_id: 'con-1' })
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Connecteur installé' })
    )
  })
})

// ─── useUninstallConnector ────────────────────────────────────────────────────
describe('useUninstallConnector', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Connecteur désinstallé" après succès', async () => {
    mockFrom.mockReturnValue({
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })

    const { result } = renderHook(() => useUninstallConnector(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('inst-1')
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Connecteur désinstallé' })
    )
  })
})

// ─── useApiStats ───────────────────────────────────────────────────────────────
describe('useApiStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne les stats calculees avec les counts Supabase', async () => {
    // useApiStats fait 6 appels count (head:true) en Promise.all + 1 select duration_ms
    // Chaque appel count : .select('id', {count,head}).gte().then → { count: N }
    // Appel timing : .select('duration_ms').not().gte().limit() → { data: [...], error: null }
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const currentCall = callCount
      return {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        // limit est utilise par la requete de timing (dernier appel)
        limit: vi.fn(() =>
          Promise.resolve({
            data: [{ duration_ms: 120 }, { duration_ms: 80 }],
            error: null,
            count: null,
          })
        ),
        // then est utilise par les requetes count (head:true)
        then: (cb: (v: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null, count: currentCall * 2 }).then(cb),
      }
    })

    const { result } = renderHook(() => useApiStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const stats = result.current.data
    expect(stats).toBeDefined()
    expect(typeof stats?.total_requests_today).toBe('number')
    expect(typeof stats?.error_rate).toBe('number')
    expect(typeof stats?.avg_response_time_ms).toBe('number')
    // avg_response_time_ms = round((120+80)/2) = 100
    expect(stats?.avg_response_time_ms).toBe(100)
  })

  it('retourne error_rate=0 quand total_requests_today=0', async () => {
    // Tous les counts sont 0
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null, count: null })),
      then: (cb: (v: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null, count: 0 }).then(cb),
    }))

    const { result } = renderHook(() => useApiStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.error_rate).toBe(0)
    expect(result.current.data?.avg_response_time_ms).toBe(0)
  })
})
