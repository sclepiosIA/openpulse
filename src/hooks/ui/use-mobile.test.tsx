import * as React from "react"
import type { ReactNode } from "react"
import { renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useIsMobile } from "./use-mobile"

const MOBILE_BREAKPOINT = 768

type StoredListener =
  | EventListenerOrEventListenerObject
  | ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown)

type TestMediaQueryList = Omit<MediaQueryList, "matches"> & {
  matches: boolean
  listeners: Set<StoredListener>
}

const mediaQueryLists: TestMediaQueryList[] = []

const testState = {
  matchMediaMock: vi.fn<(query: string) => MediaQueryList>(),
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  })
}

function createMediaQueryList(query: string): TestMediaQueryList {
  const listeners = new Set<StoredListener>()

  const mql: TestMediaQueryList = {
    media: query,
    matches: window.innerWidth < MOBILE_BREAKPOINT,
    onchange: null,
    listeners,
    addEventListener(type: string, listener: StoredListener | null): void {
      if (type === "change" && listener !== null) {
        listeners.add(listener)
      }
    },
    removeEventListener(type: string, listener: StoredListener | null): void {
      if (type === "change" && listener !== null) {
        listeners.delete(listener)
      }
    },
    addListener(listener: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null): void {
      if (listener !== null) {
        listeners.add(listener)
      }
    },
    removeListener(listener: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null): void {
      if (listener !== null) {
        listeners.delete(listener)
      }
    },
    dispatchEvent(event: Event): boolean {
      mql.matches = window.innerWidth < MOBILE_BREAKPOINT
      const mediaEvent = event as MediaQueryListEvent

      if (typeof mql.onchange === "function") {
        mql.onchange.call(mql, mediaEvent)
      }

      listeners.forEach((listener) => {
        if (typeof listener === "function") {
          listener.call(mql, mediaEvent)
        } else {
          listener.handleEvent(event)
        }
      })

      return true
    },
  }

  mediaQueryLists.push(mql)
  return mql
}

function getFirstMediaQueryList(): TestMediaQueryList {
  const mql = mediaQueryLists[0]

  if (mql === undefined) {
    throw new Error("Expected matchMedia to have been called")
  }

  return mql
}

beforeEach(() => {
  mediaQueryLists.length = 0
  setViewportWidth(1024)

  testState.matchMediaMock = vi.fn((query: string): MediaQueryList => createMediaQueryList(query))

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: testState.matchMediaMock,
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("useIsMobile", () => {
  it("returns true immediately when the initial viewport is below the mobile breakpoint", () => {
    setViewportWidth(375)

    const { result } = renderHook(() => useIsMobile(), {
      wrapper: createWrapper(),
    })

    expect(result.current).toBe(true)
    expect(testState.matchMediaMock).toHaveBeenCalledWith("(max-width: 767px)")
    expect(getFirstMediaQueryList().listeners.size).toBe(1)
  })

  it("returns false immediately when the initial viewport is at or above the mobile breakpoint", () => {
    setViewportWidth(768)

    const { result } = renderHook(() => useIsMobile(), {
      wrapper: createWrapper(),
    })

    expect(result.current).toBe(false)
    expect(testState.matchMediaMock).toHaveBeenCalledTimes(1)
    expect(testState.matchMediaMock).toHaveBeenCalledWith("(max-width: 767px)")
  })

  it("updates when the viewport crosses the mobile breakpoint", () => {
    setViewportWidth(1024)

    const { result } = renderHook(() => useIsMobile(), {
      wrapper: createWrapper(),
    })

    const mql = getFirstMediaQueryList()

    expect(result.current).toBe(false)

    act(() => {
      setViewportWidth(500)
      mql.dispatchEvent(new Event("change"))
    })

    expect(result.current).toBe(true)

    act(() => {
      setViewportWidth(768)
      mql.dispatchEvent(new Event("change"))
    })

    expect(result.current).toBe(false)

    act(() => {
      setViewportWidth(767)
      mql.dispatchEvent(new Event("change"))
    })

    expect(result.current).toBe(true)
  })

  it("removes the media query change listener on unmount", () => {
    setViewportWidth(640)

    const { unmount } = renderHook(() => useIsMobile(), {
      wrapper: createWrapper(),
    })

    const mql = getFirstMediaQueryList()

    expect(mql.listeners.size).toBe(1)

    unmount()

    expect(mql.listeners.size).toBe(0)
  })
})