import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import {
  useDatabaseStats,
  useSecurityStats,
  useSecurityConfig,
  useSecurityLogs,
  useBlockedIPs,
  useNotificationStats,
  useDatabaseActions,
} from './useSystemManagement'

const h = vi.hoisted(() => {
  type QueryResult = { data?: unknown; error?: unknown; count?: number | null }
  const chainMethods = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'gte',
    'lte',
    'in',
    'is',
    'order',
    'limit',
    'range',
  ]
  const tableResults: Record<string, QueryResult> = {}
  const insertCalls: Array<{ table: string; payload: unknown }> = []
  const makeBuilder = (table: string) => {
    const builder: Record<string, unknown> = {}
    const getResult = () => tableResults[table] ?? { data: [], error: null, count: 0 }
    for (const m of chainMethods) {
      builder[m] = vi.fn((arg: unknown) => {
        if (m === 'insert') {
          insertCalls.push({ table, payload: arg })
        }
        return builder
      })
    }
    builder.single = vi.fn(() => Promise.resolve(getResult()))
    builder.maybeSingle = vi.fn(() => Promise.resolve(getResult()))
    builder.then = (onF?: (v: QueryResult) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(getResult()).then(onF, onR)
    builder.catch = (onR?: (e: unknown) => unknown) => Promise.resolve(getResult()).catch(onR)
    return builder
  }
  const mockFrom = vi.fn((table: string) => makeBuilder(table))
  const mockRpc = vi.fn()
  const mockToast = vi.fn()
  const AUTH = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }
  return { tableResults, insertCalls, mockFrom, mockRpc, mockToast, AUTH }
})

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: { from: h.mockFrom, rpc: h.mockRpc },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: h.mockToast }),
}))

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), info: vi.fn() },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => h.AUTH,
}))

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

beforeEach(() => {
  for (const key of Object.keys(h.tableResults)) {
    delete h.tableResults[key]
  }
  h.insertCalls.length = 0
  h.mockRpc.mockReset()
  h.mockToast.mockClear()
  h.mockFrom.mockClear()
})

describe('useDatabaseStats', () => {
  it('est en chargement initialement', () => {
    h.mockRpc.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useDatabaseStats(), { wrapper: createWrapper() })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('retourne les statistiques de base de donnees en cas de succes', async () => {
    h.mockRpc.mockResolvedValue({
      data: [
        {
          storage_size: '42 MB',
          table_count: 7,
          total_records: 1234,
          cache_hit_ratio: 98,
        },
      ],
      error: null,
    })
    h.tableResults['profiles'] = { data: [], error: null, count: 5 }
    h.tableResults['etablissements'] = { data: [], error: null, count: 10 }
    h.tableResults['taches'] = { data: [], error: null, count: 20 }
    h.tableResults['categories_taches'] = { data: [], error: null, count: 3 }
    h.tableResults['contacts'] = { data: [], error: null, count: 8 }
    h.tableResults['modeles_taches'] = { data: [], error: null, count: 4 }
    h.tableResults['system_stats'] = { data: [], error: null, count: 0 }

    const { result } = renderHook(() => useDatabaseStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const stats = result.current.data
    expect(stats?.totalSize).toBe('42 MB')
    expect(stats?.tables).toBe(7)
    expect(stats?.records).toBe(1234)
    expect(stats?.cacheHitRatio).toBe(98)
    expect(stats?.indexes).toBe(12)
    expect(stats?.uptime).toBe('Géré par Supabase')
    expect(stats?.lastCheck).toBe('Jamais vérifié')
    expect(stats?.tableStats).toHaveLength(6)
    expect(stats?.tableStats[0]).toEqual({
      name: 'etablissements',
      records: 10,
      size: '5.0KB',
      lastUpdated: 'N/A',
    })
    expect(stats?.tableStats[1].records).toBe(20)
    expect(stats?.tableStats[2].records).toBe(5)
  })

  it('passe en erreur si le RPC echoue', async () => {
    h.mockRpc.mockResolvedValue({ data: null, error: { message: 'x' } })
    const { result } = renderHook(() => useDatabaseStats(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual({ message: 'x' })
  })
})

describe('useSecurityStats', () => {
  it('calcule le score de securite dynamiquement', async () => {
    h.mockRpc.mockResolvedValue({
      data: [
        {
          total_users: 50,
          blocked_ips: 2,
          failed_logins: 3,
          active_sessions: 7,
          security_incidents: 0,
        },
      ],
      error: null,
    })
    h.tableResults['security_config'] = {
      data: {
        password_require_uppercase: true,
        password_require_numbers: true,
        audit_logging: true,
        brute_force_protection: true,
      },
      error: null,
    }
    h.tableResults['profiles'] = {
      data: [
        { id: 'a', two_factor_enabled: true },
        { id: 'b', two_factor_enabled: true },
      ],
      error: null,
    }
    h.tableResults['system_stats'] = { data: [], error: null }

    const { result } = renderHook(() => useSecurityStats(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // 2FA 100% => 20, complexité => 15, audit => 15, brute force => 15, 0 incident => 35 = 100
    expect(result.current.data?.securityScore).toBe(100)
    expect(result.current.data?.totalUsers).toBe(50)
    expect(result.current.data?.blockedIPs).toBe(2)
    expect(result.current.data?.failedLogins).toBe(3)
    expect(result.current.data?.activeSessions).toBe(7)
    expect(result.current.data?.vulnerabilities).toBe(0)
    expect(result.current.data?.lastSecurityScan).toBe('Jamais effectuée')
  })

  it('reduit le score quand les protections sont absentes et incidents nombreux', async () => {
    h.mockRpc.mockResolvedValue({
      data: [{ total_users: 10, security_incidents: 5 }],
      error: null,
    })
    h.tableResults['security_config'] = { data: null, error: null }
    h.tableResults['profiles'] = {
      data: [{ id: 'a', two_factor_enabled: false }],
      error: null,
    }
    h.tableResults['system_stats'] = { data: [], error: null }

    const { result } = renderHook(() => useSecurityStats(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // 0 (2FA) + 0 + 0 + 0 + 10 (incidents < 10) = 10
    expect(result.current.data?.securityScore).toBe(10)
    expect(result.current.data?.vulnerabilities).toBe(5)
  })
})

describe('useSecurityConfig', () => {
  it('retourne la configuration de securite', async () => {
    h.tableResults['security_config'] = {
      data: { id: 'cfg1', password_min_length: 12, audit_logging: true },
      error: null,
    }
    const { result } = renderHook(() => useSecurityConfig(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({
      id: 'cfg1',
      password_min_length: 12,
      audit_logging: true,
    })
  })

  it('passe en erreur si la requete echoue', async () => {
    h.tableResults['security_config'] = { data: null, error: { message: 'x' } }
    const { result } = renderHook(() => useSecurityConfig(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useSecurityLogs', () => {
  it('retourne les logs de securite', async () => {
    h.tableResults['security_logs'] = {
      data: [{ id: 'log1', type: 'login', ip: '1.2.3.4' }],
      error: null,
    }
    const { result } = renderHook(() => useSecurityLogs(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]).toMatchObject({ id: 'log1', type: 'login' })
  })

  it('passe en erreur si la requete echoue', async () => {
    h.tableResults['security_logs'] = { data: null, error: { message: 'x' } }
    const { result } = renderHook(() => useSecurityLogs(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useBlockedIPs', () => {
  it('retourne la liste des IPs bloquees', async () => {
    h.tableResults['blocked_ips'] = {
      data: [{ id: 'ip1', ip: '10.0.0.1' }],
      error: null,
    }
    const { result } = renderHook(() => useBlockedIPs(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: 'ip1', ip: '10.0.0.1' }])
  })
})

describe('useNotificationStats', () => {
  it('calcule les statistiques de notifications', async () => {
    h.tableResults['notifications_history'] = {
      data: [
        { status: 'sent', sent_at: '2024-01-15T10:00:00Z' },
        { status: 'sent', sent_at: '2024-01-14T10:00:00Z' },
        { status: 'failed', sent_at: '2024-01-13T10:00:00Z' },
        { status: 'sent', sent_at: '2024-01-12T10:00:00Z' },
      ],
      error: null,
    }
    const { result } = renderHook(() => useNotificationStats(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.totalSent).toBe(4)
    expect(result.current.data?.emailsSent).toBe(3)
    expect(result.current.data?.failedDeliveries).toBe(1)
    expect(result.current.data?.deliveryRate).toBe(75)
  })

  it('retourne des stats par defaut en cas d erreur', async () => {
    h.tableResults['notifications_history'] = { data: null, error: { message: 'x' } }
    const { result } = renderHook(() => useNotificationStats(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({
      totalSent: 0,
      emailsSent: 0,
      failedDeliveries: 0,
      deliveryRate: 100,
      lastSent: 'Aucune notification envoyée',
    })
  })
})

describe('useDatabaseActions', () => {
  it('createBackup insere un event system_stats et affiche un toast de succes', async () => {
    h.tableResults['system_stats'] = { data: null, error: null }
    const { result } = renderHook(() => useDatabaseActions(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.createBackup.mutateAsync()
    })

    const insert = h.insertCalls.find((c) => c.table === 'system_stats')
    expect(insert?.payload).toMatchObject({
      metric_name: 'backup_requested',
      metric_type: 'event',
    })
    expect(h.mockToast).toHaveBeenCalledWith({
      title: 'Demande enregistrée',
      description: 'Les sauvegardes automatiques sont gérées par Supabase',
    })
  })

  it('optimizeDatabase enregistre la metrique database_optimized', async () => {
    h.tableResults['system_stats'] = { data: null, error: null }
    const { result } = renderHook(() => useDatabaseActions(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.optimizeDatabase.mutateAsync()
    })

    const insert = h.insertCalls.find((c) => c.table === 'system_stats')
    expect(insert?.payload).toMatchObject({
      metric_name: 'database_optimized',
      metric_type: 'event',
    })
    expect(h.mockToast).toHaveBeenCalledWith({
      title: 'Demande enregistrée',
      description: "L'optimisation automatique est gérée par Supabase",
    })
  })

  it('testConnection reussit et affiche un toast de connexion reussie', async () => {
    h.tableResults['profiles'] = { data: [{ id: 'p1' }], error: null }
    h.tableResults['system_stats'] = { data: null, error: null }
    const { result } = renderHook(() => useDatabaseActions(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.testConnection.mutateAsync()
    })

    const insert = h.insertCalls.find((c) => c.table === 'system_stats')
    expect(insert?.payload).toMatchObject({
      metric_name: 'db_connection_test',
      metric_value: 'success',
    })
    expect(h.mockToast).toHaveBeenCalledWith({
      title: 'Connexion réussie',
      description: 'La connexion à la base de données fonctionne correctement',
    })
  })

  it('testConnection en echec affiche un toast destructif', async () => {
    h.tableResults['profiles'] = { data: null, error: { message: 'x' } }
    const { result } = renderHook(() => useDatabaseActions(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.testConnection.mutateAsync().catch(() => undefined)
    })

    expect(h.mockToast).toHaveBeenCalledWith({
      title: 'Erreur de connexion',
      description: 'Impossible de se connecter à la base de données',
      variant: 'destructive',
    })
  })
})