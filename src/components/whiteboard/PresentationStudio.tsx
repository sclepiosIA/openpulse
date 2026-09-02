import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Play,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Presentation as PresentationIcon,
  MoreHorizontal,
  Copy,
  ArrowLeft,
  X,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/shared/use-toast'
import {
  usePresentations,
  useCreatePresentation,
  useUpdatePresentation,
  useDeletePresentation,
  newSlide,
  type Presentation,
  type Slide,
} from '@/hooks/whiteboards/usePresentations'
import { TEAM_LABELS, type TeamKey } from '@/hooks/whiteboards/useSimpleWhiteboards'
import { MARQUE } from '@/config/branding'

type ExcalidrawAPI = any

const SCOPE_LABEL: Record<string, string> = {
  personal: 'Perso',
  company: MARQUE.nomCourt,
  team: 'Équipe',
}

/** Studio de présentation : diapositives Excalidraw + mode plein écran. */
export function PresentationStudio({ team }: { team: TeamKey | null }) {
  const { data: presentations = [], isLoading } = usePresentations()
  const createP = useCreatePresentation()
  const updateP = useUpdatePresentation()
  const deleteP = useDeletePresentation()
  const { toast } = useToast()

  const [openId, setOpenId] = useState<string | null>(null)
  const open = useMemo(
    () => presentations.find((p) => p.id === openId) ?? null,
    [presentations, openId]
  )

  if (openId && open) {
    return <PresentationEditor presentation={open} onBack={() => setOpenId(null)} />
  }

  const handleCreate = async (scope: 'personal' | 'company' | 'team') => {
    try {
      const p = await createP.mutateAsync({ title: 'Nouvelle présentation', scope, teamRole: team })
      setOpenId(p.id)
    } catch (e: any) {
      toast({ title: 'Création impossible', description: e?.message, variant: 'destructive' })
    }
  }

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Présentations</h2>
            <p className="text-xs text-muted-foreground">
              Diapositives libres avec les mêmes outils que le tableau blanc.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={createP.isPending}>
                {createP.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-4 w-4" />
                )}
                Nouvelle présentation
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleCreate('personal')}>
                Personnelle
              </DropdownMenuItem>
              {team && (
                <DropdownMenuItem onClick={() => handleCreate('team')}>
                  Équipe {TEAM_LABELS[team]}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleCreate('company')}>
                {MARQUE.nomCourt} (tous)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : presentations.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
            <PresentationIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Aucune présentation pour le moment.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {presentations.map((p) => (
              <PresentationCard
                key={p.id}
                presentation={p}
                onOpen={() => setOpenId(p.id)}
                onRename={(title) => updateP.mutate({ id: p.id, patch: { title } })}
                onDuplicate={() =>
                  createP.mutate(
                    { title: `${p.title} (copie)`, scope: p.scope, teamRole: p.team_role },
                    {
                      onSuccess: (created) =>
                        updateP.mutate({ id: created.id, patch: { scene: p.scene } }),
                    }
                  )
                }
                onDelete={() => deleteP.mutate(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PresentationCard({
  presentation,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  presentation: Presentation
  onOpen: () => void
  onRename: (t: string) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(presentation.title)
  const slides = presentation.scene?.slides ?? []

  return (
    <div className="group rounded-xl border bg-card p-3 transition-shadow hover:shadow-md">
      <button
        onClick={onOpen}
        className="mb-3 flex aspect-video w-full items-center justify-center rounded-lg bg-muted/50 text-muted-foreground"
        aria-label={`Ouvrir ${presentation.title}`}
      >
        <PresentationIcon className="h-7 w-7 opacity-50" />
      </button>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                onRename(title.trim() || 'Sans titre')
                setEditing(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') setEditing(false)
              }}
              className="h-7 text-sm"
            />
          ) : (
            <div className="truncate text-sm font-medium">{presentation.title}</div>
          )}
          <div className="mt-1 flex items-center gap-1.5">
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {presentation.scope === 'team' && presentation.team_role
                ? (TEAM_LABELS[presentation.team_role as TeamKey] ?? 'Équipe')
                : SCOPE_LABEL[presentation.scope]}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {slides.length} diapo{slides.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditing(true)}>Renommer</DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              Dupliquer
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function PresentationEditor({
  presentation,
  onBack,
}: {
  presentation: Presentation
  onBack: () => void
}) {
  const updateP = useUpdatePresentation()
  const [slides, setSlides] = useState<Slide[]>(
    presentation.scene?.slides?.length ? presentation.scene.slides : [newSlide(0)]
  )
  const [index, setIndex] = useState(0)
  const [presenting, setPresenting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const apiRef = useRef<ExcalidrawAPI | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const current = slides[Math.min(index, slides.length - 1)]

  const persist = useCallback(
    (next: Slide[]) => {
      setStatus('saving')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        updateP.mutate(
          { id: presentation.id, patch: { scene: { slides: next } } },
          { onSuccess: () => setStatus('saved'), onError: () => setStatus('idle') }
        )
      }, 700)
    },
    [presentation.id, updateP]
  )

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const handleChange = useCallback(
    (elements: readonly any[], _state: any, files: any) => {
      setSlides((prev) => {
        const next = prev.map((s, i) =>
          i === index ? { ...s, elements: elements as unknown[], files: files ?? {} } : s
        )
        if (JSON.stringify(next[index]?.elements) === JSON.stringify(prev[index]?.elements))
          return prev
        persist(next)
        return next
      })
    },
    [index, persist]
  )

  const addSlide = () => {
    const next = [...slides, newSlide(slides.length)]
    setSlides(next)
    setIndex(next.length - 1)
    persist(next)
  }

  const duplicateSlide = (i: number) => {
    const copy: Slide = { ...slides[i], id: newSlide(i).id, title: `${slides[i].title} (copie)` }
    const next = [...slides.slice(0, i + 1), copy, ...slides.slice(i + 1)]
    setSlides(next)
    setIndex(i + 1)
    persist(next)
  }

  const removeSlide = (i: number) => {
    if (slides.length === 1) return
    const next = slides.filter((_, k) => k !== i)
    setSlides(next)
    setIndex(Math.max(0, Math.min(i, next.length - 1)))
    persist(next)
  }

  const renameSlide = (i: number, title: string) => {
    const next = slides.map((s, k) => (k === i ? { ...s, title } : s))
    setSlides(next)
    persist(next)
  }

  if (presenting) {
    return (
      <PresentMode
        slides={slides}
        startIndex={index}
        onExit={(i) => {
          setIndex(i)
          setPresenting(false)
        }}
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b bg-background/95 px-3 py-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Présentations
        </Button>
        <div className="truncate text-sm font-medium">{presentation.title}</div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
            {status === 'saving' ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Enregistrement…
              </>
            ) : status === 'saved' ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                Enregistré
              </>
            ) : (
              'Auto-sauvegarde'
            )}
          </span>
          <Button size="sm" variant="outline" onClick={addSlide} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Diapo
          </Button>
          <Button size="sm" onClick={() => setPresenting(true)} className="gap-1.5">
            <Play className="h-4 w-4" />
            Présenter
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="hidden w-44 shrink-0 border-r bg-card/40 md:block">
          <ScrollArea className="h-full">
            <div className="space-y-2 p-2">
              {slides.map((s, i) => (
                <div
                  key={s.id}
                  className={cn(
                    'group cursor-pointer rounded-lg border p-2 transition-colors',
                    i === index ? 'border-primary/40 bg-primary/10' : 'hover:bg-muted'
                  )}
                  onClick={() => setIndex(i)}
                >
                  <div className="mb-1 flex aspect-video items-center justify-center rounded bg-background text-xs text-muted-foreground">
                    {i + 1}
                  </div>
                  <Input
                    value={s.title}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => renameSlide(i, e.target.value)}
                    className="h-6 border-0 bg-transparent px-1 text-[11px] focus-visible:ring-1"
                  />
                  <div className="mt-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation()
                        duplicateSlide(i)
                      }}
                      aria-label="Dupliquer la diapositive"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      disabled={slides.length === 1}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeSlide(i)
                      }}
                      aria-label="Supprimer la diapositive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="relative min-w-0 flex-1">
          <Excalidraw
            key={current?.id}
            excalidrawAPI={(api: ExcalidrawAPI) => {
              apiRef.current = api
              api.updateScene({
                elements: (current?.elements as any) ?? [],
                appState: { collaborators: new Map() },
              })
              if (current?.files) api.addFiles(Object.values(current.files as any))
            }}
            onChange={handleChange}
            langCode="fr-FR"
            UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center md:hidden">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border bg-background/95 px-2 py-1 shadow">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-1 text-xs tabular-nums">
                {index + 1}/{slides.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={index >= slides.length - 1}
                onClick={() => setIndex(index + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PresentMode({
  slides,
  startIndex,
  onExit,
}: {
  slides: Slide[]
  startIndex: number
  onExit: (index: number) => void
}) {
  const [i, setI] = useState(startIndex)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') setI((v) => Math.min(v + 1, slides.length - 1))
      if (e.key === 'ArrowLeft') setI((v) => Math.max(v - 1, 0))
      if (e.key === 'Escape') onExit(i)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slides.length, i, onExit])

  const slide = slides[i]

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-2 text-white/80">
        <span className="truncate text-sm">{slide?.title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums">
            {i + 1} / {slides.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/10"
            onClick={() => onExit(i)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 bg-white">
        <Excalidraw
          key={slide?.id}
          viewModeEnabled
          excalidrawAPI={(api: ExcalidrawAPI) => {
            api.updateScene({
              elements: (slide?.elements as any) ?? [],
              appState: { collaborators: new Map() },
            })
            if (slide?.files) api.addFiles(Object.values(slide.files as any))
            setTimeout(() => api.scrollToContent?.(undefined, { fitToContent: true }), 60)
          }}
          langCode="fr-FR"
        />
      </div>
      <div className="flex items-center justify-center gap-3 py-3">
        <Button variant="secondary" size="sm" disabled={i === 0} onClick={() => setI(i - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={i >= slides.length - 1}
          onClick={() => setI(i + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default PresentationStudio
