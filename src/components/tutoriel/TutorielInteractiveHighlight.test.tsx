import React from 'react'
import { render, screen } from '@testing-library/react'

const { ZONES, CHILD_TEXT, mockCn } = vi.hoisted(() => {
  const ZONES = [
    { id: 'z1', x: 10, y: 20, width: 30, height: 40, stepNumber: 1, label: 'Step One', description: 'Desc one' },
    { id: 'z2', x: 50, y: 60, width: 20, height: 10, stepNumber: 2, label: 'Step Two' }
  ]
  const CHILD_TEXT = 'Inner content'
  const mockCn = (...args: unknown[]): string => {
    const parts: string[] = []
    args.forEach((a) => {
      if (typeof a === 'string' && a) parts.push(a)
    })
    return parts.join(' ')
  }
  return { ZONES, CHILD_TEXT, mockCn }
})

vi.mock('@/lib/utils', () => ({
  cn: mockCn
}))

import { TutorielInteractiveHighlight, TutorielSpotlight } from './TutorielInteractiveHighlight'

describe('TutorielInteractiveHighlight', () => {
  it('renders children and zones with correct positioning styles when inactive', () => {
    const { container } = render(
      <TutorielInteractiveHighlight zones={ZONES} className="extra-class">
        <div>{CHILD_TEXT}</div>
      </TutorielInteractiveHighlight>
    )

    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument()

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.className).toContain('relative')
    expect(wrapper.className).toContain('extra-class')

    const badge1 = screen.getByText(String(ZONES[0].stepNumber))
    const zone1 = badge1.parentElement as HTMLElement
    expect(zone1).toBeTruthy()
    expect(zone1.style.left).toBe(`${ZONES[0].x}%`)
    expect(zone1.style.top).toBe(`${ZONES[0].y}%`)
    expect(zone1.style.width).toBe(`${ZONES[0].width}%`)
    expect(zone1.style.height).toBe(`${ZONES[0].height}%`)
    expect(zone1.className).not.toContain('z-40')

    const badge2 = screen.getByText(String(ZONES[1].stepNumber))
    const zone2 = badge2.parentElement as HTMLElement
    expect(zone2).toBeTruthy()
    expect(zone2.style.left).toBe(`${ZONES[1].x}%`)
    expect(zone2.style.top).toBe(`${ZONES[1].y}%`)
    expect(zone2.style.width).toBe(`${ZONES[1].width}%`)
    expect(zone2.style.height).toBe(`${ZONES[1].height}%`)
    expect(zone2.className).not.toContain('z-40')

    expect(screen.queryByText(ZONES[0].label)).toBeNull()
    expect(screen.queryByText(ZONES[1].label)).toBeNull()
  })

  it('applies active styles and shows tooltip for active zone, toggles correctly', () => {
    const { rerender } = render(
      <TutorielInteractiveHighlight zones={ZONES} activeZone="z1">
        <div>{CHILD_TEXT}</div>
      </TutorielInteractiveHighlight>
    )

    const badge1 = screen.getByText('1')
    const zone1 = badge1.parentElement as HTMLElement
    expect(zone1.className).toContain('z-40')
    expect(badge1.className).toContain('scale-110')
    expect(screen.getByText(ZONES[0].label)).toBeInTheDocument()
    expect(screen.getByText(ZONES[0].description as string)).toBeInTheDocument()
    expect(zone1.innerHTML).toContain('animate-pulse')

    const badge2 = screen.getByText('2')
    const zone2 = badge2.parentElement as HTMLElement
    expect(zone2.className).not.toContain('z-40')
    expect(badge2.className).not.toContain('scale-110')
    expect(screen.queryByText(ZONES[1].label)).toBeNull()

    rerender(
      <TutorielInteractiveHighlight zones={ZONES} activeZone="z2">
        <div>{CHILD_TEXT}</div>
      </TutorielInteractiveHighlight>
    )

    // Now z1 is inactive, z2 is active
    const badge1b = screen.getByText('1')
    const zone1b = badge1b.parentElement as HTMLElement
    expect(zone1b.className).not.toContain('z-40')
    expect(badge1b.className).not.toContain('scale-110')
    expect(screen.queryByText(ZONES[0].label)).toBeNull()

    const badge2b = screen.getByText('2')
    const zone2b = badge2b.parentElement as HTMLElement
    expect(zone2b.className).toContain('z-40')
    expect(badge2b.className).toContain('scale-110')
    expect(screen.getByText(ZONES[1].label)).toBeInTheDocument()
  })

  it('renders description only when provided', () => {
    const { rerender } = render(
      <TutorielInteractiveHighlight zones={ZONES} activeZone="z1">
        <div>{CHILD_TEXT}</div>
      </TutorielInteractiveHighlight>
    )
    const badge1 = screen.getByText('1')
    const zone1 = badge1.parentElement as HTMLElement
    // label + description paragraphs in tooltip
    expect(zone1.querySelectorAll('p').length).toBe(2)

    rerender(
      <TutorielInteractiveHighlight zones={ZONES} activeZone="z2">
        <div>{CHILD_TEXT}</div>
      </TutorielInteractiveHighlight>
    )
    const badge2 = screen.getByText('2')
    const zone2 = badge2.parentElement as HTMLElement
    // only label paragraph in tooltip
    expect(zone2.querySelectorAll('p').length).toBe(1)
  })
})

describe('TutorielSpotlight', () => {
  it('returns only children when inactive', () => {
    const { container } = render(
      <TutorielSpotlight x={10} y={20} width={30} height={40} active={false}>
        <div>{CHILD_TEXT}</div>
      </TutorielSpotlight>
    )
    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('renders overlay with correct mask and attributes when active', () => {
    const { container } = render(
      <TutorielSpotlight x={15} y={25} width={35} height={45} active>
        <div>{CHILD_TEXT}</div>
      </TutorielSpotlight>
    )
    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument()

    const svg = container.querySelector('svg') as SVGElement
    expect(svg).toBeTruthy()

    const mask = container.querySelector('mask#spotlight-mask') as SVGMaskElement
    expect(mask).toBeTruthy()

    const innerRect = mask.querySelector('rect + rect') as SVGRectElement
    // The inner rect is the second rect inside mask (first is full white background)
    expect(innerRect).toBeTruthy()
    expect(innerRect.getAttribute('x')).toBe('15%')
    expect(innerRect.getAttribute('y')).toBe('25%')
    expect(innerRect.getAttribute('width')).toBe('35%')
    expect(innerRect.getAttribute('height')).toBe('45%')
    expect(innerRect.getAttribute('fill')).toBe('black')
    expect(innerRect.getAttribute('rx')).toBe('8')

    const overlayRect = svg.querySelector('rect[mask="url(#spotlight-mask)"]') as SVGRectElement
    expect(overlayRect).toBeTruthy()
    expect(overlayRect.getAttribute('width')).toBe('100%')
    expect(overlayRect.getAttribute('height')).toBe('100%')
    expect(overlayRect.getAttribute('fill')).toBe('rgba(0,0,0,0.6)')
  })
})