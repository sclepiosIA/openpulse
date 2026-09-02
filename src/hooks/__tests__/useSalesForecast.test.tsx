import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const { mockRpc } = vi.hoisted(() => {
  const mockRpc = vi.fn()
  return { mockRpc }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
  },
}))

import { useSalesForecast } from '@/hooks/crm/useSalesForecast'
import type { SalesForecast } from '@/hooks/crm/useSalesForecast'
import { supabase } from '@/integrations/supabase/client';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const now = new Date()
const currentYear = now.getFullYear()

const mockForecastData: SalesForecast = {
  range: { start: `${currentYear}-01-01`, end: `${currentYear}-12-31` },
  kpis: {
    pipeline_raw: 150000,
    pipeline_weighted: 90000,
    current_quarter: 40000,
    next_quarter: 50000,
    won_total: 30000,
    target_total: 200000,
    current_quarter_target: 50000,
  },
  previous_period: {
    pipeline_raw: 100000,
    pipeline_weighted: 60000,
    won_total: 20000,
  },
  by_quarter: [
    { quarter: 'Q1', raw: 40000, weighted: 24000, won: 10000, target: 50000, count: 5 },
    { quarter: 'Q2', raw: 50000, weighted: 30000, won: 15000, target: 50000, count: 6 },
    { quarter: 'Q3', raw: 35000, weighted: 21000, won: 5000, target: 50000, count: 4 },
    { quarter: 'Q4', raw: 25000, weighted: 15000, won: 0, target: 50000, count: 3 },
  ],
  by_commercial: [
    {
      user_id: 'u-1',
      display_name: 'Alice Martin',
      raw: 80000,
      weighted: 48000,
      won: 15000,
      deals_count: 10,
    },
    {
      user_id: 'u-2',
      display_name: 'Bob Dupont',
      raw: 70000,
      weighted: 42000,
      won: 15000,
      deals_count: 8,
    },
  ],
  by_phase: [
    {
      statut: 'prospect',
      label: 'Prospection',
      phase_group: 'early',
      probability: 0.1,
      raw: 50000,
      weighted: 5000,
      count: 8,
    },
    {
      statut: 'proposition',
      label: 'Proposition',
      phase_group: 'mid',
      probability: 0.4,
      raw: 60000,
      weighted: 24000,
      count: 6,
    },
    {
      statut: 'negociation',
      label: 'Negociation',
      phase_group: 'late',
      probability: 0.7,
      raw: 40000,
      weighted: 28000,
      count: 4,
    },
  ],
  top_deals: [
    {
      id: 'd-1',
      nom: 'CHU Bordeaux',
      statut: 'negociation',
      probability: 0.7,
      deal_value: 30000,
      weighted_value: 21000,
      closing_date: `${currentYear}-09-30`,
    },
    {
      id: 'd-2',
      nom: 'Clinique Nantes',
      statut: 'proposition',
      probability: 0.4,
      deal_value: 25000,
      weighted_value: 10000,
      closing_date: `${currentYear}-11-30`,
    },
  ],
}

describe('useSalesForecast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Appel RPC', () => {
    it('appelle supabase.rpc avec les bons parametres pour range=year', async () => {
      mockRpc.mockResolvedValue({ data: mockForecastData, error: null })

      const { result } = renderHook(() => useSalesForecast('year'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(mockRpc).toHaveBeenCalledWith('get_sales_forecast', {
        p_start: `${currentYear}-01-01`,
        p_end: `${currentYear}-12-31`,
      })
    })

    it('appelle get_sales_forecast pour current_quarter', async () => {
      mockRpc.mockResolvedValue({ data: mockForecastData, error: null })

      const { result } = renderHook(() => useSalesForecast('current_quarter'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(mockRpc).toHaveBeenCalledWith(
        'get_sales_forecast',
        expect.objectContaining({
          p_start: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          p_end: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        })
      )
    })
  })

  describe('Donnees retournees', () => {
    beforeEach(() => {
      mockRpc.mockResolvedValue({ data: mockForecastData, error: null })
    })

    it('retourne les KPIs corrects', async () => {
      const { result } = renderHook(() => useSalesForecast(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.data?.kpis.pipeline_raw).toBe(150000)
      expect(result.current.data?.kpis.pipeline_weighted).toBe(90000)
      expect(result.current.data?.kpis.won_total).toBe(30000)
      expect(result.current.data?.kpis.target_total).toBe(200000)
    })

    it('retourne by_quarter avec 4 trimestres', async () => {
      const { result } = renderHook(() => useSalesForecast(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.data?.by_quarter).toHaveLength(4)
      expect(result.current.data?.by_quarter[0].quarter).toBe('Q1')
      expect(result.current.data?.by_quarter[0].raw).toBe(40000)
    })

    it('retourne by_commercial avec le bon nombre de commerciaux', async () => {
      const { result } = renderHook(() => useSalesForecast(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.data?.by_commercial).toHaveLength(2)
      expect(result.current.data?.by_commercial[0].display_name).toBe('Alice Martin')
    })

    it('retourne top_deals avec closing_date', async () => {
      const { result } = renderHook(() => useSalesForecast(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.data?.top_deals[0].nom).toBe('CHU Bordeaux')
      expect(result.current.data?.top_deals[0].weighted_value).toBe(21000)
    })

    it('retourne previous_period pour comparaison', async () => {
      const { result } = renderHook(() => useSalesForecast(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.data?.previous_period?.pipeline_raw).toBe(100000)
      expect(result.current.data?.previous_period?.won_total).toBe(20000)
    })
  })

  describe('Gestion des erreurs', () => {
    it('expose isError quand le RPC echoue', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } })

      const { result } = renderHook(() => useSalesForecast(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.data).toBeUndefined()
    })
  })

  describe('Range current_quarter : dates trimestre courant', () => {
    it('p_start et p_end sont dans le trimestre courant', async () => {
      mockRpc.mockResolvedValue({ data: mockForecastData, error: null })

      const { result } = renderHook(() => useSalesForecast('current_quarter'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      const callArgs = mockRpc.mock.calls[0][1] as { p_start: string; p_end: string }
      const start = new Date(callArgs.p_start)
      const end = new Date(callArgs.p_end)

      // Start doit etre le premier jour d'un mois de debut de trimestre (janv/avril/juil/oct)
      expect(start.getDate()).toBe(1)
      expect([0, 3, 6, 9]).toContain(start.getMonth()) // mois 0=Jan, 3=Avr, 6=Jul, 9=Oct

      // End >= Start
      expect(end.getTime()).toBeGreaterThan(start.getTime())
    })
  })

  describe('Range next_quarter : dates trimestre suivant', () => {
    it('p_start est apres la fin du trimestre courant', async () => {
      mockRpc.mockResolvedValue({ data: mockForecastData, error: null })

      const { result: currentQ } = renderHook(() => useSalesForecast('current_quarter'), {
        wrapper: createWrapper(),
      })
      const { result: nextQ } = renderHook(() => useSalesForecast('next_quarter'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(currentQ.current.isLoading).toBe(false))
      await waitFor(() => expect(nextQ.current.isLoading).toBe(false))

      const currentStart = mockRpc.mock.calls[0][1].p_start as string
      const nextStart = mockRpc.mock.calls[1][1].p_start as string
      expect(nextStart > currentStart).toBe(true)
    })
  })

  describe('Range rolling_12', () => {
    it('range couvre environ 12 mois', async () => {
      mockRpc.mockResolvedValue({ data: mockForecastData, error: null })

      const { result } = renderHook(() => useSalesForecast('rolling_12'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      const callArgs = mockRpc.mock.calls[0][1] as { p_start: string; p_end: string }
      const diffMs = new Date(callArgs.p_end).getTime() - new Date(callArgs.p_start).getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)

      // 12 mois ~ 335-370 jours
      expect(diffDays).toBeGreaterThan(300)
      expect(diffDays).toBeLessThan(400)
    })
  })
})
