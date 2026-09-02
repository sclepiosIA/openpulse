import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act } from '@testing-library/react'

const { pushEntryMock, popEntryMock, updateLabelMock, mockUseVirtualBreadcrumb } = vi.hoisted(() => {
  const pushEntryMock = vi.fn()
  const popEntryMock = vi.fn()
  const updateLabelMock = vi.fn()
  const mockUseVirtualBreadcrumb = () => ({
    pushEntry: pushEntryMock,
    popEntry: popEntryMock,
    updateLabel: updateLabelMock
  })
  return { pushEntryMock, popEntryMock, updateLabelMock, mockUseVirtualBreadcrumb }
})

vi.mock('../shared/useVirtualBreadcrumb', () => ({
  useVirtualBreadcrumb: mockUseVirtualBreadcrumb
}))

import { useTabBreadcrumb } from './useTabBreadcrumb'

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 }
    }
  })
  return function Wrapper({ children }: { children?: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children)
  }
}

describe('useTabBreadcrumb', () => {
  beforeEach(() => {
    pushEntryMock.mockReset()
    popEntryMock.mockReset()
    updateLabelMock.mockReset()
  })

  it('pushes a breadcrumb entry with full label and parentPath, and clicking calls onTabChange with currentTab', () => {
    const onTabChange = vi.fn()
    const config = {
      pageLabel: 'Page',
      parentPath: '/parent',
      tabLabels: { details: 'Détails', other: 'Autre' },
      onTabChange
    }

    const wrapper = createWrapper()
    renderHook(() => useTabBreadcrumb(config, 'details', 'Sous-section'), { wrapper })

    expect(pushEntryMock).toHaveBeenCalledTimes(1)
    const [labelArg, clickCb, parentPathArg, typeArg] = pushEntryMock.mock.calls[0]
    expect(labelArg).toBe('Détails > Sous-section')
    expect(typeof clickCb).toBe('function')
    expect(parentPathArg).toBe('/parent')
    expect(typeArg).toBe('tab')

    act(() => {
      ;(clickCb as () => void)()
    })
    expect(onTabChange).toHaveBeenCalledTimes(1)
    expect(onTabChange).toHaveBeenCalledWith('details')
  })

  it('cleans up previous entry on tab change and pushes a new one with updated label', () => {
    const config = {
      pageLabel: 'Page',
      parentPath: '/section',
      tabLabels: { details: 'Détails', other: 'Autre' }
    }

    const wrapper = createWrapper()
    const { rerender } = renderHook(
      ({ tab, sub }: { tab: string; sub?: string }) => useTabBreadcrumb(config, tab, sub),
      { initialProps: { tab: 'details', sub: 'Intro' }, wrapper }
    )

    expect(pushEntryMock).toHaveBeenCalledTimes(1)
    expect(pushEntryMock.mock.calls[0][0]).toBe('Détails > Intro')

    rerender({ tab: 'other', sub: undefined })

    expect(popEntryMock).toHaveBeenCalledTimes(1)
    expect(pushEntryMock).toHaveBeenCalledTimes(2)
    expect(pushEntryMock.mock.calls[1][0]).toBe('Autre')
  })

  it('updates sub label using updateSubLabel with current tab label', () => {
    const config = {
      pageLabel: 'Page',
      parentPath: '/path',
      tabLabels: { info: 'Infos' }
    }

    const wrapper = createWrapper()
    const { result } = renderHook(() => useTabBreadcrumb(config, 'info'), { wrapper })

    act(() => {
      result.current.updateSubLabel('Profil')
    })

    expect(updateLabelMock).toHaveBeenCalledTimes(1)
    expect(updateLabelMock).toHaveBeenCalledWith('Infos > Profil')
  })

  it('wrapTabChange returns a function that delegates to the provided handler', () => {
    const config = {
      pageLabel: 'Page',
      parentPath: '/path',
      tabLabels: { a: 'A' }
    }

    const wrapper = createWrapper()
    const { result } = renderHook(() => useTabBreadcrumb(config, 'a'), { wrapper })

    const handler = vi.fn()
    const wrapped = result.current.wrapTabChange(handler)

    act(() => {
      wrapped('b')
    })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('b')
  })

  it('falls back to currentTab as label when not found in tabLabels', () => {
    const config = {
      pageLabel: 'Page',
      parentPath: '/p',
      tabLabels: { known: 'Connu' }
    }

    const wrapper = createWrapper()
    renderHook(() => useTabBreadcrumb(config, 'unknown', 'Sub'), { wrapper })

    expect(pushEntryMock).toHaveBeenCalledTimes(1)
    const [labelArg] = pushEntryMock.mock.calls[0]
    expect(labelArg).toBe('unknown > Sub')
  })

  it('re-pushes when only subLabel changes due to fullLabel dependency', () => {
    const config = {
      pageLabel: 'Page',
      parentPath: '/x',
      tabLabels: { t1: 'T1' }
    }

    const wrapper = createWrapper()
    const { rerender } = renderHook(
      ({ sub }: { sub?: string }) => useTabBreadcrumb(config, 't1', sub),
      { initialProps: { sub: 'One' }, wrapper }
    )

    expect(pushEntryMock).toHaveBeenCalledTimes(1)
    expect(pushEntryMock.mock.calls[0][0]).toBe('T1 > One')

    rerender({ sub: 'Two' })

    expect(popEntryMock).toHaveBeenCalledTimes(1)
    expect(pushEntryMock).toHaveBeenCalledTimes(2)
    expect(pushEntryMock.mock.calls[1][0]).toBe('T1 > Two')
  })
})