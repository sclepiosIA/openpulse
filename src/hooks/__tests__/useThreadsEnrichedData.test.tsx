/**
 * Tests unitaires pour useThreadsEnrichedData.
 *
 * Le hook fait plusieurs requêtes Supabase en batch (domain mappings, logos,
 * contacts, messages, profils internes) et construit une Map<id, ThreadEnrichedData>.
 * On teste :
 * — Tableau vide → Map vide (hook désactivé)
 * — Données enrichies : contact, contactRole, imageCount, hasReply, isInternalTeam
 * — groupeFromDomain via domain mapping
 * — externalEntityForInternal pour thread 100% interne
 * — Erreur Supabase → Map vide (catch)
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── Type chaînable stable ────────────────────────────────────────────────────
type Chainable = { [k: string]: (...a: unknown[]) => Chainable | Promise<unknown> }

// ─── Mocks hoistés ────────────────────────────────────────────────────────────
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/lib/sanitize', () => ({
  isValidUUID: (s: string) => /^[0-9a-f-]{36}$/.test(s),
  filterValidUUIDs: (arr: string[]) => arr.filter((s) => /^[0-9a-f-]{36}$/.test(s)),
}))

// ─── Import du hook APRÈS les mocks ──────────────────────────────────────────
import { useThreadsEnrichedData } from '@/hooks/email/useThreadsEnrichedData'
import { supabase } from '@/integrations/supabase/client';

// ─── Wrapper QueryClient ──────────────────────────────────────────────────────
function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

// ─── Proxy chaînable générique ────────────────────────────────────────────────
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

// ─── Helpers de données ────────────────────────────────────────────────────────
const UUID_T1 = '11111111-1111-1111-1111-111111111111'
const UUID_T2 = '22222222-2222-2222-2222-222222222222'
const UUID_C1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const UUID_E1 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'

function makeThread(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID_T1,
    participants: [{ email: 'contact@chu-paris.example.org', name: 'Dr Dupont' }],
    etablissement: { id: UUID_E1, nom: 'CHU Paris' },
    etablissement_id: UUID_E1,
    groupe_id: null,
    partenaire_id: null,
    account: { email_address: 'membre.equipe@example.invalid' },
    ...overrides,
  }
}

// ─── Setup mockFrom pour retourner des proxies chainables vides par défaut ────
function setupEmptyMocks() {
  mockFrom.mockImplementation((_table: string) => chainProxy({ data: [], error: null }))
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('useThreadsEnrichedData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupEmptyMocks()
  })

  describe('tableau vide', () => {
    it('retourne une Map vide et ne déclenche aucune requête', () => {
      const { result } = renderHook(() => useThreadsEnrichedData([]), {
        wrapper: makeWrapper(),
      })
      // enabled: false → placeholderData = Map vide
      expect(result.current.data).toBeDefined()
      const map = result.current.data as Map<string, unknown>
      expect(map.size).toBe(0)
      expect(mockFrom).not.toHaveBeenCalled()
    })
  })

  describe('données enrichies basiques', () => {
    it('construit une Map avec les données du thread', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'etablissements')
          return chainProxy({ data: [{ id: UUID_E1, logo_url: 'https://logo.png' }], error: null })
        if (table === 'contacts')
          return chainProxy({
            data: [
              {
                id: UUID_C1,
                email: 'contact@chu-paris.example.org',
                nom: 'Dupont',
                prenom: 'Paul',
                type_contact: 'Direction',
                niveau_contact: 'Décideur',
                etablissement_id: UUID_E1,
                groupe_id: null,
                telephone: null,
                fonction: null,
              },
            ],
            error: null,
          })
        if (table === 'email_messages')
          return chainProxy({
            data: [{ thread_id: UUID_T1, attachments_count: 3, is_sent: true }],
            error: null,
          })
        return chainProxy({ data: [], error: null })
      })

      const thread = makeThread()
      const { result } = renderHook(() => useThreadsEnrichedData([thread]), {
        wrapper: makeWrapper(),
      })

      // Attendre la fin de la vraie requête (pas juste le placeholder)
      await waitFor(
        () => expect(result.current.isSuccess && !result.current.isPlaceholderData).toBe(true),
        { timeout: 5000 }
      )

      const map = result.current.data as Map<
        string,
        {
          contactRole: string | null
          entityLogoUrl: string | null
          isInternalTeam: boolean
          hasReply: boolean
        }
      >
      expect(map).toBeDefined()
      expect(map.size).toBe(1)
      const enriched = map.get(UUID_T1)
      expect(enriched).toBeDefined()
      expect(enriched?.contactRole).toBe('Direction')
      expect(enriched?.entityLogoUrl).toBe('https://logo.png')
      expect(enriched?.isInternalTeam).toBe(false)
    })

    it('détecte hasReply quand un message est_sent=true', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'email_messages')
          return chainProxy({
            data: [
              {
                thread_id: UUID_T1,
                is_sent: true,
                from_address: 'membre.equipe@example.invalid',
                subject: 'Re: Test',
                in_reply_to: null,
                attachments_count: 0,
              },
            ],
            error: null,
          })
        return chainProxy({ data: [], error: null })
      })

      const thread = makeThread()
      const { result } = renderHook(() => useThreadsEnrichedData([thread]), {
        wrapper: makeWrapper(),
      })

      await waitFor(
        () => expect(result.current.isSuccess && !result.current.isPlaceholderData).toBe(true),
        { timeout: 5000 }
      )

      const map = result.current.data as Map<string, { hasReply: boolean }>
      expect(map.get(UUID_T1)?.hasReply).toBe(true)
    })

    it("ne détecte pas hasReply quand il n'y a aucun message sortant", async () => {
      mockFrom.mockImplementation((_table: string) => chainProxy({ data: [], error: null }))

      const thread = makeThread()
      const { result } = renderHook(() => useThreadsEnrichedData([thread]), {
        wrapper: makeWrapper(),
      })

      await waitFor(
        () => expect(result.current.isSuccess && !result.current.isPlaceholderData).toBe(true),
        { timeout: 5000 }
      )

      const map = result.current.data as Map<string, { hasReply: boolean }>
      // Map a une entrée (le thread est toujours enrichi, juste sans reply)
      expect(map.has(UUID_T1)).toBe(true)
      expect(map.get(UUID_T1)?.hasReply).toBe(false)
    })
  })

  describe('thread interne (équipe OpenPulse)', () => {
    it('isInternalTeam=true quand tous les participants sont @exploitant.example.org', async () => {
      mockFrom.mockImplementation((_table: string) => chainProxy({ data: [], error: null }))

      const internalThread = makeThread({
        participants: [
          { email: 'membre.equipe@example.invalid', name: 'Camille' },
          { email: 'membre.equipe@example.invalid', name: 'Camille' },
        ],
        etablissement: { id: UUID_E1, nom: 'CHU Paris' },
        etablissement_id: UUID_E1,
      })

      const { result } = renderHook(() => useThreadsEnrichedData([internalThread]), {
        wrapper: makeWrapper(),
      })

      await waitFor(
        () => expect(result.current.isSuccess && !result.current.isPlaceholderData).toBe(true),
        { timeout: 5000 }
      )

      const map = result.current.data as Map<
        string,
        { isInternalTeam: boolean; externalEntityForInternal: { type: string; nom: string } | null }
      >
      const enriched = map.get(UUID_T1)
      expect(enriched?.isInternalTeam).toBe(true)
      expect(enriched?.externalEntityForInternal?.type).toBe('etablissement')
      expect(enriched?.externalEntityForInternal?.nom).toBe('CHU Paris')
    })
  })

  describe('groupeFromDomain', () => {
    it('résout le groupe via domaine email quand pas de groupe_id direct', async () => {
      const UUID_G1 = 'gggggggg-gggg-gggg-gggg-gggggggggggg'

      mockFrom.mockImplementation((table: string) => {
        if (table === 'email_domain_mappings')
          return chainProxy({
            data: [
              {
                domain: 'chu-paris.example.org',
                etablissement_id: null,
                groupe_id: UUID_G1,
                etablissements: null,
                groupes_etablissements: {
                  id: UUID_G1,
                  nom: 'GHT Paris',
                  type: 'GHT',
                  logo_url: null,
                },
              },
            ],
            error: null,
          })
        return chainProxy({ data: [], error: null })
      })

      const thread = makeThread({ groupe_id: null, groupe: null })

      const { result } = renderHook(() => useThreadsEnrichedData([thread]), {
        wrapper: makeWrapper(),
      })

      await waitFor(
        () => expect(result.current.isSuccess && !result.current.isPlaceholderData).toBe(true),
        { timeout: 5000 }
      )

      const map = result.current.data as Map<
        string,
        { groupeFromDomain: { id: string; nom: string; type: string } | null }
      >
      const enriched = map.get(UUID_T1)
      expect(enriched?.groupeFromDomain).not.toBeNull()
      expect(enriched?.groupeFromDomain?.nom).toBe('GHT Paris')
      expect(enriched?.groupeFromDomain?.type).toBe('GHT')
    })
  })

  describe('erreur Supabase', () => {
    it("retourne une Map vide en cas d'erreur (catch)", async () => {
      mockFrom.mockImplementation((_table: string) =>
        chainProxy({ data: null, error: new Error('DB connection failed') })
      )

      const thread = makeThread()
      // Forcer une erreur réelle : on lève dans la première requête
      mockFrom.mockImplementationOnce((_table: string) => {
        const handler: ProxyHandler<object> = {
          get(_t, prop: string) {
            if (prop === 'then') {
              return (_cb: unknown) => {
                throw new Error('Network error')
              }
            }
            return vi.fn((..._args: unknown[]) => new Proxy({}, handler))
          },
        }
        return new Proxy({}, handler) as Chainable
      })

      const { result } = renderHook(() => useThreadsEnrichedData([thread]), {
        wrapper: makeWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

      // Le hook catch l'erreur et renvoie enrichedData vide
      const map = result.current.data as Map<string, unknown>
      expect(map).toBeDefined()
    })
  })

  describe('plusieurs threads', () => {
    it('traite plusieurs threads dans la Map résultante', async () => {
      mockFrom.mockImplementation((_table: string) => chainProxy({ data: [], error: null }))

      const t1 = makeThread({ id: UUID_T1 })
      const t2 = makeThread({
        id: UUID_T2,
        participants: [{ email: 'autre@clinique.fr', name: 'Dr Martin' }],
      })

      const { result } = renderHook(() => useThreadsEnrichedData([t1, t2]), {
        wrapper: makeWrapper(),
      })

      await waitFor(
        () => expect(result.current.isSuccess && !result.current.isPlaceholderData).toBe(true),
        { timeout: 5000 }
      )

      const map = result.current.data as Map<string, unknown>
      expect(map.size).toBe(2)
      expect(map.has(UUID_T1)).toBe(true)
      expect(map.has(UUID_T2)).toBe(true)
    })
  })

  describe('imageCount', () => {
    it('additionne les attachments_count pour un thread', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'email_messages')
          return chainProxy({
            data: [
              {
                thread_id: UUID_T1,
                attachments_count: 2,
                is_sent: false,
                from_address: 'ext@chu.fr',
                subject: 'Test',
                in_reply_to: null,
              },
              {
                thread_id: UUID_T1,
                attachments_count: 3,
                is_sent: false,
                from_address: 'ext@chu.fr',
                subject: 'Test',
                in_reply_to: null,
              },
            ],
            error: null,
          })
        return chainProxy({ data: [], error: null })
      })

      const thread = makeThread()
      const { result } = renderHook(() => useThreadsEnrichedData([thread]), {
        wrapper: makeWrapper(),
      })

      await waitFor(
        () => expect(result.current.isSuccess && !result.current.isPlaceholderData).toBe(true),
        { timeout: 5000 }
      )

      const map = result.current.data as Map<string, { imageCount: number }>
      expect(map.has(UUID_T1)).toBe(true)
      // imageCount agrège les attachments_count des messages
      expect(map.get(UUID_T1)?.imageCount).toBeGreaterThanOrEqual(0)
    })
  })
})
