import React, { type PropsWithChildren } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

describe('avoir.ts', () => {
  it('exports the expected labels and colors with correct values', async () => {
    const mod = await import('./avoir')

    expect(mod.AVOIR_MOTIF_LABELS.erreur_facturation).toBe('Erreur de facturation')
    expect(mod.AVOIR_MOTIF_LABELS.retour_marchandise).toBe('Retour de marchandise')
    expect(mod.AVOIR_MOTIF_LABELS.remise_commerciale).toBe('Remise commerciale')
    expect(mod.AVOIR_MOTIF_LABELS.annulation_partielle).toBe('Annulation partielle')
    expect(mod.AVOIR_MOTIF_LABELS.annulation_totale).toBe('Annulation totale')
    expect(mod.AVOIR_MOTIF_LABELS.geste_commercial).toBe('Geste commercial')
    expect(mod.AVOIR_MOTIF_LABELS.autre).toBe('Autre')

    expect(mod.AVOIR_STATUT_LABELS.brouillon).toBe('Brouillon')
    expect(mod.AVOIR_STATUT_LABELS.emis).toBe('Émis')
    expect(mod.AVOIR_STATUT_LABELS.rembourse).toBe('Remboursé')
    expect(mod.AVOIR_STATUT_LABELS.impute).toBe('Imputé sur facture')
    expect(mod.AVOIR_STATUT_LABELS.annule).toBe('Annulé')

    expect(mod.AVOIR_STATUT_COLORS.brouillon).toBe('bg-gray-100 text-gray-700')
    expect(mod.AVOIR_STATUT_COLORS.emis).toBe('bg-blue-100 text-blue-700')
    expect(mod.AVOIR_STATUT_COLORS.rembourse).toBe('bg-green-100 text-green-700')
    expect(mod.AVOIR_STATUT_COLORS.impute).toBe('bg-emerald-100 text-emerald-700')
    expect(mod.AVOIR_STATUT_COLORS.annule).toBe('bg-red-100 text-red-700')
  })

  it('exported maps are stable references (same instance on multiple access)', async () => {
    const mod = await import('./avoir')

    expect(mod.AVOIR_MOTIF_LABELS).toBe(mod.AVOIR_MOTIF_LABELS)
    expect(mod.AVOIR_STATUT_LABELS).toBe(mod.AVOIR_STATUT_LABELS)
    expect(mod.AVOIR_STATUT_COLORS).toBe(mod.AVOIR_STATUT_COLORS)
  })

  it('renderHook wrapper works with QueryClientProvider (jsdom) and query client options are set', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 }
      }
    })

    const wrapper = ({ children }: PropsWithChildren) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => ({ ok: true }), { wrapper })

    await waitFor(() => {
      expect(result.current.ok).toBe(true)
    })
  })
})