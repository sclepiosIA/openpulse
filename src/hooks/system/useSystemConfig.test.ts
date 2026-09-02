/* @vitest-environment jsdom */

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useSystemConfig, useSystemStats, useUpdateSystemConfig, useSystemMaintenanceActions } from './useSystemConfig'

const {
  SYSTEM_CONFIG_ROWS,
  SYSTEM_STATS_RPC_DATA,
  DB_STATS_RPC_DATA,
  APP_VERSION_ROW,
  TOAST_RETURN,
  debugError,
  mockFrom,
  mockRpc,
  selectMock,
  orderMock,
  eqMock,
  maybeSingleMock,
  updateMock,
  insertMock,
  singleMock,
  gteMock,
  lteMock,
  inMock,
  limitMock,
  deleteMock,
} = vi.hoisted(() => {
  const SYSTEM_CONFIG_ROWS = [
    {
      id: '1',
      key: 'app_name',
      value: 'Admin Panel',
      description: 'Nom app',
      category: 'general',
      data_type: 'string' as const,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: '2',
      key: 'maintenance_mode',
      value: 'true',
      description: 'Maintenance',
      category: 'general',
      data_type: 'boolean' as const,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: '3',
      key: 'db_retention_days',
      value: '30',
      description: 'Retention',
      category: 'database',
      data_type: 'number' as const,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: '4',
      key: 'notification_email',
      value: 'ops@test.local',
      description: 'Email',
      category: 'notifications',
      data_type: 'string' as const,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
  ]

  const SYSTEM_STATS_RPC_DATA = {
    total_users: 12,
    active_users: 7,
    total_establishments: 5,
    total_tasks: 22,
    completed_tasks: 14,
  }

  const DB_STATS_RPC_DATA = [{ storage_size: '128 MB' }]
  const APP_VERSION_ROW = { key: 'app_version', value: '2.3.4' }

  const TOAST_RETURN = { toast: vi.fn() }
  const debugError = vi.fn()
  const mockFrom = vi.fn()
  const mockRpc = vi.fn()
  const selectMock = vi.fn()
  const orderMock = vi.fn()
  const eqMock = vi.fn()
  const maybeSingleMock = vi.fn()
  const updateMock = vi.fn()
  const insertMock = vi.fn()
  const singleMock = vi.fn()
  const gteMock = vi.fn()
  const lteMock = vi.fn()
  const inMock = vi.fn()
  const limitMock = vi.fn()
  const deleteMock = vi.fn()

  return {
    SYSTEM_CONFIG_ROWS,
    SYSTEM_STATS_RPC_DATA,
    DB_STATS_RPC_DATA,
    APP_VERSION_ROW,
    TOAST_RETURN,
    debugError,
    mockFrom,
    mockRpc,
    selectMock,
    orderMock,
    eqMock,
    maybeSingleMock,
    updateMock,
    insertMock,
    singleMock,
    gteMock,
    lteMock,
    inMock,
    limitMock,
    deleteMock,
  }
})

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => TOAST_RETURN,
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}))

function createThenableBuilder(result: unknown) {
  const promise = Promise.resolve(result)
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
    single: singleMock,
    maybeSingle: maybeSingleMock,
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }

  selectMock.mockReturnValue(builder)
  orderMock.mockReturnValue(builder)
  eqMock.mockReturnValue(builder)
  gteMock.mockReturnValue(builder)
  lteMock.mockReturnValue(builder)
  inMock.mockReturnValue(builder)
  limitMock.mockReturnValue(builder)
  updateMock.mockReturnValue(builder)
  insertMock.mockReturnValue(builder)
  deleteMock.mockReturnValue(builder)
  singleMock.mockResolvedValue(result)
  maybeSingleMock.mockResolvedValue(result)

  return builder
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useSystemConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('charge la configuration système et convertit les types métier', async () => {
    mockFrom.mockReturnValue(createThenableBuilder({ data: SYSTEM_CONFIG_ROWS, error: null }))

    const { result } = renderHook(() => useSystemConfig(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('system_config')
    expect(selectMock).toHaveBeenCalledWith('id, key, value, description, category, data_type, created_at, updated_at')
    expect(orderMock).toHaveBeenCalledWith('category', { ascending: true })
    expect(result.current.data?.items).toEqual(SYSTEM_CONFIG_ROWS)
    expect(result.current.data?.config.appName).toBe('Admin Panel')
    expect(result.current.data?.config.maintenanceMode).toBe(true)
    expect(result.current.data?.config.dbRetentionDays).toBe(30)
    expect(result.current.data?.config.notificationEmail).toBe('ops@test.local')
    expect(TOAST_RETURN.toast).not.toHaveBeenCalled()
  })

  it('passe en erreur et affiche un toast si le chargement échoue', async () => {
    mockFrom.mockReturnValue(createThenableBuilder({ data: null, error: { message: 'x' } }))

    const { result } = renderHook(() => useSystemConfig(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(TOAST_RETURN.toast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de charger la configuration système',
      variant: 'destructive',
    })
    expect(result.current.error).toEqual({ message: 'x' })
  })
})

describe('useSystemStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne les statistiques système enrichies avec version et taille BDD', async () => {
    mockFrom.mockReturnValue(createThenableBuilder({ data: APP_VERSION_ROW, error: null }))
    mockRpc.mockImplementation((name: string) => {
      if (name === 'get_system_stats') {
        return Promise.resolve({ data: SYSTEM_STATS_RPC_DATA, error: null })
      }
      if (name === 'get_db_stats') {
        return Promise.resolve({ data: DB_STATS_RPC_DATA, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const { result } = renderHook(() => useSystemStats(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockRpc).toHaveBeenCalledWith('get_system_stats')
    expect(mockRpc).toHaveBeenCalledWith('get_db_stats')
    expect(mockFrom).toHaveBeenCalledWith('system_config')
    expect(selectMock).toHaveBeenCalledWith('key, value')
    expect(eqMock).toHaveBeenCalledWith('key', 'app_version')
    expect(result.current.data).toEqual({
      uptime: 'Géré par Supabase',
      totalUsers: 12,
      activeUsers: 7,
      totalEstablishments: 5,
      totalTasks: 22,
      completedTasks: 14,
      dbSize: '128 MB',
      cacheSize: 'Cache local',
      version: '2.3.4',
    })
  })
})

describe('useUpdateSystemConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('met à jour les clés en snake_case, invalide le cache et affiche un toast de succès', async () => {
    mockFrom.mockReturnValue(createThenableBuilder({ data: null, error: null }))

    const { result } = renderHook(() => useUpdateSystemConfig(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        maintenanceMode: false,
        dbRetentionDays: 45,
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('system_config')
    expect(updateMock).toHaveBeenCalledTimes(2)

    const firstArg = updateMock.mock.calls[0][0] as { value: string; updated_at: string }
    const secondArg = updateMock.mock.calls[1][0] as { value: string; updated_at: string }

    expect([firstArg.value, secondArg.value].sort()).toEqual(['45', 'false'].sort())
    expect(typeof firstArg.updated_at).toBe('string')
    expect(typeof secondArg.updated_at).toBe('string')
    expect(eqMock).toHaveBeenCalledWith('key', 'maintenance_mode')
    expect(eqMock).toHaveBeenCalledWith('key', 'db_retention_days')
    expect(TOAST_RETURN.toast).toHaveBeenCalledWith({
      title: 'Configuration sauvegardée',
      description: 'Les paramètres système ont été mis à jour avec succès',
    })
  })

  it('remonte les erreurs de mutation, loggue debug et affiche un toast destructif', async () => {
    mockFrom.mockReturnValue(createThenableBuilder({ data: null, error: { message: 'x' } }))

    const { result } = renderHook(() => useUpdateSystemConfig(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(result.current.mutateAsync({ appName: 'New App' })).rejects.toEqual({ message: 'x' })
    })

    expect(debugError).toHaveBeenCalledWith('Error updating system config:', { message: 'x' })
    expect(TOAST_RETURN.toast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de sauvegarder la configuration',
      variant: 'destructive',
    })
  })
})

describe('useSystemMaintenanceActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clearCache insère un événement puis affiche un toast', async () => {
    mockFrom.mockReturnValue(createThenableBuilder({ data: null, error: null }))

    const { result } = renderHook(() => useSystemMaintenanceActions(), { wrapper: createWrapper() })

    await act(async () => {
      const response = await result.current.clearCache.mutateAsync()
      expect(response).toEqual({ success: true, message: 'Cache React Query invalidé' })
    })

    expect(mockFrom).toHaveBeenCalledWith('system_stats')
    expect(insertMock).toHaveBeenCalledWith({
      metric_name: 'cache_cleared',
      metric_value: expect.any(String),
      metric_type: 'event',
    })
    expect(TOAST_RETURN.toast).toHaveBeenCalledWith({
      title: 'Cache vidé',
      description: 'Le cache applicatif a été entièrement nettoyé',
    })
  })

  it('runBackup compte les enregistrements, journalise la demande et retourne le total', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createThenableBuilder({ count: 4, data: null, error: null })
      if (table === 'etablissements') return createThenableBuilder({ count: 3, data: null, error: null })
      if (table === 'taches') return createThenableBuilder({ count: 8, data: null, error: null })
      if (table === 'system_stats') return createThenableBuilder({ data: null, error: null })
      return createThenableBuilder({ data: null, error: null })
    })

    const { result } = renderHook(() => useSystemMaintenanceActions(), { wrapper: createWrapper() })

    await act(async () => {
      const response = await result.current.runBackup.mutateAsync()
      expect(response.success).toBe(true)
      expect(response.records).toBe(15)
      expect(response.message).toContain('Supabase')
    })

    expect(selectMock).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(insertMock).toHaveBeenCalledWith({
      metric_name: 'backup_requested',
      metric_value: expect.stringContaining('"records":15'),
      metric_type: 'event',
    })
    expect(TOAST_RETURN.toast).toHaveBeenCalledWith({
      title: 'Sauvegarde créée',
      description: 'Sauvegarde de 15 enregistrements créée avec succès',
    })
  })

  it('optimizeDB agrège les compteurs par table et enregistre le résultat', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createThenableBuilder({ count: 10, data: null, error: null })
      if (table === 'etablissements') return createThenableBuilder({ count: 2, data: null, error: null })
      if (table === 'taches') return createThenableBuilder({ count: 6, data: null, error: null })
      if (table === 'system_config') return createThenableBuilder({ count: 4, data: null, error: null })
      if (table === 'system_stats') return createThenableBuilder({ data: null, error: null })
      return createThenableBuilder({ data: null, error: null })
    })

    const { result } = renderHook(() => useSystemMaintenanceActions(), { wrapper: createWrapper() })

    await act(async () => {
      const response = await result.current.optimizeDB.mutateAsync()
      expect(response.success).toBe(true)
      expect(response.results).toEqual([
        { table: 'profiles', records: 10 },
        { table: 'etablissements', records: 2 },
        { table: 'taches', records: 6 },
        { table: 'system_config', records: 4 },
      ])
    })

    expect(insertMock).toHaveBeenCalledWith({
      metric_name: 'db_optimized',
      metric_value: JSON.stringify([
        { table: 'profiles', records: 10 },
        { table: 'etablissements', records: 2 },
        { table: 'taches', records: 6 },
        { table: 'system_config', records: 4 },
      ]),
      metric_type: 'event',
    })
    expect(TOAST_RETURN.toast).toHaveBeenCalledWith({
      title: 'Base de données optimisée',
      description: "L'optimisation de la base de données est terminée",
    })
  })

  it('restartServices journalise le redémarrage et affiche un toast', async () => {
    mockFrom.mockReturnValue(createThenableBuilder({ data: null, error: null }))

    const { result } = renderHook(() => useSystemMaintenanceActions(), { wrapper: createWrapper() })

    await act(async () => {
      const response = await result.current.restartServices.mutateAsync()
      expect(response).toEqual({
        success: true,
        message: 'Événement enregistré. Les services sont gérés par Supabase.',
      })
    })

    expect(insertMock).toHaveBeenCalledWith({
      metric_name: 'services_restarted',
      metric_value: expect.any(String),
      metric_type: 'event',
    })
    expect(TOAST_RETURN.toast).toHaveBeenCalledWith({
      title: 'Services redémarrés',
      description: 'Tous les services système ont été redémarrés',
    })
  })
})