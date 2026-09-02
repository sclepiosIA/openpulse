import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import DOMPurify from 'dompurify'
import { toast } from 'sonner'
import { FloatingSelectionBar } from './FloatingSelectionBar'
import { SlashCommandMenu } from './SlashCommandMenu'
import { CopilotSidePanel } from './CopilotSidePanel'
import { AIDiffOverlay } from './AIDiffOverlay'
import { useCopilotTransform } from './useCopilotStream'
import { useDocContext } from './useDocContext'
import type { CopilotAction, CopilotSurface } from './actions'
import { getActionById } from './actions'
import { TransactionalActionsDialog } from './TransactionalActionsDialog'

interface UseDocumentCopilotOpts {
  editor: Editor | null
  documentId?: string
  documentName?: string
  folderId?: string | null
  surface?: CopilotSurface
}

interface StructuredResult {
  action: string
  parsed: unknown
}

/**
 * Contrôleur haut-niveau qui expose:
 *  - <CopilotBridge /> : monte les 3 surfaces IA (BubbleMenu + Slash + SidePanel + Diff)
 *  - openSlash(): ouvrir la palette Cmd+K
 *  - openPanel(): ouvrir le chat latéral
 *  - onKeyDown handler à brancher sur la div éditeur pour Cmd+K / Cmd+J
 */
export function useDocumentCopilot({
  editor,
  documentId,
  documentName,
  folderId,
  surface = 'document',
}: UseDocumentCopilotOpts) {
  const [slashOpen, setSlashOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [diffOpen, setDiffOpen] = useState(false)
  const [structuredResult, setStructuredResult] = useState<StructuredResult | null>(null)
  const [pendingProposal, setPendingProposal] = useState<{
    action: CopilotAction
    originalText: string
    proposal: string
    isHtml: boolean
    range: { from: number; to: number } | null
    insertAtCursor: boolean
  } | null>(null)

  const { run, isLoading } = useCopilotTransform()
  const currentHtml = useMemo(
    () => editor?.getHTML() ?? '',
    [editor, editor?.state?.doc?.textContent]
  )
  const { summary: contextSummary } = useDocContext({
    documentName,
    documentHtml: currentHtml,
    folderId,
  })

  const getSelectionText = useCallback((): { text: string; from: number; to: number } => {
    if (!editor) return { text: '', from: 0, to: 0 }
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, '\n')
    return { text, from, to }
  }, [editor])

  const runAction = useCallback(
    async (action: CopilotAction, opts?: { language?: string; prompt?: string }) => {
      if (!editor) return
      const sel = getSelectionText()
      const hasSelection = sel.to > sel.from && sel.text.length > 0

      if (action.needsSelection && !hasSelection) {
        toast.error("Sélectionnez d'abord du texte")
        return
      }

      const fullText = editor.state.doc.textContent.slice(0, 40000)
      const selectionPayload = action.needsSelection
        ? sel.text
        : action.id === 'draft_from_prompt'
          ? (opts?.prompt ?? '')
          : action.id === 'continue_writing'
            ? fullText
            : ''

      if (!selectionPayload.trim() && !fullText.trim()) {
        toast.error(
          "Le document est vide — ajoutez du contenu ou saisissez une instruction avant d'utiliser le Copilot"
        )
        return
      }

      const res = await run({
        action: action.id,
        selection: selectionPayload,
        fullText,
        language: opts?.language,
        documentId: documentId ?? null,
        surface,
      })
      if (!res) return

      if (action.structured) {
        setStructuredResult({ action: action.id, parsed: res.parsed })
        return
      }

      const isHtml = /<[a-z][\s\S]*>/i.test(res.result)
      setPendingProposal({
        action,
        originalText: hasSelection ? sel.text : (opts?.prompt ?? ''),
        proposal: res.result,
        isHtml,
        range: hasSelection ? { from: sel.from, to: sel.to } : null,
        insertAtCursor: !!action.insertAtCursor || !hasSelection,
      })
      setDiffOpen(true)
    },
    [editor, getSelectionText, run, documentId, surface]
  )

  const acceptProposal = useCallback(() => {
    if (!editor || !pendingProposal) return
    const { proposal, isHtml, range, insertAtCursor } = pendingProposal
    const clean = isHtml ? DOMPurify.sanitize(proposal) : proposal

    editor.chain().focus()

    if (range && !insertAtCursor) {
      if (isHtml) {
        editor.chain().setTextSelection(range).deleteSelection().insertContent(clean).run()
      } else {
        editor.chain().setTextSelection(range).deleteSelection().insertContent(clean).run()
      }
    } else {
      // insert at cursor / end
      if (isHtml) {
        editor.chain().insertContent(clean).run()
      } else {
        // Split into paragraphs
        const paragraphs = proposal.split(/\n\n+/)
        editor
          .chain()
          .insertContent(paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join(''))
          .run()
      }
    }

    setPendingProposal(null)
  }, [editor, pendingProposal])

  const rejectProposal = useCallback(() => {
    setPendingProposal(null)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault()
      setSlashOpen(true)
    } else if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
      e.preventDefault()
      setPanelOpen((v) => !v)
    }
  }, [])

  // Global keyboard shortcut fallback
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        // only when editor is present
        if (!editor) return
        // don't hijack if focus is on an input outside the editor
        const target = e.target as HTMLElement | null
        const inEditor =
          target?.closest('.ProseMirror') || target?.closest('[data-copilot-scope="document"]')
        if (!inEditor) return
        e.preventDefault()
        setSlashOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [editor])

  const insertAtCursorFromChat = useCallback(
    (html: string) => {
      if (!editor) return
      const clean = DOMPurify.sanitize(html)
      editor.chain().focus().insertContent(clean).run()
    },
    [editor]
  )

  const bridge = (
    <>
      <FloatingSelectionBar editor={editor} isRunning={isLoading} onRunAction={runAction} />
      <SlashCommandMenu
        open={slashOpen}
        onOpenChange={setSlashOpen}
        surface={surface}
        hasSelection={!!editor && editor.state.selection.from !== editor.state.selection.to}
        onSelectAction={runAction}
        onFreePrompt={(prompt) => {
          const draft = getActionById('draft_from_prompt')
          if (draft) runAction(draft, { prompt })
        }}
      />
      <CopilotSidePanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        documentTitle={documentName}
        documentHtml={currentHtml}
        contextSummary={contextSummary}
        documentId={documentId ?? null}
        onInsertAtCursor={insertAtCursorFromChat}
      />
      {pendingProposal && (
        <AIDiffOverlay
          open={diffOpen}
          onOpenChange={setDiffOpen}
          actionLabel={pendingProposal.action.label}
          originalText={pendingProposal.originalText || '(nouvelle insertion)'}
          proposal={pendingProposal.proposal}
          proposalIsHtml={pendingProposal.isHtml}
          onAccept={acceptProposal}
          onReject={rejectProposal}
        />
      )}
      {structuredResult &&
        (() => {
          const p = (structuredResult.parsed ?? {}) as Record<string, unknown>
          const hasTx =
            Array.isArray(p.tasks) || Array.isArray(p.events) || Array.isArray(p.contacts)
          return hasTx ? (
            <TransactionalActionsDialog
              action={structuredResult.action}
              parsed={p}
              onClose={() => setStructuredResult(null)}
            />
          ) : (
            <StructuredResultDialog
              data={structuredResult}
              onClose={() => setStructuredResult(null)}
            />
          )
        })()}
    </>
  )

  return {
    bridge,
    openSlash: () => setSlashOpen(true),
    openPanel: () => setPanelOpen(true),
    handleKeyDown,
    isRunning: isLoading,
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── Rendu générique des résultats structurés (titres, tâches, événements, contacts) ───
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

function StructuredResultDialog({
  data,
  onClose,
}: {
  data: StructuredResult
  onClose: () => void
}) {
  const parsed = (data.parsed ?? {}) as Record<string, unknown>
  const titles = Array.isArray(parsed.titles) ? (parsed.titles as string[]) : null
  const tasks = Array.isArray(parsed.tasks)
    ? (parsed.tasks as Array<Record<string, unknown>>)
    : null
  const events = Array.isArray(parsed.events)
    ? (parsed.events as Array<Record<string, unknown>>)
    : null
  const contacts = Array.isArray(parsed.contacts)
    ? (parsed.contacts as Array<Record<string, unknown>>)
    : null

  const [labelMap]: Array<Record<string, string>> = [
    {
      headline_suggest: 'Suggestions de titres',
      extract_actions: 'Actions détectées',
      extract_events: 'Événements détectés',
      extract_contacts: 'Contacts détectés',
    },
  ]

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{labelMap[data.action] ?? 'Résultat IA'}</DialogTitle>
          <DialogDescription>Résultat structuré à copier ou utiliser.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-96">
          {titles && (
            <ul className="space-y-2">
              {titles.map((t, i) => (
                <li key={i} className="text-sm p-2 rounded-md border bg-muted/30">
                  {t}
                </li>
              ))}
            </ul>
          )}
          {tasks && (
            <ul className="space-y-2">
              {tasks.map((t, i) => (
                <li key={i} className="text-sm p-2 rounded-md border">
                  <div className="font-medium">{String(t.title ?? '')}</div>
                  {t.due ? (
                    <div className="text-xs text-muted-foreground">Échéance : {String(t.due)}</div>
                  ) : null}
                  {t.assignee ? (
                    <div className="text-xs text-muted-foreground">
                      Assignée : {String(t.assignee)}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {events && (
            <ul className="space-y-2">
              {events.map((e, i) => (
                <li key={i} className="text-sm p-2 rounded-md border">
                  <div className="font-medium">{String(e.title ?? '')}</div>
                  <div className="text-xs text-muted-foreground">
                    {String(e.start ?? '?')}
                    {e.end ? ` → ${String(e.end)}` : ''}
                  </div>
                  {e.location ? (
                    <div className="text-xs text-muted-foreground">Lieu : {String(e.location)}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {contacts && (
            <ul className="space-y-2">
              {contacts.map((c, i) => (
                <li key={i} className="text-sm p-2 rounded-md border">
                  <div className="font-medium">{String(c.name ?? '')}</div>
                  {c.email ? (
                    <div className="text-xs text-muted-foreground">{String(c.email)}</div>
                  ) : null}
                  {c.phone ? (
                    <div className="text-xs text-muted-foreground">{String(c.phone)}</div>
                  ) : null}
                  {c.role ? (
                    <div className="text-xs text-muted-foreground">{String(c.role)}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {!titles && !tasks && !events && !contacts && (
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(parsed, null, 2)}</pre>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
