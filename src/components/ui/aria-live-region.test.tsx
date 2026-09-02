import React, { PropsWithChildren } from 'react'
import { render, screen, renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { cnMock } = vi.hoisted(() => {
  const cnImpl = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ')
  return { cnMock: vi.fn(cnImpl) }
})

vi.mock('@/lib/utils', () => ({ cn: cnMock }))

import { AriaLiveRegion, useAriaAnnounce } from './aria-live-region'

describe('AriaLiveRegion', () => {
  it('renders with default polite aria-live, merges className, and announces message after delay', async () => {
    vi.useFakeTimers()
    render(<AriaLiveRegion message="Bonjour" className="extra-class" />)

    const region = screen.getByRole('status')
    expect(region).toBeInTheDocument()
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveAttribute('aria-atomic', 'true')
    expect(region.textContent).toBe('')

    expect(cnMock).toHaveBeenCalled()
    expect(cnMock).toHaveBeenCalledWith('sr-only', 'extra-class')
    expect(region.className).toContain('sr-only')
    expect(region.className).toContain('extra-class')

    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(region.textContent).toBe('Bonjour')
    vi.useRealTimers()
  })

  it('supports assertive aria-live and announces', async () => {
    vi.useFakeTimers()
    render(<AriaLiveRegion message="Alerte" type="assertive" />)
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'assertive')
    expect(region.textContent).toBe('')
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(region.textContent).toBe('Alerte')
    vi.useRealTimers()
  })

  it('clears previous announcement before setting a new one when message changes', async () => {
    vi.useFakeTimers()
    const { rerender } = render(<AriaLiveRegion message="First" />)
    const region = screen.getByRole('status')

    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(region.textContent).toBe('First')

    rerender(<AriaLiveRegion message="Second" />)
    // The effect clears the announcement immediately on rerender
    expect(region.textContent).toBe('')

    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(region.textContent).toBe('Second')
    vi.useRealTimers()
  })
})

describe('useAriaAnnounce', () => {
  const createWrapper = () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })
    const Wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    return Wrapper
  }

  it('initializes with empty announcement and increments key on announce', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useAriaAnnounce(), { wrapper })

    expect(result.current.announcement).toEqual({ message: '', key: 0 })

    act(() => {
      result.current.announce('Hello')
    })
    expect(result.current.announcement.message).toBe('Hello')
    expect(result.current.announcement.key).toBe(1)

    act(() => {
      result.current.announce('World')
    })
    expect(result.current.announcement.message).toBe('World')
    expect(result.current.announcement.key).toBe(2)
  })
})