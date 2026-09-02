import React, { useState } from 'react'
import type { ButtonHTMLAttributes, ChangeEvent, InputHTMLAttributes } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NoteDrawingCanvas } from './NoteDrawingCanvas'

const { canvasContext, confirmMock, toDataUrlMock, anchorClickMock } = vi.hoisted(() => {
  const ctx = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    lineCap: 'butt',
    lineJoin: 'miter',
    globalCompositeOperation: 'source-over',
    strokeStyle: '#000000',
    fillStyle: '#000000',
    globalAlpha: 1,
    lineWidth: 1,
  }

  return {
    canvasContext: ctx,
    confirmMock: vi.fn(),
    toDataUrlMock: vi.fn(),
    anchorClickMock: vi.fn(),
  }
})

vi.mock('@/components/ui/button', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react')

  type MockButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string
    size?: string
    asChild?: boolean
  }

  const Button = ReactModule.forwardRef<HTMLButtonElement, MockButtonProps>(
    ({ variant: _variant, size: _size, asChild: _asChild, children, ...props }, ref) =>
      ReactModule.createElement('button', { ...props, ref }, children)
  )

  Button.displayName = 'MockButton'

  return {
    Button,
    buttonVariants: () => '',
  }
})

vi.mock('@/components/ui/slider', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react')

  type MockSliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
    value?: number[]
    onValueChange?: (value: number[]) => void
    min?: number
    max?: number
    step?: number
  }

  const Slider = ReactModule.forwardRef<HTMLInputElement, MockSliderProps>(
    ({ value, onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
      const currentValue = value?.[0] ?? min

      return ReactModule.createElement('input', {
        ...props,
        ref,
        type: 'range',
        min,
        max,
        step,
        value: currentValue,
        onChange: (event: ChangeEvent<HTMLInputElement>) => {
          onValueChange?.([Number(event.currentTarget.value)])
        },
      })
    }
  )

  Slider.displayName = 'MockSlider'

  return { Slider }
})

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(' '),
  formatNumber: (value: number) => new Intl.NumberFormat('fr-FR').format(value),
}))

type DrawingTool = 'pen' | 'highlighter' | 'eraser'

interface DrawingPoint {
  x: number
  y: number
  p?: number
}

interface DrawingStroke {
  points: DrawingPoint[]
  color: string
  size: number
  tool: DrawingTool
}

interface PointerPoint {
  clientX: number
  clientY: number
  pressure: number
}

interface PointerDispatchOptions extends PointerPoint {
  pointerId: number
  pointerType: 'mouse' | 'pen' | 'touch'
  button?: number
  coalesced?: PointerPoint[]
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

function getCanvas(container: HTMLElement): HTMLCanvasElement {
  const canvas = container.querySelector('canvas')

  if (canvas instanceof HTMLCanvasElement) {
    return canvas
  }

  throw new Error('Canvas element not found')
}

function dispatchCanvasPointerEvent(
  canvas: HTMLCanvasElement,
  eventName: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel' | 'pointerleave',
  options: PointerDispatchOptions
) {
  const coalesced = options.coalesced ?? [
    {
      clientX: options.clientX,
      clientY: options.clientY,
      pressure: options.pressure,
    },
  ]

  const event = new Event(eventName, {
    bubbles: true,
    cancelable: true,
  })

  Object.defineProperties(event, {
    pointerId: { configurable: true, value: options.pointerId },
    pointerType: { configurable: true, value: options.pointerType },
    button: { configurable: true, value: options.button ?? 0 },
    clientX: { configurable: true, value: options.clientX },
    clientY: { configurable: true, value: options.clientY },
    pressure: { configurable: true, value: options.pressure },
    getCoalescedEvents: {
      configurable: true,
      value: () => coalesced,
    },
  })

  fireEvent(canvas, event)
}

function drawPointerLine(
  canvas: HTMLCanvasElement,
  pointerId: number,
  start: PointerPoint,
  end: PointerPoint
) {
  dispatchCanvasPointerEvent(canvas, 'pointerdown', {
    pointerId,
    pointerType: 'pen',
    button: 0,
    ...start,
  })

  dispatchCanvasPointerEvent(canvas, 'pointermove', {
    pointerId,
    pointerType: 'pen',
    button: 0,
    ...end,
    coalesced: [end],
  })

  dispatchCanvasPointerEvent(canvas, 'pointerup', {
    pointerId,
    pointerType: 'pen',
    button: 0,
    ...end,
  })
}

function StatefulCanvas({
  initialStrokes,
  onObservedChange,
}: {
  initialStrokes: DrawingStroke[]
  onObservedChange: (strokes: DrawingStroke[]) => void
}) {
  const [currentStrokes, setCurrentStrokes] = useState<DrawingStroke[]>(initialStrokes)

  return (
    <NoteDrawingCanvas
      strokes={currentStrokes}
      onChange={(nextStrokes) => {
        onObservedChange(nextStrokes)
        setCurrentStrokes(nextStrokes)
      }}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()

  canvasContext.lineCap = 'butt'
  canvasContext.lineJoin = 'miter'
  canvasContext.globalCompositeOperation = 'source-over'
  canvasContext.strokeStyle = '#000000'
  canvasContext.fillStyle = '#000000'
  canvasContext.globalAlpha = 1
  canvasContext.lineWidth = 1

  toDataUrlMock.mockReturnValue('data:image/png;base64,png')
  confirmMock.mockReturnValue(true)

  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    value: 1,
  })

  class MockResizeObserver {
    private readonly callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }

    observe(_target: Element) {
      this.callback([], this as unknown as ResizeObserver)
    }

    unobserve(_target: Element) {
      return undefined
    }

    disconnect() {
      return undefined
    }
  }

  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: MockResizeObserver,
  })

  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: MockResizeObserver,
  })

  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return 640
    },
  })

  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      width: 640,
      height: 2000,
      top: 0,
      left: 0,
      right: 640,
      bottom: 2000,
      toJSON: () => ({}),
    }),
  })

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: (contextId: string) => (contextId === '2d' ? canvasContext : null),
  })

  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    value: toDataUrlMock,
  })

  Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  })

  Object.defineProperty(HTMLCanvasElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: vi.fn(),
  })

  Object.defineProperty(window, 'confirm', {
    configurable: true,
    value: confirmMock,
  })

  Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
    configurable: true,
    value: anchorClickMock,
  })
})

afterEach(() => {
  cleanup()
})

describe('NoteDrawingCanvas', () => {
  it('affiche la barre d’outils, les couleurs et dimensionne le canvas responsive', async () => {
    const onChange = vi.fn()

    const { container } = renderWithProviders(
      <NoteDrawingCanvas strokes={[]} onChange={onChange} />
    )
    const canvas = getCanvas(container)

    expect(screen.getByRole('button', { name: 'Stylo' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Surligneur' }).getAttribute('aria-pressed')).toBe(
      'false'
    )
    expect(screen.getByRole('button', { name: 'Gomme' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getAllByRole('button', { name: /^Couleur #/ })).toHaveLength(8)
    expect(screen.getByRole('button', { name: 'Couleur #1e293b' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Couleur #db2777' })).toBeTruthy()
    expect(screen.getByText('Taille')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Annuler' }) as HTMLButtonElement).disabled).toBe(
      true
    )
    expect((screen.getByRole('button', { name: 'Rétablir' }) as HTMLButtonElement).disabled).toBe(
      true
    )

    await waitFor(() => {
      expect(canvas.style.width).toBe('640px')
      expect(canvas.style.height).toBe('2000px')
    })

    expect(canvas.width).toBe(640)
    expect(canvas.height).toBe(2000)
    expect(canvasContext.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0)
    expect(canvasContext.clearRect).toHaveBeenCalledWith(0, 0, 640, 2000)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('crée un trait stylo avec couleur, taille et points réels au relâchement du pointeur', async () => {
    const onChange = vi.fn()

    const { container } = renderWithProviders(
      <NoteDrawingCanvas strokes={[]} onChange={onChange} />
    )
    const canvas = getCanvas(container)

    await act(async () => {
      drawPointerLine(
        canvas,
        11,
        { clientX: 10, clientY: 15, pressure: 0.8 },
        { clientX: 20, clientY: 25, pressure: 0.9 }
      )
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith([
      {
        points: [
          { x: 10, y: 15, p: 0.8 },
          { x: 20, y: 25, p: 0.9 },
        ],
        color: '#1e293b',
        size: 3,
        tool: 'pen',
      },
    ])
    expect(canvasContext.stroke).toHaveBeenCalled()
  })

  it('applique l’outil surligneur et multiplie la taille sélectionnée par quatre', async () => {
    const onChange = vi.fn()

    const { container } = renderWithProviders(
      <NoteDrawingCanvas strokes={[]} onChange={onChange} />
    )
    const canvas = getCanvas(container)

    fireEvent.click(screen.getByRole('button', { name: 'Surligneur' }))
    fireEvent.change(screen.getByRole('slider'), { target: { value: '5' } })

    expect(screen.getByRole('button', { name: 'Surligneur' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    expect(screen.getByText('5')).toBeTruthy()

    await act(async () => {
      drawPointerLine(
        canvas,
        12,
        { clientX: 30, clientY: 40, pressure: 0.6 },
        { clientX: 50, clientY: 70, pressure: 0.7 }
      )
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith([
      {
        points: [
          { x: 30, y: 40, p: 0.6 },
          { x: 50, y: 70, p: 0.7 },
        ],
        color: '#1e293b',
        size: 20,
        tool: 'highlighter',
      },
    ])
  })

  it('utilise la couleur blanche et l’outil eraser quand la gomme est active', async () => {
    const onChange = vi.fn()

    const { container } = renderWithProviders(
      <NoteDrawingCanvas strokes={[]} onChange={onChange} />
    )
    const canvas = getCanvas(container)

    fireEvent.click(screen.getByRole('button', { name: 'Couleur #dc2626' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gomme' }))

    expect(screen.getByRole('button', { name: 'Gomme' }).getAttribute('aria-pressed')).toBe('true')

    await act(async () => {
      drawPointerLine(
        canvas,
        13,
        { clientX: 80, clientY: 90, pressure: 0.5 },
        { clientX: 100, clientY: 110, pressure: 0.6 }
      )
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith([
      {
        points: [
          { x: 80, y: 90, p: undefined },
          { x: 100, y: 110, p: 0.6 },
        ],
        color: '#ffffff',
        size: 3,
        tool: 'eraser',
      },
    ])
  })

  it('annule puis rétablit un trait via l’historique interne', async () => {
    const onObservedChange = vi.fn()

    const { container } = renderWithProviders(
      <StatefulCanvas initialStrokes={[]} onObservedChange={onObservedChange} />
    )
    const canvas = getCanvas(container)

    await act(async () => {
      drawPointerLine(
        canvas,
        21,
        { clientX: 14, clientY: 18, pressure: 0.7 },
        { clientX: 24, clientY: 28, pressure: 0.8 }
      )
    })

    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Annuler' }) as HTMLButtonElement).disabled).toBe(
        false
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(onObservedChange).toHaveBeenLastCalledWith([])

    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Rétablir' }) as HTMLButtonElement).disabled).toBe(
        false
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Rétablir' }))

    expect(onObservedChange).toHaveBeenLastCalledWith([
      {
        points: [
          { x: 14, y: 18, p: 0.7 },
          { x: 24, y: 28, p: 0.8 },
        ],
        color: '#1e293b',
        size: 3,
        tool: 'pen',
      },
    ])
  })

  it('demande confirmation avant de tout effacer et n’efface pas si la confirmation est refusée', () => {
    const initialStroke: DrawingStroke = {
      points: [{ x: 1, y: 2 }],
      color: '#dc2626',
      size: 4,
      tool: 'pen',
    }
    const onObservedChange = vi.fn()

    renderWithProviders(
      <StatefulCanvas initialStrokes={[initialStroke]} onObservedChange={onObservedChange} />
    )

    confirmMock.mockReturnValueOnce(false)

    fireEvent.click(screen.getByRole('button', { name: 'Tout effacer' }))

    expect(confirmMock).toHaveBeenCalledWith('Effacer tout le dessin ?')
    expect(onObservedChange).not.toHaveBeenCalled()

    confirmMock.mockReturnValueOnce(true)

    fireEvent.click(screen.getByRole('button', { name: 'Tout effacer' }))

    expect(onObservedChange).toHaveBeenCalledTimes(1)
    expect(onObservedChange).toHaveBeenCalledWith([])
  })

  it('exporte le canvas courant en image PNG', () => {
    const onChange = vi.fn()

    renderWithProviders(<NoteDrawingCanvas strokes={[]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Exporter en PNG' }))

    expect(toDataUrlMock).toHaveBeenCalledTimes(1)
    expect(toDataUrlMock).toHaveBeenCalledWith('image/png')
    expect(anchorClickMock).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })
})
