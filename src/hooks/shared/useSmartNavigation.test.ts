/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act } from '@testing-library/react'
import { getClickableRowProps, useSmartNavigation } from './useSmartNavigation'

const { mockNavigate, mockOpen, mockFrom, stableUser } = vi.hoisted(() => {
  const navigate = vi.fn()
  const open = vi.fn()
  const user = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const createBuilder = () => {
    const result = { data: null, error: null as null | { message: string } }
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
    }
    return builder
  }

  return {
    mockNavigate: navigate,
    mockOpen: open,
    mockFrom: vi.fn(() => createBuilder()),
    stableUser: user,
  }
})

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableUser,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableUser,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => stableUser,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return ({ children }: { children: React.ReactNode }) =>
    QueryClientProvider({ client: queryClient, children })
}

describe('useSmartNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('open', mockOpen)
  })

  it('expose smartNavigate et la fonction navigate du routeur', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSmartNavigation(), { wrapper })

    expect(result.current.navigate).toBe(mockNavigate)
    expect(typeof result.current.smartNavigate).toBe('function')
  })

  it('navigue en interne sur clic normal', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSmartNavigation(), { wrapper })

    const preventDefault = vi.fn()
    const event = {
      metaKey: false,
      ctrlKey: false,
      preventDefault,
    } as unknown as React.MouseEvent

    await act(async () => {
      result.current.smartNavigate(event, '/dashboard')
    })

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    expect(preventDefault).not.toHaveBeenCalled()
    expect(mockOpen).not.toHaveBeenCalled()
  })

  it('ouvre un nouvel onglet sur Cmd+clic', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSmartNavigation(), { wrapper })

    const preventDefault = vi.fn()
    const event = {
      metaKey: true,
      ctrlKey: false,
      preventDefault,
    } as unknown as React.MouseEvent

    await act(async () => {
      result.current.smartNavigate(event, '/projects/1')
    })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(mockOpen).toHaveBeenCalledTimes(1)
    expect(mockOpen).toHaveBeenCalledWith('/projects/1', '_blank')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('ouvre un nouvel onglet sur Ctrl+clic', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSmartNavigation(), { wrapper })

    const preventDefault = vi.fn()
    const event = {
      metaKey: false,
      ctrlKey: true,
      preventDefault,
    } as unknown as React.MouseEvent

    await act(async () => {
      result.current.smartNavigate(event, '/reports')
    })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(mockOpen).toHaveBeenCalledTimes(1)
    expect(mockOpen).toHaveBeenCalledWith('/reports', '_blank')
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

describe('getClickableRowProps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('open', mockOpen)
  })

  it('retourne des props d’accessibilité cohérentes', () => {
    const navigate = vi.fn()

    const props = getClickableRowProps(navigate, '/users/42')

    expect(props.role).toBe('link')
    expect(props.tabIndex).toBe(0)
    expect(typeof props.onClick).toBe('function')
    expect(typeof props.onKeyDown).toBe('function')
  })

  it('onClick navigue en interne sur clic normal', async () => {
    const navigate = vi.fn()
    const props = getClickableRowProps(navigate, '/users/42')

    const preventDefault = vi.fn()
    const event = {
      metaKey: false,
      ctrlKey: false,
      preventDefault,
    } as unknown as React.MouseEvent

    await act(async () => {
      props.onClick(event)
    })

    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/users/42')
    expect(preventDefault).not.toHaveBeenCalled()
    expect(mockOpen).not.toHaveBeenCalled()
  })

  it('onClick ouvre un nouvel onglet sur Cmd+clic', async () => {
    const navigate = vi.fn()
    const props = getClickableRowProps(navigate, '/users/42')

    const preventDefault = vi.fn()
    const event = {
      metaKey: true,
      ctrlKey: false,
      preventDefault,
    } as unknown as React.MouseEvent

    await act(async () => {
      props.onClick(event)
    })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(mockOpen).toHaveBeenCalledTimes(1)
    expect(mockOpen).toHaveBeenCalledWith('/users/42', '_blank')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('onClick ouvre un nouvel onglet sur Ctrl+clic', async () => {
    const navigate = vi.fn()
    const props = getClickableRowProps(navigate, '/users/42')

    const preventDefault = vi.fn()
    const event = {
      metaKey: false,
      ctrlKey: true,
      preventDefault,
    } as unknown as React.MouseEvent

    await act(async () => {
      props.onClick(event)
    })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(mockOpen).toHaveBeenCalledTimes(1)
    expect(mockOpen).toHaveBeenCalledWith('/users/42', '_blank')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('onKeyDown navigue sur Enter', async () => {
    const navigate = vi.fn()
    const props = getClickableRowProps(navigate, '/settings')

    const event = {
      key: 'Enter',
    } as unknown as React.KeyboardEvent

    await act(async () => {
      props.onKeyDown(event)
    })

    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/settings')
  })

  it('onKeyDown ignore les autres touches', async () => {
    const navigate = vi.fn()
    const props = getClickableRowProps(navigate, '/settings')

    const event = {
      key: ' ',
    } as unknown as React.KeyboardEvent

    await act(async () => {
      props.onKeyDown(event)
    })

    expect(navigate).not.toHaveBeenCalled()
  })
})