import { Suspense, Component, ReactNode, useContext } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry'
import { Dialog, DialogPortal, DialogOverlay } from '@/components/ui/dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Loader2, AlertTriangle, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { NativeEditorType } from '../dialogs/NewDocumentDialog'
import { cn } from '@/lib/utils'
import { SidebarContext } from '@/components/ui/sidebar'

function useSidebarOffset(): string {
  const sidebar = useContext(SidebarContext)
  if (!sidebar) {
    return '0px'
  }

  const { state, isMobile, open } = sidebar
  if (isMobile) return '0px'
  if (state === 'collapsed' || !open) return '3.5rem'
  return '16rem'
}

const DocumentEditor = lazy(() =>
  import('./DocumentEditor').then((m) => ({ default: m.DocumentEditor }))
)
const SpreadsheetEditor = lazy(() =>
  import('./SpreadsheetEditor').then((m) => ({ default: m.SpreadsheetEditor }))
)
const PresentationEditor = lazy(() =>
  import('./PresentationEditor').then((m) => ({ default: m.PresentationEditor }))
)

interface NativeEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editorType: NativeEditorType
  documentId?: string
  documentName?: string
  initialContent?: string
  folderId?: string | null
}

function EditorFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

// Error boundary for lazy-loaded editors
interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class EditorErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; onClose: () => void }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-semibold text-foreground">Erreur de chargement de l'éditeur</p>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {this.state.error?.message || "Une erreur inattendue s'est produite."}
          </p>
          <div className="flex gap-3">
            <Button onClick={this.handleRetry} variant="default" size="sm">
              <RotateCcw className="w-4 h-4 mr-2" />
              Réessayer
            </Button>
            <Button onClick={this.props.onClose} variant="outline" size="sm">
              <X className="w-4 h-4 mr-2" />
              Fermer
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export function NativeEditorDialog({
  open,
  onOpenChange,
  editorType,
  documentId,
  documentName = 'Sans titre',
  initialContent,
  folderId,
}: NativeEditorDialogProps) {
  const handleClose = () => onOpenChange(false)
  const leftOffset = useSidebarOffset()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay style={{ left: leftOffset }} />
        <DialogPrimitive.Content
          style={{ left: leftOffset, width: `calc(100vw - ${leftOffset})` }}
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          className={cn(
            'fixed top-0 bottom-0 z-50 h-screen bg-background outline-none transition-[left,width] duration-200 ease-linear',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        >
          <VisuallyHidden>
            <DialogPrimitive.Title>Éditeur de document</DialogPrimitive.Title>
            <DialogPrimitive.Description>Éditeur de document natif</DialogPrimitive.Description>
          </VisuallyHidden>
          <EditorErrorBoundary onClose={handleClose}>
            <Suspense fallback={<EditorFallback />}>
              {editorType === 'native_doc' && (
                <DocumentEditor
                  documentId={documentId}
                  documentName={documentName}
                  initialContent={initialContent}
                  folderId={folderId}
                  onClose={handleClose}
                  className="h-full"
                  collaborative={!!documentId}
                />
              )}
              {editorType === 'native_sheet' && (
                <SpreadsheetEditor
                  documentId={documentId}
                  documentName={documentName}
                  initialContent={initialContent}
                  folderId={folderId}
                  onClose={handleClose}
                  className="h-full"
                  collaborative={!!documentId}
                />
              )}
              {editorType === 'native_pres' && (
                <PresentationEditor
                  documentId={documentId}
                  documentName={documentName}
                  initialContent={initialContent}
                  folderId={folderId}
                  onClose={handleClose}
                  className="h-full"
                  collaborative={!!documentId}
                />
              )}
            </Suspense>
          </EditorErrorBoundary>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
