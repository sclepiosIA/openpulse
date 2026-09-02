import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  Excalidraw,
  convertToExcalidrawElements,
  exportToBlob,
  exportToSvg,
} from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { useUpdateWhiteboard, type Whiteboard } from '@/hooks/whiteboards/useWhiteboards'
import {
  Loader2,
  Check,
  StickyNote,
  Sparkles,
  Image as ImageIcon,
  LayoutTemplate,
  Download,
  Maximize2,
  Minimize2,
  Trash2,
  Network,
  Users,
  Upload,
  History,
  Blocks,
  MessageSquare,
  Search,
  PanelRight,
  Frame as FrameIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/shared/use-toast'
import { WHITEBOARD_TEMPLATES, buildTemplate } from '@/lib/whiteboardTemplates'
import { buildMindMapSkeletons, parseMindMapJson } from '@/lib/mindmapSkeletons'
import { useWhiteboardCollab, mergeElements } from '@/hooks/whiteboards/useWhiteboardCollab'
import { useCreateVersion, type WhiteboardVersion } from '@/hooks/whiteboards/useWhiteboardVersions'
import type { LibraryItem } from '@/hooks/whiteboards/useWhiteboardLibrary'
import type { TeamKey } from '@/hooks/whiteboards/useSimpleWhiteboards'
import { WhiteboardVersionsPanel } from './WhiteboardVersionsPanel'
import { WhiteboardLibraryPanel } from './WhiteboardLibraryPanel'
import { WhiteboardCommentsPanel } from './WhiteboardCommentsPanel'
import { cn } from '@/lib/utils'
import { MARQUE } from '@/config/branding'
import { isWhiteboardTextEditing } from './whiteboardEditingGuard'

type ExcalidrawImperativeAPI = any

interface Props {
  whiteboard: Whiteboard
  readOnly?: boolean
  /** Active la collaboration temps réel (tableaux équipe / entreprise). */
  collaborative?: boolean
  /** Périmètre du tableau, utilisé pour le partage des blocs de bibliothèque. */
  scope?: 'personal' | 'team' | 'company'
  team?: TeamKey | null
}

const POSTIT_COLORS = [
  { hex: '#fef3c7', label: 'Jaune' },
  { hex: '#fecaca', label: 'Rouge' },
  { hex: '#bbf7d0', label: 'Vert' },
  { hex: '#bfdbfe', label: 'Bleu' },
  { hex: '#e9d5ff', label: 'Violet' },
  { hex: '#fed7aa', label: 'Orange' },
]

/** Intervalle minimum entre deux instantanés automatiques d'historique. */
const AUTO_VERSION_INTERVAL_MS = 10 * 60 * 1000

function randomId() {
  return `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Tableau blanc Excalidraw complet : post-its colorés, modèles, bibliothèque de blocs,
 * assistants IA (texte, mind map, image), historique de versions, commentaires,
 * recherche/plan, import-export (PNG/SVG/PDF/JSON) et collaboration temps réel
 * incrémentale avec curseurs distants.
 */
export function WhiteboardCanvas({
  whiteboard,
  readOnly = false,
  collaborative = false,
  scope = 'personal',
  team = null,
}: Props) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>('')
  const lastVersionAtRef = useRef<number>(Date.now())
  const cursorSentAtRef = useRef<number>(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const updateWb = useUpdateWhiteboard()
  const createVersion = useCreateVersion()
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTab, setPanelTab] = useState('versions')
  const [search, setSearch] = useState('')
  const [outlineTick, setOutlineTick] = useState(0)
  const [viewport, setViewport] = useState({ scrollX: 0, scrollY: 0, zoom: 1 })
  const { toast } = useToast()

  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMode, setAiMode] = useState<'postit' | 'bullets'>('postit')
  // Accès aux données de la base (outils Jarvis) — activé par défaut.
  const [aiUseKnowledge, setAiUseKnowledge] = useState<boolean>(true)
  const [mapPrompt, setMapPrompt] = useState('')
  const [mapBusy, setMapBusy] = useState(false)
  const [imgPrompt, setImgPrompt] = useState('')
  const [imgBusy, setImgBusy] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [imgOpen, setImgOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const isEditingText = useCallback(
    () =>
      isWhiteboardTextEditing(
        apiRef.current,
        typeof document === 'undefined' ? null : document.activeElement
      ),
    []
  )

  /**
   * Excalidraw ne redessine pas le texte lié aux formes tant que les polices
   * (Excalifont/Virgil) ne sont pas chargées : on force un repaint dès que
   * document.fonts est prêt, sinon le texte n'apparaît qu'à la sélection.
   */
  const forceRepaint = useCallback(() => {
    const run = () => {
      const api = apiRef.current
      if (!api) return
      if (isEditingText()) return
      try {
        api.refresh?.()
        const els = api
          .getSceneElements()
          .map((el: any) => ({ ...el, version: (el.version ?? 1) + 1 }))
        api.updateScene({ elements: els as any })
      } catch {
        /* noop */
      }
    }
    const schedule = () => {
      requestAnimationFrame(run)
      ;[80, 250, 600, 1200].forEach((d) => setTimeout(run, d))
    }
    if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
      ;(document as any).fonts.ready.then(schedule).catch(schedule)
    } else {
      schedule()
    }
  }, [isEditingText])

  /** Fusion des éléments distants (par id/version) : le travail local n'est jamais écrasé. */
  const pendingRemoteRef = useRef<unknown[] | null>(null)
  const applyRemoteScene = useCallback((incoming: unknown[]) => {
    const api = apiRef.current
    if (!api) return
    if (isEditingText()) {
      pendingRemoteRef.current = incoming
      return
    }
    const merged = mergeElements(api.getSceneElements() as any, incoming as any)
    lastSavedRef.current = JSON.stringify(merged)
    api.updateScene({ elements: merged as any })
    setOutlineTick((t) => t + 1)
  }, [isEditingText])

  /** Resynchronisation depuis la base après une reconnexion temps réel. */
  const resyncFromDb = useCallback(async () => {
    const api = apiRef.current
    if (!api) return
    const { data } = await supabase
      .from('whiteboards')
      .select('scene')
      .eq('id', whiteboard.id)
      .maybeSingle()
    const remote = ((data as any)?.scene?.elements ?? []) as unknown[]
    if (remote.length) applyRemoteScene(remote)
  }, [whiteboard.id, applyRemoteScene])

  const { peers, broadcastScene, broadcastCursor } = useWhiteboardCollab(
    whiteboard.id,
    collaborative && !readOnly,
    applyRemoteScene,
    resyncFromDb
  )

  useEffect(() => {
    const api = apiRef.current
    if (!api) return
    const scene = whiteboard.scene || {}
    api.updateScene({
      elements: (scene.elements as any) ?? [],
      appState: { ...(scene.appState as any), collaborators: new Map() },
    })
    if (scene.files) api.addFiles(Object.values(scene.files as any))
    lastSavedRef.current = JSON.stringify(scene.elements ?? [])
    lastVersionAtRef.current = Date.now()
    setStatus('idle')
    setOutlineTick((t) => t + 1)
    forceRepaint()
  }, [whiteboard.id, forceRepaint])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  /** Instantané d'historique espacé dans le temps pour ne pas saturer la base. */
  const maybeSnapshot = useCallback(
    (elements: readonly unknown[], appState: Record<string, unknown>, files: unknown) => {
      if (readOnly) return
      if (Date.now() - lastVersionAtRef.current < AUTO_VERSION_INTERVAL_MS) return
      lastVersionAtRef.current = Date.now()
      createVersion.mutate({
        whiteboardId: whiteboard.id,
        scene: { elements: elements as unknown[], appState, files },
        reason: 'auto',
      })
    },
    [createVersion, readOnly, whiteboard.id]
  )

  const handleChange = useCallback(
    (elements: readonly any[], appState: any, files: any) => {
      const zoom = appState.zoom?.value ?? 1
      setViewport((v) =>
        v.scrollX === appState.scrollX && v.scrollY === appState.scrollY && v.zoom === zoom
          ? v
          : { scrollX: appState.scrollX ?? 0, scrollY: appState.scrollY ?? 0, zoom }
      )
      if (readOnly) return
      if (pendingRemoteRef.current && !isEditingText()) {
        const pending = pendingRemoteRef.current
        pendingRemoteRef.current = null
        applyRemoteScene(pending)
      }
      const serialized = JSON.stringify(elements)
      if (serialized === lastSavedRef.current) return
      lastSavedRef.current = serialized
      setStatus('saving')
      if (collaborative) broadcastScene(elements)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        const cleanAppState = {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
          zoom: appState.zoom,
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
        }
        updateWb.mutate(
          {
            id: whiteboard.id,
            patch: { scene: { elements: elements as unknown[], appState: cleanAppState, files } },
          },
          {
            onSuccess: () => {
              setStatus('saved')
              setOutlineTick((t) => t + 1)
              maybeSnapshot(elements, cleanAppState, files)
            },
            onError: () => setStatus('idle'),
          }
        )
      }, 800)
    },
    [
      whiteboard.id,
      readOnly,
      updateWb,
      collaborative,
      broadcastScene,
      maybeSnapshot,
      isEditingText,
      applyRemoteScene,
    ]
  )

  /** Point de dépôt centré sur la zone visible du canvas. */
  const getDropPoint = useCallback(() => {
    const api = apiRef.current
    if (!api) return { x: 100, y: 100 }
    const st = api.getAppState()
    const rect = containerRef.current?.getBoundingClientRect()
    const w = rect?.width ?? window.innerWidth
    const h = rect?.height ?? window.innerHeight
    const cx = (w / 2 - (st.scrollX ?? 0)) / (st.zoom?.value ?? 1)
    const cy = (h / 2 - (st.scrollY ?? 0)) / (st.zoom?.value ?? 1)
    return { x: Math.round(cx - 110), y: Math.round(cy - 100) }
  }, [])

  const appendElements = (skeletons: Record<string, unknown>[], scrollTo = true) => {
    const api = apiRef.current
    if (!api || readOnly || skeletons.length === 0) return
    const newEls = convertToExcalidrawElements(skeletons as any)
    const current = api.getSceneElements()
    api.updateScene({ elements: [...current, ...newEls] })
    if (scrollTo) {
      try {
        api.scrollToContent(newEls, { fitToContent: true, animate: true })
      } catch {
        /* noop */
      }
    }
    forceRepaint()
  }

  const addPostIt = (text = 'Nouvelle note', color?: string) => {
    const { x, y } = getDropPoint()
    const bg = color ?? POSTIT_COLORS[Math.floor(Math.random() * POSTIT_COLORS.length)].hex
    appendElements(
      [
        {
          type: 'rectangle',
          x,
          y,
          width: 220,
          height: 200,
          backgroundColor: bg,
          strokeColor: 'transparent',
          fillStyle: 'solid',
          roughness: 0,
          roundness: { type: 3 },
          label: { text, fontSize: 20, fontFamily: 2, textAlign: 'center' },
        },
      ],
      false
    )
  }

  const insertTemplate = (key: (typeof WHITEBOARD_TEMPLATES)[number]['key']) => {
    const { x, y } = getDropPoint()
    appendElements(buildTemplate(key, x - 300, y))
  }

  /** Ajoute un cadre nommé permettant de structurer le tableau (et de le présenter). */
  const addFrame = () => {
    const api = apiRef.current
    if (!api || readOnly) return
    const { x, y } = getDropPoint()
    const frame = {
      id: randomId(),
      type: 'frame',
      x: x - 300,
      y: y - 200,
      width: 900,
      height: 600,
      name: `Cadre ${(api.getSceneElements() as any[]).filter((e) => e.type === 'frame').length + 1}`,
      version: 1,
      versionNonce: Date.now(),
      seed: Math.floor(Math.random() * 1e6),
      angle: 0,
      strokeColor: '#bbb',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      boundElements: [],
      updated: Date.now(),
      link: null,
      locked: false,
      isDeleted: false,
    }
    api.updateScene({ elements: [...(api.getSceneElements() as any[]), frame as any] })
    setOutlineTick((t) => t + 1)
  }

  const invokeAi = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('notes-ai-assist', { body })
    if (error) {
      const details =
        typeof (error as any)?.context?.text === 'function'
          ? await (error as any).context.text().catch(() => '')
          : ''
      throw new Error(details || error.message)
    }
    const payload = data as any
    if (payload?.error)
      throw new Error(typeof payload.error === 'string' ? payload.error : 'Erreur IA')
    if (payload?.knowledge_used) {
      toast({
        title: `Données ${MARQUE.nomCourt} utilisées`,
        description: "La réponse s'appuie sur la base de données interne.",
      })
    } else if (payload?.knowledge_requested) {
      const reason =
        payload.knowledge_error === 'no-data'
          ? 'Aucune donnée interne pertinente trouvée.'
          : payload.knowledge_error === 'timeout'
            ? 'La recherche dans la base a dépassé le délai imparti.'
            : "La base de données n'a pas pu être interrogée."
      toast({ title: 'Rédaction sans données internes', description: reason })
    }
    return payload?.text?.trim() as string | undefined
  }

  const runAiText = async () => {
    if (!aiPrompt.trim() || aiBusy) return
    setAiBusy(true)
    try {
      const text = await invokeAi({
        prompt: aiPrompt.trim(),
        mode: aiMode,
        useKnowledge: aiUseKnowledge,
      })
      if (!text) throw new Error('Réponse vide')
      if (aiMode === 'bullets') {
        const lines = text
          .split('\n')
          .map((l) => l.replace(/^[•\-*]\s*/, '').trim())
          .filter(Boolean)
        const { x, y } = getDropPoint()
        appendElements(
          lines.map((l, i) => ({
            type: 'rectangle',
            x: x + (i % 3) * 240,
            y: y + Math.floor(i / 3) * 220,
            width: 220,
            height: 200,
            backgroundColor: POSTIT_COLORS[i % POSTIT_COLORS.length].hex,
            strokeColor: 'transparent',
            fillStyle: 'solid',
            roughness: 0,
            roundness: { type: 3 },
            label: { text: l, fontSize: 18, fontFamily: 2, textAlign: 'center' },
          }))
        )
      } else {
        addPostIt(text)
      }
      setAiPrompt('')
      setAiOpen(false)
    } catch (e: any) {
      toast({
        title: 'IA indisponible',
        description: e?.message ?? 'Erreur inconnue',
        variant: 'destructive',
      })
    } finally {
      setAiBusy(false)
    }
  }

  const runAiMindmap = async () => {
    if (!mapPrompt.trim() || mapBusy) return
    setMapBusy(true)
    try {
      const raw = await invokeAi({
        prompt: mapPrompt.trim(),
        mode: 'mindmap',
        useKnowledge: aiUseKnowledge,
      })
      if (!raw) throw new Error('Réponse vide')
      const parsed = parseMindMapJson(raw)
      const { x, y } = getDropPoint()
      const { elements, branchCount } = buildMindMapSkeletons(
        parsed,
        x,
        y,
        mapPrompt.trim().slice(0, 60)
      )
      if (!branchCount) throw new Error('Carte mentale vide')

      appendElements(elements)
      toast({
        title: 'Carte mentale générée',
        description: `${branchCount} branche${branchCount > 1 ? 's' : ''}, ${elements.length} éléments.`,
      })
      setMapPrompt('')
      setMapOpen(false)
    } catch (e: any) {
      const msg =
        e instanceof SyntaxError
          ? "La réponse de l'IA n'était pas exploitable, réessayez avec un sujet plus précis."
          : (e?.message ?? 'Erreur inconnue')
      toast({ title: 'Mind map IA échouée', description: msg, variant: 'destructive' })
    } finally {
      setMapBusy(false)
    }
  }

  const runAiImage = async () => {
    if (!imgPrompt.trim() || imgBusy) return
    const api = apiRef.current
    if (!api) return
    setImgBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: imgPrompt.trim(),
          size: '1024x1024',
          quality: 'medium',
          n: 1,
          useKnowledge: aiUseKnowledge,
        },
      })
      if (error) throw error
      const img = (data as any)?.images?.[0]
      const dataUrl: string | undefined = img?.dataUrl ?? img?.url
      if (!dataUrl) {
        const msg = (data as any)?.error ?? 'Aucune image générée'
        throw new Error(typeof msg === 'string' ? msg : 'Aucune image générée')
      }
      const fileId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      api.addFiles([{ id: fileId, dataURL: dataUrl, mimeType: 'image/png', created: Date.now() }])
      const { x, y } = getDropPoint()
      appendElements(
        [
          {
            type: 'image',
            fileId,
            x,
            y,
            width: 400,
            height: 400,
            status: 'saved',
            scale: [1, 1],
          },
        ],
        false
      )
      forceRepaint()
      setImgPrompt('')
      setImgOpen(false)
    } catch (e: any) {
      toast({
        title: 'Génération image échouée',
        description: e?.message ?? 'Erreur inconnue',
        variant: 'destructive',
      })
    } finally {
      setImgBusy(false)
    }
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const slug = (whiteboard.title || 'tableau').replace(/[^\w\-]+/g, '-').toLowerCase()

  const handleExport = async (format: 'png' | 'svg' | 'pdf' | 'json') => {
    const api = apiRef.current
    if (!api || exporting) return
    const elements = api.getSceneElements()
    if (!elements.length) {
      toast({ title: 'Tableau vide', description: 'Ajoutez du contenu avant d’exporter.' })
      return
    }
    setExporting(true)
    try {
      const appState = { ...api.getAppState(), exportBackground: true, exportPadding: 32 }
      const files = api.getFiles()
      if (format === 'json') {
        const payload = {
          type: 'excalidraw',
          version: 2,
          source: 'openpulse',
          elements,
          appState: { viewBackgroundColor: appState.viewBackgroundColor },
          files,
        }
        downloadBlob(
          new Blob([JSON.stringify(payload)], { type: 'application/json' }),
          `${slug}.excalidraw`
        )
      } else if (format === 'svg') {
        const svg = await exportToSvg({ elements, appState, files, exportPadding: 32 } as any)
        const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
        downloadBlob(blob, `${slug}.svg`)
      } else {
        const blob = await exportToBlob({
          elements,
          appState,
          files,
          mimeType: 'image/png',
          quality: 1,
          getDimensions: (w: number, h: number) => ({ width: w * 2, height: h * 2, scale: 2 }),
        } as any)
        if (format === 'png') {
          downloadBlob(blob, `${slug}.png`)
        } else {
          const { default: jsPDF } = await import('jspdf')
          const dataUrl: string = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          const image = new Image()
          await new Promise((res, rej) => {
            image.onload = res
            image.onerror = rej
            image.src = dataUrl
          })
          const landscape = image.width >= image.height
          const pdf = new jsPDF({
            orientation: landscape ? 'landscape' : 'portrait',
            unit: 'pt',
            format: 'a4',
          })
          const pw = pdf.internal.pageSize.getWidth()
          const ph = pdf.internal.pageSize.getHeight()
          const ratio = Math.min((pw - 40) / image.width, (ph - 40) / image.height)
          const w = image.width * ratio
          const h = image.height * ratio
          pdf.addImage(dataUrl, 'PNG', (pw - w) / 2, (ph - h) / 2, w, h)
          pdf.save(`${slug}.pdf`)
        }
      }
      toast({
        title: 'Export réussi',
        description: `${slug}.${format === 'json' ? 'excalidraw' : format}`,
      })
    } catch (e: any) {
      toast({
        title: 'Export impossible',
        description: e?.message ?? 'Erreur inconnue',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  /** Import d'un fichier .excalidraw / .json ou d'une image, fusionné avec la scène. */
  const handleImportFile = async (file: File) => {
    const api = apiRef.current
    if (!api || readOnly) return
    try {
      // Historique avant import pour pouvoir revenir en arrière.
      createVersion.mutate({
        whiteboardId: whiteboard.id,
        scene: {
          elements: api.getSceneElements() as unknown[],
          appState: {},
          files: api.getFiles(),
        },
        reason: 'import',
      })

      if (file.type.startsWith('image/')) {
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        const fileId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        api.addFiles([{ id: fileId, dataURL: dataUrl, mimeType: file.type, created: Date.now() }])
        const { x, y } = getDropPoint()
        appendElements(
          [
            {
              type: 'image',
              fileId,
              x,
              y,
              width: 400,
              height: 400,
              status: 'saved',
              scale: [1, 1],
            },
          ],
          false
        )
        toast({ title: 'Image importée' })
        return
      }

      const text = await file.text()
      const parsed = JSON.parse(text)
      const imported = (parsed?.elements ?? []) as any[]
      if (!Array.isArray(imported) || imported.length === 0)
        throw new Error('Fichier sans éléments')
      const idMap = new Map<string, string>()
      const cloned = imported.map((el) => {
        const newId = randomId()
        idMap.set(el.id, newId)
        return {
          ...el,
          id: newId,
          version: 1,
          versionNonce: Date.now(),
          updated: Date.now(),
          isDeleted: false,
        }
      })
      // Rattacher les liaisons internes aux nouveaux identifiants.
      cloned.forEach((el: any) => {
        if (Array.isArray(el.boundElements)) {
          el.boundElements = el.boundElements
            .map((b: any) => (idMap.has(b.id) ? { ...b, id: idMap.get(b.id) } : null))
            .filter(Boolean)
        }
        if (el.containerId && idMap.has(el.containerId)) el.containerId = idMap.get(el.containerId)
        if (el.frameId && idMap.has(el.frameId)) el.frameId = idMap.get(el.frameId)
      })
      if (parsed.files) api.addFiles(Object.values(parsed.files))
      api.updateScene({ elements: [...(api.getSceneElements() as any[]), ...cloned] })
      try {
        api.scrollToContent(cloned as any, { fitToContent: true, animate: true })
      } catch {
        /* noop */
      }
      forceRepaint()
      toast({ title: 'Tableau importé', description: `${cloned.length} éléments ajoutés.` })
    } catch (e: any) {
      toast({
        title: 'Import impossible',
        description: e?.message ?? 'Fichier invalide',
        variant: 'destructive',
      })
    }
  }

  const toggleFullscreen = async () => {
    const el = containerRef.current
    if (!el) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await el.requestFullscreen()
    } catch {
      /* noop */
    }
  }

  const clearBoard = () => {
    const api = apiRef.current
    if (!api) return
    createVersion.mutate({
      whiteboardId: whiteboard.id,
      scene: { elements: api.getSceneElements() as unknown[], appState: {}, files: api.getFiles() },
      reason: 'clear',
    })
    api.updateScene({ elements: [] })
    setClearOpen(false)
    setOutlineTick((t) => t + 1)
  }

  /** Restauration d'une version : la scène courante est remplacée. */
  const restoreVersion = (sceneToRestore: WhiteboardVersion['scene']) => {
    const api = apiRef.current
    if (!api) return
    api.updateScene({ elements: (sceneToRestore.elements as any) ?? [] })
    if (sceneToRestore.files) api.addFiles(Object.values(sceneToRestore.files as any))
    forceRepaint()
    setOutlineTick((t) => t + 1)
  }

  const getCurrentScene = useCallback(() => {
    const api = apiRef.current
    return {
      elements: (api?.getSceneElements() ?? []) as unknown[],
      appState: {},
      files: api?.getFiles() ?? {},
    }
  }, [])

  const getSelection = useCallback(() => {
    const api = apiRef.current
    if (!api) return { elements: [], files: {} }
    const selectedIds = api.getAppState()?.selectedElementIds ?? {}
    const elements = (api.getSceneElements() as any[]).filter((el) => selectedIds[el.id])
    return { elements, files: api.getFiles() ?? {} }
  }, [])

  const insertLibraryItem = useCallback(
    (item: LibraryItem) => {
      const api = apiRef.current
      if (!api || readOnly) return
      const source = (item.elements ?? []) as any[]
      if (!source.length) return
      const minX = Math.min(...source.map((el) => el.x ?? 0))
      const minY = Math.min(...source.map((el) => el.y ?? 0))
      const { x, y } = getDropPoint()
      const idMap = new Map<string, string>()
      const cloned = source.map((el) => {
        const newId = randomId()
        idMap.set(el.id, newId)
        return {
          ...el,
          id: newId,
          x: (el.x ?? 0) - minX + x,
          y: (el.y ?? 0) - minY + y,
          version: 1,
          versionNonce: Date.now(),
          updated: Date.now(),
          isDeleted: false,
        }
      })
      cloned.forEach((el: any) => {
        if (Array.isArray(el.boundElements)) {
          el.boundElements = el.boundElements
            .map((b: any) => (idMap.has(b.id) ? { ...b, id: idMap.get(b.id) } : null))
            .filter(Boolean)
        }
        if (el.containerId && idMap.has(el.containerId)) el.containerId = idMap.get(el.containerId)
        if (el.frameId && idMap.has(el.frameId)) el.frameId = idMap.get(el.frameId)
      })
      if (item.files) api.addFiles(Object.values(item.files as any))
      api.updateScene({ elements: [...(api.getSceneElements() as any[]), ...cloned] })
      try {
        api.scrollToContent(cloned as any, { fitToContent: true, animate: true })
      } catch {
        /* noop */
      }
      forceRepaint()
    },
    [getDropPoint, readOnly, forceRepaint]
  )

  const focusOn = useCallback((x: number, y: number) => {
    const api = apiRef.current
    if (!api) return
    try {
      api.scrollToContent([{ x, y, width: 10, height: 10 } as any], {
        fitToContent: false,
        animate: true,
      })
    } catch {
      /* noop */
    }
  }, [])

  /** Plan du tableau : cadres nommés + textes, filtrés par la recherche. */
  const outline = useMemo(() => {
    void outlineTick
    const api = apiRef.current
    const elements = (api?.getSceneElements() ?? []) as any[]
    const q = search.trim().toLowerCase()
    const frames = elements
      .filter((el) => el.type === 'frame')
      .map((el) => ({
        id: el.id,
        label: el.name || 'Cadre',
        x: el.x,
        y: el.y,
        kind: 'frame' as const,
      }))
    const texts = elements
      .filter((el) => el.type === 'text' && typeof el.text === 'string' && el.text.trim())
      .map((el) => ({
        id: el.id,
        label: el.text.trim().slice(0, 80),
        x: el.x,
        y: el.y,
        kind: 'text' as const,
      }))
    const all = [...frames, ...texts]
    return q ? all.filter((i) => i.label.toLowerCase().includes(q)) : all.slice(0, 200)
  }, [search, outlineTick, panelOpen])

  const remoteCursors = useMemo(
    () =>
      peers.filter(
        (p) =>
          typeof p.x === 'number' &&
          typeof p.y === 'number' &&
          Date.now() - (p.updatedAt ?? 0) < 15_000
      ),
    [peers]
  )

  return (
    <TooltipProvider delayDuration={300}>
      <div ref={containerRef} className="relative h-full w-full bg-background">
        {/* Présence temps réel */}
        {collaborative && peers.length > 0 && (
          <div className="absolute right-4 top-3 z-10 flex items-center gap-1.5 rounded-full border bg-background/95 px-2.5 py-1 shadow-sm backdrop-blur">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex -space-x-1.5">
              {peers.slice(0, 5).map((p) => (
                <Tooltip key={p.id}>
                  <TooltipTrigger asChild>
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.name.slice(0, 2).toUpperCase()}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {p.name}
                    {p.editing ? ' — en train d’écrire' : ''}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            {peers.length > 5 && (
              <span className="text-[11px] text-muted-foreground">+{peers.length - 5}</span>
            )}
          </div>
        )}

        {/* Curseurs distants */}
        {collaborative &&
          remoteCursors.map((p) => (
            <div
              key={`cursor-${p.id}`}
              className="pointer-events-none absolute z-20 flex items-center gap-1"
              style={{
                left: (p.x as number) * viewport.zoom + viewport.scrollX * viewport.zoom,
                top: (p.y as number) * viewport.zoom + viewport.scrollY * viewport.zoom,
              }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full border border-white"
                style={{ backgroundColor: p.color }}
              />
              <span
                className="rounded px-1 py-0.5 text-[10px] font-medium text-white shadow"
                style={{ backgroundColor: p.color }}
              >
                {p.name}
              </span>
            </div>
          ))}

        {/* Panneau latéral (versions, bibliothèque, commentaires, plan) */}
        <div className="absolute right-4 top-14 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-9 min-h-9 w-9 rounded-full p-0 shadow-sm"
                onClick={() => setPanelOpen(true)}
                aria-label="Ouvrir le panneau du tableau"
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Historique, bibliothèque, commentaires</TooltipContent>
          </Tooltip>
        </div>

        {!readOnly && (
          <div className="pointer-events-none absolute inset-x-0 bottom-20 z-10 flex justify-center px-3">
            <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border bg-background/95 px-1.5 py-1 shadow-lg backdrop-blur">
              {/* Post-it + couleurs */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => addPostIt()}
                className="h-8 gap-1.5 rounded-full"
              >
                <StickyNote className="h-4 w-4 text-amber-500" />
                <span className="hidden sm:inline">Post-it</span>
              </Button>
              <div className="hidden items-center gap-1 pr-1 md:flex">
                {POSTIT_COLORS.map((c) => (
                  <Tooltip key={c.hex}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => addPostIt('Nouvelle note', c.hex)}
                        className="h-4 w-4 rounded-full border border-black/10 transition-transform hover:scale-125"
                        style={{ backgroundColor: c.hex }}
                        aria-label={`Post-it ${c.label}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent>Post-it {c.label.toLowerCase()}</TooltipContent>
                  </Tooltip>
                ))}
              </div>

              <div className="h-5 w-px bg-border" />

              {/* Modèles */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 gap-1.5 rounded-full">
                    <LayoutTemplate className="h-4 w-4 text-sky-500" />
                    <span className="hidden sm:inline">Modèles</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top" className="w-64">
                  <DropdownMenuLabel>Insérer un modèle</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {WHITEBOARD_TEMPLATES.map((t) => (
                    <DropdownMenuItem
                      key={t.key}
                      onSelect={() => insertTemplate(t.key)}
                      className="flex-col items-start gap-0.5"
                    >
                      <span className="text-sm font-medium">{t.label}</span>
                      <span className="text-xs text-muted-foreground">{t.description}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={addFrame}>
                    <FrameIcon className="mr-2 h-4 w-4" /> Ajouter un cadre nommé
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="h-5 w-px bg-border" />

              {/* IA texte */}
              <Popover open={aiOpen} onOpenChange={setAiOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 gap-1.5 rounded-full">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="hidden sm:inline">IA texte</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="center" className="w-80 space-y-2">
                  <div className="text-sm font-medium">Générer avec l’IA</div>
                  <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                    {(
                      [
                        ['postit', 'Un post-it'],
                        ['bullets', 'Plusieurs post-its'],
                      ] as const
                    ).map(([k, l]) => (
                      <button
                        key={k}
                        onClick={() => setAiMode(k)}
                        className={cn(
                          'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                          aiMode === k
                            ? 'bg-background shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Ex : Résume les 3 axes d'amélioration du projet…"
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runAiText()
                    }}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch checked={aiUseKnowledge} onCheckedChange={setAiUseKnowledge} />
                      <span className="leading-tight">Utiliser les données de l'instance</span>
                    </label>
                    <Button size="sm" onClick={runAiText} disabled={aiBusy || !aiPrompt.trim()}>
                      {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Générer'}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* IA mind map */}
              <Popover open={mapOpen} onOpenChange={setMapOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 gap-1.5 rounded-full">
                    <Network className="h-4 w-4 text-emerald-500" />
                    <span className="hidden sm:inline">Mind map</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="center" className="w-80 space-y-2">
                  <div className="text-sm font-medium">Carte mentale IA</div>
                  <Textarea
                    value={mapPrompt}
                    onChange={(e) => setMapPrompt(e.target.value)}
                    placeholder="Ex : Parcours de cotation aux urgences…"
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runAiMindmap()
                    }}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch checked={aiUseKnowledge} onCheckedChange={setAiUseKnowledge} />
                      <span className="leading-tight">Utiliser les données de l'instance</span>
                    </label>
                    <Button
                      size="sm"
                      onClick={runAiMindmap}
                      disabled={mapBusy || !mapPrompt.trim()}
                    >
                      {mapBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Construire'}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* IA image */}
              <Popover open={imgOpen} onOpenChange={setImgOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 gap-1.5 rounded-full">
                    <ImageIcon className="h-4 w-4 text-fuchsia-500" />
                    <span className="hidden sm:inline">IA image</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="center" className="w-80 space-y-2">
                  <div className="text-sm font-medium">Générer une image</div>
                  <Textarea
                    value={imgPrompt}
                    onChange={(e) => setImgPrompt(e.target.value)}
                    placeholder="Ex : Un logo minimaliste d'hôpital en style flat design…"
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runAiImage()
                    }}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch checked={aiUseKnowledge} onCheckedChange={setAiUseKnowledge} />
                      <span className="leading-tight">Utiliser les données de l'instance</span>
                    </label>
                    <Button size="sm" onClick={runAiImage} disabled={imgBusy || !imgPrompt.trim()}>
                      {imgBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Générer'}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <div className="h-5 w-px bg-border" />

              {/* Import */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 rounded-full p-0"
                    aria-label="Importer un fichier"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Importer (.excalidraw, .json, image)</TooltipContent>
              </Tooltip>
              <input
                ref={fileInputRef}
                type="file"
                accept=".excalidraw,application/json,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleImportFile(f)
                  e.target.value = ''
                }}
              />

              {/* Export */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 rounded-full p-0"
                    aria-label="Exporter"
                  >
                    {exporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top">
                  <DropdownMenuLabel>Exporter</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => handleExport('png')}>
                    Image PNG (HD)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleExport('svg')}>
                    Vectoriel SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleExport('pdf')}>
                    Document PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleExport('json')}>
                    Fichier .excalidraw
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={toggleFullscreen}
                    className="h-8 w-8 rounded-full p-0"
                    aria-label="Plein écran"
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setClearOpen(true)}
                    className="h-8 w-8 rounded-full p-0 text-destructive hover:text-destructive"
                    aria-label="Vider le tableau"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Vider le tableau</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-full border bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
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
            <span>Auto-sauvegarde active</span>
          )}
        </div>

        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api
            const scene = whiteboard.scene || {}
            api.updateScene({
              elements: (scene.elements as any) ?? [],
              appState: { ...(scene.appState as any), collaborators: new Map() },
            })
            if (scene.files) api.addFiles(Object.values(scene.files as any))
            forceRepaint()
          }}
          onChange={handleChange}
          onPointerUpdate={(payload: any) => {
            if (!collaborative || readOnly) return
            const now = Date.now()
            if (now - cursorSentAtRef.current < 60) return
            cursorSentAtRef.current = now
            const p = payload?.pointer
            if (p) broadcastCursor(p.x, p.y, !!payload?.button && payload.button !== 'up')
          }}
          viewModeEnabled={readOnly}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              export: { saveFileToDisk: true },
            },
          }}
          langCode="fr-FR"
        />

        <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
          <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
            <SheetHeader className="border-b p-3">
              <SheetTitle className="truncate text-base">{whiteboard.title}</SheetTitle>
            </SheetHeader>
            <Tabs
              value={panelTab}
              onValueChange={setPanelTab}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList className="mx-3 mt-2 grid w-auto grid-cols-4">
                <TabsTrigger value="versions" className="min-h-9 gap-1 px-1 text-xs">
                  <History className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Versions</span>
                </TabsTrigger>
                <TabsTrigger value="library" className="min-h-9 gap-1 px-1 text-xs">
                  <Blocks className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Blocs</span>
                </TabsTrigger>
                <TabsTrigger value="comments" className="min-h-9 gap-1 px-1 text-xs">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Notes</span>
                </TabsTrigger>
                <TabsTrigger value="outline" className="min-h-9 gap-1 px-1 text-xs">
                  <Search className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Plan</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="versions" className="mt-0 min-h-0 flex-1 overflow-hidden">
                <WhiteboardVersionsPanel
                  whiteboardId={whiteboard.id}
                  getCurrentScene={getCurrentScene}
                  onRestore={restoreVersion}
                />
              </TabsContent>
              <TabsContent value="library" className="mt-0 min-h-0 flex-1 overflow-hidden">
                <WhiteboardLibraryPanel
                  scope={scope}
                  team={team}
                  getSelection={getSelection}
                  onInsert={insertLibraryItem}
                />
              </TabsContent>
              <TabsContent value="comments" className="mt-0 min-h-0 flex-1 overflow-hidden">
                <WhiteboardCommentsPanel
                  whiteboardId={whiteboard.id}
                  getAnchor={getDropPoint}
                  onFocusComment={focusOn}
                />
              </TabsContent>
              <TabsContent value="outline" className="mt-0 min-h-0 flex-1 overflow-hidden">
                <div className="flex h-full min-h-0 flex-col gap-2 p-3">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un texte ou un cadre"
                    className="h-9 text-sm"
                    aria-label="Rechercher dans le tableau"
                  />
                  <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
                    {outline.length === 0 && (
                      <p className="px-1 py-8 text-center text-xs text-muted-foreground">
                        Aucun résultat.
                      </p>
                    )}
                    {outline.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          focusOn(item.x, item.y)
                          setPanelOpen(false)
                        }}
                        className="flex w-full items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-left hover:bg-muted/60"
                      >
                        {item.kind === 'frame' ? (
                          <FrameIcon className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                        ) : (
                          <span className="h-3.5 w-3.5 shrink-0 text-center text-[11px] text-muted-foreground">
                            T
                          </span>
                        )}
                        <span className="truncate text-sm">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </SheetContent>
        </Sheet>

        <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Vider le tableau ?</AlertDialogTitle>
              <AlertDialogDescription>
                Tous les éléments de « {whiteboard.title} » seront supprimés. Un point de
                restauration est créé automatiquement avant l’opération.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={clearBoard}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Vider
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}

export default WhiteboardCanvas
