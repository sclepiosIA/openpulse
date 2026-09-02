import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  return { mockFrom }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}))

import { useAllFacturationPeriodes } from '@/hooks/billing/useAllFacturationPeriodes'
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

type Chainable = { [k: string]: (...args: unknown[]) => Chainable | Promise<unknown> }
function makeChain(resolvedValue: unknown): Chainable {
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === 'then')
        return (cb: (v: unknown) => unknown) => Promise.resolve(resolvedValue).then(cb)
      return vi.fn((..._args: unknown[]) => new Proxy({}, handler))
    },
  }
  return new Proxy({}, handler) as Chainable
}

// Helper pour construire une date au format yyyy-MM-dd
function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const currentYear = new Date().getFullYear()

const mockPeriodes = [
  {
    id: 'p-1',
    etablissement_id: 'etab-1',
    date_debut: dateStr(currentYear, 1, 1),
    date_fin: dateStr(currentYear, 3, 31),
    montant_prevu: 10000,
    montant_percu: 10000,
    statut: 'encaissee',
    date_facture: dateStr(currentYear, 1, 15),
    date_virement_estimee: null,
    type_periode: 'trimestre',
    notes: null,
    etablissement: { id: 'etab-1', nom: 'CHU Paris', client_facturation: 'direct' },
  },
  {
    id: 'p-2',
    etablissement_id: 'etab-2',
    date_debut: dateStr(currentYear, 4, 1),
    date_fin: dateStr(currentYear, 6, 30),
    montant_prevu: 8000,
    montant_percu: null,
    statut: 'facturee',
    date_facture: dateStr(currentYear, 4, 10),
    date_virement_estimee: dateStr(currentYear + 1, 6, 30),
    type_periode: 'trimestre',
    notes: 'En attente paiement',
    etablissement: { id: 'etab-2', nom: 'Clinique Lyon', client_facturation: 'direct' },
  },
  {
    id: 'p-3',
    etablissement_id: 'etab-3',
    date_debut: dateStr(currentYear, 7, 1),
    date_fin: dateStr(currentYear, 9, 30),
    montant_prevu: 6000,
    montant_percu: null,
    statut: 'en_retard',
    date_facture: null,
    date_virement_estimee: null,
    type_periode: 'trimestre',
    notes: null,
    etablissement: { id: 'etab-3', nom: 'Hopital Marseille', client_facturation: 'direct' },
  },
]

describe('useAllFacturationPeriodes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Structure de retour', () => {
    it('retourne les proprietes attendues', async () => {
      mockFrom.mockReturnValue(makeChain({ data: [], error: null }))

      const { result } = renderHook(() => useAllFacturationPeriodes(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      // Proprietes computed
      expect(typeof result.current.totalPrevuAnnuel).toBe('number')
      expect(typeof result.current.totalEncaisse).toBe('number')
      expect(typeof result.current.totalFacture).toBe('number')
      expect(typeof result.current.totalEnRetard).toBe('number')
      expect(typeof result.current.nbEnRetard).toBe('number')
      expect(Array.isArray(result.current.periodes)).toBe(true)
      expect(Array.isArray(result.current.evolution)).toBe(true)
      expect(result.current.evolution).toHaveLength(12)
    })
  })

  describe('Calculs des KPIs', () => {
    beforeEach(() => {
      // 1er appel : facturation_periodes, 2e appel : etablissements_groupes
      mockFrom
        .mockReturnValueOnce(makeChain({ data: mockPeriodes, error: null }))
        .mockReturnValueOnce(makeChain({ data: [], error: null }))
    })

    it('calcule totalEncaisse correctement', async () => {
      const { result } = renderHook(() => useAllFacturationPeriodes(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      // Seule p-1 est 'encaissee' avec montant_percu = 10000
      expect(result.current.totalEncaisse).toBe(10000)
    })

    it('calcule totalFacture correctement', async () => {
      const { result } = renderHook(() => useAllFacturationPeriodes(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      // Seule p-2 est 'facturee' avec montant_prevu = 8000
      expect(result.current.totalFacture).toBe(8000)
    })

    it('calcule totalEnRetard et nbEnRetard correctement', async () => {
      const { result } = renderHook(() => useAllFacturationPeriodes(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      // p-3 est 'en_retard' avec montant_prevu = 6000
      expect(result.current.totalEnRetard).toBe(6000)
      expect(result.current.nbEnRetard).toBe(1)
    })

    it("calcule totalPrevuAnnuel pour l'annee courante", async () => {
      const { result } = renderHook(() => useAllFacturationPeriodes(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      // Toutes les 3 periodes ont date_debut dans currentYear
      // totalPrevuAnnuel = 10000 + 8000 + 6000 = 24000
      expect(result.current.totalPrevuAnnuel).toBe(24000)
    })

    it('calcule tauxEncaissement = 10000/24000*100 = 41%', async () => {
      const { result } = renderHook(() => useAllFacturationPeriodes(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      // Math.round(10000/24000*100) = Math.round(41.666) = 42
      expect(result.current.tauxEncaissement).toBe(42)
    })

    it('parStatut contient les bons compteurs', async () => {
      const { result } = renderHook(() => useAllFacturationPeriodes(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.parStatut['encaissee']).toBe(1)
      expect(result.current.parStatut['facturee']).toBe(1)
      expect(result.current.parStatut['en_retard']).toBe(1)
    })
  })

  describe('Deduplication groupe', () => {
    it('deduplique les periodes pour les etablissements en facturation groupe', async () => {
      const periodesGroupe = [
        {
          ...mockPeriodes[0],
          id: 'pg-1',
          etablissement_id: 'etab-g1',
          etablissement: { id: 'etab-g1', nom: 'Groupe A - Etab 1', client_facturation: 'groupe' },
        },
        {
          ...mockPeriodes[0],
          id: 'pg-2',
          etablissement_id: 'etab-g2',
          etablissement: { id: 'etab-g2', nom: 'Groupe A - Etab 2', client_facturation: 'groupe' },
        },
      ]

      const groupesMembres = [
        { etablissement_id: 'etab-g1', groupe_id: 'groupe-a' },
        { etablissement_id: 'etab-g2', groupe_id: 'groupe-a' },
      ]

      mockFrom
        .mockReturnValueOnce(makeChain({ data: periodesGroupe, error: null }))
        .mockReturnValueOnce(makeChain({ data: groupesMembres, error: null }))

      const { result } = renderHook(() => useAllFacturationPeriodes(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      // Les 2 periodes ont meme groupe_id + date_debut + type_periode => 1 seule gardee
      expect(result.current.periodes).toHaveLength(1)
    })
  })

  describe('Cas limite : periodes vides', () => {
    it('retourne tous les KPIs a zero', async () => {
      mockFrom.mockReturnValue(makeChain({ data: [], error: null }))

      const { result } = renderHook(() => useAllFacturationPeriodes(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.totalPrevuAnnuel).toBe(0)
      expect(result.current.totalEncaisse).toBe(0)
      expect(result.current.nbEnRetard).toBe(0)
      expect(result.current.tauxEncaissement).toBe(0)
    })
  })

  describe('Prochains virements', () => {
    it('inclut les periodes avec date_virement_estimee future non encaissees', async () => {
      // p-2 a date_virement_estimee = currentYear+1 (future)
      mockFrom
        .mockReturnValueOnce(makeChain({ data: mockPeriodes, error: null }))
        .mockReturnValueOnce(makeChain({ data: [], error: null }))

      const { result } = renderHook(() => useAllFacturationPeriodes(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.prochainsVirements).toHaveLength(1)
      expect(result.current.prochainsVirements[0].id).toBe('p-2')
    })
  })
})
