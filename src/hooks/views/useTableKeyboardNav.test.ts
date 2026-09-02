import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import { createElement, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject, type PropsWithChildren } from 'react'
import { useTableKeyboardNav } from './useTableKeyboardNav'

let scrollIntoViewMock = vi.fn()

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function setupHook(opts?: { autoFocusFirst?: boolean }) {
  const rendered = renderHook(() => useTableKeyboardNav<HTMLDivElement>(opts), {
    wrapper: createWrapper(),
  })

  const container = document.createElement('div')
  container.tabIndex = -1
  document.body.appendChild(container)

  const ref = rendered.result.current.containerRef as MutableRefObject<HTMLDivElement | null>
  ref.current = container

  return { ...rendered, container }
}

function createRow(label: string): HTMLButtonElement {
  const row = document.createElement('button')
  row.type = 'button'
  row.tabIndex = 0
  row.dataset.rowNav = 'true'
  row.textContent = label
  return row
}

function createKeyboardEvent(key: string, target: HTMLElement) {
  const preventDefault = vi.fn()
  const event = {
    key,
    target,
    preventDefault,
  } as unknown as ReactKeyboardEvent

  return { event, preventDefault }
}

function sendKey(handler: (event: ReactKeyboardEvent) => void, key: string, target: HTMLElement) {
  const { event, preventDefault } = createKeyboardEvent(key, target)

  act(() => {
    handler(event)
  })

  return preventDefault
}

beforeEach(() => {
  document.body.innerHTML = ''
  scrollIntoViewMock = vi.fn()
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoViewMock,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('useTableKeyboardNav', () => {
  it('returns a ref and a keyboard handler', () => {
    const { result } = renderHook(() => useTableKeyboardNav<HTMLDivElement>(), {
      wrapper: createWrapper(),
    })

    expect(result.current.containerRef.current).toBeNull()
    expect(typeof result.current.onKeyDown).toBe('function')
  })

  it('navigates only data-row-nav rows with arrows, vim keys, Home and End', () => {
    const { result, container } = setupHook()
    const first = createRow('First row')
    const ignored = document.createElement('button')
    ignored.type = 'button'
    ignored.tabIndex = 0
    ignored.textContent = 'Ignored row'
    const second = createRow('Second row')
    const third = createRow('Third row')

    container.append(first, ignored, second, third)

    first.focus()
    expect(document.activeElement).toBe(first)

    const arrowDownPreventDefault = sendKey(result.current.onKeyDown, 'ArrowDown', first)
    expect(arrowDownPreventDefault).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(second)
    expect(document.activeElement).not.toBe(ignored)
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith({ block: 'nearest', behavior: 'smooth' })

    const jPreventDefault = sendKey(result.current.onKeyDown, 'j', second)
    expect(jPreventDefault).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(third)

    const boundedArrowDownPreventDefault = sendKey(result.current.onKeyDown, 'ArrowDown', third)
    expect(boundedArrowDownPreventDefault).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(third)

    const homePreventDefault = sendKey(result.current.onKeyDown, 'Home', third)
    expect(homePreventDefault).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(first)

    const endPreventDefault = sendKey(result.current.onKeyDown, 'End', first)
    expect(endPreventDefault).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(third)

    const arrowUpPreventDefault = sendKey(result.current.onKeyDown, 'ArrowUp', third)
    expect(arrowUpPreventDefault).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(second)

    const kPreventDefault = sendKey(result.current.onKeyDown, 'k', second)
    expect(kPreventDefault).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(first)

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(7)
  })

  it('focuses the first row when a navigation key is pressed while focus is outside the row collection', () => {
    const { result, container } = setupHook()
    const first = createRow('First navigable row')
    const second = createRow('Second navigable row')
    const outside = document.createElement('button')
    outside.type = 'button'
    outside.textContent = 'Outside focus'

    container.append(first, second)
    document.body.appendChild(outside)

    outside.focus()
    expect(document.activeElement).toBe(outside)

    const preventDefault = sendKey(result.current.onKeyDown, 'ArrowUp', container)

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(first)
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith({ block: 'nearest', behavior: 'smooth' })
  })

  it('ignores typing targets and native Enter or Space activation keys', () => {
    const { result, container } = setupHook()
    const row = createRow('Focusable row')
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const select = document.createElement('select')
    const editable = document.createElement('div')
    editable.tabIndex = 0
    editable.contentEditable = 'true'
    Object.defineProperty(editable, 'isContentEditable', {
      configurable: true,
      value: true,
    })

    container.append(row, input, textarea, select, editable)

    for (const target of [input, textarea, select, editable]) {
      scrollIntoViewMock.mockClear()
      target.focus()

      const preventDefault = sendKey(result.current.onKeyDown, 'ArrowDown', target)

      expect(preventDefault).not.toHaveBeenCalled()
      expect(document.activeElement).toBe(target)
      expect(scrollIntoViewMock).not.toHaveBeenCalled()
    }

    row.focus()
    scrollIntoViewMock.mockClear()

    const enterPreventDefault = sendKey(result.current.onKeyDown, 'Enter', row)
    const spacePreventDefault = sendKey(result.current.onKeyDown, ' ', row)

    expect(enterPreventDefault).not.toHaveBeenCalled()
    expect(spacePreventDefault).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(row)
    expect(scrollIntoViewMock).not.toHaveBeenCalled()
  })

  it('does nothing when there is no container or no navigable rows', () => {
    const rendered = renderHook(() => useTableKeyboardNav<HTMLDivElement>(), {
      wrapper: createWrapper(),
    })
    const detachedTarget = document.createElement('div')
    document.body.appendChild(detachedTarget)

    const missingContainerPreventDefault = sendKey(rendered.result.current.onKeyDown, 'End', detachedTarget)

    expect(missingContainerPreventDefault).not.toHaveBeenCalled()
    expect(scrollIntoViewMock).not.toHaveBeenCalled()

    const emptyContainer = document.createElement('div')
    document.body.appendChild(emptyContainer)
    const ref = rendered.result.current.containerRef as MutableRefObject<HTMLDivElement | null>
    ref.current = emptyContainer

    const emptyRowsPreventDefault = sendKey(rendered.result.current.onKeyDown, 'Home', emptyContainer)

    expect(emptyRowsPreventDefault).not.toHaveBeenCalled()
    expect(scrollIntoViewMock).not.toHaveBeenCalled()
  })
})