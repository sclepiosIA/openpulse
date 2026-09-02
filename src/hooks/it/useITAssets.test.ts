// @vitest-environment jsdom

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  useITAssets,
  useUpsertITAsset,
  useDeleteITAsset,
  useITLicenses,
  useUpsertITLicense,
  useDeleteITLicense,
  useLicenseAssignments,
  useAssignLicense,
  useRevokeLicense,
  useITRenewals,
} from './useITAssets'

const {
  IT_ASSETS_ROWS,
  IT_LICENSES_ROWS,
  IT_ASSIGNMENTS_ROWS,
  IT_RENEWALS_ROWS,
  mockFrom,
  fromResults,
  operationCalls,
  resetSupabaseMocks,
} = vi.hoisted(() => {
  const IT_ASSETS_ROWS = [
    {
      id: 'asset-1',
      category: 'laptop',
      brand: 'Lenovo',
      model: 'ThinkPad X1',
      serial_number: 'SN-1',
      status: 'assigned',
      purchase_date: '2024-01-10',
      purchase_price: 1499,
      supplier: 'Vendor A',
      invoice_ref: 'INV-1',
      warranty_end: '2027-01-10',
      assigned_to_profile_id: 'profile-1',
      assigned_at: '2024-02-01T10:00:00.000Z',
      location: 'Paris',
      notes: 'Primary device',
      tags: ['dev', 'vip'],
      created_at: '2024-01-10T00:00:00.000Z',
      updated_at: '2024-03-01T00:00:00.000Z',
    },
    {
      id: 'asset-2',
      category: 'monitor',
      brand: 'Dell',
      model: 'U2720Q',
      serial_number: null,
      status: 'in_stock',
      purchase_date: null,
      purchase_price: null,
      supplier: null,
      invoice_ref: null,
      warranty_end: null,
      assigned_to_profile_id: null,
      assigned_at: null,
      location: 'Storage',
      notes: null,
      tags: [],
      created_at: '2024-01-11T00:00:00.000Z',
      updated_at: '2024-02-28T00:00:00.000Z',
    },
  ]

  const IT_LICENSES_ROWS = [
    {
      id: 'lic-1',
      name: 'Workspace',
      vendor: 'Google',
      description: 'Email suite',
      seats_total: 50,
      cost_amount: 10,
      billing_cycle: 'monthly',
      renewal_date: '2025-12-01',
      auto_renew: true,
      contract_ref: 'CTR-1',
      notes: 'Core tools',
      tags: ['saas'],
      active: true,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-02-01T00:00:00.000Z',
    },
    {
      id: 'lic-2',
      name: 'Figma',
      vendor: 'Figma',
      description: null,
      seats_total: 12,
      cost_amount: 30,
      billing_cycle: 'yearly',
      renewal_date: '2025-06-15',
      auto_renew: false,
      contract_ref: null,
      notes: null,
      tags: ['design'],
      active: true,
      created_at: '2024-01-02T00:00:00.000Z',
      updated_at: '2024-02-02T00:00:00.000Z',
    },
  ]

  const IT_ASSIGNMENTS_ROWS = [
    {
      id: 'assign-1',
      license_id: 'lic-1',
      profile_id: 'profile-1',
      assigned_at: '2024-05-01T00:00:00.000Z',
      revoked_at: null,
      notes: 'Engineering',
    },
    {
      id: 'assign-2',
      license_id: 'lic-2',
      profile_id: 'profile-2',
      assigned_at: '2024-05-02T00:00:00.000Z',
      revoked_at: null,
      notes: null,
    },
  ]

  const IT_RENEWALS_ROWS = [
    {
      kind: 'license',
      id: 'lic-1',
      label: 'Workspace',
      vendor: 'Google',
      due_date: '2025-12-01',
      amount: 10,
      days_until: 60,
      category: null,
    },
    {
      kind: 'warranty',
      id: 'asset-1',
      label: 'ThinkPad X1',
      vendor: 'Lenovo',
      due_date: '2027-01-10',
      amount: null,
      days_until: 400,
      category: 'laptop',
    },
  ]

  const mockFrom = vi.fn()
  const fromResults = new Map<string, { data: unknown; error: { message: string } | null }>()
  const operationCalls = {
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }

  const resetSupabaseMocks = () => {
    mockFrom.mockReset()
    fromResults.clear()
    operationCalls.select.mockClear()
    operationCalls.order.mockClear()
    operationCalls.limit.mockClear()
    operationCalls.eq.mockClear()
    operationCalls.is.mockClear()
    operationCalls.insert.mockClear()
    operationCalls.update.mockClear()
    operationCalls.delete.mockClear()

    fromResults.set('it_assets', { data: IT_ASSETS_ROWS, error: null })
    fromResults.set('it_software_licenses', { data: IT_LICENSES_ROWS, error: null })
    fromResults.set('it_license_assignments', { data: IT_ASSIGNMENTS_ROWS, error: null })
    fromResults.set('v_it_renewals_upcoming', { data: IT_RENEWALS_ROWS, error: null })

    mockFrom.mockImplementation((table: string) => {
      let currentResult = fromResults.get(table) ?? { data: [], error: null }

      const builder = {
        select: vi.fn((...args: unknown[]) => {
          operationCalls.select(table, ...args)
          return builder
        }),
        order: vi.fn((...args: unknown[]) => {
          operationCalls.order(table, ...args)
          return builder
        }),
        limit: vi.fn((...args: unknown[]) => {
          operationCalls.limit(table, ...args)
          return Promise.resolve(currentResult)
        }),
        eq: vi.fn((...args: unknown[]) => {
          operationCalls.eq(table, ...args)
          return builder
        }),
        is: vi.fn((...args: unknown[]) => {
          operationCalls.is(table, ...args)
          return builder
        }),
        insert: vi.fn((...args: unknown[]) => {
          operationCalls.insert(table, ...args)
          return Promise.resolve(currentResult)
        }),
        update: vi.fn((...args: unknown[]) => {
          operationCalls.update(table, ...args)
          return builder
        }),
        delete: vi.fn((...args: unknown[]) => {
          operationCalls.delete(table, ...args)
          return builder
        }),
        single: vi.fn(() => Promise.resolve(currentResult)),
        maybeSingle: vi.fn(() => Promise.resolve(currentResult)),
        then: (
          onFulfilled: (value: typeof currentResult) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) => Promise.resolve(currentResult).then(onFulfilled, onRejected),
        catch: (onRejected: (reason: unknown) => unknown) =>
          Promise.resolve(currentResult).catch(onRejected),
      }

      return builder
    })
  }

  resetSupabaseMocks()

  return {
    IT_ASSETS_ROWS,
    IT_LICENSES_ROWS,
    IT_ASSIGNMENTS_ROWS,
    IT_RENEWALS_ROWS,
    mockFrom,
    fromResults,
    operationCalls,
    resetSupabaseMocks,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

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

describe('useITAssets hooks', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  it('useITAssets charge puis retourne les assets triés via la requête attendue', async () => {
    const { result } = renderHook(() => useITAssets(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('it_assets')
    expect(operationCalls.select).toHaveBeenCalledWith('it_assets', '*')
    expect(operationCalls.order).toHaveBeenCalledWith('it_assets', 'updated_at', {
      ascending: false,
    })
    expect(operationCalls.limit).toHaveBeenCalledWith('it_assets', 1000)

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].model).toBe('ThinkPad X1')
    expect(result.current.data?.[0].status).toBe('assigned')
    expect(result.current.data?.[1].category).toBe('monitor')
    expect(result.current.data?.[1].location).toBe('Storage')
  })

  it('useITAssets passe en erreur si supabase renvoie une erreur', async () => {
    fromResults.set('it_assets', { data: null, error: { message: 'x' } })

    const { result } = renderHook(() => useITAssets(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error?.message).toBe('x')
  })

  it('useUpsertITAsset insère un asset sans id', async () => {
    const { result } = renderHook(() => useUpsertITAsset(), { wrapper: createWrapper() })

    const payload = {
      model: 'EliteBook 840',
      category: 'laptop' as const,
      brand: 'HP',
      status: 'in_stock' as const,
      tags: ['new'],
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(mockFrom).toHaveBeenCalledWith('it_assets')
    expect(operationCalls.insert).toHaveBeenCalledWith('it_assets', payload)
  })

  it('useUpsertITAsset met à jour un asset avec id', async () => {
    const { result } = renderHook(() => useUpsertITAsset(), { wrapper: createWrapper() })

    const payload = {
      id: 'asset-1',
      model: 'ThinkPad X1 Carbon',
      status: 'in_repair' as const,
      notes: 'Screen issue',
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(operationCalls.update).toHaveBeenCalledWith('it_assets', {
      model: 'ThinkPad X1 Carbon',
      status: 'in_repair',
      notes: 'Screen issue',
    })
    expect(operationCalls.eq).toHaveBeenCalledWith('it_assets', 'id', 'asset-1')
  })

  it('useDeleteITAsset supprime par id', async () => {
    const { result } = renderHook(() => useDeleteITAsset(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('asset-2')
    })

    expect(mockFrom).toHaveBeenCalledWith('it_assets')
    expect(operationCalls.delete).toHaveBeenCalledWith('it_assets')
    expect(operationCalls.eq).toHaveBeenCalledWith('it_assets', 'id', 'asset-2')
  })

  it('useITLicenses charge les licences avec les bons paramètres métier', async () => {
    const { result } = renderHook(() => useITLicenses(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('it_software_licenses')
    expect(operationCalls.order).toHaveBeenCalledWith('it_software_licenses', 'renewal_date', {
      ascending: true,
      nullsFirst: false,
    })
    expect(operationCalls.limit).toHaveBeenCalledWith('it_software_licenses', 1000)

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].name).toBe('Workspace')
    expect(result.current.data?.[0].billing_cycle).toBe('monthly')
    expect(result.current.data?.[1].vendor).toBe('Figma')
    expect(result.current.data?.[1].auto_renew).toBe(false)
  })

  it('useITLicenses passe en erreur si supabase renvoie une erreur', async () => {
    fromResults.set('it_software_licenses', { data: null, error: { message: 'x' } })

    const { result } = renderHook(() => useITLicenses(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error?.message).toBe('x')
  })

  it('useUpsertITLicense insère une licence sans id', async () => {
    const { result } = renderHook(() => useUpsertITLicense(), { wrapper: createWrapper() })

    const payload = {
      name: 'Notion',
      vendor: 'Notion',
      seats_total: 20,
      billing_cycle: 'yearly' as const,
      active: true,
      tags: ['docs'],
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(operationCalls.insert).toHaveBeenCalledWith('it_software_licenses', payload)
  })

  it('useUpsertITLicense met à jour une licence avec id', async () => {
    const { result } = renderHook(() => useUpsertITLicense(), { wrapper: createWrapper() })

    const payload = {
      id: 'lic-2',
      name: 'Figma Org',
      seats_total: 15,
      auto_renew: true,
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(operationCalls.update).toHaveBeenCalledWith('it_software_licenses', {
      name: 'Figma Org',
      seats_total: 15,
      auto_renew: true,
    })
    expect(operationCalls.eq).toHaveBeenCalledWith('it_software_licenses', 'id', 'lic-2')
  })

  it('useDeleteITLicense supprime une licence par id', async () => {
    const { result } = renderHook(() => useDeleteITLicense(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('lic-1')
    })

    expect(operationCalls.delete).toHaveBeenCalledWith('it_software_licenses')
    expect(operationCalls.eq).toHaveBeenCalledWith('it_software_licenses', 'id', 'lic-1')
  })

  it('useLicenseAssignments retourne toutes les assignations actives sans filtre', async () => {
    const { result } = renderHook(() => useLicenseAssignments(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('it_license_assignments')
    expect(operationCalls.select).toHaveBeenCalledWith('it_license_assignments', '*')
    expect(operationCalls.is).toHaveBeenCalledWith('it_license_assignments', 'revoked_at', null)
    expect(operationCalls.limit).toHaveBeenCalledWith('it_license_assignments', 2000)

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].license_id).toBe('lic-1')
    expect(result.current.data?.[1].profile_id).toBe('profile-2')
  })

  it('useLicenseAssignments applique le filtre license_id quand fourni', async () => {
    const { result } = renderHook(() => useLicenseAssignments('lic-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(operationCalls.eq).toHaveBeenCalledWith('it_license_assignments', 'license_id', 'lic-1')
  })

  it('useLicenseAssignments passe en erreur si supabase renvoie une erreur', async () => {
    fromResults.set('it_license_assignments', { data: null, error: { message: 'x' } })

    const { result } = renderHook(() => useLicenseAssignments('lic-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error?.message).toBe('x')
  })

  it('useAssignLicense insère une assignation de licence', async () => {
    const { result } = renderHook(() => useAssignLicense(), { wrapper: createWrapper() })

    const payload = {
      license_id: 'lic-1',
      profile_id: 'profile-9',
      notes: 'Temporary access',
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(operationCalls.insert).toHaveBeenCalledWith('it_license_assignments', payload)
  })

  it('useRevokeLicense met à jour revoked_at pour une assignation', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T09:30:00.000Z'))

    const { result } = renderHook(() => useRevokeLicense(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('assign-1')
    })

    expect(operationCalls.update).toHaveBeenCalledWith('it_license_assignments', {
      revoked_at: '2026-01-15T09:30:00.000Z',
    })
    expect(operationCalls.eq).toHaveBeenCalledWith('it_license_assignments', 'id', 'assign-1')

    vi.useRealTimers()
  })

  it('useITRenewals charge les renouvellements à venir', async () => {
    const { result } = renderHook(() => useITRenewals(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('v_it_renewals_upcoming')
    expect(operationCalls.order).toHaveBeenCalledWith('v_it_renewals_upcoming', 'due_date', {
      ascending: true,
    })
    expect(operationCalls.limit).toHaveBeenCalledWith('v_it_renewals_upcoming', 200)

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].kind).toBe('license')
    expect(result.current.data?.[0].label).toBe('Workspace')
    expect(result.current.data?.[1].kind).toBe('warranty')
    expect(result.current.data?.[1].category).toBe('laptop')
  })

  it('useITRenewals passe en erreur si supabase renvoie une erreur', async () => {
    fromResults.set('v_it_renewals_upcoming', { data: null, error: { message: 'x' } })

    const { result } = renderHook(() => useITRenewals(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error?.message).toBe('x')
  })
})
