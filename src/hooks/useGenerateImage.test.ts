// @vitest-environment jsdom

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useGenerateImage,
  type GenerateImageOptions,
  type GeneratedImage,
} from './useGenerateImage'

const { SUCCESS_IMAGES, INVOKE_SUCCESS, SUPABASE_ROWS, AUTH_STATE, mockInvoke, mockFrom } =
  vi.hoisted(() => {
    const successImages: GeneratedImage[] = [
      { url: 'https://example.com/image-1.png', b64_json: 'img1b64' },
      { dataUrl: 'data:image/png;base64,img2', url: 'https://example.com/image-2.png' },
    ]

    return {
      SUCCESS_IMAGES: successImages,
      INVOKE_SUCCESS: { data: { images: successImages }, error: null as null },
      SUPABASE_ROWS: [{ id: '1' }],
      AUTH_STATE: {
        user: { id: 'u1', email: 't@t.co' },
        session: { user: { id: 'u1' } },
        isLoading: false,
      },
      mockInvoke: vi.fn(),
      mockFrom: vi.fn(),
    }
  })

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    like: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    is: vi.fn(() => builder),
    in: vi.fn(() => builder),
    contains: vi.fn(() => builder),
    containedBy: vi.fn(() => builder),
    overlaps: vi.fn(() => builder),
    textSearch: vi.fn(() => builder),
    filter: vi.fn(() => builder),
    match: vi.fn(() => builder),
    not: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: SUPABASE_ROWS[0], error: null })),
    maybeSingle: vi.fn(async () => ({ data: SUPABASE_ROWS[0], error: null })),
    then: (onFulfilled: (value: { data: typeof SUPABASE_ROWS; error: null }) => unknown) =>
      Promise.resolve({ data: SUPABASE_ROWS, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: SUPABASE_ROWS, error: null }).catch(onRejected),
  }

  mockFrom.mockImplementation(() => builder)

  return {
    supabase: {
      from: mockFrom,
      functions: {
        invoke: mockInvoke,
      },
    },
  }
})

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
  AuthProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
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

describe('useGenerateImage', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockFrom.mockClear()
  })

  it('initialise avec isGenerating à false et error à null', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useGenerateImage(), { wrapper })

    expect(result.current.isGenerating).toBe(false)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.generate).toBe('function')
  })

  it('génère des images avec les bonnes options et expose le chargement pendant la requête', async () => {
    let resolveInvoke: ((value: typeof INVOKE_SUCCESS) => void) | undefined

    mockInvoke.mockImplementationOnce(
      () =>
        new Promise<typeof INVOKE_SUCCESS>((resolve) => {
          resolveInvoke = resolve
        })
    )

    const wrapper = createWrapper()
    const { result } = renderHook(() => useGenerateImage(), { wrapper })

    const options: GenerateImageOptions = {
      prompt: 'Un paysage de montagne au lever du soleil',
      size: '1024x1536',
      quality: 'high',
      n: 2,
      output_format: 'png',
    }

    let promise: Promise<GeneratedImage[]> | undefined

    act(() => {
      promise = result.current.generate(options)
    })

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(true)
    })

    expect(result.current.error).toBeNull()
    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(mockInvoke).toHaveBeenCalledWith('generate-image', {
      body: options,
    })

    resolveInvoke?.(INVOKE_SUCCESS)

    await expect(promise).resolves.toEqual(SUCCESS_IMAGES)

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(false)
    })

    expect(result.current.error).toBeNull()
  })

  it('retourne les images générées en cas de succès immédiat', async () => {
    mockInvoke.mockResolvedValueOnce(INVOKE_SUCCESS)

    const wrapper = createWrapper()
    const { result } = renderHook(() => useGenerateImage(), { wrapper })

    const options: GenerateImageOptions = {
      prompt: 'Portrait studio',
      quality: 'medium',
      output_format: 'webp',
    }

    let images: GeneratedImage[] | undefined

    await act(async () => {
      images = await result.current.generate(options)
    })

    expect(images).toEqual(SUCCESS_IMAGES)
    expect(images?.[0]).toEqual({
      url: 'https://example.com/image-1.png',
      b64_json: 'img1b64',
    })
    expect(images?.[1]).toEqual({
      dataUrl: 'data:image/png;base64,img2',
      url: 'https://example.com/image-2.png',
    })
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.error).toBeNull()
    expect(mockInvoke).toHaveBeenCalledWith('generate-image', {
      body: options,
    })
  })

  it('propage une erreur de fonction supabase et renseigne error', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'x' },
    })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useGenerateImage(), { wrapper })

    let caught: unknown

    await act(async () => {
      try {
        await result.current.generate({ prompt: 'Prompt en erreur' })
      } catch (e) {
        caught = e
      }
    })

    expect(caught).toMatchObject({ message: 'x' })

    await waitFor(() => {
      expect(result.current.error).toBe('Erreur de génération')
    })

    expect(result.current.isGenerating).toBe(false)
    expect(mockInvoke).toHaveBeenCalledWith('generate-image', {
      body: { prompt: 'Prompt en erreur' },
    })
  })

  it('gère une erreur métier renvoyée dans data.error', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { error: 'contenu refusé' },
      error: null,
    })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useGenerateImage(), { wrapper })

    let caught: unknown

    await act(async () => {
      try {
        await result.current.generate({ prompt: 'Contenu sensible' })
      } catch (e) {
        caught = e
      }
    })

    expect(caught).toBeInstanceOf(Error)
    expect(caught).toMatchObject({ message: 'contenu refusé' })

    await waitFor(() => {
      expect(result.current.error).toBe('contenu refusé')
    })

    expect(result.current.isGenerating).toBe(false)
    expect(mockInvoke).toHaveBeenCalledWith('generate-image', {
      body: { prompt: 'Contenu sensible' },
    })
  })

  it("gère l'absence d'images renvoyées", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {},
      error: null,
    })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useGenerateImage(), { wrapper })

    let caught: unknown

    await act(async () => {
      try {
        await result.current.generate({ prompt: 'Aucune image' })
      } catch (e) {
        caught = e
      }
    })

    expect(caught).toBeInstanceOf(Error)
    expect(caught).toMatchObject({ message: 'Aucune image renvoyée' })

    await waitFor(() => {
      expect(result.current.error).toBe('Aucune image renvoyée')
    })

    expect(result.current.isGenerating).toBe(false)
    expect(mockInvoke).toHaveBeenCalledWith('generate-image', {
      body: { prompt: 'Aucune image' },
    })
  })

  it('réinitialise error à null avant une nouvelle tentative réussie', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'x' },
      })
      .mockResolvedValueOnce(INVOKE_SUCCESS)

    const wrapper = createWrapper()
    const { result } = renderHook(() => useGenerateImage(), { wrapper })

    await act(async () => {
      try {
        await result.current.generate({ prompt: 'Premier essai' })
      } catch {}
    })

    await waitFor(() => {
      expect(result.current.error).toBe('Erreur de génération')
    })

    let images: GeneratedImage[] | undefined

    await act(async () => {
      images = await result.current.generate({ prompt: 'Deuxième essai' })
    })

    expect(images).toEqual(SUCCESS_IMAGES)
    expect(result.current.error).toBeNull()
    expect(result.current.isGenerating).toBe(false)
    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'generate-image', {
      body: { prompt: 'Premier essai' },
    })
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'generate-image', {
      body: { prompt: 'Deuxième essai' },
    })
  })
})
