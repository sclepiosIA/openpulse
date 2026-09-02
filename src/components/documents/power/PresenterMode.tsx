/**
 * Mode Présentateur : plein écran, notes, chrono, minuteur slide, navigation clavier.
 */
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import DOMPurify from 'dompurify'
import { X, ChevronLeft, ChevronRight, Timer, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Config DOMPurify pour rendu de slides (HTML riche mais sans JS ni event handlers).
const SLIDE_SANITIZE_CONFIG = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  ADD_ATTR: ['style', 'class'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'formaction'],
}

export interface PresenterSlide {
  id: string
  html: string // rendu HTML
  notes?: string
}

interface Props {
  slides: PresenterSlide[]
  initialIndex?: number
  onClose: () => void
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0')
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, '0')
  return `${m}:${s}`
}

export function PresenterMode({ slides, initialIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const [elapsed, setElapsed] = useState(0)
  const [slideElapsed, setSlideElapsed] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(Date.now())
  const slideStartRef = useRef(Date.now())

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const next = Math.min(slides.length - 1, Math.max(0, i + delta))
        if (next !== i) slideStartRef.current = Date.now()
        return next
      })
    },
    [slides.length]
  )

  useEffect(() => {
    const el = document.documentElement
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const tick = () => {
      setElapsed((Date.now() - startRef.current) / 1000)
      setSlideElapsed((Date.now() - slideStartRef.current) / 1000)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(-1)
      } else if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Home') {
        setIndex(0)
        slideStartRef.current = Date.now()
      } else if (e.key === 'End') {
        setIndex(slides.length - 1)
        slideStartRef.current = Date.now()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose, slides.length])

  const current = slides[index]
  const next = slides[index + 1]

  const currentSanitized = useMemo(
    () => (current ? DOMPurify.sanitize(current.html, SLIDE_SANITIZE_CONFIG) : ''),
    [current]
  )
  const nextSanitized = useMemo(
    () => (next ? DOMPurify.sanitize(next.html, SLIDE_SANITIZE_CONFIG) : ''),
    [next]
  )

  return (
    <div className="fixed inset-0 z-[9999] bg-black text-white grid grid-cols-[1fr_360px] grid-rows-[1fr_auto]">
      {/* Slide courante */}
      <div className="row-span-2 flex items-center justify-center bg-black overflow-hidden">
        {current ? (
          <div
            className="bg-card text-black shadow-2xl"
            style={{ width: '90vw', maxWidth: 1600, aspectRatio: '16 / 9' }}
            dangerouslySetInnerHTML={{ __html: currentSanitized }}
          />
        ) : (
          <div className="text-muted-foreground">Aucune slide</div>
        )}
      </div>

      {/* Panneau notes */}
      <div className="flex flex-col border-l border-neutral-800 bg-neutral-950 p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-neutral-400">
            Slide {index + 1} / {slides.length}
          </span>
          <button onClick={onClose} className="hover:text-red-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="text-xs uppercase text-neutral-500 mb-1">Notes</div>
        <div className="flex-1 overflow-auto text-sm whitespace-pre-wrap border border-neutral-800 rounded p-2 bg-neutral-900">
          {current?.notes || <span className="text-neutral-600 italic">Aucune note</span>}
        </div>
        <div className="text-xs uppercase text-neutral-500 mt-3 mb-1">Slide suivante</div>
        <div
          className="border border-neutral-800 rounded p-2 bg-neutral-900"
          style={{ aspectRatio: '16 / 9', overflow: 'hidden' }}
        >
          {next ? (
            <div
              className="w-full h-full origin-top-left"
              style={{
                transform: 'scale(0.28)',
                transformOrigin: 'top left',
                width: '360%',
                height: '360%',
              }}
            >
              <div
                className="bg-card text-black w-full h-full"
                dangerouslySetInnerHTML={{ __html: nextSanitized }}
              />
            </div>
          ) : (
            <div className="text-neutral-600 italic text-xs">Fin de présentation</div>
          )}
        </div>
      </div>

      {/* Barre de contrôle */}
      <div className="col-start-1 flex items-center justify-between px-6 py-2 bg-neutral-950 border-t border-neutral-800">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {fmt(elapsed)}
          </span>
          <span className="flex items-center gap-1">
            <Timer className="h-3.5 w-3.5" /> Slide {fmt(slideElapsed)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => go(-1)} disabled={index === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs w-16 text-center">
            {index + 1} / {slides.length}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => go(1)}
            disabled={index >= slides.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
