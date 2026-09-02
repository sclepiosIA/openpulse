/**
 * Tests unitaires pour useSecurityLog.
 *
 * Ce hook expose { logAction } — une callback async qui :
 *   1. Tente de récupérer l'IP via fetch('https://api.ipify.org?format=json')
 *   2. Appelle supabase.rpc('log_security_event', { p_action, p_resource, p_details, ... })
 *   3. Swallow toutes les erreurs (ne lance jamais d'exception vers le caller)
 *
 * Comportements testés :
 *   — appel rpc avec les bons paramètres (action, resource, resourceId, details)
 *   — IP récupérée et transmise au rpc
 *   — IP non disponible (fetch échoue) → rpc appelé sans IP (undefined)
 *   — erreur rpc → swallowed
 *   — stabilité de la référence logAction (useCallback)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ─── Mocks stables avec vi.hoisted ───────────────────────────────────────────
const mockRpc = vi.hoisted(() => vi.fn())

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1', email: 'admin@hopital.fr' } } },
        error: null,
      }),
    },
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    maskId: vi.fn((id: string) => `${id.slice(0, 6)}***`),
  },
}))

// ─── Mock global fetch ────────────────────────────────────────────────────────
const originalFetch = globalThis.fetch
const mockFetch = vi.fn()

import { useSecurityLog } from '@/hooks/auth/useSecurityLog'
import { supabase } from '@/integrations/supabase/client';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useSecurityLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = mockFetch
    mockRpc.mockResolvedValue({ data: null, error: null })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.clearAllMocks()
  })

  describe('structure du hook', () => {
    it('retourne un objet avec la propriété logAction', () => {
      const { result } = renderHook(() => useSecurityLog())
      expect(result.current).toHaveProperty('logAction')
      expect(typeof result.current.logAction).toBe('function')
    })

    it('logAction est stable entre les re-renders (useCallback)', () => {
      const { result, rerender } = renderHook(() => useSecurityLog())
      const first = result.current.logAction
      rerender()
      expect(result.current.logAction).toBe(first)
    })
  })

  describe('appel rpc avec les bons paramètres', () => {
    it('passe action et resource au rpc', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ ip: '1.2.3.4' }),
      })

      const { result } = renderHook(() => useSecurityLog())

      await act(async () => {
        await result.current.logAction('LOGIN', 'auth')
      })

      expect(mockRpc).toHaveBeenCalledWith(
        'log_security_event',
        expect.objectContaining({
          p_action: 'LOGIN',
          p_resource: 'auth',
        })
      )
    })

    it('passe resourceId quand fourni', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ ip: '10.0.0.1' }),
      })

      const { result } = renderHook(() => useSecurityLog())

      await act(async () => {
        await result.current.logAction('EXPORT', 'salary_data', undefined, 'res-456')
      })

      expect(mockRpc).toHaveBeenCalledWith(
        'log_security_event',
        expect.objectContaining({
          p_action: 'EXPORT',
          p_resource: 'salary_data',
          p_resource_id: 'res-456',
        })
      )
    })

    it('passe details sérialisés', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ ip: '192.168.1.1' }),
      })

      const details = {
        previous_value: 'ancien_rôle',
        new_value: 'admin',
        affected_records: 1,
      }

      const { result } = renderHook(() => useSecurityLog())

      await act(async () => {
        await result.current.logAction('ROLE_CHANGE', 'user_roles', details, 'user-789')
      })

      const rpcArg = mockRpc.mock.calls[0][1]
      expect(rpcArg.p_details).toEqual(details)
    })

    it("ne transmet pas d'IP côté client (résolution server-side RGPD)", async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ ip: '203.0.113.42' }),
      })

      const { result } = renderHook(() => useSecurityLog())

      await act(async () => {
        await result.current.logAction('VIEW', 'patient_records')
      })

      const rpcArg = mockRpc.mock.calls[0][1]
      // Le hook passe volontairement p_ip_address=undefined (résolu server-side
      // depuis les headers de requête pour éviter ipify + concerns RGPD).
      expect(rpcArg.p_ip_address).toBeUndefined()
    })


    it('passe user_agent du navigateur', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ ip: '1.2.3.4' }),
      })

      const { result } = renderHook(() => useSecurityLog())

      await act(async () => {
        await result.current.logAction('DELETE', 'documents', undefined, 'doc-1')
      })

      const rpcArg = mockRpc.mock.calls[0][1]
      expect(rpcArg.p_user_agent).toBe(navigator.userAgent)
    })
  })

  describe('résilience — fetch IP échoue', () => {
    it('appelle quand même rpc si fetch IP échoue', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useSecurityLog())

      await act(async () => {
        await result.current.logAction('AUDIT', 'security_log')
      })

      expect(mockRpc).toHaveBeenCalledTimes(1)
    })

    it('passe p_ip_address=undefined si fetch IP échoue', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useSecurityLog())

      await act(async () => {
        await result.current.logAction('AUDIT', 'security_log')
      })

      const rpcArg = mockRpc.mock.calls[0][1]
      // p_ip_address doit être undefined (|| undefined pattern dans le hook)
      expect(rpcArg.p_ip_address).toBeUndefined()
    })

    it('ne throw pas si fetch IP échoue', async () => {
      mockFetch.mockRejectedValue(new Error('CORS error'))

      const { result } = renderHook(() => useSecurityLog())

      await act(async () => {
        await expect(result.current.logAction('LOGIN', 'auth')).resolves.toBeUndefined()
      })
    })
  })

  describe('résilience — rpc échoue', () => {
    it('ne throw pas si rpc Supabase échoue', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ ip: '1.2.3.4' }),
      })
      mockRpc.mockRejectedValue(new Error('RPC failure'))

      const { result } = renderHook(() => useSecurityLog())

      await act(async () => {
        await expect(result.current.logAction('VIEW', 'reports')).resolves.toBeUndefined()
      })
    })

    it("swallow l'erreur même si rpc retourne une erreur Supabase", async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ ip: '1.2.3.4' }),
      })
      mockRpc.mockResolvedValue({ data: null, error: { message: 'Permission denied' } })

      const { result } = renderHook(() => useSecurityLog())

      // Le hook ne vérifie pas error dans le retour rpc, il awaite juste l'appel
      // Donc pas de throw dans ce cas
      await act(async () => {
        await expect(result.current.logAction('ACCESS', 'sensitive_data')).resolves.toBeUndefined()
      })
    })
  })

  describe('cas limites des paramètres', () => {
    it('fonctionne sans details (undefined)', async () => {
      mockFetch.mockResolvedValue({ json: async () => ({ ip: '1.1.1.1' }) })

      const { result } = renderHook(() => useSecurityLog())

      await act(async () => {
        await result.current.logAction('VIEW', 'dashboard')
      })

      const rpcArg = mockRpc.mock.calls[0][1]
      expect(rpcArg.p_details).toBeUndefined()
    })

    it('fonctionne sans resourceId (undefined)', async () => {
      mockFetch.mockResolvedValue({ json: async () => ({ ip: '1.1.1.1' }) })

      const { result } = renderHook(() => useSecurityLog())

      await act(async () => {
        await result.current.logAction('VIEW', 'dashboard', { reason: 'test' })
      })

      const rpcArg = mockRpc.mock.calls[0][1]
      expect(rpcArg.p_resource_id).toBeUndefined()
    })

    it('accepte des détails complexes avec champs optionnels', async () => {
      mockFetch.mockResolvedValue({ json: async () => ({ ip: '1.2.3.4' }) })

      const details = {
        previous_value: 42,
        new_value: null,
        affected_records: 5,
        ip_source: '10.0.0.1',
        reason: 'Correction données RH',
      }

      const { result } = renderHook(() => useSecurityLog())

      await act(async () => {
        await result.current.logAction('UPDATE', 'rh_salaires', details, 'sal-001')
      })

      const rpcArg = mockRpc.mock.calls[0][1]
      expect(rpcArg.p_details).toMatchObject({
        previous_value: 42,
        new_value: null,
        affected_records: 5,
      })
    })

    it('plusieurs appels successifs créent un log par appel', async () => {
      mockFetch.mockResolvedValue({ json: async () => ({ ip: '1.2.3.4' }) })
      mockRpc.mockResolvedValue({ data: null, error: null })

      const { result } = renderHook(() => useSecurityLog())

      await act(async () => {
        await result.current.logAction('VIEW', 'salary')
        await result.current.logAction('EXPORT', 'salary', undefined, 'exp-1')
        await result.current.logAction('DELETE', 'document', undefined, 'doc-1')
      })

      expect(mockRpc).toHaveBeenCalledTimes(3)
      expect(mockRpc.mock.calls[0][1].p_action).toBe('VIEW')
      expect(mockRpc.mock.calls[1][1].p_action).toBe('EXPORT')
      expect(mockRpc.mock.calls[2][1].p_action).toBe('DELETE')
    })
  })
})
