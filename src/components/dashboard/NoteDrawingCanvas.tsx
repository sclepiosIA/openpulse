import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Pen, Highlighter, Eraser, Undo2, Redo2, Trash2, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DrawingStroke } from '@/types/supabase-extensions'

interface NoteDrawingCanvasProps {
  strokes: DrawingStroke[]
  onChange: (strokes: DrawingStroke[]) => void
}

type Tool = 'pen' | 'highlighter' | 'eraser'

const COLORS = [
  '#1e293b',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0284c7',
  '#7c3aed',
  '#db2777',
]
const CANVAS_HEIGHT = 2000

export function NoteDrawingCanvas({ strokes, onChange }: NoteDrawingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const currentStrokeRef = useRef<DrawingStroke | null>(null)
  const isDrawingRef = useRef(false)
  const activePointerRef = useRef<number | null>(null)
  const historyRef = useRef<DrawingStroke[][]>([])
  const futureRef = useRef<DrawingStroke[][]>([])

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#1e293b')
  const [size, setSize] = useState(3)
  const [canvasWidth, setCanvasWidth] = useState(800)

  // Track container width for responsive canvas
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setCanvasWidth(Math.max(320, el.clientWidth))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const redraw = useCallback(
    (extra?: DrawingStroke | null) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)

      const all = extra ? [...strokes, extra] : strokes
      for (const stroke of all) {
        drawStroke(ctx, stroke)
      }
    },
    [strokes]
  )

  // Resize the canvas backing store on width/height/dpr change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasWidth * dpr
    canvas.height = CANVAS_HEIGHT * dpr
    canvas.style.width = `${canvasWidth}px`
    canvas.style.height = `${CANVAS_HEIGHT}px`
    redraw()
  }, [canvasWidth, redraw])

  useEffect(() => {
    redraw()
  }, [redraw])

  const pushHistory = () => {
    historyRef.current.push(strokes.map((s) => ({ ...s, points: [...s.points] })))
    if (historyRef.current.length > 50) historyRef.current.shift()
    futureRef.current = []
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Ignore mouse right-click; palm rejection: only accept primary pointer
    if (e.button !== 0 && e.pointerType === 'mouse') return
    if (activePointerRef.current !== null) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    activePointerRef.current = e.pointerId
    isDrawingRef.current = true

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const pressure = e.pressure && e.pressure > 0 && e.pressure !== 0.5 ? e.pressure : undefined

    currentStrokeRef.current = {
      points: [{ x, y, p: pressure }],
      color: tool === 'eraser' ? '#ffffff' : color,
      size: tool === 'highlighter' ? size * 4 : size,
      tool,
    }
    pushHistory()
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || activePointerRef.current !== e.pointerId) return
    const canvas = canvasRef.current
    const stroke = currentStrokeRef.current
    if (!canvas || !stroke) return
    const rect = canvas.getBoundingClientRect()

    // Coalesced events for smoother stylus input
    const events =
      typeof e.nativeEvent.getCoalescedEvents === 'function'
        ? e.nativeEvent.getCoalescedEvents()
        : [e.nativeEvent]

    for (const ev of events) {
      const x = ev.clientX - rect.left
      const y = ev.clientY - rect.top
      const pressure =
        ev.pressure && ev.pressure > 0 && ev.pressure !== 0.5 ? ev.pressure : undefined
      stroke.points.push({ x, y, p: pressure })
    }

    // Incremental draw
    const ctx = canvas.getContext('2d')
    if (ctx) drawStroke(ctx, stroke)
  }

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== e.pointerId) return
    const canvas = canvasRef.current
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }
    activePointerRef.current = null
    isDrawingRef.current = false
    const stroke = currentStrokeRef.current
    currentStrokeRef.current = null
    if (!stroke || stroke.points.length === 0) return
    onChange([...strokes, stroke])
  }

  const handleUndo = () => {
    const previous = historyRef.current.pop()
    if (!previous) return
    futureRef.current.push(strokes.map((s) => ({ ...s, points: [...s.points] })))
    onChange(previous)
  }

  const handleRedo = () => {
    const next = futureRef.current.pop()
    if (!next) return
    historyRef.current.push(strokes.map((s) => ({ ...s, points: [...s.points] })))
    onChange(next)
  }

  const handleClear = () => {
    if (strokes.length === 0) return
    if (!window.confirm('Effacer tout le dessin ?')) return
    pushHistory()
    onChange([])
  }

  const handleExport = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `dessin-${new Date().toISOString().slice(0, 10)}.png`
    a.click()
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full min-h-0 gap-2">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-md bg-muted/40 border shrink-0">
        <div className="flex items-center gap-1">
          <ToolButton active={tool === 'pen'} onClick={() => setTool('pen')} label="Stylo">
            <Pen className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            active={tool === 'highlighter'}
            onClick={() => setTool('highlighter')}
            label="Surligneur"
          >
            <Highlighter className="h-4 w-4" />
          </ToolButton>
          <ToolButton active={tool === 'eraser'} onClick={() => setTool('eraser')} label="Gomme">
            <Eraser className="h-4 w-4" />
          </ToolButton>
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                'h-6 w-6 rounded-full border-2 transition-transform',
                color === c && tool !== 'eraser'
                  ? 'border-foreground scale-110'
                  : 'border-transparent hover:scale-105'
              )}
              style={{ backgroundColor: c }}
              aria-label={`Couleur ${c}`}
            />
          ))}
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-2 min-w-[140px]">
          <span className="text-xs text-muted-foreground">Taille</span>
          <Slider
            value={[size]}
            onValueChange={(v) => setSize(v[0] ?? 3)}
            min={1}
            max={20}
            step={1}
            className="w-24"
          />
          <span className="text-xs w-6 text-right tabular-nums">{size}</span>
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleUndo}
            disabled={historyRef.current.length === 0}
            aria-label="Annuler"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRedo}
            disabled={futureRef.current.length === 0}
            aria-label="Rétablir"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleExport}
            aria-label="Exporter en PNG"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={handleClear}
            aria-label="Tout effacer"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0 overflow-auto rounded-md border bg-card">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={endStroke}
          className="touch-none cursor-crosshair block"
          style={{ display: 'block' }}
        />
      </div>
    </div>
  )
}

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'ghost'}
      size="icon"
      className="h-8 w-8"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </Button>
  )
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: DrawingStroke) {
  const { points, color, size, tool } = stroke
  if (points.length === 0) return

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0,0,0,1)'
  } else if (tool === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply'
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.35
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = color
  }

  if (points.length === 1) {
    // Single dot
    const p = points[0]
    const w = (p.p ?? 0.5) * size * 1.5
    ctx.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(0.5, w / 2), 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const pressure = curr.p ?? prev.p ?? 0.5
    ctx.lineWidth = Math.max(0.5, size * (0.5 + pressure))
    ctx.beginPath()
    ctx.moveTo(prev.x, prev.y)
    // Quadratic smoothing
    const midX = (prev.x + curr.x) / 2
    const midY = (prev.y + curr.y) / 2
    ctx.quadraticCurveTo(prev.x, prev.y, midX, midY)
    ctx.lineTo(curr.x, curr.y)
    ctx.stroke()
  }

  ctx.restore()
}
