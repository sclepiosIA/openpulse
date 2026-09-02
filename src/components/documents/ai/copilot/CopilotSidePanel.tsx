import { useCallback, useEffect, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import ReactMarkdown from 'react-markdown'
import {
  Sparkles,
  Send,
  Square,
  Trash2,
  Copy,
  X,
  ArrowDownToLine,
  ImagePlus,
  Loader2,
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useCopilotStream } from './useCopilotStream'
import { useGenerateImage } from '@/hooks/documents/useGenerateImage'
import { toast } from 'sonner'

interface CopilotSidePanelProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  documentTitle?: string
  documentHtml?: string
  contextSummary?: string
  documentId?: string | null
  onInsertAtCursor?: (text: string) => void
}

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED = [
  'Résume ce document en 5 puces',
  "Reformule l'introduction pour un ton plus professionnel",
  "Quels sont les points d'action à retenir ?",
  'Génère un plan pour compléter ce document',
]

export function CopilotSidePanel({
  open,
  onOpenChange,
  documentTitle,
  documentHtml,
  contextSummary,
  documentId,
  onInsertAtCursor,
}: CopilotSidePanelProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [streamingContent, setStreamingContent] = useState('')
  const [imageMode, setImageMode] = useState(false)
  const [imagePrompt, setImagePrompt] = useState('')
  const { start, stop, isStreaming } = useCopilotStream()
  const { generate: generateImage, isGenerating: isGeneratingImage } = useGenerateImage()
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleGenerateImage = useCallback(async () => {
    const prompt = imagePrompt.trim()
    if (!prompt || isGeneratingImage) return
    try {
      const images = await generateImage({ prompt, size: '1024x1024', quality: 'medium', n: 1 })
      const first = images[0]
      const src = first?.dataUrl ?? first?.url
      if (!src) {
        toast.error('Aucune image renvoyée')
        return
      }
      if (onInsertAtCursor) {
        const safeAlt = prompt.replace(/"/g, '&quot;').slice(0, 200)
        onInsertAtCursor(`<p><img src="${src}" alt="${safeAlt}" /></p>`)
        toast.success('Image insérée')
        setImagePrompt('')
        setImageMode(false)
      } else {
        toast.error("Insertion d'image indisponible ici")
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Échec de la génération')
    }
  }, [imagePrompt, isGeneratingImage, generateImage, onInsertAtCursor])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamingContent])

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isStreaming) return
      const nextMessages: ChatMsg[] = [...messages, { role: 'user', content: trimmed }]
      setMessages(nextMessages)
      setInput('')
      setStreamingContent('')
      let acc = ''
      start({
        messages: nextMessages,
        documentTitle,
        documentHtml,
        contextSummary,
        documentId,
        onDelta: (chunk) => {
          acc += chunk
          setStreamingContent(acc)
        },
        onDone: () => {
          if (acc.length > 0) {
            setMessages((prev) => [...prev, { role: 'assistant', content: acc }])
          }
          setStreamingContent('')
        },
        onError: (err) => {
          toast.error(err)
          setStreamingContent('')
        },
      })
    },
    [messages, isStreaming, start, documentTitle, documentHtml, contextSummary, documentId]
  )

  const handleClear = () => {
    if (isStreaming) stop()
    setMessages([])
    setStreamingContent('')
  }

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Copié')
    } catch {
      toast.error('Impossible de copier')
    }
  }

  const handleInsert = (content: string) => {
    if (!onInsertAtCursor) {
      toast.error('Insertion indisponible ici')
      return
    }
    // Conversion markdown minimal → HTML via DOMPurify (le hook consommateur nettoie de nouveau)
    const asHtml = markdownToHtml(content)
    onInsertAtCursor(asHtml)
    toast.success('Inséré dans le document')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Copilot IA
          </SheetTitle>
          <div className="flex items-center gap-1">
            <Button
              variant={imageMode ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setImageMode((v) => !v)}
              title="Générer une image"
              disabled={!onInsertAtCursor}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Image
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleClear}
              title="Nouveau chat"
              disabled={messages.length === 0 && !streamingContent}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onOpenChange(false)}
              title="Fermer"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div ref={scrollRef} className="px-4 py-4 space-y-3">
            {messages.length === 0 && !streamingContent && (
              <div className="text-sm text-muted-foreground space-y-3">
                <p>
                  Posez une question sur ce document, demandez un résumé, une reformulation, un
                  plan…
                </p>
                <div className="space-y-1.5">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="w-full text-left px-3 py-2 rounded-md border bg-muted/30 hover:bg-muted text-xs transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                role={m.role}
                content={m.content}
                onCopy={() => handleCopy(m.content)}
                onInsert={
                  m.role === 'assistant' && onInsertAtCursor
                    ? () => handleInsert(m.content)
                    : undefined
                }
              />
            ))}

            {streamingContent && (
              <MessageBubble role="assistant" content={streamingContent} streaming />
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-3 space-y-2">
          {imageMode && (
            <div className="rounded-md border bg-muted/30 p-2 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <ImagePlus className="h-3.5 w-3.5 text-primary" />
                Générer une image (Azure gpt-image-2)
              </div>
              <Textarea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    handleGenerateImage()
                  }
                }}
                placeholder="Décrivez l'image à générer… (Cmd/Ctrl+Entrée pour générer)"
                className="min-h-[60px] max-h-28 resize-none text-sm"
                disabled={isGeneratingImage}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setImageMode(false)
                    setImagePrompt('')
                  }}
                  disabled={isGeneratingImage}
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleGenerateImage}
                  disabled={!imagePrompt.trim() || isGeneratingImage || !onInsertAtCursor}
                >
                  {isGeneratingImage ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Génération…
                    </>
                  ) : (
                    <>
                      <ImagePlus className="h-3.5 w-3.5 mr-1.5" />
                      Générer et insérer
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(input)
                }
              }}
              placeholder="Question sur ce document…"
              className="min-h-[44px] max-h-32 resize-none text-sm"
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button size="icon" variant="destructive" onClick={stop} title="Arrêter">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                title="Envoyer (Entrée)"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground px-1">
            Contexte : le contenu du document et son titre sont partagés avec l'IA.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MessageBubble({
  role,
  content,
  onCopy,
  onInsert,
  streaming,
}: {
  role: 'user' | 'assistant'
  content: string
  onCopy?: () => void
  onInsert?: () => void
  streaming?: boolean
}) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'rounded-lg px-3 py-2 text-sm max-w-[95%]',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{content}</div>
        ) : (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 dark:prose-invert">
            <ReactMarkdown>{content}</ReactMarkdown>
            {streaming && <span className="inline-block ml-0.5 animate-pulse">▎</span>}
          </div>
        )}
      </div>
      {!isUser && !streaming && (onCopy || onInsert) && (
        <div className="flex gap-1 mt-1">
          {onCopy && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] gap-1"
              onClick={onCopy}
            >
              <Copy className="h-3 w-3" />
              Copier
            </Button>
          )}
          {onInsert && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] gap-1"
              onClick={onInsert}
            >
              <ArrowDownToLine className="h-3 w-3" />
              Insérer dans le document
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Conversion Markdown → HTML très basique.
 * Suffit pour insertion Copilot (l'éditeur TipTap normalisera ensuite).
 */
function markdownToHtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inList = false
  let inOl = false
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^\s*[-*]\s+/.test(line)) {
      if (inOl) {
        out.push('</ol>')
        inOl = false
      }
      if (!inList) {
        out.push('<ul>')
        inList = true
      }
      out.push(`<li>${inlineMd(line.replace(/^\s*[-*]\s+/, ''))}</li>`)
    } else if (/^\s*\d+\.\s+/.test(line)) {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      if (!inOl) {
        out.push('<ol>')
        inOl = true
      }
      out.push(`<li>${inlineMd(line.replace(/^\s*\d+\.\s+/, ''))}</li>`)
    } else if (/^#{1,3}\s+/.test(line)) {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      if (inOl) {
        out.push('</ol>')
        inOl = false
      }
      const level = line.match(/^#+/)![0].length
      const text = line.replace(/^#+\s+/, '')
      out.push(`<h${level}>${inlineMd(text)}</h${level}>`)
    } else if (line === '') {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      if (inOl) {
        out.push('</ol>')
        inOl = false
      }
    } else {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      if (inOl) {
        out.push('</ol>')
        inOl = false
      }
      out.push(`<p>${inlineMd(line)}</p>`)
    }
  }
  if (inList) out.push('</ul>')
  if (inOl) out.push('</ol>')
  return DOMPurify.sanitize(out.join(''))
}

function inlineMd(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}
