import React from 'react'
import { render, renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Hoisted stable mocks/spies and factories
const { MEASURE_SPY, MEASURE_ELEMENT_SPY, mockUseVirtualizer } = vi.hoisted(() => {
  const MEASURE_SPY = vi.fn()
  const MEASURE_ELEMENT_SPY = vi.fn((el: Element | null) => void el)
  const mockUseVirtualizer = vi.fn(
    (config: {
      count: number
      getScrollElement?: () => Element | null
      estimateSize?: (index: number) => number
      overscan?: number
      measureElement?: (el: Element) => number
    }) => {
      const count = Number(config.count ?? 0)
      const estimate = (index: number) => (config.estimateSize ? config.estimateSize(index) : 0)
      const virtualItems: Array<{ index: number; size: number; start: number; key: number }> = []
      let start = 0
      for (let i = 0; i < count; i++) {
        const size = estimate(i)
        virtualItems.push({ index: i, size, start, key: i })
        start += size
      }
      return {
        getVirtualItems: () => virtualItems,
        getTotalSize: () => start,
        measure: () => {
          MEASURE_SPY()
        },
        measureElement: (el: Element | null) => {
          MEASURE_ELEMENT_SPY(el)
        },
      }
    }
  )
  return { MEASURE_SPY, MEASURE_ELEMENT_SPY, mockUseVirtualizer }
})

// Mocks for external/internal dependencies
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: mockUseVirtualizer,
}))

vi.mock('@/lib/utils', () => {
  const cn = (...args: Array<string | undefined | null | false>) => args.filter(Boolean).join(' ')
  return { cn }
})

// Import the module under test
import { VirtualList, useVirtualInfiniteList } from './virtual-list'

afterEach(() => {
  vi.clearAllMocks()
})

function createWrapper(): React.FC<{ children: React.ReactNode }> {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('VirtualList component', () => {
  it('renders items with fixed height and correct total size and classes', () => {
    const items = Array.from({ length: 10 }, (_, i) => i)
    const itemHeight = 20
    const height = 100
    const { container } = render(
      <VirtualList<number>
        items={items}
        height={height}
        itemHeight={itemHeight}
        renderItem={(item, index) => <span>{`Row ${index}: ${item}`}</span>}
        className="custom-class"
        overscan={3}
      />
    )

    const parentDiv = container.firstElementChild as HTMLDivElement
    expect(parentDiv).toBeTruthy()
    expect(parentDiv.className).toContain('overflow-auto')
    expect(parentDiv.className).toContain('custom-class')
    expect(parentDiv.style.height).toBe('100px')

    const innerDiv = parentDiv.firstElementChild as HTMLDivElement
    expect(innerDiv).toBeTruthy()

    // total size = count * itemHeight
    const expectedTotal = items.length * itemHeight
    expect(innerDiv.style.height).toBe(`${expectedTotal}px`)

    const itemDivs = innerDiv.querySelectorAll('[data-index]')
    expect(itemDivs.length).toBe(items.length)

    // Check a few items have correct transform and height when dynamicHeight = false
    const firstItem = innerDiv.querySelector('[data-index="0"]') as HTMLDivElement
    const fourthItem = innerDiv.querySelector('[data-index="3"]') as HTMLDivElement
    expect(firstItem.style.transform).toBe('translateY(0px)')
    expect(firstItem.style.height).toBe(`${itemHeight}px`)
    expect(fourthItem.style.transform).toBe(`translateY(${3 * itemHeight}px)`)
    expect(fourthItem.style.height).toBe(`${itemHeight}px`)

    // measure should not be called when dynamicHeight is false
    expect(MEASURE_SPY).not.toHaveBeenCalled()
    expect(MEASURE_ELEMENT_SPY).not.toHaveBeenCalled()
  })

  it('calls measure and measureElement when dynamicHeight=true', () => {
    const items = Array.from({ length: 5 }, (_, i) => i)
    const itemHeight = 30
    const height = 200
    render(
      <VirtualList<number>
        items={items}
        height={height}
        itemHeight={itemHeight}
        renderItem={(item, index) => <span>{`Dyn ${index}: ${item}`}</span>}
        dynamicHeight={true}
      />
    )

    // measure should have been called due to useLayoutEffect
    expect(MEASURE_SPY).toHaveBeenCalledTimes(1)
    // measureElement should have been called for each rendered item via ref callback
    expect(MEASURE_ELEMENT_SPY.mock.calls.length).toBe(items.length)
    // Each call should have received an Element
    for (const call of MEASURE_ELEMENT_SPY.mock.calls) {
      expect(call[0]).toBeInstanceOf(HTMLElement)
    }
  })
})

describe('useVirtualInfiniteList hook', () => {
  it('includes loader row and triggers fetchNextPage when near end and not fetching', () => {
    const items = [1, 2, 3]
    const itemHeight = 20
    const fetchNextPage = vi.fn()

    const { result } = renderHook(
      () =>
        useVirtualInfiniteList<number>({
          items,
          height: 120,
          itemHeight,
          hasNextPage: true,
          fetchNextPage,
          isFetchingNextPage: false,
          overscan: 8,
        }),
      { wrapper: createWrapper() }
    )

    expect(fetchNextPage).toHaveBeenCalledTimes(1)
    // Should include loader row (count = items.length + 1)
    const virtualItems = result.current.virtualItems
    expect(virtualItems.length).toBe(items.length + 1)
    const last = virtualItems[virtualItems.length - 1]
    expect(last.index).toBe(items.length) // loader index

    // Total size includes loader size with 1.5x height
    const total = result.current.virtualizer.getTotalSize()
    const expectedTotal = items.length * itemHeight + 1.5 * itemHeight
    expect(total).toBe(expectedTotal)
  })

  it('does not trigger fetchNextPage when already fetching', () => {
    const items = [10, 20]
    const itemHeight = 25
    const fetchNextPage = vi.fn()

    renderHook(
      () =>
        useVirtualInfiniteList<number>({
          items,
          height: 80,
          itemHeight,
          hasNextPage: true,
          fetchNextPage,
          isFetchingNextPage: true,
        }),
      { wrapper: createWrapper() }
    )

    expect(fetchNextPage).not.toHaveBeenCalled()
  })

  it('does not trigger fetchNextPage when no next page', () => {
    const items = [5, 6, 7, 8]
    const itemHeight = 15
    const fetchNextPage = vi.fn()

    const { result } = renderHook(
      () =>
        useVirtualInfiniteList<number>({
          items,
          height: 100,
          itemHeight,
          hasNextPage: false,
          fetchNextPage,
          isFetchingNextPage: false,
        }),
      { wrapper: createWrapper() }
    )

    expect(fetchNextPage).not.toHaveBeenCalled()
    // No loader row when hasNextPage=false
    expect(result.current.virtualItems.length).toBe(items.length)
    const last = result.current.virtualItems[result.current.virtualItems.length - 1]
    expect(last.index).toBe(items.length - 1)
    const total = result.current.virtualizer.getTotalSize()
    const expectedTotal = items.length * itemHeight
    expect(total).toBe(expectedTotal)
  })
})