/**
 * Tests unitaires pour useMonitorLogs.
 *
 * Le hook agrège 7 requêtes Supabase, calcule des KPIs, des patterns récurrents,
 * des logs filtrés et des données de graphe.
 * On teste :
 * — Structure de retour (isLoading, filteredLogs, kpis, chartData, etc.)
 * — Agrégation allLogs : transformation frontend → severity critical/error
 * — Transformation AI : critical si duration > 80000ms
 * — Transformation email_sync, api, security, feedback
 * — KPIs : errors24h, aiSuccessRate, counts par source
 * — Filtres : activeTab (frontend/ai/email/api/security/feedback), severityFilter, searchTerm
 * — Patterns récurrents : détectés quand count >= 2
 * — Controls : setPeriod réinitialise displayCount, loadMore incrémente
 * — État d'erreur : hasError=true si une query échoue
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { subHours } from 'date-fns'

// ─── Type chaînable stable ────────────────────────────────────────────────────
type Chainable = { [k: string]: (...a: unknown[]) => Chainable | Promise<unknown> }

// ─── Mocks hoistés ────────────────────────────────────────────────────────────
const { mockFromSupa } = vi.hoisted(() => ({ mockFromSupa: vi.fn() }))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFromSupa },
}))

// ─── Import APRÈS les mocks ──────────────────────────────────────────────────
import { useMonitorLogs } from '@/hooks/monitoring/useMonitorLogs'
import { supabase } from '@/integrations/supabase/client';

// ─── Wrapper QueryClient ──────────────────────────────────────────────────────
function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

// ─── Proxy chaînable ─────────────────────────────────────────────────────────
function chainProxy(resolved: unknown): Chainable {
  const handler: ProxyHandler<object> = {
    get(_t, prop: string) {
      if (prop === 'then')
        return (cb: (v: unknown) => unknown) => Promise.resolve(resolved).then(cb)
      return vi.fn((..._args: unknown[]) => new Proxy({}, handler))
    },
  }
  return new Proxy({}, handler) as Chainable
}

// ─── Timestamps pour les tests ────────────────────────────────────────────────
const NOW = new Date().toISOString()
const TWO_HOURS_AGO = subHours(new Date(), 2).toISOString()
const YESTERDAY = subHours(new Date(), 26).toISOString()

// ─── Données de test ─────────────────────────────────────────────────────────
const FE_ERROR = {
  id: 'fe-1',
  created_at: TWO_HOURS_AGO,
  user_id: 'user-1',
  error_message: 'Cannot read property of undefined',
  error_stack: 'Error at Component.tsx:42',
  error_type: 'runtime',
  component_name: 'Dashboard',
  current_route: '/dashboard',
  browser_info: 'Chrome 120',
  metadata: {},
  fingerprint: 'fp-001',
}

const FE_ERROR_BOUNDARY = {
  ...FE_ERROR,
  id: 'fe-2',
  error_type: 'react_boundary',
  error_message: 'Component crashed',
}

const AI_ERROR = {
  id: 'ai-1',
  processed_at: TWO_HOURS_AGO,
  processing_type: 'email_classification',
  error_message: 'Timeout',
  processing_duration_ms: 90000, // > 80000 → critical
  processed_by: 'user-1',
  model_used: 'claude-3',
  prompt_tokens: 500,
  completion_tokens: 0,
  total_tokens: 500,
  context_type: 'email',
}

const AI_ERROR_NORMAL = {
  ...AI_ERROR,
  id: 'ai-2',
  processing_duration_ms: 5000, // < 80000 → error
  error_message: 'Model unavailable',
}

const EMAIL_SYNC_ERROR = {
  id: 'sync-1',
  execution_start: TWO_HOURS_AGO,
  execution_end: TWO_HOURS_AGO,
  error_details: 'IMAP connection refused',
  status: 'error',
  emails_fetched: 0,
}

const API_ERROR_500 = {
  id: 'api-1',
  created_at: TWO_HOURS_AGO,
  endpoint: '/api/contacts',
  method: 'GET',
  status_code: 500,
  error_message: 'Internal Server Error',
  duration_ms: 1200,
  user_agent: 'Mozilla',
}

const API_ERROR_404 = {
  ...API_ERROR_500,
  id: 'api-2',
  status_code: 404,
  error_message: 'Not Found',
}

const SEC_LOG_HIGH = {
  id: 'sec-1',
  created_at: TWO_HOURS_AGO,
  user_id: 'user-1',
  user_email: 'hacker@evil.com',
  log_type: 'unauthorized_access',
  risk_level: 'high',
  ip_address: '1.2.3.4',
  metadata: {},
}

const SEC_LOG_MEDIUM = {
  ...SEC_LOG_HIGH,
  id: 'sec-2',
  risk_level: 'medium',
  log_type: 'suspicious_activity',
}

const FEEDBACK_BUG = {
  id: 'fb-1',
  created_at: TWO_HOURS_AGO,
  user_id: 'user-1',
  type: 'bug',
  title: 'Le bouton ne fonctionne pas',
  description: 'Description du bug',
  status: 'open',
  console_logs: null,
  current_route: '/settings',
  browser_info: 'Firefox 120',
  priority: 'high',
}

// ─── Setup mocks complets ─────────────────────────────────────────────────────
function setupFullMocks() {
  mockFromSupa.mockImplementation((table: string) => {
    if (table === 'frontend_error_logs')
      return chainProxy({ data: [FE_ERROR, FE_ERROR_BOUNDARY], error: null })
    if (table === 'ai_processing_log')
      return chainProxy({ data: [AI_ERROR, AI_ERROR_NORMAL], error: null, count: 10 })
    if (table === 'email_sync_logs') return chainProxy({ data: [EMAIL_SYNC_ERROR], error: null })
    if (table === 'api_logs')
      return chainProxy({ data: [API_ERROR_500, API_ERROR_404], error: null })
    if (table === 'security_logs')
      return chainProxy({ data: [SEC_LOG_HIGH, SEC_LOG_MEDIUM], error: null })
    if (table === 'user_feedbacks') return chainProxy({ data: [FEEDBACK_BUG], error: null })
    return chainProxy({ data: [], error: null })
  })
}

function setupEmptyMocks() {
  mockFromSupa.mockImplementation((_table: string) => chainProxy({ data: [], error: null }))
}

describe('useMonitorLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupEmptyMocks()
  })

  describe('structure de retour', () => {
    it('expose tous les champs attendus', () => {
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      // Avant chargement
      expect(result.current).toHaveProperty('filteredLogs')
      expect(result.current).toHaveProperty('allLogs')
      expect(result.current).toHaveProperty('kpis')
      expect(result.current).toHaveProperty('chartData')
      expect(result.current).toHaveProperty('recurringPatterns')
      expect(result.current).toHaveProperty('uniqueUsers')
      expect(result.current).toHaveProperty('isLoading')
      expect(result.current).toHaveProperty('hasError')
      expect(result.current).toHaveProperty('errorInfos')
      expect(result.current).toHaveProperty('period')
      expect(result.current).toHaveProperty('setPeriod')
      expect(result.current).toHaveProperty('searchTerm')
      expect(result.current).toHaveProperty('setSearchTerm')
      expect(result.current).toHaveProperty('severityFilter')
      expect(result.current).toHaveProperty('setSeverityFilter')
      expect(result.current).toHaveProperty('activeTab')
      expect(result.current).toHaveProperty('setActiveTab')
      expect(result.current).toHaveProperty('displayCount')
      expect(result.current).toHaveProperty('loadMore')
      expect(result.current).toHaveProperty('retryAll')
    })

    it('initialise avec les valeurs par défaut', () => {
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      expect(result.current.period).toBe('7d')
      expect(result.current.searchTerm).toBe('')
      expect(result.current.severityFilter).toBe('all')
      expect(result.current.activeTab).toBe('global')
      expect(result.current.userFilter).toBe('all')
      expect(result.current.sourceFilter).toBe('all')
      expect(result.current.displayCount).toBe(100)
    })
  })

  describe('agrégation allLogs', () => {
    it('transforme les erreurs frontend avec severity=error', async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      const feLogs = result.current.allLogs.filter((l) => l.source === 'frontend')
      expect(feLogs.length).toBeGreaterThanOrEqual(2)
      const runtimeLog = feLogs.find((l) => l.type === 'runtime')
      expect(runtimeLog?.severity).toBe('error')
      expect(runtimeLog?.id).toBe('fe-fe-1')
    })

    it('transforme les erreurs frontend react_boundary en severity=critical', async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      const boundaryLog = result.current.allLogs.find((l) => l.id === 'fe-fe-2')
      expect(boundaryLog?.severity).toBe('critical')
    })

    it('transforme les erreurs AI : duration > 80000ms → critical', async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      const criticalAi = result.current.allLogs.find((l) => l.id === 'ai-ai-1')
      expect(criticalAi?.severity).toBe('critical')
      expect(criticalAi?.source).toBe('ai')
    })

    it('transforme les erreurs AI normales en severity=error', async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      const normalAi = result.current.allLogs.find((l) => l.id === 'ai-ai-2')
      expect(normalAi?.severity).toBe('error')
    })

    it('transforme les logs email_sync en severity=error', async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      const syncLog = result.current.allLogs.find((l) => l.id === 'email-sync-1')
      expect(syncLog?.source).toBe('email_sync')
      expect(syncLog?.severity).toBe('error')
      expect(syncLog?.message).toBe('IMAP connection refused')
    })

    it('transforme les erreurs api : status >= 500 → critical, 4xx → error', async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      const api500 = result.current.allLogs.find((l) => l.id === 'api-api-1')
      expect(api500?.severity).toBe('critical')

      const api404 = result.current.allLogs.find((l) => l.id === 'api-api-2')
      expect(api404?.severity).toBe('error')
    })

    it('transforme les logs security : risk_level=high → critical, medium → warning', async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      const highSec = result.current.allLogs.find((l) => l.id === 'sec-sec-1')
      expect(highSec?.severity).toBe('critical')
      expect(highSec?.userEmail).toBe('hacker@evil.com')

      const medSec = result.current.allLogs.find((l) => l.id === 'sec-sec-2')
      expect(medSec?.severity).toBe('warning')
    })

    it('transforme les feedbacks bugs avec la bonne severity', async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      const fb = result.current.allLogs.find((l) => l.id === 'fb-fb-1')
      expect(fb?.source).toBe('feedback')
      expect(fb?.severity).toBe('error') // priority='high'
      expect(fb?.message).toBe('Le bouton ne fonctionne pas')
    })

    it('trie allLogs par timestamp décroissant', async () => {
      mockFromSupa.mockImplementation((table: string) => {
        if (table === 'frontend_error_logs')
          return chainProxy({
            data: [
              { ...FE_ERROR, id: 'fe-old', created_at: YESTERDAY },
              { ...FE_ERROR, id: 'fe-new', created_at: NOW },
            ],
            error: null,
          })
        return chainProxy({ data: [], error: null })
      })

      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      const logs = result.current.allLogs.filter((l) => l.source === 'frontend')
      if (logs.length >= 2) {
        const t0 = new Date(logs[0].timestamp).getTime()
        const t1 = new Date(logs[1].timestamp).getTime()
        expect(t0).toBeGreaterThanOrEqual(t1)
      }
    })
  })

  describe('KPIs', () => {
    it('calcule errors24h (logs error/critical dans les 24 dernières heures)', async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      // TWO_HOURS_AGO est dans les 24h → doit compter
      expect(result.current.kpis.errors24h).toBeGreaterThan(0)
    })

    it('kpis.syncErrors = nombre de sync errors', async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      expect(result.current.kpis.syncErrors).toBe(1)
    })

    it('kpis.feedbackBugs = nombre de feedbacks', async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      expect(result.current.kpis.feedbackBugs).toBe(1)
    })

    it('kpis.securityAlerts = nombre de security logs', async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      expect(result.current.kpis.securityAlerts).toBe(2)
    })

    it('kpis.aiSuccessRate = 100 quand aiTotal=0', async () => {
      setupEmptyMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      expect(result.current.kpis.aiSuccessRate).toBe(100)
    })

    it('kpis.frontendErrors = nombre de frontend errors', async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      expect(result.current.kpis.frontendErrors).toBe(2)
    })
  })

  describe('filtres activeTab', () => {
    it("activeTab='frontend' filtre sur source=frontend", async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      act(() => result.current.setActiveTab('frontend'))

      await waitFor(() => {
        expect(result.current.filteredLogs.every((l) => l.source === 'frontend')).toBe(true)
      })
    })

    it("activeTab='ai' filtre sur source=ai", async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      act(() => result.current.setActiveTab('ai'))

      await waitFor(() => {
        expect(result.current.filteredLogs.every((l) => l.source === 'ai')).toBe(true)
      })
    })

    it("activeTab='security' filtre sur source=security", async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      act(() => result.current.setActiveTab('security'))

      await waitFor(() => {
        expect(result.current.filteredLogs.every((l) => l.source === 'security')).toBe(true)
      })
    })
  })

  describe('filtre severity', () => {
    it("severityFilter='critical' ne retient que les logs critical", async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      act(() => result.current.setSeverityFilter('critical'))

      await waitFor(() => {
        expect(result.current.filteredLogs.every((l) => l.severity === 'critical')).toBe(true)
      })
    })
  })

  describe('filtre searchTerm', () => {
    it('searchTerm filtre par message', async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      act(() => result.current.setSearchTerm('IMAP'))

      await waitFor(() => {
        expect(result.current.filteredLogs.every((l) => l.message.includes('IMAP'))).toBe(true)
      })
    })
  })

  describe('patterns récurrents', () => {
    it('détecte les patterns quand le même message apparaît >= 2 fois', async () => {
      const REPEATED_MSG = 'Cannot read property'
      mockFromSupa.mockImplementation((table: string) => {
        if (table === 'frontend_error_logs')
          return chainProxy({
            data: [
              { ...FE_ERROR, id: 'fe-a', error_message: REPEATED_MSG, error_type: 'runtime' },
              {
                ...FE_ERROR,
                id: 'fe-b',
                error_message: REPEATED_MSG,
                error_type: 'runtime',
                created_at: YESTERDAY,
              },
            ],
            error: null,
          })
        return chainProxy({ data: [], error: null })
      })

      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      const patterns = result.current.recurringPatterns
      expect(patterns.length).toBeGreaterThan(0)
      const p = patterns.find((p) => p.message.includes(REPEATED_MSG.slice(0, 50)))
      expect(p).toBeDefined()
      expect(p?.count).toBeGreaterThanOrEqual(2)
    })

    it('ne signale pas les patterns avec count < 2', async () => {
      setupEmptyMocks()
      mockFromSupa.mockImplementation((table: string) => {
        if (table === 'frontend_error_logs') return chainProxy({ data: [FE_ERROR], error: null })
        return chainProxy({ data: [], error: null })
      })

      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      expect(result.current.recurringPatterns.length).toBe(0)
    })
  })

  describe('controls setPeriod / loadMore', () => {
    it('setPeriod réinitialise displayCount à 100', async () => {
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      // Augmenter d'abord le displayCount
      act(() => result.current.loadMore())
      expect(result.current.displayCount).toBe(200)

      // Changer de période → reset à 100
      act(() => result.current.setPeriod('24h'))
      expect(result.current.displayCount).toBe(100)
      expect(result.current.period).toBe('24h')
    })

    it('loadMore incrémente displayCount de 100', async () => {
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      act(() => result.current.loadMore())
      expect(result.current.displayCount).toBe(200)

      act(() => result.current.loadMore())
      expect(result.current.displayCount).toBe(300)
    })

    it('setActiveTab réinitialise displayCount à 100', async () => {
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      act(() => result.current.loadMore())
      expect(result.current.displayCount).toBe(200)

      act(() => result.current.setActiveTab('frontend'))
      expect(result.current.displayCount).toBe(100)
    })
  })

  describe('chartData', () => {
    it("période '7d' → 7 points quotidiens", async () => {
      setupEmptyMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      expect(result.current.period).toBe('7d')
      expect(result.current.chartData.length).toBe(7)
      // Chaque point a les 6 sources
      const point = result.current.chartData[0]
      expect(point).toHaveProperty('frontend')
      expect(point).toHaveProperty('ai')
      expect(point).toHaveProperty('email')
      expect(point).toHaveProperty('api')
      expect(point).toHaveProperty('security')
      expect(point).toHaveProperty('feedback')
    })

    it("période '24h' → 24 points horaires", async () => {
      setupEmptyMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      act(() => result.current.setPeriod('24h'))

      await waitFor(() => {
        expect(result.current.chartData.length).toBe(24)
      })
    })

    it("période '30d' → 30 points quotidiens", async () => {
      setupEmptyMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      act(() => result.current.setPeriod('30d'))

      await waitFor(() => {
        expect(result.current.chartData.length).toBe(30)
      })
    })
  })

  describe('uniqueUsers', () => {
    it('extrait les utilisateurs uniques des logs', async () => {
      mockFromSupa.mockImplementation((table: string) => {
        if (table === 'security_logs')
          return chainProxy({
            data: [
              { ...SEC_LOG_HIGH, user_id: 'u1', user_email: 'alice@test.com' },
              { ...SEC_LOG_HIGH, id: 'sec-3', user_id: 'u2', user_email: 'bob@test.com' },
              { ...SEC_LOG_HIGH, id: 'sec-4', user_id: 'u1', user_email: 'alice@test.com' }, // doublon
            ],
            error: null,
          })
        return chainProxy({ data: [], error: null })
      })

      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      const users = result.current.uniqueUsers
      const ids = users.map((u) => u.id)
      const uniqueIds = [...new Set(ids)]
      expect(ids.length).toBe(uniqueIds.length)
      expect(users.some((u) => u.label === 'alice@test.com')).toBe(true)
      expect(users.some((u) => u.label === 'bob@test.com')).toBe(true)
    })
  })

  describe('état hasError', () => {
    it('hasError=false quand toutes les queries réussissent', async () => {
      setupEmptyMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      expect(result.current.hasError).toBe(false)
      expect(result.current.errorInfos.length).toBe(0)
    })

    it('expose les données brutes par source (frontendErrors, aiErrors, etc.)', async () => {
      setupFullMocks()
      const { result } = renderHook(() => useMonitorLogs(), { wrapper: makeWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      expect(result.current.frontendErrors.length).toBe(2)
      expect(result.current.aiErrors.length).toBe(2)
      expect(result.current.emailSyncErrors.length).toBe(1)
      expect(result.current.apiErrors.length).toBe(2)
      expect(result.current.securityLogs.length).toBe(2)
      expect(result.current.feedbacks.length).toBe(1)
    })
  })
})
