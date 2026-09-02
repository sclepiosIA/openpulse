import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { invokeEdge } from '@/services/edgeFunctions'
import { toast } from 'sonner'
import type { DocumentWithRelations } from '@/types/documents'
import { useQueryClient } from '@tanstack/react-query'
import { debug } from '@/lib/debug'

interface DocSpaceEditorDialogProps {
  document: DocumentWithRelations | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

declare global {
  interface Window {
    DocSpace?: {
      SDK: {
        initFrame: (config: DocSpaceConfig) => DocSpaceInstance
        frames: Record<string, DocSpaceInstance>
      }
    }
  }
}

interface DocSpaceConfig {
  frameId: string
  width?: string
  height?: string
  mode?: 'manager' | 'editor' | 'viewer' | 'room-selector' | 'file-selector' | 'system'
  id?: string | number
  showMenu?: boolean
  showFilter?: boolean
  showHeader?: boolean
  destroyText?: string
  events?: {
    onAppReady?: () => void
    onAppError?: (error: string) => void
    onEditorCloseCallback?: () => void
    onAuthSuccess?: () => void
    onSignOut?: () => void
  }
}

interface DocSpaceInstance {
  destroyFrame: () => void
}

export function DocSpaceEditorDialog({ document, open, onOpenChange }: DocSpaceEditorDialogProps) {
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [docSpaceFileId, setDocSpaceFileId] = useState<string | null>(null)
  const [docSpaceUrl, setDocSpaceUrl] = useState<string | null>(null)
  const frameRef = useRef<DocSpaceInstance | null>(null)
  const queryClient = useQueryClient()

  const initializeEditor = useCallback(async () => {
    if (!document || !open) return

    setLoading(true)
    setUploading(false)
    setError(null)
    setDocSpaceFileId(null)

    try {
      // 1. Get DocSpace configuration
      let configData: any
      try {
        configData = await invokeEdge<any>('docspace-config')
      } catch (configError) {
        debug.error('Config error:', configError)
        throw new Error('Erreur de configuration DocSpace')
      }

      if (!configData?.docSpaceUrl) {
        throw new Error('URL DocSpace non configurée')
      }

      setDocSpaceUrl(configData.docSpaceUrl)

      // 2. Upload document to DocSpace
      setUploading(true)
      let uploadData: any
      try {
        uploadData = await invokeEdge<any>('docspace-upload', { documentId: document.id })
      } catch (uploadError) {
        debug.error('Upload error:', uploadError)
        throw new Error("Erreur lors de l'upload vers DocSpace")
      }

      if (!uploadData?.docSpaceFileId) {
        throw new Error('ID de fichier DocSpace non reçu')
      }

      setDocSpaceFileId(uploadData.docSpaceFileId)
      setUploading(false)

      // 3. Load DocSpace SDK script
      await loadDocSpaceSDK(configData.sdkUrl)

      // 4. Initialize the frame
      initDocSpaceFrame(configData.docSpaceUrl, uploadData.docSpaceFileId)

      setLoading(false)
    } catch (err: unknown) {
      debug.error('Error initializing DocSpace:', err)
      const errorMessage =
        err instanceof Error ? err.message : "Erreur lors de l'initialisation de l'éditeur"
      setError(errorMessage)
      setLoading(false)
      setUploading(false)
    }
  }, [document, open])

  const loadDocSpaceSDK = (sdkUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.DocSpace?.SDK) {
        resolve()
        return
      }

      const script = window.document.createElement('script')
      script.src = sdkUrl
      script.async = true
      script.onload = () => {
        // Give it a moment to initialize
        setTimeout(() => {
          if (window.DocSpace?.SDK) {
            resolve()
          } else {
            reject(new Error('DocSpace SDK failed to initialize'))
          }
        }, 100)
      }
      script.onerror = () => {
        reject(new Error('Failed to load DocSpace SDK'))
      }
      window.document.head.appendChild(script)
    })
  }

  const initDocSpaceFrame = (docSpaceUrl: string, fileId: string) => {
    if (!window.DocSpace?.SDK) {
      setError('DocSpace SDK not loaded')
      return
    }

    const frameId = `docspace-frame-${document?.id}`

    try {
      frameRef.current = window.DocSpace.SDK.initFrame({
        frameId,
        width: '100%',
        height: '100%',
        mode: 'editor',
        id: fileId,
        showMenu: false,
        showFilter: false,
        showHeader: true,
        events: {
          onAppReady: () => {
            debug.log('DocSpace editor ready')
          },
          onAppError: (error: string) => {
            debug.error('DocSpace error:', error)
            toast.error('Erreur DocSpace: ' + error)
          },
          onEditorCloseCallback: () => {
            handleClose()
          },
        },
      })
    } catch (err) {
      debug.error('Error initializing DocSpace frame:', err)
      setError("Erreur lors de l'initialisation du frame DocSpace")
    }
  }

  const handleClose = async () => {
    // Save document back to Supabase before closing
    if (docSpaceFileId && document) {
      try {
        toast.info('Sauvegarde en cours...')

        try {
          await invokeEdge('docspace-download', {
            documentId: document.id,
            docSpaceFileId,
            deleteFromDocSpace: true,
          })
          toast.success('Document sauvegardé')
        } catch (downloadError) {
          debug.error('Error saving document:', downloadError)
          toast.error('Erreur lors de la sauvegarde')
        }
      } catch (err) {
        debug.error('Error in handleClose:', err)
      }
    }

    // Cleanup frame
    if (frameRef.current) {
      try {
        frameRef.current.destroyFrame()
      } catch (e) {
        debug.warn('Error destroying DocSpace frame:', e)
      }
      frameRef.current = null
    }

    // Reset state
    setDocSpaceFileId(null)
    setDocSpaceUrl(null)
    setLoading(true)
    setError(null)

    // Invalidate queries to refresh document list
    queryClient.invalidateQueries({ queryKey: ['documents'] })
    onOpenChange(false)
  }

  useEffect(() => {
    if (open && document) {
      initializeEditor()
    }

    return () => {
      // Cleanup on unmount
      if (frameRef.current) {
        try {
          frameRef.current.destroyFrame()
        } catch (e) {
          debug.warn('Error destroying DocSpace frame:', e)
        }
        frameRef.current = null
      }
    }
  }, [open, document, initializeEditor])

  if (!document) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 overflow-hidden editor-shell">
        {/* Header */}
        <div className="editor-header flex items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="editor-brand-badge inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold shrink-0">
              <span className="tracking-wide">OpenPulse</span>
            </div>
            <div className="min-w-0 flex flex-col leading-tight">
              <span className="text-sm font-semibold truncate text-foreground">
                {document.name}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Édition collaborative DocSpace
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleClose}
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Editor container */}
        <div className="flex-1 relative">
          {(loading || uploading) && (
            <div className="absolute inset-0 flex items-center justify-center bg-background">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">
                  {uploading
                    ? 'Upload du document vers DocSpace...'
                    : "Chargement de l'éditeur DocSpace..."}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background">
              <div className="text-center space-y-4 max-w-md px-4">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
                <p className="text-destructive font-medium">{error}</p>
                <p className="text-sm text-muted-foreground">
                  Vérifiez que DocSpace est correctement configuré dans les Developer Tools et que
                  l'URL de l'application est autorisée.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => initializeEditor()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Réessayer
                  </Button>
                  <Button variant="ghost" onClick={handleClose}>
                    Fermer
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div id={`docspace-frame-${document.id}`} className="w-full h-full" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
