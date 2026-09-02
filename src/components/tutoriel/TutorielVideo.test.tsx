import React from 'react'
import { render, screen, act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockFrom, setResponse, selectMock, insertMock, eqMock, singleMock, maybeSingleMock, orderMock, limitMock, updateMock, deleteMock } = vi.hoisted(() => {
  // mutable current response used by builder.then to resolve stable references
  let currentResponse: { data: unknown; error: unknown } = { data: null, error: null }

  // spies for chainable builder methods
  const selectMock = vi.fn(() => builder)
  const insertMock = vi.fn(() => builder)
  const eqMock = vi.fn(() => builder)
  const singleMock = vi.fn(() => builder)
  const maybeSingleMock = vi.fn(() => builder)
  const orderMock = vi.fn(() => builder)
  const limitMock = vi.fn(() => builder)
  const updateMock = vi.fn(() => builder)
  const deleteMock = vi.fn(() => builder)

  // builder that is chainable and thenable
  const builder: any = {
    select: selectMock,
    insert: insertMock,
    eq: eqMock,
    single: singleMock,
    maybeSingle: maybeSingleMock,
    order: orderMock,
    limit: limitMock,
    update: updateMock,
    delete: deleteMock,
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(currentResponse).then(onFulfilled, onRejected)
    },
    catch(onRejected: (e: unknown) => unknown) {
      return Promise.resolve(currentResponse).catch(onRejected)
    },
  }

  const mockFrom = vi.fn(() => builder)

  const setResponse = (resp: { data: unknown; error: unknown }) => {
    currentResponse = resp
  }

  return { mockFrom, setResponse, selectMock, insertMock, eqMock, singleMock, maybeSingleMock, orderMock, limitMock, updateMock, deleteMock }
})

const { toastSuccess, toastError } = vi.hoisted(() => {
  const toastSuccess = vi.fn()
  const toastError = vi.fn()
  return { toastSuccess, toastError }
})

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom,
    },
  }
})

vi.mock('sonner', () => {
  return {
    toast: {
      success: toastSuccess,
      error: toastError,
    },
  }
})

vi.mock('lucide-react', () => {
  return {
    Play: (props: any) => React.createElement('svg', { 'data-testid': 'play-icon', ...props }),
  }
})

vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

import { TutorielVideo } from './TutorielVideo'
import { supabase } from '@/integrations/supabase/client'

describe('TutorielVideo component and supabase-based hooks', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('renders a YouTube watch URL converted to embed URL and shows title and play icon', () => {
    const watchUrl = 'https://www.youtube.com/watch?v=abc123xyz'
    const title = 'Mon tutoriel'
    render(
      <Wrapper>
        <TutorielVideo url={watchUrl} title={title} />
      </Wrapper>
    )

    const icon = screen.getByTestId('play-icon')
    expect(icon).toBeTruthy()
    expect(screen.getByText(`Vidéo tutoriel : ${title}`)).toBeTruthy()

    const iframe = screen.getByTitle(title) as HTMLIFrameElement
    const srcAttr = iframe.getAttribute('src')
    expect(srcAttr).toBe('https://www.youtube.com/embed/abc123xyz')
    const allowAttr = iframe.getAttribute('allow') ?? ''
    expect(allowAttr.includes('autoplay')).toBe(true)
    // allowFullScreen is a boolean attribute; getAttribute returns "" or null depending on attribute presence
    expect(iframe.hasAttribute('allowFullScreen')).toBe(true)
  })

  it('converts youtu.be short URL to embed URL', () => {
    const shortUrl = 'https://youtu.be/shortId1'
    const title = 'Short URL'
    render(
      <Wrapper>
        <TutorielVideo url={shortUrl} title={title} />
      </Wrapper>
    )
    const iframe = screen.getByTitle(title) as HTMLIFrameElement
    expect(iframe.getAttribute('src')).toBe('https://youtube.com/embed/shortId1')
  })

  it('keeps an already embed URL unchanged', () => {
    const embedUrl = 'https://youtube.com/embed/kjlhkjh123'
    const title = 'Embed already'
    render(
      <Wrapper>
        <TutorielVideo url={embedUrl} title={title} />
      </Wrapper>
    )
    const iframe = screen.getByTitle(title) as HTMLIFrameElement
    expect(iframe.getAttribute('src')).toBe(embedUrl)
  })

  it('fetch hook: isLoading initially true then resolves to data on success', async () => {
    setResponse({ data: [{ id: 'v1', title: 'Video 1' }], error: null })

    function useFetchVideos() {
      const [state, setState] = React.useState({
        isLoading: true,
        data: null as Array<{ id: string; title: string }> | null,
        error: null as null | { message: string },
      })
      React.useEffect(() => {
        let mounted = true
        supabase.from('videos').select('*').then((res: any) => {
          if (!mounted) return
          if (res.error) {
            setState({ isLoading: false, data: null, error: res.error })
          } else {
            setState({ isLoading: false, data: res.data as Array<{ id: string; title: string }>, error: null })
          }
        })
        return () => {
          mounted = false
        }
      }, [])
      return state
    }

    const { result } = renderHook(() => useFetchVideos(), { wrapper: Wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBeInstanceOf(Array)
    const data = result.current.data ?? []
    expect(data.length).toBe(1)
    expect(data[0]).toEqual({ id: 'v1', title: 'Video 1' })

    expect(mockFrom).toHaveBeenCalledWith('videos')
    expect(selectMock).toHaveBeenCalledWith('*')
  })

  it('fetch hook: sets error when supabase returns an error object', async () => {
    setResponse({ data: null, error: { message: 'fail fetch' } })

    function useFetchVideosError() {
      const [state, setState] = React.useState({
        isLoading: true,
        data: null as null | unknown,
        error: null as null | { message: string },
      })
      React.useEffect(() => {
        let mounted = true
        supabase.from('videos').select('*').then((res: any) => {
          if (!mounted) return
          if (res.error) {
            setState({ isLoading: false, data: null, error: res.error })
          } else {
            setState({ isLoading: false, data: res.data, error: null })
          }
        })
        return () => {
          mounted = false
        }
      }, [])
      return state
    }

    const { result } = renderHook(() => useFetchVideosError(), { wrapper: Wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toEqual({ message: 'fail fetch' })
    expect(result.current.data).toBeNull()
  })

  it('mutation: insert is called with expected payload and resolves result', async () => {
    setResponse({ data: [{ id: 'new1', title: 'New Video' }], error: null })

    async function addVideo(payload: { title: string }) {
      const res = await supabase.from('videos').insert([payload])
      return res
    }

    await act(async () => {
      const res = await addVideo({ title: 'New Video' })
      expect(res.data).toEqual([{ id: 'new1', title: 'New Video' }])
      expect(res.error).toBeNull()
    })

    expect(mockFrom).toHaveBeenCalledWith('videos')
    expect(insertMock).toHaveBeenCalledWith([{ title: 'New Video' }])
  })
})