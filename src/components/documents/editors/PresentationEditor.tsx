import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useUndoRedo, matchUndoRedo, isTypingTarget } from '@/hooks/documents/useUndoRedo'
import { useRealtimeCoedit } from '@/hooks/documents/useRealtimeCoedit'
import {
  Plus,
  Trash2,
  Save,
  FileDown,
  Play,
  ChevronLeft,
  ChevronRight,
  Type,
  Image as ImageIcon,
  Square,
  PresentationIcon,
  History,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useNativeDocumentSave } from '@/hooks/documents/useNativeDocumentSave'
import { loadPdfLibs } from '@/lib/export/dynamicPdfImport'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { EditorHeader, EditorCloseButton, EditorAIButton } from './EditorChrome'
import {
  AIGenerateDeckDialog,
  type GeneratedDeck,
} from '@/components/documents/ai/copilot/AIGenerateDeckDialog'
import { CopilotSidePanel } from '@/components/documents/ai/copilot/CopilotSidePanel'
import { PresenterMode, type PresenterSlide } from '@/components/documents/power/PresenterMode'
import { VersionHistoryDialog } from '@/components/documents/power/VersionHistoryDialog'
import { saveVersion } from '@/components/documents/power/versionHistory'

interface PresentationEditorProps {
  documentId?: string
  documentName?: string
  initialContent?: string
  folderId?: string | null
  onClose?: () => void
  className?: string
  collaborative?: boolean
}

interface SlideElement {
  id: string
  type: 'text' | 'image' | 'shape'
  x: number
  y: number
  width: number
  height: number
  content: string
  style?: {
    fontSize?: number
    fontWeight?: string
    color?: string
    textAlign?: string
    backgroundColor?: string
    borderRadius?: number
    objectFit?: string
  }
}

interface Slide {
  id: string
  elements: SlideElement[]
  backgroundColor?: string
  notes?: string
}

interface PresentationState {
  slides: Slide[]
  currentSlide: number
}

const SLIDE_WIDTH = 960
const SLIDE_HEIGHT = 540

function createEmptySlide(): Slide {
  return {
    id: crypto.randomUUID(),
    elements: [
      {
        id: crypto.randomUUID(),
        type: 'text',
        x: 80,
        y: 100,
        width: 800,
        height: 80,
        content: 'Titre de la slide',
        style: { fontSize: 36, fontWeight: 'bold', color: '#1a1a2e', textAlign: 'center' },
      },
      {
        id: crypto.randomUUID(),
        type: 'text',
        x: 120,
        y: 240,
        width: 720,
        height: 200,
        content: 'Contenu de votre présentation...',
        style: { fontSize: 18, color: '#4a4a5a', textAlign: 'center' },
      },
    ],
  }
}

function createTitleSlide(): Slide {
  return {
    id: crypto.randomUUID(),
    backgroundColor: 'hsl(var(--primary))',
    elements: [
      {
        id: crypto.randomUUID(),
        type: 'text',
        x: 80,
        y: 160,
        width: 800,
        height: 100,
        content: 'Titre de la présentation',
        style: { fontSize: 42, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' },
      },
      {
        id: crypto.randomUUID(),
        type: 'text',
        x: 200,
        y: 300,
        width: 560,
        height: 60,
        content: 'Sous-titre ou auteur',
        style: { fontSize: 20, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
      },
    ],
  }
}

export function PresentationEditor({
  documentId,
  documentName = 'Présentation',
  initialContent,
  folderId,
  onClose,
  className,
  collaborative = false,
}: PresentationEditorProps) {
  const { save: saveToNextcloud, isSaving: isNativeSaving } = useNativeDocumentSave({
    documentName,
    mimeType: 'application/json',
    extension: 'json',
    folderId,
    existingDocumentId: documentId,
  })
  const initialPresentation = useMemo<PresentationState>(() => {
    if (initialContent) {
      try {
        return JSON.parse(initialContent)
      } catch {
        /* ignore */
      }
    }
    return { slides: [createTitleSlide(), createEmptySlide()], currentSlide: 0 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const {
    state: presentation,
    set: setPresentation,
    replace: replacePresentation,
    undo: undoPresentation,
    redo: redoPresentation,
    reset: resetPresentation,
  } = useUndoRedo<PresentationState>(initialPresentation)

  // Ref pour lire le currentSlide local sans le partager
  const currentSlideRef = useRef(0)
  const { connectedUsers: coeditUsers, isConnected: isCoeditConnected } =
    useRealtimeCoedit<PresentationState>({
      documentId,
      enabled: !!collaborative && !!documentId,
      // On ne partage pas le currentSlide (perso à chaque utilisateur)
      snapshot: useMemo(
        () => ({ slides: presentation.slides, currentSlide: 0 }),
        [presentation.slides]
      ),
      onRemoteSnapshot: (remote) => {
        // Conserve le currentSlide local, remplace uniquement les slides
        const localCurrent = currentSlideRef.current
        resetPresentation({
          slides: remote.slides,
          currentSlide: Math.min(Math.max(localCurrent, 0), Math.max(remote.slides.length - 1, 0)),
        })
      },
      channelKind: 'slides',
    })

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [editingElementId, setEditingElementId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [presenterOpen, setPresenterOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  // Suivi "dirty" pour beforeunload (P0 audit).
  const dirtyRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = true
  }, [presentation])
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const currentSlide = presentation.slides[presentation.currentSlide]
  useEffect(() => {
    currentSlideRef.current = presentation.currentSlide
  }, [presentation.currentSlide])
  const selectedElement = currentSlide?.elements.find((e) => e.id === selectedElementId)

  const updateSlide = useCallback((slideIndex: number, updater: (slide: Slide) => Slide) => {
    setPresentation((prev) => ({
      ...prev,
      slides: prev.slides.map((s, i) => (i === slideIndex ? updater(s) : s)),
    }))
  }, [])

  const addSlide = () => {
    setPresentation((prev) => ({
      ...prev,
      slides: [...prev.slides, createEmptySlide()],
      currentSlide: prev.slides.length,
    }))
  }

  const deleteSlide = (index: number) => {
    if (presentation.slides.length <= 1) return
    setPresentation((prev) => ({
      slides: prev.slides.filter((_, i) => i !== index),
      currentSlide: Math.min(prev.currentSlide, prev.slides.length - 2),
    }))
  }

  const addElement = (type: 'text' | 'image' | 'shape') => {
    const newEl: SlideElement = {
      id: crypto.randomUUID(),
      type,
      x: 100,
      y: 200,
      width: type === 'text' ? 400 : 200,
      height: type === 'text' ? 60 : 150,
      content: type === 'text' ? 'Nouveau texte' : type === 'image' ? '' : '',
      style:
        type === 'text'
          ? { fontSize: 18, color: '#333' }
          : type === 'shape'
            ? { backgroundColor: 'hsl(var(--primary) / 0.2)', borderRadius: 8 }
            : {},
    }

    if (type === 'image') {
      const url = window.prompt("URL de l'image :")
      if (!url) return
      newEl.content = url
      newEl.style = { objectFit: 'cover' }
    }

    updateSlide(presentation.currentSlide, (slide) => ({
      ...slide,
      elements: [...slide.elements, newEl],
    }))
    setSelectedElementId(newEl.id)
  }

  const updateElement = (elementId: string, updates: Partial<SlideElement>) => {
    updateSlide(presentation.currentSlide, (slide) => ({
      ...slide,
      elements: slide.elements.map((el) => (el.id === elementId ? { ...el, ...updates } : el)),
    }))
  }

  const deleteElement = () => {
    if (!selectedElementId) return
    updateSlide(presentation.currentSlide, (slide) => ({
      ...slide,
      elements: slide.elements.filter((el) => el.id !== selectedElementId),
    }))
    setSelectedElementId(null)
  }

  const handleSave = useCallback(async () => {
    if (isSaving || isNativeSaving) return // P0 audit : garde anti-doublon.
    setIsSaving(true)
    try {
      const json = JSON.stringify(presentation)
      const blob = new Blob([json], { type: 'application/json' })
      await saveToNextcloud(blob)
      setLastSaved(new Date())
      dirtyRef.current = false
      if (documentId) saveVersion(documentId, json, 'json', { auto: true })
      toast.success('Présentation enregistrée')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }, [isSaving, isNativeSaving, presentation, saveToNextcloud, documentId])

  const handleExportPptx = useCallback(async () => {
    try {
      const PptxGenJS = (await import('pptxgenjs')).default
      const pptx = new PptxGenJS()
      pptx.layout = 'LAYOUT_16x9'

      presentation.slides.forEach((slide) => {
        const pptxSlide = pptx.addSlide()
        if (slide.backgroundColor) {
          pptxSlide.background = { color: slide.backgroundColor.replace('#', '') }
        }

        slide.elements.forEach((el) => {
          const xInch = (el.x / SLIDE_WIDTH) * 10
          const yInch = (el.y / SLIDE_HEIGHT) * 5.625
          const wInch = (el.width / SLIDE_WIDTH) * 10
          const hInch = (el.height / SLIDE_HEIGHT) * 5.625

          if (el.type === 'text') {
            pptxSlide.addText(el.content, {
              x: xInch,
              y: yInch,
              w: wInch,
              h: hInch,
              fontSize: el.style?.fontSize ? el.style.fontSize * 0.75 : 14,
              bold: el.style?.fontWeight === 'bold',
              color: el.style?.color?.replace('#', '') || '333333',
              align: (el.style?.textAlign as any) || 'left',
            })
          } else if (el.type === 'image' && el.content) {
            pptxSlide.addImage({
              path: el.content,
              x: xInch,
              y: yInch,
              w: wInch,
              h: hInch,
            })
          } else if (el.type === 'shape') {
            pptxSlide.addShape('rect' as any, {
              x: xInch,
              y: yInch,
              w: wInch,
              h: hInch,
              fill: { color: el.style?.backgroundColor?.replace('#', '') || 'CCCCCC' },
            })
          }
        })
      })

      await pptx.writeFile({ fileName: `${documentName.replace(/\.[^.]+$/, '')}.pptx` })
      toast.success('PPTX exporté avec succès')
    } catch {
      toast.error("Erreur lors de l'export PPTX")
    }
  }, [presentation, documentName])

  const handleExportPdf = useCallback(async () => {
    try {
      const { jsPDF } = await loadPdfLibs()
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: [SLIDE_WIDTH, SLIDE_HEIGHT],
      })

      presentation.slides.forEach((slide, idx) => {
        if (idx > 0) doc.addPage([SLIDE_WIDTH, SLIDE_HEIGHT], 'landscape')

        // Background
        if (slide.backgroundColor && !slide.backgroundColor.includes('var(')) {
          doc.setFillColor(slide.backgroundColor)
          doc.rect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT, 'F')
        }

        slide.elements.forEach((el) => {
          if (el.type === 'text') {
            const fontSize = el.style?.fontSize || 18
            doc.setFontSize(fontSize)
            const color = el.style?.color || '#333333'
            doc.setTextColor(color)
            if (el.style?.fontWeight === 'bold') doc.setFont('helvetica', 'bold')
            else doc.setFont('helvetica', 'normal')

            const align = (el.style?.textAlign as 'left' | 'center' | 'right') || 'left'
            let textX = el.x
            if (align === 'center') textX = el.x + el.width / 2
            else if (align === 'right') textX = el.x + el.width

            const lines = doc.splitTextToSize(el.content, el.width)
            const lineHeight = fontSize * 1.2
            const totalTextH = lines.length * lineHeight
            const startY = el.y + (el.height - totalTextH) / 2 + fontSize

            doc.text(lines, textX, startY, { align, maxWidth: el.width })
          } else if (el.type === 'shape') {
            const bgColor = el.style?.backgroundColor || '#cccccc'
            if (!bgColor.includes('var(')) {
              doc.setFillColor(bgColor)
            } else {
              doc.setFillColor('#cccccc')
            }
            doc.roundedRect(
              el.x,
              el.y,
              el.width,
              el.height,
              el.style?.borderRadius || 0,
              el.style?.borderRadius || 0,
              'F'
            )
          } else if (el.type === 'image' && el.content) {
            try {
              doc.addImage(el.content, 'JPEG', el.x, el.y, el.width, el.height)
            } catch {
              // Skip images that fail to load
            }
          }
        })
      })

      doc.save(`${documentName.replace(/\.[^.]+$/, '')}.pdf`)
      toast.success('PDF exporté avec succès')
    } catch {
      toast.error("Erreur lors de l'export PDF")
    }
  }, [presentation, documentName])

  // Raccourcis clavier Office-parity : Ctrl+S, Ctrl+Z/Y, Delete, Escape,
  // navigation slides (flèches + PageUp/PageDown + Home/End), F5 lance le
  // mode plein écran. Les changements de slide utilisent `replacePresentation`
  // pour NE PAS polluer l'historique undo/redo (parité PowerPoint).
  const goSlide = useCallback(
    (delta: number) => {
      replacePresentation((prev) => ({
        ...prev,
        currentSlide: Math.max(0, Math.min(prev.slides.length - 1, prev.currentSlide + delta)),
      }))
    },
    [replacePresentation]
  )
  const setSlide = useCallback(
    (idx: number) => {
      replacePresentation((prev) => ({
        ...prev,
        currentSlide: Math.max(0, Math.min(prev.slides.length - 1, idx)),
      }))
    },
    [replacePresentation]
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target) || !!editingElementId
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSave()
        return
      }
      const ur = matchUndoRedo(e)
      if (ur && !typing) {
        e.preventDefault()
        if (ur === 'undo') undoPresentation()
        else redoPresentation()
        return
      }
      if (e.key === 'F5') {
        e.preventDefault()
        setIsFullscreen(true)
        return
      }
      if (e.key === 'Delete' && selectedElementId && !editingElementId) {
        deleteElement()
        return
      }
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false)
        else {
          setSelectedElementId(null)
          setEditingElementId(null)
        }
        return
      }
      if (typing) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        goSlide(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        goSlide(-1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        setSlide(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setSlide(Number.MAX_SAFE_INTEGER)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [
    handleSave,
    selectedElementId,
    editingElementId,
    isFullscreen,
    undoPresentation,
    redoPresentation,
    deleteElement,
    goSlide,
    setSlide,
  ])

  // Fullscreen mode
  if (isFullscreen) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-black flex items-center justify-center cursor-none"
        onClick={() => {
          replacePresentation((prev) => ({
            ...prev,
            currentSlide: Math.min(prev.currentSlide + 1, prev.slides.length - 1),
          }))
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          setIsFullscreen(false)
        }}
      >
        <div
          className="relative"
          style={{
            width: '100vw',
            height: `${(100 * 9) / 16}vw`,
            maxHeight: '100vh',
            maxWidth: `${(100 * 16) / 9}vh`,
            backgroundColor: currentSlide?.backgroundColor || '#ffffff',
          }}
        >
          {currentSlide?.elements.map((el) => (
            <div
              key={el.id}
              className="absolute"
              style={{
                left: `${(el.x / SLIDE_WIDTH) * 100}%`,
                top: `${(el.y / SLIDE_HEIGHT) * 100}%`,
                width: `${(el.width / SLIDE_WIDTH) * 100}%`,
                height: `${(el.height / SLIDE_HEIGHT) * 100}%`,
              }}
            >
              {el.type === 'text' && (
                <div
                  style={{
                    fontSize: `${((el.style?.fontSize || 18) / SLIDE_WIDTH) * 100}vw`,
                    fontWeight: el.style?.fontWeight,
                    color: el.style?.color,
                    textAlign: el.style?.textAlign as any,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {el.content}
                </div>
              )}
              {el.type === 'image' && el.content && (
                <img
                  loading="lazy"
                  decoding="async"
                  src={el.content}
                  alt=""
                  className="w-full h-full"
                  style={{ objectFit: (el.style?.objectFit as any) || 'cover' }}
                />
              )}
              {el.type === 'shape' && (
                <div
                  className="w-full h-full"
                  style={{
                    backgroundColor: el.style?.backgroundColor,
                    borderRadius: el.style?.borderRadius,
                  }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="absolute bottom-4 right-4 text-white/50 text-xs">
          {presentation.currentSlide + 1} / {presentation.slides.length} — Clic droit pour quitter
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col editor-shell h-full overflow-hidden', className)}>
      <EditorHeader
        documentName={documentName}
        kind="Présentation"
        isSaving={isSaving}
        lastSaved={lastSaved}
        presence={coeditUsers}
        isCollabConnected={isCoeditConnected}
      >
        <EditorAIButton onClick={() => setAiOpen(true)} title="Générer un deck avec l'IA">
          IA Deck
        </EditorAIButton>
        <EditorAIButton onClick={() => setCopilotOpen(true)} title="Ouvrir le Copilot (chat IA)">
          Copilot
        </EditorAIButton>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="gap-1.5 h-8 text-xs"
        >
          <Save className="h-3.5 w-3.5" /> Enregistrer
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setHistoryOpen(true)}
          className="gap-1.5 h-8 text-xs"
          title="Historique des versions"
        >
          <History className="h-3.5 w-3.5" /> Historique
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExportPptx}
          className="gap-1.5 h-8 text-xs"
        >
          <FileDown className="h-3.5 w-3.5" /> PPTX
        </Button>
        <Button variant="ghost" size="sm" onClick={handleExportPdf} className="gap-1.5 h-8 text-xs">
          <FileDown className="h-3.5 w-3.5" /> PDF
        </Button>
        <Button
          size="sm"
          onClick={() => setIsFullscreen(true)}
          className="gap-1.5 h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Play className="h-3.5 w-3.5" /> Présenter
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPresenterOpen(true)}
          className="gap-1.5 h-8 text-xs"
        >
          <PresentationIcon className="h-3.5 w-3.5" /> Mode Présentateur
        </Button>
        {onClose && <EditorCloseButton onClose={onClose} />}
      </EditorHeader>

      {/* Toolbar */}
      <div className="editor-toolbar flex items-center gap-2 px-4 py-2 overflow-x-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={() => addElement('text')}
          className="gap-1.5 h-8 text-xs"
        >
          <Type className="h-3.5 w-3.5" /> Texte
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addElement('image')}
          className="gap-1.5 h-8 text-xs"
        >
          <ImageIcon className="h-3.5 w-3.5" /> Image
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addElement('shape')}
          className="gap-1.5 h-8 text-xs"
        >
          <Square className="h-3.5 w-3.5" /> Forme
        </Button>
        {selectedElementId && (
          <>
            <div className="h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              onClick={deleteElement}
              className="gap-1.5 h-8 text-xs text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Supprimer
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Slide thumbnails panel */}
        <div className="w-52 min-w-[208px] editor-rail overflow-y-auto p-3 space-y-2.5">
          {presentation.slides.map((slide, index) => (
            <div
              key={slide.id}
              className={cn(
                'relative group cursor-pointer rounded-lg overflow-hidden transition-all',
                index === presentation.currentSlide
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-transparent shadow-[var(--shadow-paper)] scale-[1.02]'
                  : 'ring-1 ring-border hover:ring-primary/40 shadow-sm'
              )}
              onClick={() => {
                replacePresentation((prev) => ({ ...prev, currentSlide: index }))
                setSelectedElementId(null)
                setEditingElementId(null)
              }}
            >
              <div
                className="aspect-video p-1"
                style={{ backgroundColor: slide.backgroundColor || 'hsl(var(--editor-paper))' }}
              >
                <div className="relative w-full h-full" style={{ fontSize: '4px' }}>
                  {slide.elements.map((el) => (
                    <div
                      key={el.id}
                      className="absolute overflow-hidden"
                      style={{
                        left: `${(el.x / SLIDE_WIDTH) * 100}%`,
                        top: `${(el.y / SLIDE_HEIGHT) * 100}%`,
                        width: `${(el.width / SLIDE_WIDTH) * 100}%`,
                        height: `${(el.height / SLIDE_HEIGHT) * 100}%`,
                        color: el.style?.color,
                        fontWeight: el.style?.fontWeight,
                        backgroundColor:
                          el.type === 'shape' ? el.style?.backgroundColor : undefined,
                      }}
                    >
                      {el.type === 'text' && <span className="line-clamp-2">{el.content}</span>}
                      {el.type === 'image' && el.content && (
                        <img
                          loading="lazy"
                          decoding="async"
                          src={el.content}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <span
                className={cn(
                  'absolute bottom-1 left-1.5 text-[10px] font-semibold rounded px-1.5 py-0.5',
                  index === presentation.currentSlide
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background/85 text-muted-foreground'
                )}
              >
                {index + 1}
              </span>
              {presentation.slides.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSlide(index)
                  }}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-destructive text-destructive-foreground rounded-full p-1 transition-opacity shadow"
                  aria-label="Supprimer la slide"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={addSlide}
            className="w-full gap-1.5 text-xs border-dashed hover:border-primary hover:text-primary hover:bg-primary/5"
          >
            <Plus className="h-3 w-3" /> Ajouter une slide
          </Button>
        </div>

        {/* Main canvas area */}
        <div className="flex-1 overflow-auto flex items-center justify-center editor-slide-stage p-6">
          <div
            className="editor-slide-canvas relative rounded-md"
            style={{
              width: SLIDE_WIDTH,
              height: SLIDE_HEIGHT,
              backgroundColor: currentSlide?.backgroundColor || '#ffffff',
              transform: 'scale(0.85)',
              transformOrigin: 'center',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedElementId(null)
                setEditingElementId(null)
              }
            }}
          >
            {currentSlide?.elements.map((el) => (
              <div
                key={el.id}
                className={cn(
                  'absolute cursor-move',
                  selectedElementId === el.id &&
                    'outline outline-2 outline-primary outline-offset-1'
                )}
                style={{
                  left: el.x,
                  top: el.y,
                  width: el.width,
                  height: el.height,
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedElementId(el.id)
                }}
                onDoubleClick={() => {
                  if (el.type === 'text') setEditingElementId(el.id)
                }}
              >
                {el.type === 'text' && editingElementId === el.id ? (
                  <Textarea
                    className="w-full h-full resize-none border-0 bg-transparent p-0 focus-visible:ring-0"
                    style={{
                      fontSize: el.style?.fontSize,
                      fontWeight: el.style?.fontWeight,
                      color: el.style?.color,
                      textAlign: el.style?.textAlign as any,
                    }}
                    value={el.content}
                    onChange={(e) => updateElement(el.id, { content: e.target.value })}
                    onBlur={() => setEditingElementId(null)}
                    autoFocus
                  />
                ) : el.type === 'text' ? (
                  <div
                    className="w-full h-full flex items-center whitespace-pre-wrap"
                    style={{
                      fontSize: el.style?.fontSize,
                      fontWeight: el.style?.fontWeight,
                      color: el.style?.color,
                      textAlign: el.style?.textAlign as any,
                      justifyContent:
                        el.style?.textAlign === 'center'
                          ? 'center'
                          : el.style?.textAlign === 'right'
                            ? 'flex-end'
                            : 'flex-start',
                    }}
                  >
                    {el.content}
                  </div>
                ) : el.type === 'image' && el.content ? (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={el.content}
                    alt=""
                    className="w-full h-full"
                    style={{ objectFit: (el.style?.objectFit as any) || 'cover' }}
                  />
                ) : el.type === 'shape' ? (
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundColor: el.style?.backgroundColor,
                      borderRadius: el.style?.borderRadius,
                    }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Properties panel */}
        {selectedElement && (
          <div className="w-60 min-w-[240px] editor-rail border-l border-border p-4 space-y-4 overflow-y-auto">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Propriétés
            </h3>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Position X</label>
              <Input
                type="number"
                className="h-7 text-xs"
                value={selectedElement.x}
                onChange={(e) =>
                  updateElement(selectedElement.id, { x: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Position Y</label>
              <Input
                type="number"
                className="h-7 text-xs"
                value={selectedElement.y}
                onChange={(e) =>
                  updateElement(selectedElement.id, { y: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Largeur</label>
              <Input
                type="number"
                className="h-7 text-xs"
                value={selectedElement.width}
                onChange={(e) =>
                  updateElement(selectedElement.id, { width: parseInt(e.target.value) || 100 })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Hauteur</label>
              <Input
                type="number"
                className="h-7 text-xs"
                value={selectedElement.height}
                onChange={(e) =>
                  updateElement(selectedElement.id, { height: parseInt(e.target.value) || 50 })
                }
              />
            </div>

            {selectedElement.type === 'text' && (
              <>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Taille police</label>
                  <Input
                    type="number"
                    className="h-7 text-xs"
                    value={selectedElement.style?.fontSize || 18}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        style: {
                          ...selectedElement.style,
                          fontSize: parseInt(e.target.value) || 18,
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Couleur</label>
                  <Input
                    type="color"
                    className="h-7 w-full"
                    value={selectedElement.style?.color || '#333333'}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        style: { ...selectedElement.style, color: e.target.value },
                      })
                    }
                  />
                </div>
              </>
            )}

            {selectedElement.type === 'shape' && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Couleur de fond</label>
                <Input
                  type="color"
                  className="h-7 w-full"
                  value={selectedElement.style?.backgroundColor || '#cccccc'}
                  onChange={(e) =>
                    updateElement(selectedElement.id, {
                      style: { ...selectedElement.style, backgroundColor: e.target.value },
                    })
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer / slide navigation */}
      <div className="editor-header flex items-center justify-center gap-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={presentation.currentSlide === 0}
          onClick={() =>
            replacePresentation((prev) => ({ ...prev, currentSlide: prev.currentSlide - 1 }))
          }
          aria-label="Précédent"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground font-medium tabular-nums">
          Slide{' '}
          <span className="text-foreground font-semibold">{presentation.currentSlide + 1}</span> /{' '}
          {presentation.slides.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={presentation.currentSlide === presentation.slides.length - 1}
          onClick={() =>
            replacePresentation((prev) => ({ ...prev, currentSlide: prev.currentSlide + 1 }))
          }
          aria-label="Suivant"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <AIGenerateDeckDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        documentId={documentId ?? null}
        onGenerated={(deck: GeneratedDeck) => {
          const newSlides: Slide[] = []
          if (deck.title) {
            newSlides.push({
              id: crypto.randomUUID(),
              backgroundColor: 'hsl(var(--primary))',
              elements: [
                {
                  id: crypto.randomUUID(),
                  type: 'text',
                  x: 60,
                  y: 200,
                  width: 840,
                  height: 100,
                  content: deck.title,
                  style: {
                    fontSize: 42,
                    fontWeight: 'bold',
                    color: '#ffffff',
                    textAlign: 'center',
                  },
                },
              ],
            })
          }
          for (const s of deck.slides) {
            newSlides.push({
              id: crypto.randomUUID(),
              notes: s.notes,
              elements: [
                {
                  id: crypto.randomUUID(),
                  type: 'text',
                  x: 60,
                  y: 40,
                  width: 840,
                  height: 60,
                  content: s.title,
                  style: { fontSize: 30, fontWeight: 'bold', color: '#1a1a2e', textAlign: 'left' },
                },
                {
                  id: crypto.randomUUID(),
                  type: 'text',
                  x: 80,
                  y: 130,
                  width: 800,
                  height: 380,
                  content: (s.bullets ?? []).map((b) => `• ${b}`).join('\n'),
                  style: { fontSize: 20, color: '#333', textAlign: 'left' },
                },
              ],
            })
          }
          setPresentation({ slides: newSlides, currentSlide: 0 })
          toast.success('Deck IA importé')
        }}
      />

      <CopilotSidePanel
        open={copilotOpen}
        onOpenChange={setCopilotOpen}
        documentTitle={documentName}
        documentHtml={presentation.slides
          .map((s, idx) => {
            const texts = s.elements
              .filter((el) => el.type === 'text')
              .map((el) => el.content || '')
              .join('\n')
            return `Slide ${idx + 1}:\n${texts}${s.notes ? `\nNotes: ${s.notes}` : ''}`
          })
          .join('\n\n')}
        documentId={documentId ?? null}
        onInsertAtCursor={(html: string) => {
          // Nettoie le HTML → texte pour la slide
          const tmp = document.createElement('div')
          tmp.innerHTML = html
          const title = tmp.querySelector('h1,h2,h3')?.textContent?.trim() || 'Nouvelle slide'
          tmp.querySelector('h1,h2,h3')?.remove()
          const bodyText = tmp.textContent?.trim() || ''
          const newSlide: Slide = {
            id: crypto.randomUUID(),
            elements: [
              {
                id: crypto.randomUUID(),
                type: 'text',
                x: 60,
                y: 40,
                width: 840,
                height: 60,
                content: title,
                style: { fontSize: 30, fontWeight: 'bold', color: '#1a1a2e', textAlign: 'left' },
              },
              {
                id: crypto.randomUUID(),
                type: 'text',
                x: 80,
                y: 130,
                width: 800,
                height: 380,
                content: bodyText,
                style: { fontSize: 20, color: '#333', textAlign: 'left' },
              },
            ],
          }
          setPresentation((prev) => ({
            slides: [...prev.slides, newSlide],
            currentSlide: prev.slides.length,
          }))
          toast.success('Slide insérée depuis Copilot')
        }}
      />

      {presenterOpen && (
        <PresenterMode
          initialIndex={presentation.currentSlide}
          onClose={() => setPresenterOpen(false)}
          slides={presentation.slides.map(
            (s): PresenterSlide => ({
              id: s.id,
              notes: s.notes,
              html: `<div style="position:relative;width:100%;height:100%;background:${s.backgroundColor || '#fff'};">${s.elements
                .map((el) => {
                  const posStyle = `position:absolute;left:${(el.x / SLIDE_WIDTH) * 100}%;top:${(el.y / SLIDE_HEIGHT) * 100}%;width:${(el.width / SLIDE_WIDTH) * 100}%;height:${(el.height / SLIDE_HEIGHT) * 100}%;`
                  if (el.type === 'text') {
                    const st = `${posStyle}display:flex;align-items:center;font-size:${((el.style?.fontSize || 18) / SLIDE_WIDTH) * 100}vw;font-weight:${el.style?.fontWeight || 'normal'};color:${el.style?.color || '#000'};text-align:${el.style?.textAlign || 'left'};white-space:pre-wrap;`
                    const safe = (el.content || '').replace(
                      /[&<>]/g,
                      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!
                    )
                    return `<div style="${st}">${safe}</div>`
                  }
                  if (el.type === 'image' && el.content) {
                    return `<img src="${el.content}" style="${posStyle}object-fit:${el.style?.objectFit || 'cover'};" alt=""/>`
                  }
                  return `<div style="${posStyle}background:${el.style?.backgroundColor || '#ccc'};border-radius:${el.style?.borderRadius || 0}px;"></div>`
                })
                .join('')}</div>`,
            })
          )}
        />
      )}

      <VersionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        documentId={documentId}
        documentName={documentName}
        kind="json"
        getCurrentContent={() => JSON.stringify(presentation)}
        onRestore={(content) => {
          try {
            const parsed = JSON.parse(content) as PresentationState
            resetPresentation(parsed)
            setSelectedElementId(null)
            setEditingElementId(null)
          } catch (err) {
            console.error('Restore presentation version failed', err)
            toast.error('Impossible de restaurer cette version')
          }
        }}
      />
    </div>
  )
}
