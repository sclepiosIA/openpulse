import React from 'react'
import { renderHook, render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Stable mocks and references (vi.hoisted ensures stable references to avoid re-creation)
const {
  useIsMobileMock,
  cnMock,
  ButtonMock,
  InputMock,
  SeparatorMock,
  SkeletonMock,
  TooltipProviderMock,
  TooltipTriggerMock,
  TooltipContentMock,
  TooltipMock,
} = vi.hoisted(() => {
  // Simple stable implementations for UI primitives and utils
  const useIsMobileMock = vi.fn(() => false)

  const cnMock = (...args: Array<unknown>) =>
    args
      .flatMap((a) => (Array.isArray(a) ? a : [a]))
      .filter(Boolean)
      .join(' ')

  function ButtonMock(props: any) {
    // Render a native button and keep data attributes for queries
    const { children, ...rest } = props
    return React.createElement('button', { 'data-testid': 'mock-button', ...rest }, children)
  }

  function InputMock(props: any) {
    return React.createElement('input', { 'data-testid': 'mock-input', ...props })
  }

  function SeparatorMock(props: any) {
    return React.createElement('div', {
      'data-testid': 'mock-separator',
      role: 'separator',
      ...props,
    })
  }

  function SkeletonMock(props: any) {
    return React.createElement('div', { 'data-testid': 'mock-skeleton', ...props })
  }

  function TooltipProviderMock(props: any) {
    return React.createElement(React.Fragment, {}, props.children)
  }

  function TooltipTriggerMock(props: any) {
    return React.createElement(React.Fragment, {}, props.children)
  }

  function TooltipContentMock(props: any) {
    return React.createElement(React.Fragment, {}, props.children)
  }

  function TooltipMock(props: any) {
    return React.createElement(React.Fragment, {}, props.children)
  }

  return {
    useIsMobileMock,
    cnMock,
    ButtonMock,
    InputMock,
    SeparatorMock,
    SkeletonMock,
    TooltipProviderMock,
    TooltipTriggerMock,
    TooltipContentMock,
    TooltipMock,
  }
})

// Mock all internal @/... dependencies used by the module under test
vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: useIsMobileMock }))
vi.mock('@/lib/utils', () => ({ cn: cnMock }))
vi.mock('@/components/ui/button', () => ({ Button: ButtonMock }))
vi.mock('@/components/ui/input', () => ({ Input: InputMock }))
vi.mock('@/components/ui/separator', () => ({ Separator: SeparatorMock }))
vi.mock('@/components/ui/skeleton', () => ({ Skeleton: SkeletonMock }))
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: TooltipProviderMock,
  TooltipTrigger: TooltipTriggerMock,
  TooltipContent: TooltipContentMock,
  Tooltip: TooltipMock,
}))

// Mock lucide-react's PanelLeft used in SidebarTrigger to avoid rendering issues
vi.mock('lucide-react', () => ({
  PanelLeft: () => React.createElement('svg', { 'data-testid': 'panel-left' }),
}))

// Now import the module under test (must happen after vi.mock)
import * as SidebarModule from './sidebar'

describe('sidebar module', () => {
  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })

  beforeEach(() => {
    vi.clearAllMocks()
    // Clear cookies between tests
    // Setting document.cookie to empty string isn't sufficient to remove cookies,
    // but for the purpose of assertions below we set a fresh cookie string.
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    })
  })

  it('useSidebar throws when used outside SidebarProvider', () => {
    // Using renderHook without provider should throw the specific error
    expect(() => {
      renderHook(() => SidebarModule.useSidebar())
    }).toThrow('useSidebar must be used within a SidebarProvider.')
  })

  it('SidebarProvider provides context with default open and setOpen writes cookie and toggles state', async () => {
    // Ensure non-mobile environment
    useIsMobileMock.mockReturnValue(false)

    const wrapper = ({ children }: { children?: React.ReactNode }) => {
      const client = createQueryClient()
      return React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(SidebarModule.SidebarProvider, null, children)
      )
    }

    const { result } = renderHook(() => SidebarModule.useSidebar(), { wrapper })

    // Initial values coming from the provider defaultOpen=true
    expect(result.current.open).toBe(true)
    expect(result.current.state).toBe('expanded')
    expect(result.current.isMobile).toBe(false)
    expect(result.current.openMobile).toBe(false)

    // Toggle via setOpen(false) and assert cookie written and state updated
    act(() => {
      result.current.setOpen(false)
    })

    expect(result.current.open).toBe(false)
    expect(result.current.state).toBe('collapsed')
    expect(document.cookie).toEqual(expect.stringContaining('sidebar:state=false'))

    // Toggle back using toggleSidebar (non-mobile should flip open)
    act(() => {
      result.current.toggleSidebar()
    })

    expect(result.current.open).toBe(true)
    expect(result.current.state).toBe('expanded')

    // Simulate keyboard shortcut Ctrl+B to toggle sidebar
    act(() => {
      // dispatch keyboard event with ctrlKey
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }))
    })

    // After keyboard event, open should have toggled
    expect(result.current.open).toBe(false)
    expect(result.current.state).toBe('collapsed')
  })

  it('toggleSidebar updates openMobile when isMobile is true', () => {
    // Set mobile environment
    useIsMobileMock.mockReturnValue(true)

    const wrapper = ({ children }: { children?: React.ReactNode }) => {
      const client = createQueryClient()
      return React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(SidebarModule.SidebarProvider, null, children)
      )
    }

    const { result } = renderHook(() => SidebarModule.useSidebar(), { wrapper })

    // Initially not openMobile
    expect(result.current.isMobile).toBe(true)
    expect(result.current.openMobile).toBe(false)

    act(() => {
      result.current.toggleSidebar()
    })

    expect(result.current.openMobile).toBe(true)

    act(() => {
      result.current.toggleSidebar()
    })

    expect(result.current.openMobile).toBe(false)
  })

  it('Sidebar returns null on mobile (isMobile true) and renders on desktop', () => {
    // Mobile case: Sidebar should return null
    useIsMobileMock.mockReturnValue(true)

    const client = createQueryClient()
    const { container: mobileContainer } = render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(
          SidebarModule.SidebarProvider,
          null,
          React.createElement(SidebarModule.Sidebar, null, 'child')
        )
      )
    )

    // When mobile, Sidebar's early return means no element with data-sidebar present
    expect(mobileContainer.querySelector('[data-sidebar="sidebar"]')).toBeNull()
    expect(mobileContainer.textContent).not.toContain('child') // child not rendered inside sidebar

    // Desktop case: Sidebar should render its content
    useIsMobileMock.mockReturnValue(false)

    const { container: desktopContainer } = render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(
          SidebarModule.SidebarProvider,
          null,
          React.createElement(SidebarModule.Sidebar, null, 'child')
        )
      )
    )

    // On desktop there should be a container with data-sidebar="sidebar"
    const sidebarEl = desktopContainer.querySelector('[data-sidebar="sidebar"]')
    expect(sidebarEl).not.toBeNull()
    expect(desktopContainer.textContent).toContain('child')
  })

  it('SidebarTrigger click calls toggleSidebar and updates context open state', () => {
    useIsMobileMock.mockReturnValue(false)

    const client = createQueryClient()

    function Consumer() {
      const ctx = SidebarModule.useSidebar()
      return React.createElement(
        React.Fragment,
        null,
        React.createElement('span', { 'data-testid': 'state' }, ctx.open ? 'open' : 'closed'),
        React.createElement(SidebarModule.SidebarTrigger, null)
      )
    }

    const { getByTestId } = render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(
          SidebarModule.SidebarProvider,
          null,
          React.createElement(Consumer, null)
        )
      )
    )

    const stateSpan = getByTestId('state')
    const button = screen.getByTestId('mock-button')

    // Initially open
    expect(stateSpan.textContent).toBe('open')

    act(() => {
      fireEvent.click(button)
    })

    // After clicking the trigger, state should toggle to closed
    expect(stateSpan.textContent).toBe('closed')
  })

  it('SidebarRail onClick uses toggleSidebar (via button onClick)', () => {
    useIsMobileMock.mockReturnValue(false)

    const client = createQueryClient()

    function Consumer() {
      const ctx = SidebarModule.useSidebar()
      return React.createElement(
        React.Fragment,
        null,
        React.createElement('span', { 'data-testid': 'rail-state' }, ctx.open ? 'open' : 'closed'),
        React.createElement(SidebarModule.SidebarRail, null)
      )
    }

    const { getByTestId } = render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(
          SidebarModule.SidebarProvider,
          null,
          React.createElement(Consumer, null)
        )
      )
    )

    const stateSpan = getByTestId('rail-state')
    const railButton = screen.getByLabelText('Ouvrir/fermer le menu')

    // Initially open
    expect(stateSpan.textContent).toBe('open')

    act(() => {
      fireEvent.click(railButton)
    })

    // After clicking the rail, should toggle to closed
    expect(stateSpan.textContent).toBe('closed')
  })
})
