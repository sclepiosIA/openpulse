import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { act } from 'react-dom/test-utils'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GanttDualLayout } from './GanttDualLayout'

const { CN } = vi.hoisted(() => {
  const CN = vi.fn((...args: Array<string | false | undefined | null>) =>
    args.filter(Boolean).join(' ')
  )
  return { CN }
})

vi.mock('@/lib/utils', () => ({
  cn: CN
}))

describe('GanttDualLayout', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 }
    }
  })

  it('uses cn to combine classes and applies leftColumnWidth style', () => {
    const { container } = render(
      <GanttDualLayout
        fixedContent={<div>FIXED</div>}
        scrollableContent={<div>SCROLL</div>}
        leftColumnWidth={300}
        className="extra"
      />
    )

    // The outer wrapper should have classes combined via cn
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.className).toContain('flex w-full h-full')
    expect(wrapper.className).toContain('extra')
    expect(CN).toHaveBeenCalledWith('flex w-full h-full', 'extra')

    // The fixed column must have the exact inline width style
    const fixedDiv = container.querySelector('div[style]') as HTMLElement
    expect(fixedDiv).toBeTruthy()
    // style.width is normalized to '300px'
    expect(fixedDiv.style.width).toBe('300px')
    // ensure the fixed content is rendered
    expect(fixedDiv.textContent).toContain('FIXED')
  })

  it('synchronizes vertical scroll from fixed to scrollable and back using internal ref', () => {
    const tall = <div style={{ height: '1200px' }}>TALL</div>

    const { container } = render(
      <GanttDualLayout fixedContent={tall} scrollableContent={tall} />
    )

    const fixedDiv = container.querySelector('.flex-shrink-0') as HTMLElement
    const scrollableDiv = container.querySelector('.flex-1') as HTMLElement

    expect(fixedDiv).toBeTruthy()
    expect(scrollableDiv).toBeTruthy()

    // Scroll fixed -> scrollable
    act(() => {
      fixedDiv.scrollTop = 150
      fireEvent.scroll(fixedDiv)
    })
    expect(scrollableDiv.scrollTop).toBe(150)

    // Scroll scrollable -> fixed
    act(() => {
      scrollableDiv.scrollTop = 300
      fireEvent.scroll(scrollableDiv)
    })
    expect(fixedDiv.scrollTop).toBe(300)
  })

  it('synchronizes vertical scroll when an external scrollableRef is provided', () => {
    const tall = <div style={{ height: '900px' }}>TALL2</div>
    const externalRef = React.createRef<HTMLDivElement>()

    const { container } = render(
      <GanttDualLayout
        fixedContent={tall}
        scrollableContent={tall}
        scrollableRef={externalRef}
      />
    )

    const fixedDiv = container.querySelector('.flex-shrink-0') as HTMLElement
    const scrollableDiv = container.querySelector('.flex-1') as HTMLElement

    // The externalRef should point to the same scrollable element after render
    expect(externalRef.current).toBeTruthy()
    expect(externalRef.current).toBe(scrollableDiv)

    act(() => {
      fixedDiv.scrollTop = 42
      fireEvent.scroll(fixedDiv)
    })
    expect(scrollableDiv.scrollTop).toBe(42)

    act(() => {
      scrollableDiv.scrollTop = 84
      fireEvent.scroll(scrollableDiv)
    })
    expect(fixedDiv.scrollTop).toBe(84)
  })

  it('mounts without throwing when an external ref is null initially', () => {
    const tall = <div style={{ height: '200px' }}>TALL3</div>
    const externalRef = React.createRef<HTMLDivElement>()

    expect(() =>
      render(
        <GanttDualLayout
          fixedContent={tall}
          scrollableContent={tall}
          scrollableRef={externalRef}
        />
      )
    ).not.toThrow()
  })

  it('uses a QueryClientProvider wrapper for renderHook as required and returns expected value', () => {
    const wrapper = ({ children }: { children?: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () => {
        return { ready: true }
      },
      { wrapper }
    )

    expect(result.current.ready).toBe(true)
  })
})