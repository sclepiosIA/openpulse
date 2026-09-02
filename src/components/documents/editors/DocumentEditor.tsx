import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import TextAlign from '@tiptap/extension-text-align'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import { DocumentEditorToolbar } from './DocumentEditorToolbar'
import { CollaborativeCursors } from './CollaborativeCursors'
import { exportToPdf, exportToDocx, importDocx } from '@/lib/documentExport'
import { useNativeDocumentSave } from '@/hooks/documents/useNativeDocumentSave'
import { useCollaborativeEditor } from '@/hooks/documents/useCollaborativeEditor'
import { useDocumentCopilot } from '@/components/documents/ai/copilot/useDocumentCopilot'
import { FindReplaceDialog } from '@/components/documents/power/FindReplaceDialog'
import { WordCountBar } from '@/components/documents/power/WordCountBar'
import {
  PageSetupDialog,
  pageSetupToStyle,
  DEFAULT_PAGE_SETUP,
  type PageSetup,
} from '@/components/documents/power/PageSetupDialog'
import { MailMergeDialog } from '@/components/documents/power/MailMergeDialog'
import { VersionHistoryDialog } from '@/components/documents/power/VersionHistoryDialog'
import { saveVersion } from '@/components/documents/power/versionHistory'
import { Button } from '@/components/ui/button'
import { Search, FileCog, Mails, History } from 'lucide-react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isDocumentsAiPanelEnabled } from '@/config/documentsAi'
import { EditorHeader, EditorCloseButton, EditorAIButton } from './EditorChrome'

const DocumentAiPanel = lazy(() =>
  import('../ai/DocumentAiPanel').then((m) => ({ default: m.DocumentAiPanel }))
)

function EditorAiPanelHost({
  editor,
  documentName,
  open,
  onClose,
}: {
  editor: { getHTML: () => string; commands: { insertContent?: (html: string) => void } } | null
  documentName?: string
  open: boolean
  onClose: () => void
}) {
  if (!open || !editor) return null
  return (
    <Suspense fallback={null}>
      <DocumentAiPanel
        documentName={documentName}
        getDocumentContent={() => editor.getHTML()}
        onInsertContent={(html) => editor.commands.insertContent?.(html)}
        onClose={onClose}
      />
    </Suspense>
  )
}

interface DocumentEditorProps {
  documentId?: string
  initialContent?: string
  documentName?: string
  folderId?: string | null
  onSave?: (html: string) => void
  onClose?: () => void
  className?: string
  collaborative?: boolean
}

export function DocumentEditor({
  documentId,
  initialContent = '',
  documentName = 'Sans titre',
  folderId,
  onSave,
  onClose,
  className,
  collaborative = false,
}: DocumentEditorProps) {
  // ─── Collaborative mode ───
  if (collaborative && documentId) {
    return (
      <CollaborativeDocumentEditor
        documentId={documentId}
        initialContent={initialContent}
        documentName={documentName}
        folderId={folderId}
        onSave={onSave}
        onClose={onClose}
        className={className}
      />
    )
  }

  // ─── Solo mode (original) ───
  return (
    <SoloDocumentEditor
      documentId={documentId}
      initialContent={initialContent}
      documentName={documentName}
      folderId={folderId}
      onSave={onSave}
      onClose={onClose}
      className={className}
    />
  )
}

// ═══════════════════════════════════════════════════
// Solo Editor (original logic, unchanged)
// ═══════════════════════════════════════════════════
function SoloDocumentEditor({
  documentId,
  initialContent = '',
  documentName = 'Sans titre',
  folderId,
  onSave,
  onClose,
  className,
}: Omit<DocumentEditorProps, 'collaborative'>) {
  const navigateFn = useNavigate()
  const { save: saveToNextcloud, isSaving: isNativeSaving } = useNativeDocumentSave({
    documentName,
    mimeType: 'text/html',
    extension: 'html',
    folderId,
    existingDocumentId: documentId,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const aiPanelEnabled = isDocumentsAiPanelEnabled()
  const [findOpen, setFindOpen] = useState(false)
  const [findMode, setFindMode] = useState<'find' | 'replace'>('find')
  const [pageSetupOpen, setPageSetupOpen] = useState(false)
  const [mailMergeOpen, setMailMergeOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [pageSetup, setPageSetup] = useState<PageSetup>(DEFAULT_PAGE_SETUP)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dirtyRef = useRef(false)
  // beforeunload : prévient la fermeture d'onglet si des changements sont non sauvegardés (P0 audit).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder: 'Commencez à rédiger votre document...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ] as any,
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm sm:prose max-w-none focus:outline-none min-h-[500px] px-8 py-6 [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer hover:[&_a]:text-primary/80',
      },
      handleClick: (view: any, pos: any, event: any) => {
        const resolved = view.state.doc.resolve(pos)
        const linkMark = resolved.marks().find((m: any) => m.type.name === 'link')
        if (linkMark?.attrs?.href) {
          event.preventDefault()
          const href = linkMark.attrs.href as string
          if (href.startsWith('/') || href.includes(window.location.origin)) {
            const path = href.startsWith('/') ? href : new URL(href).pathname
            navigateFn(path)
          } else {
            window.open(href, '_blank', 'noopener')
          }
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor }: any) => {
      dirtyRef.current = true
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(() => {
        handleSave(editor.getHTML())
      }, 3000)
    },
  }) as any

  const copilot = useDocumentCopilot({
    editor,
    documentId,
    documentName,
    folderId,
    surface: 'document',
  })

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (editor) handleSave(editor.getHTML())
        return
      }
      // Ctrl+F / Ctrl+H : ouvre Rechercher & remplacer avec focus sur le bon champ.
      // Actif uniquement quand l'utilisateur travaille dans cet éditeur (focus dans la surface).
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'h')) {
        const active = document.activeElement as HTMLElement | null
        const inSurface = !!active?.closest?.('[data-doc-editor-root]')
        if (!inSurface && !editor?.isFocused) return
        e.preventDefault()
        setFindMode(e.key === 'h' ? 'replace' : 'find')
        setFindOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [editor])

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [])

  const handleSave = useCallback(
    async (html: string) => {
      if (isSaving || isNativeSaving) return
      setIsSaving(true)
      try {
        if (onSave) onSave(html)
        const blob = new Blob([html], { type: 'text/html' })
        await saveToNextcloud(blob)
        setLastSaved(new Date())
        dirtyRef.current = false
        // Snapshot d'historique auto (dédupliqué) après sauvegarde réussie.
        if (documentId) saveVersion(documentId, html, 'html', { auto: true })
      } catch (err: any) {
        console.error('Save error:', err)
        toast.error('Erreur lors de la sauvegarde')
      } finally {
        setIsSaving(false)
      }
    },
    [isSaving, isNativeSaving, onSave, saveToNextcloud, documentId]
  )

  const handleExportPdf = useCallback(async () => {
    if (!editor) return
    try {
      await exportToPdf(editor.getHTML(), documentName)
      toast.success('PDF exporté avec succès')
    } catch {
      toast.error("Erreur lors de l'export PDF")
    }
  }, [editor, documentName])

  const handleExportDocx = useCallback(async () => {
    if (!editor) return
    try {
      await exportToDocx(editor.getHTML(), documentName)
      toast.success('DOCX exporté avec succès')
    } catch {
      toast.error("Erreur lors de l'export DOCX")
    }
  }, [editor, documentName])

  const handleImportDocx = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !editor) return
      try {
        const html = await importDocx(file)
        editor.commands.setContent(html)
        toast.success('Document DOCX importé')
      } catch {
        toast.error("Erreur lors de l'import DOCX")
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [editor]
  )

  return (
    <div className={cn('flex flex-col editor-shell rounded-lg overflow-hidden h-full', className)}>
      <EditorHeader
        documentName={documentName}
        kind="Document"
        isSaving={isSaving}
        lastSaved={lastSaved}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFindMode('find')
            setFindOpen(true)
          }}
          className="gap-1.5 h-8 text-xs"
          title="Rechercher (Ctrl+F)"
        >
          <Search className="h-3.5 w-3.5" /> Rechercher
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPageSetupOpen(true)}
          className="gap-1.5 h-8 text-xs"
        >
          <FileCog className="h-3.5 w-3.5" /> Mise en page
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMailMergeOpen(true)}
          className="gap-1.5 h-8 text-xs"
        >
          <Mails className="h-3.5 w-3.5" /> Publipostage
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
        {aiPanelEnabled && (
          <EditorAIButton onClick={() => setAiPanelOpen((open) => !open)} title="Assistant IA">
            Assistant IA
          </EditorAIButton>
        )}
        {onClose && <EditorCloseButton onClose={onClose} />}
      </EditorHeader>

      <DocumentEditorToolbar
        editor={editor}
        onSave={() => editor && handleSave(editor.getHTML())}
        onExportPdf={handleExportPdf}
        onExportDocx={handleExportDocx}
        onImportDocx={handleImportDocx}
        isSaving={isSaving}
        onOpenCopilotPanel={() => copilot.openPanel()}
        onOpenCopilotSlash={() => copilot.openSlash()}
      />

      <div
        className="flex-1 overflow-auto editor-shell px-4 py-6"
        data-copilot-scope="document"
        data-doc-editor-root
        onKeyDown={copilot.handleKeyDown}
      >
        <div
          className={cn(
            'editor-paper mx-auto rounded-md',
            '[&_.ics-link]:text-primary [&_.ics-link]:bg-primary/10 [&_.ics-link]:px-1.5 [&_.ics-link]:py-0.5 [&_.ics-link]:rounded [&_.ics-link]:text-xs [&_.ics-link]:font-medium [&_.ics-link]:no-underline [&_.ics-link]:cursor-pointer [&_.ics-link:hover]:bg-primary/20',
            '[&_.ics-uid]:text-muted-foreground [&_.ics-uid]:bg-muted [&_.ics-uid]:px-1 [&_.ics-uid]:py-0.5 [&_.ics-uid]:rounded [&_.ics-uid]:text-xs [&_.ics-uid]:font-mono'
          )}
          style={pageSetupToStyle(pageSetup)}
        >
          <EditorContent editor={editor} />
        </div>
        <EditorAiPanelHost
          editor={editor}
          documentName={documentName}
          open={aiPanelEnabled && aiPanelOpen}
          onClose={() => setAiPanelOpen(false)}
        />
      </div>

      <WordCountBar editor={editor} />

      <FindReplaceDialog
        open={findOpen}
        onOpenChange={setFindOpen}
        editor={editor}
        initialFocus={findMode}
      />
      <PageSetupDialog
        open={pageSetupOpen}
        onOpenChange={setPageSetupOpen}
        value={pageSetup}
        onChange={setPageSetup}
      />
      <MailMergeDialog
        open={mailMergeOpen}
        onOpenChange={setMailMergeOpen}
        editor={editor}
        documentName={documentName}
      />
      <VersionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        documentId={documentId}
        documentName={documentName}
        kind="html"
        getCurrentContent={() => editor?.getHTML() ?? ''}
        onRestore={(content) => editor?.commands.setContent(content)}
      />

      {copilot.bridge}

      <input
        ref={fileInputRef}
        type="file"
        accept=".docx"
        onChange={handleFileSelected}
        className="hidden"
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════
// Collaborative Editor (Yjs + Supabase Realtime)
// ═══════════════════════════════════════════════════
function CollaborativeDocumentEditor({
  documentId,
  initialContent = '',
  documentName = 'Sans titre',
  folderId,
  onSave,
  onClose,
  className,
}: Omit<DocumentEditorProps, 'collaborative'>) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const aiPanelEnabled = isDocumentsAiPanelEnabled()
  const [historyOpen, setHistoryOpen] = useState(false)

  const { editor, connectedUsers, isConnected, isSynced, isSaving, handleSave } =
    useCollaborativeEditor({
      documentId: documentId!,
      documentName,
      initialContent,
      folderId,
    })

  const copilot = useDocumentCopilot({
    editor,
    documentId,
    documentName,
    folderId,
    surface: 'document',
  })

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [handleSave])

  const handleExportPdf = useCallback(async () => {
    if (!editor) return
    try {
      await exportToPdf(editor.getHTML(), documentName)
      toast.success('PDF exporté avec succès')
    } catch {
      toast.error("Erreur lors de l'export PDF")
    }
  }, [editor, documentName])

  const handleExportDocx = useCallback(async () => {
    if (!editor) return
    try {
      await exportToDocx(editor.getHTML(), documentName)
      toast.success('DOCX exporté avec succès')
    } catch {
      toast.error("Erreur lors de l'export DOCX")
    }
  }, [editor, documentName])

  const handleImportDocx = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !editor) return
      try {
        const html = await importDocx(file)
        editor.commands.setContent(html)
        toast.success('Document DOCX importé')
      } catch {
        toast.error("Erreur lors de l'import DOCX")
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [editor]
  )

  return (
    <div className={cn('flex flex-col editor-shell rounded-lg overflow-hidden h-full', className)}>
      <EditorHeader
        documentName={documentName}
        kind="Document"
        isSaving={isSaving}
        lastSaved={null}
      >
        {!isSynced && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Synchronisation…
          </span>
        )}
        <CollaborativeCursors connectedUsers={connectedUsers} isConnected={isConnected} />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setHistoryOpen(true)}
          className="gap-1.5 h-8 text-xs"
          title="Historique des versions"
        >
          <History className="h-3.5 w-3.5" /> Historique
        </Button>
        {aiPanelEnabled && (
          <EditorAIButton onClick={() => setAiPanelOpen((open) => !open)} title="Assistant IA">
            Assistant IA
          </EditorAIButton>
        )}
        {onClose && <EditorCloseButton onClose={onClose} />}
      </EditorHeader>

      <DocumentEditorToolbar
        editor={editor}
        onSave={handleSave}
        onExportPdf={handleExportPdf}
        onExportDocx={handleExportDocx}
        onImportDocx={handleImportDocx}
        isSaving={isSaving}
        connectedUsers={connectedUsers}
        onOpenCopilotPanel={() => copilot.openPanel()}
        onOpenCopilotSlash={() => copilot.openSlash()}
      />

      <div
        className="flex-1 overflow-auto editor-shell px-4 py-6"
        data-copilot-scope="document"
        onKeyDown={copilot.handleKeyDown}
      >
        <div
          className={cn(
            'editor-paper max-w-[816px] mx-auto rounded-md min-h-[1056px]',
            '[&_.ics-link]:text-primary [&_.ics-link]:bg-primary/10 [&_.ics-link]:px-1.5 [&_.ics-link]:py-0.5 [&_.ics-link]:rounded [&_.ics-link]:text-xs [&_.ics-link]:font-medium [&_.ics-link]:no-underline [&_.ics-link]:cursor-pointer [&_.ics-link:hover]:bg-primary/20',
            '[&_.ics-uid]:text-muted-foreground [&_.ics-uid]:bg-muted [&_.ics-uid]:px-1 [&_.ics-uid]:py-0.5 [&_.ics-uid]:rounded [&_.ics-uid]:text-xs [&_.ics-uid]:font-mono',
            '[&_.collaboration-cursor__caret]:relative [&_.collaboration-cursor__caret]:ml-[-1px] [&_.collaboration-cursor__caret]:mr-[-1px] [&_.collaboration-cursor__caret]:border-l-2 [&_.collaboration-cursor__caret]:border-r-0 [&_.collaboration-cursor__caret]:border-t-0 [&_.collaboration-cursor__caret]:border-b-0 [&_.collaboration-cursor__caret]:pointer-events-none [&_.collaboration-cursor__caret]:break-normal',
            '[&_.collaboration-cursor__label]:absolute [&_.collaboration-cursor__label]:top-[-1.4em] [&_.collaboration-cursor__label]:left-[-1px] [&_.collaboration-cursor__label]:text-[10px] [&_.collaboration-cursor__label]:leading-normal [&_.collaboration-cursor__label]:font-semibold [&_.collaboration-cursor__label]:text-white [&_.collaboration-cursor__label]:px-1 [&_.collaboration-cursor__label]:py-0.5 [&_.collaboration-cursor__label]:rounded [&_.collaboration-cursor__label]:whitespace-nowrap [&_.collaboration-cursor__label]:select-none [&_.collaboration-cursor__label]:pointer-events-none'
          )}
        >
          <EditorContent editor={editor} />
        </div>
        <EditorAiPanelHost
          editor={editor}
          documentName={documentName}
          open={aiPanelEnabled && aiPanelOpen}
          onClose={() => setAiPanelOpen(false)}
        />
      </div>

      {copilot.bridge}

      <VersionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        documentId={documentId}
        documentName={documentName}
        kind="html"
        getCurrentContent={() => editor?.getHTML() ?? ''}
        onRestore={(content) => editor?.commands.setContent(content)}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".docx"
        onChange={handleFileSelected}
        className="hidden"
      />
    </div>
  )
}
