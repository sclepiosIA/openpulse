/* @vitest-environment jsdom */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TutorielBeforeAfter, TutorielComparison } from './TutorielBeforeAfter'

const { mockCn } = vi.hoisted(() => ({
  mockCn: vi.fn((...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' ')
  ),
}))

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('TutorielBeforeAfter', () => {
  it('renders horizontal comparison with default labels and default position', () => {
    const { container } = render(
      <TutorielBeforeAfter before={<div>Before content</div>} after={<div>After content</div>} />
    )

    expect(screen.getByText('Before content')).toBeInTheDocument()
    expect(screen.getByText('After content')).toBeInTheDocument()
    expect(screen.getByText('Avant')).toBeInTheDocument()
    expect(screen.getByText('Après')).toBeInTheDocument()

    const root = container.firstElementChild
    expect(root).toBeInstanceOf(HTMLElement)
    expect((root as HTMLElement).className).toContain('cursor-ew-resize')
    expect((root as HTMLElement).className).not.toContain('cursor-ns-resize')

    const clipped = container.querySelector('.absolute.inset-0.overflow-hidden')
    expect(clipped).toBeInstanceOf(HTMLElement)
    expect((clipped as HTMLElement).style.clipPath).toBe('inset(0 50% 0 0)')

    const divider = container.querySelector('.absolute.bg-card.shadow-lg.z-10')
    expect(divider).toBeInstanceOf(HTMLElement)
    expect((divider as HTMLElement).style.left).toBe('50%')
    expect((divider as HTMLElement).style.transform).toBe('translateX(-50%)')
    expect((divider as HTMLElement).className).toContain('w-1')
    expect((divider as HTMLElement).className).toContain('h-full')
    expect((divider as HTMLElement).className).toContain('top-0')
  })

  it('updates horizontal position on mouse move and clamps between 5 and 95', () => {
    const { container } = render(
      <TutorielBeforeAfter
        before={<div>Before</div>}
        after={<div>After</div>}
        defaultPosition={40}
      />
    )

    const root = container.firstElementChild as HTMLDivElement
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      x: 10,
      y: 20,
      left: 10,
      top: 20,
      right: 210,
      bottom: 120,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    })

    fireEvent.mouseMove(root, { clientX: 110, clientY: 60 })

    let clipped = container.querySelector('.absolute.inset-0.overflow-hidden') as HTMLElement
    let divider = container.querySelector('.absolute.bg-card.shadow-lg.z-10') as HTMLElement
    expect(clipped.style.clipPath).toBe('inset(0 50% 0 0)')
    expect(divider.style.left).toBe('50%')

    fireEvent.mouseMove(root, { clientX: 0, clientY: 60 })

    clipped = container.querySelector('.absolute.inset-0.overflow-hidden') as HTMLElement
    divider = container.querySelector('.absolute.bg-card.shadow-lg.z-10') as HTMLElement
    expect(clipped.style.clipPath).toBe('inset(0 95% 0 0)')
    expect(divider.style.left).toBe('5%')

    fireEvent.mouseMove(root, { clientX: 400, clientY: 60 })

    clipped = container.querySelector('.absolute.inset-0.overflow-hidden') as HTMLElement
    divider = container.querySelector('.absolute.bg-card.shadow-lg.z-10') as HTMLElement
    expect(clipped.style.clipPath).toBe('inset(0 5% 0 0)')
    expect(divider.style.left).toBe('95%')
  })

  it('renders vertical mode with custom labels, className and updates top position on mouse move', () => {
    const { container } = render(
      <TutorielBeforeAfter
        before={<div>Ancien</div>}
        after={<div>Nouveau</div>}
        beforeLabel="Avant custom"
        afterLabel="Après custom"
        direction="vertical"
        className="custom-class"
        defaultPosition={30}
      />
    )

    expect(screen.getByText('Avant custom')).toBeInTheDocument()
    expect(screen.getByText('Après custom')).toBeInTheDocument()

    const root = container.firstElementChild as HTMLDivElement
    expect(root.className).toContain('cursor-ns-resize')
    expect(root.className).toContain('custom-class')

    let clipped = container.querySelector('.absolute.inset-0.overflow-hidden') as HTMLElement
    let divider = container.querySelector('.absolute.bg-card.shadow-lg.z-10') as HTMLElement

    expect(clipped.style.clipPath).toBe('inset(0 0 70% 0)')
    expect(divider.style.top).toBe('30%')
    expect(divider.style.transform).toBe('translateY(-50%)')
    expect(divider.className).toContain('h-1')
    expect(divider.className).toContain('w-full')
    expect(divider.className).toContain('left-0')

    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 100,
      bottom: 200,
      width: 100,
      height: 200,
      toJSON: () => ({}),
    })

    fireEvent.mouseMove(root, { clientX: 20, clientY: 50 })

    clipped = container.querySelector('.absolute.inset-0.overflow-hidden') as HTMLElement
    divider = container.querySelector('.absolute.bg-card.shadow-lg.z-10') as HTMLElement
    expect(clipped.style.clipPath).toBe('inset(0 0 75% 0)')
    expect(divider.style.top).toBe('25%')

    fireEvent.mouseMove(root, { clientX: 20, clientY: 500 })

    clipped = container.querySelector('.absolute.inset-0.overflow-hidden') as HTMLElement
    divider = container.querySelector('.absolute.bg-card.shadow-lg.z-10') as HTMLElement
    expect(clipped.style.clipPath).toBe('inset(0 0 5% 0)')
    expect(divider.style.top).toBe('95%')
  })

  it('renders the correct svg arrows depending on direction', () => {
    const { container, rerender } = render(
      <TutorielBeforeAfter before={<div>b</div>} after={<div>a</div>} direction="horizontal" />
    )

    let paths = Array.from(container.querySelectorAll('svg path')).map((p) => p.getAttribute('d'))
    expect(paths).toEqual(['M18 8l4 4-4 4', 'M6 8l-4 4 4 4'])

    rerender(
      <TutorielBeforeAfter before={<div>b</div>} after={<div>a</div>} direction="vertical" />
    )

    paths = Array.from(container.querySelectorAll('svg path')).map((p) => p.getAttribute('d'))
    expect(paths).toEqual(['M8 6l4-4 4 4', 'M8 18l4 4 4-4'])
  })

  it('positions labels differently in vertical mode', () => {
    const { container } = render(
      <TutorielBeforeAfter
        before={<div>Ancien</div>}
        after={<div>Nouveau</div>}
        direction="vertical"
      />
    )

    const beforeLabel = screen.getByText('Avant').closest('div')
    const afterLabel = screen.getByText('Après').closest('div')

    expect(beforeLabel).toBeInstanceOf(HTMLElement)
    expect(afterLabel).toBeInstanceOf(HTMLElement)
    expect((beforeLabel as HTMLElement).className).toContain('top-3')
    expect((beforeLabel as HTMLElement).className).toContain('left-3')
    expect((afterLabel as HTMLElement).className).toContain('bottom-3')
    expect((afterLabel as HTMLElement).className).toContain('right-3')

    const handle = container.querySelector('.rounded-full.shadow-lg.border-2.border-primary')
    expect(handle).toBeInstanceOf(HTMLElement)
    expect((handle as HTMLElement).className).toContain('w-8')
    expect((handle as HTMLElement).className).toContain('h-8')
  })

  it('has the expected displayName and can render inside a QueryClientProvider wrapper', () => {
    expect(TutorielBeforeAfter.displayName).toBe('TutorielBeforeAfter')

    const wrapper = createWrapper()
    const { result } = renderHook(() => TutorielBeforeAfter.displayName, { wrapper })

    expect(result.current).toBe('TutorielBeforeAfter')
  })
})

describe('TutorielComparison', () => {
  it('renders side-by-side comparison with default labels and content', () => {
    const { container } = render(
      <TutorielComparison before={<div>État avant</div>} after={<div>État après</div>} />
    )

    expect(screen.getByText('Avant')).toBeInTheDocument()
    expect(screen.getByText('Après')).toBeInTheDocument()
    expect(screen.getByText('État avant')).toBeInTheDocument()
    expect(screen.getByText('État après')).toBeInTheDocument()

    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('grid')
    expect(root.className).toContain('grid-cols-2')
    expect(root.className).toContain('gap-4')

    const beforeLabel = screen.getByText('Avant')
    const afterLabel = screen.getByText('Après')

    const beforeOuter = beforeLabel.closest('.rounded-xl')
    const afterOuter = afterLabel.closest('.rounded-xl')
    expect(beforeOuter).toBeInstanceOf(HTMLElement)
    expect(afterOuter).toBeInstanceOf(HTMLElement)
    expect((beforeOuter as HTMLElement).className).toContain('border-destructive/30')
    expect((afterOuter as HTMLElement).className).toContain('border-success/30')

    const beforeContentWrapper = screen.getByText('État avant').parentElement
    const afterContentWrapper = screen.getByText('État après').parentElement
    expect(beforeContentWrapper).toBeInstanceOf(HTMLElement)
    expect(afterContentWrapper).toBeInstanceOf(HTMLElement)
    expect((beforeContentWrapper as HTMLElement).className).toContain('p-4')
    expect((afterContentWrapper as HTMLElement).className).toContain('p-4')
  })

  it('renders custom labels, className and displayName correctly', () => {
    const { container } = render(
      <TutorielComparison
        before={<div>Old</div>}
        after={<div>New</div>}
        beforeLabel="Avant perso"
        afterLabel="Après perso"
        className="wrapper-class"
      />
    )

    expect(screen.getByText('Avant perso')).toBeInTheDocument()
    expect(screen.getByText('Après perso')).toBeInTheDocument()
    expect(screen.getByText('Old')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()

    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('wrapper-class')
    expect(TutorielComparison.displayName).toBe('TutorielComparison')
  })
})
