import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useGenerateImage } from './useGenerateImage'

const { IMAGES, mockInvoke, mockFrom } = vi.hoisted(() => {
  const IMAGES = [{ dataUrl: 'data:image/png;base64,abc' }, { url: 'https://example.test/img.png' }]
  return {
    IMAGES,
    mockInvoke: vi.fn(),
    mockFrom: vi.fn(),
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockInvoke },
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useGenerateImage', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('retourne un état initial sans génération en cours ni erreur', () => {
    const { result } = renderHook(() => useGenerateImage(), { wrapper: createWrapper() })
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.generate).toBe('function')
  })

  it("appelle l'edge function generate-image avec les bonnes options et retourne les images", async () => {
    mockInvoke.mockResolvedValue({ data: { images: IMAGES }, error: null })
    const { result } = renderHook(() => useGenerateImage(), { wrapper: createWrapper() })

    let images: Awaited<ReturnType<typeof result.current.generate>> = []
    await act(async () => {
      images = await result.current.generate({
        prompt: 'un chat astronaute',
        size: '1024x1024',
        quality: 'high',
        n: 2,
        output_format: 'png',
      })
    })

    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(mockInvoke).toHaveBeenCalledWith('generate-image', {
      body: {
        prompt: 'un chat astronaute',
        size: '1024x1024',
        quality: 'high',
        n: 2,
        output_format: 'png',
      },
    })
    expect(images).toHaveLength(2)
    expect(images[0].dataUrl).toBe('data:image/png;base64,abc')
    expect(images[1].url).toBe('https://example.test/img.png')
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('passe isGenerating à true pendant la génération puis revient à false', async () => {
    let resolveInvoke: (value: { data: { images: typeof IMAGES }; error: null }) => void = () => {}
    mockInvoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInvoke = resolve
        })
    )
    const { result } = renderHook(() => useGenerateImage(), { wrapper: createWrapper() })

    let pending: Promise<unknown> = Promise.resolve()
    act(() => {
      pending = result.current.generate({ prompt: 'paysage' })
    })

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(true)
    })

    await act(async () => {
      resolveInvoke({ data: { images: IMAGES }, error: null })
      await pending
    })

    expect(result.current.isGenerating).toBe(false)
  })

  it("expose le message d'erreur quand l'edge function renvoie une erreur", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('quota dépassé') })
    const { result } = renderHook(() => useGenerateImage(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(result.current.generate({ prompt: 'x' })).rejects.toThrow('quota dépassé')
    })

    expect(result.current.error).toBe('quota dépassé')
    expect(result.current.isGenerating).toBe(false)
  })

  it('lève une erreur quand la réponse contient data.error', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'prompt refusé' }, error: null })
    const { result } = renderHook(() => useGenerateImage(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(result.current.generate({ prompt: 'x' })).rejects.toThrow('prompt refusé')
    })

    expect(result.current.error).toBe('prompt refusé')
    expect(result.current.isGenerating).toBe(false)
  })

  it('lève « Aucune image renvoyée » quand data.images est absent', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useGenerateImage(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(result.current.generate({ prompt: 'x' })).rejects.toThrow(
        'Aucune image renvoyée'
      )
    })

    expect(result.current.error).toBe('Aucune image renvoyée')
    expect(result.current.isGenerating).toBe(false)
  })

  it("réinitialise l'erreur au début d'une nouvelle génération réussie", async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('boom') })
    mockInvoke.mockResolvedValueOnce({ data: { images: IMAGES }, error: null })
    const { result } = renderHook(() => useGenerateImage(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(result.current.generate({ prompt: 'x' })).rejects.toThrow('boom')
    })
    expect(result.current.error).toBe('boom')

    await act(async () => {
      const images = await result.current.generate({ prompt: 'y' })
      expect(images).toHaveLength(2)
    })

    expect(result.current.error).toBeNull()
    expect(result.current.isGenerating).toBe(false)
  })
})
