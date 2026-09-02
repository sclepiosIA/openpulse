// @vitest-environment jsdom

import React from 'react'
import { render, screen } from '@testing-library/react'
import {
  JarvisTypingDots,
  JarvisWaveIndicator,
  JarvisOrbitalLoader,
  JarvisPulseRing,
} from './JarvisAnimations'

type MotionCall = {
  tag: string
  props: Record<string, unknown>
}

const { motionCalls, cnMock } = vi.hoisted(() => ({
  motionCalls: [] as MotionCall[],
  cnMock: vi.fn((...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' ')
  ),
}))

vi.mock('@/lib/utils', () => ({
  cn: cnMock,
}))

vi.mock('framer-motion', async () => {
  const ReactModule = await import('react')

  const makeMotionComponent = (tag: string) =>
    ReactModule.forwardRef<HTMLElement, Record<string, unknown>>(function MotionMock(props, ref) {
      motionCalls.push({ tag, props })
      const { children, ...domProps } = props
      return ReactModule.createElement(tag, { ...domProps, ref }, children)
    })

  return {
    motion: {
      div: makeMotionComponent('div'),
    },
  }
})

describe('JarvisAnimations', () => {
  beforeEach(() => {
    motionCalls.length = 0
    cnMock.mockClear()
  })

  describe('JarvisTypingDots', () => {
    it('renders 3 dots with default size, color and staggered animations', () => {
      const { container } = render(<JarvisTypingDots />)

      const root = container.firstElementChild
      expect(root).not.toBeNull()
      expect(root?.className).toContain('flex items-center')
      expect(root?.className).toContain('gap-1.5')

      const dots = container.querySelectorAll('.rounded-full')
      expect(dots).toHaveLength(3)

      const dotCalls = motionCalls.filter((call) => {
        const className = typeof call.props.className === 'string' ? call.props.className : ''
        return className.includes('rounded-full') && className.includes('bg-primary')
      })

      expect(dotCalls).toHaveLength(3)
      expect(dotCalls[0]?.props.className).toContain('w-2 h-2')
      expect(dotCalls[1]?.props.className).toContain('w-2 h-2')
      expect(dotCalls[2]?.props.className).toContain('w-2 h-2')

      expect(dotCalls[0]?.props.animate).toEqual({
        scale: [1, 1.4, 1],
        opacity: [0.4, 1, 0.4],
      })

      expect(dotCalls[0]?.props.transition).toMatchObject({
        duration: 1,
        repeat: Infinity,
        delay: 0,
        ease: 'easeInOut',
      })
      expect(dotCalls[1]?.props.transition).toMatchObject({
        duration: 1,
        repeat: Infinity,
        delay: 0.15,
        ease: 'easeInOut',
      })
      expect(dotCalls[2]?.props.transition).toMatchObject({
        duration: 1,
        repeat: Infinity,
        delay: 0.3,
        ease: 'easeInOut',
      })
    })

    it('applies custom size, color and className', () => {
      const { container } = render(
        <JarvisTypingDots size="lg" color="white" className="extra-class" />
      )

      const root = container.firstElementChild
      expect(root?.className).toContain('gap-2')
      expect(root?.className).toContain('extra-class')

      const dotCalls = motionCalls.filter((call) => {
        const className = typeof call.props.className === 'string' ? call.props.className : ''
        return className.includes('rounded-full') && className.includes('bg-card')
      })

      expect(dotCalls).toHaveLength(3)
      for (const call of dotCalls) {
        expect(call.props.className).toContain('w-2.5 h-2.5')
        expect(call.props.className).toContain('bg-card')
      }
    })
  })

  describe('JarvisWaveIndicator', () => {
    it('renders 5 active bars with animated heights', () => {
      const { container } = render(<JarvisWaveIndicator className="wave-wrap" isActive />)

      const root = container.firstElementChild
      expect(root?.className).toContain('flex items-center justify-center gap-0.5 h-6')
      expect(root?.className).toContain('wave-wrap')

      const barCalls = motionCalls.filter((call) => {
        const className = typeof call.props.className === 'string' ? call.props.className : ''
        return className.includes('w-1 bg-primary rounded-full')
      })

      expect(barCalls).toHaveLength(5)
      expect(barCalls[0]?.props.animate).toEqual({
        height: ['8px', '20px', '8px'],
      })
      expect(barCalls[0]?.props.transition).toMatchObject({
        duration: 0.6,
        repeat: Infinity,
        delay: 0,
        ease: 'easeInOut',
      })
      expect(barCalls[4]?.props.transition).toMatchObject({
        delay: 0.32,
      })

      expect(container.querySelectorAll('.w-1.bg-primary.rounded-full')).toHaveLength(5)
    })

    it('renders inactive bars with fixed height animation', () => {
      render(<JarvisWaveIndicator isActive={false} />)

      const barCalls = motionCalls.filter((call) => {
        const className = typeof call.props.className === 'string' ? call.props.className : ''
        return className.includes('w-1 bg-primary rounded-full')
      })

      expect(barCalls).toHaveLength(5)
      for (const call of barCalls) {
        expect(call.props.animate).toEqual({
          height: '8px',
        })
      }
    })
  })

  describe('JarvisOrbitalLoader', () => {
    it('renders rings, orbiting dots and center core with correct size and animations', () => {
      const { container } = render(<JarvisOrbitalLoader size={60} className="orbital-wrap" />)

      const root = container.firstElementChild as HTMLElement | null
      expect(root).not.toBeNull()
      expect(root?.className).toContain('relative')
      expect(root?.className).toContain('orbital-wrap')
      expect(root?.style.width).toBe('60px')
      expect(root?.style.height).toBe('60px')

      const outerRing = motionCalls.find(
        (call) =>
          call.props.className === 'absolute inset-0 rounded-full border-2 border-primary/20'
      )
      expect(outerRing?.props.animate).toEqual({ rotate: 360 })
      expect(outerRing?.props.transition).toEqual({
        duration: 3,
        repeat: Infinity,
        ease: 'linear',
      })

      const middleRing = motionCalls.find(
        (call) =>
          call.props.className === 'absolute inset-1 rounded-full border-2 border-primary/40'
      )
      expect(middleRing?.props.animate).toEqual({ rotate: -360 })
      expect(middleRing?.props.transition).toEqual({
        duration: 2,
        repeat: Infinity,
        ease: 'linear',
      })

      const orbitDots = motionCalls.filter(
        (call) => call.props.className === 'absolute w-2 h-2 bg-primary rounded-full'
      )
      expect(orbitDots).toHaveLength(3)

      const radius = 60 / 2 - 6
      orbitDots.forEach((dot, i) => {
        const animate = dot.props.animate as {
          x: number[]
          y: number[]
          opacity: number[]
        }
        const transition = dot.props.transition as {
          duration: number
          repeat: number
          delay: number
          ease: string
        }

        expect(animate.opacity).toEqual([1, 0.5, 1])
        expect(animate.x).toHaveLength(3)
        expect(animate.y).toHaveLength(3)

        expect(animate.x[0]).toBeCloseTo(Math.cos((i * 2 * Math.PI) / 3) * radius, 10)
        expect(animate.x[1]).toBeCloseTo(Math.cos((i * 2 * Math.PI) / 3 + Math.PI) * radius, 10)
        expect(animate.x[2]).toBeCloseTo(Math.cos((i * 2 * Math.PI) / 3 + 2 * Math.PI) * radius, 10)

        expect(animate.y[0]).toBeCloseTo(Math.sin((i * 2 * Math.PI) / 3) * radius, 10)
        expect(animate.y[1]).toBeCloseTo(Math.sin((i * 2 * Math.PI) / 3 + Math.PI) * radius, 10)
        expect(animate.y[2]).toBeCloseTo(Math.sin((i * 2 * Math.PI) / 3 + 2 * Math.PI) * radius, 10)

        expect(transition).toMatchObject({
          duration: 2,
          repeat: Infinity,
          delay: i * 0.2,
          ease: 'easeInOut',
        })
      })

      const firstDotStyle = orbitDots[0]?.props.style as Record<string, string> | undefined
      expect(firstDotStyle).toMatchObject({
        top: '50%',
        left: '50%',
        marginTop: '-4px',
        marginLeft: '-4px',
      })

      const centerCore = motionCalls.find(
        (call) =>
          call.props.className ===
          'absolute inset-0 m-auto w-3 h-3 rounded-full bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/40'
      )
      expect(centerCore?.props.animate).toEqual({
        scale: [1, 1.2, 1],
      })
      expect(centerCore?.props.transition).toEqual({ duration: 1.5, repeat: Infinity })
    })
  })

  describe('JarvisPulseRing', () => {
    it('renders primary pulse rings and core glow by default', () => {
      const { container } = render(<JarvisPulseRing />)

      const root = container.firstElementChild as HTMLElement | null
      expect(root?.className).toContain('relative flex items-center justify-center')
      expect(root?.style.width).toBe('48px')
      expect(root?.style.height).toBe('48px')

      const pulseCalls = motionCalls.filter((call) => {
        const className = typeof call.props.className === 'string' ? call.props.className : ''
        return (
          className.includes('absolute inset-0 rounded-full') && className.includes('bg-primary')
        )
      })

      expect(pulseCalls).toHaveLength(3)
      expect(pulseCalls[0]?.props.animate).toEqual({
        scale: [1, 1.5],
        opacity: [0.4, 0],
      })
      expect(pulseCalls[1]?.props.animate).toEqual({
        scale: [1, 1.7],
        opacity: [0.30000000000000004, 0],
      })
      expect(pulseCalls[2]?.props.animate).toEqual({
        scale: [1, 1.9],
        opacity: [0.2, 0],
      })
      expect(pulseCalls[0]?.props.transition).toMatchObject({
        duration: 2,
        repeat: Infinity,
        delay: 0,
        ease: 'easeOut',
      })
      expect(pulseCalls[1]?.props.transition).toMatchObject({ delay: 0.4 })
      expect(pulseCalls[2]?.props.transition).toMatchObject({ delay: 0.8 })

      const core = motionCalls.find((call) => {
        const className = typeof call.props.className === 'string' ? call.props.className : ''
        return (
          className.includes('relative w-1/3 h-1/3 rounded-full') &&
          className.includes('bg-primary') &&
          className.includes('shadow-lg')
        )
      })

      expect(core?.props.animate).toEqual({
        scale: [1, 1.1, 1],
      })
      expect(core?.props.transition).toEqual({ duration: 1, repeat: Infinity })

      const coreStyle = core?.props.style as { boxShadow?: string } | undefined
      expect(coreStyle?.boxShadow).toBe('0 0 20px hsl(var(--primary) / 0.5)')

      expect(container.querySelectorAll('.bg-primary')).toHaveLength(4)
    })

    it('renders success variant with custom size and emerald glow', () => {
      const { container } = render(
        <JarvisPulseRing size={72} color="success" className="success-ring" />
      )

      const root = container.firstElementChild as HTMLElement | null
      expect(root?.style.width).toBe('72px')
      expect(root?.style.height).toBe('72px')
      expect(root?.className).toContain('success-ring')

      const pulseCalls = motionCalls.filter((call) => {
        const className = typeof call.props.className === 'string' ? call.props.className : ''
        return className.includes('bg-emerald-500')
      })

      expect(pulseCalls).toHaveLength(4)

      const core = pulseCalls.find((call) => {
        const className = typeof call.props.className === 'string' ? call.props.className : ''
        return className.includes('relative w-1/3 h-1/3 rounded-full')
      })

      const coreStyle = core?.props.style as { boxShadow?: string } | undefined
      expect(coreStyle?.boxShadow).toBe('0 0 20px rgb(16 185 129 / 0.5)')
    })

    it('renders warning variant with amber glow', () => {
      render(<JarvisPulseRing color="warning" />)

      const warningCore = motionCalls.find((call) => {
        const className = typeof call.props.className === 'string' ? call.props.className : ''
        return (
          className.includes('relative w-1/3 h-1/3 rounded-full') &&
          className.includes('bg-amber-500')
        )
      })

      expect(warningCore).toBeTruthy()
      const coreStyle = warningCore?.props.style as { boxShadow?: string } | undefined
      expect(coreStyle?.boxShadow).toBe('0 0 20px rgb(245 158 11 / 0.5)')
    })
  })

  it('uses cn helper to compose classes across components', () => {
    render(
      <>
        <JarvisTypingDots className="dots" />
        <JarvisWaveIndicator className="wave" />
        <JarvisOrbitalLoader className="orbital" />
        <JarvisPulseRing className="pulse" />
      </>
    )

    expect(cnMock).toHaveBeenCalled()

    const calls = cnMock.mock.calls.map((args) => args.join(' '))
    expect(
      calls.some((value) => value.includes('flex items-center') && value.includes('dots'))
    ).toBe(true)
    expect(calls.some((value) => value.includes('justify-center') && value.includes('wave'))).toBe(
      true
    )
    expect(calls.some((value) => value.includes('relative') && value.includes('orbital'))).toBe(
      true
    )
    expect(
      calls.some(
        (value) =>
          value.includes('relative flex items-center justify-center') && value.includes('pulse')
      )
    ).toBe(true)

    expect(screen.queryAllByText('')).toBeDefined()
  })
})
