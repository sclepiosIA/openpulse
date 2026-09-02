import DOMPurify from 'dompurify'
import { Check, X, Copy } from 'lucide-react'
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
import { toast } from 'sonner'

interface AIDiffOverlayProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  actionLabel: string
  originalText: string
  proposal: string
  proposalIsHtml?: boolean
  onAccept: () => void
  onReject: () => void
}

/**
 * Diff simple avant/après pour une action IA de transformation.
 * L'utilisateur peut accepter, rejeter ou copier la proposition.
 */
export function AIDiffOverlay({
  open,
  onOpenChange,
  actionLabel,
  originalText,
  proposal,
  proposalIsHtml,
  onAccept,
  onReject,
}: AIDiffOverlayProps) {
  const cleanHtml = proposalIsHtml ? DOMPurify.sanitize(proposal) : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        proposalIsHtml ? proposal.replace(/<[^>]+>/g, '') : proposal
      )
      toast.success('Copié dans le presse-papier')
    } catch {
      toast.error('Impossible de copier')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onReject()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-4xl flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Aperçu IA — {actionLabel}</DialogTitle>
          <DialogDescription>
            Vérifiez le résultat avant de l'insérer dans le document.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0 flex-1">
          <div className="flex flex-col min-h-0">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Avant</div>
            <ScrollArea className="border rounded-md p-3 bg-muted/30 flex-1 min-h-0">
              <pre className="text-sm whitespace-pre-wrap font-sans text-muted-foreground">
                {originalText || '(vide)'}
              </pre>
            </ScrollArea>
          </div>
          <div className="flex flex-col min-h-0">
            <div className="text-xs font-semibold text-primary mb-2">Proposition IA</div>
            <ScrollArea className="border rounded-md p-3 bg-primary/5 flex-1 min-h-0">
              {proposalIsHtml ? (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: cleanHtml }}
                />
              ) : (
                <pre className="text-sm whitespace-pre-wrap font-sans">{proposal}</pre>
              )}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copier
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onReject()
                onOpenChange(false)
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Rejeter
            </Button>
            <Button
              onClick={() => {
                onAccept()
                onOpenChange(false)
              }}
            >
              <Check className="mr-2 h-4 w-4" />
              Accepter
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
