import { useState, useCallback, useRef, useEffect } from 'react'
import { Document, Page } from 'react-pdf'
import { cn } from '@/lib/utils'
import {
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  FileText,
  FileImage,
  File,
  FileSpreadsheet,
  Presentation,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import '@/lib/pdfjs'

interface InlineDocumentPreviewProps {
  url: string | null
  mimeType: string | null
  fileName: string
  loading?: boolean
  onOpenFullPreview?: () => void
  className?: string
  /** Width constraint for the preview container */
  maxWidth?: number
}

export function InlineDocumentPreview({
  url,
  mimeType,
  fileName,
  loading = false,
  onOpenFullPreview,
  className,
  maxWidth = 340,
}: InlineDocumentPreviewProps) {
  const isPDF = mimeType?.includes('pdf') ?? false
  const isImage = mimeType?.startsWith('image/') ?? false
  const isOfficeDoc = mimeType
    ? mimeType.includes('word') ||
      mimeType.includes('excel') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('powerpoint') ||
      mimeType.includes('presentation') ||
      mimeType.includes('msword') ||
      mimeType.includes('opendocument')
    : false
  const isText = mimeType
    ? mimeType.startsWith('text/') ||
      mimeType.includes('json') ||
      mimeType.includes('xml') ||
      mimeType.includes('javascript') ||
      mimeType.includes('typescript')
    : false
  const isVideo = mimeType?.startsWith('video/') ?? false
  const isAudio = mimeType?.startsWith('audio/') ?? false

  if (loading || !url) {
    return (
      <div
        className={cn('flex items-center justify-center rounded-xl bg-muted/40', className)}
        style={{ minHeight: 200 }}
      >
        {loading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
        ) : (
          <FileIcon mimeType={mimeType} />
        )}
      </div>
    )
  }

  if (isPDF) {
    return (
      <InlinePDFPreview
        url={url}
        maxWidth={maxWidth}
        onOpenFull={onOpenFullPreview}
        className={className}
      />
    )
  }

  if (isImage) {
    return (
      <InlineImagePreview
        url={url}
        fileName={fileName}
        onOpenFull={onOpenFullPreview}
        className={className}
      />
    )
  }

  if (isVideo) {
    return (
      <div className={cn('rounded-xl overflow-hidden bg-black', className)}>
        <video src={url} controls className="w-full max-h-[400px]" preload="metadata" />
      </div>
    )
  }

  if (isAudio) {
    return (
      <div className={cn('rounded-xl bg-muted/30 p-4 flex flex-col items-center gap-3', className)}>
        <FileIcon mimeType={mimeType} />
        <audio src={url} controls className="w-full" preload="metadata" />
      </div>
    )
  }

  if (isText) {
    return <InlineTextPreview url={url} className={className} />
  }

  if (isOfficeDoc) {
    return (
      <div
        className={cn(
          'rounded-xl bg-muted/20 flex flex-col items-center justify-center gap-3 p-6',
          className
        )}
        style={{ minHeight: 200 }}
      >
        <FileIcon mimeType={mimeType} />
        <p className="text-xs text-muted-foreground text-center">
          Aperçu non disponible pour ce format
        </p>
        {onOpenFullPreview && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenFullPreview}
            className="gap-1.5 text-xs"
          >
            <Maximize2 className="h-3 w-3" />
            Ouvrir
          </Button>
        )}
      </div>
    )
  }

  // Fallback
  return (
    <div
      className={cn(
        'rounded-xl bg-muted/20 flex flex-col items-center justify-center gap-3 p-6',
        className
      )}
      style={{ minHeight: 200 }}
    >
      <FileIcon mimeType={mimeType} />
      <p className="text-xs text-muted-foreground">{mimeType || 'Type inconnu'}</p>
    </div>
  )
}

// ============================================================================
// INLINE PDF PREVIEW
// ============================================================================

function InlinePDFPreview({
  url,
  maxWidth,
  onOpenFull,
  className,
}: {
  url: string
  maxWidth: number
  onOpenFull?: () => void
  className?: string
}) {
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pdfLoading, setPdfLoading] = useState(true)
  const [pdfError, setPdfError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const onDocLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n)
    setPdfLoading(false)
  }, [])

  const prevPage = () => setCurrentPage((p) => Math.max(1, p - 1))
  const nextPage = () => setCurrentPage((p) => Math.min(numPages, p + 1))

  return (
    <div
      className={cn('rounded-xl overflow-hidden bg-card dark:bg-muted/20 flex flex-col', className)}
      ref={containerRef}
    >
      {/* PDF render area */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden relative"
        style={{ minHeight: 300 }}
      >
        {pdfLoading && !pdfError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {pdfError ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground p-4">
            <FileText className="h-12 w-12 text-red-400" />
            <p className="text-xs">Impossible de charger le PDF</p>
          </div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={onDocLoadSuccess}
            onLoadError={() => {
              setPdfError(true)
              setPdfLoading(false)
            }}
            loading={null}
            className="flex items-center justify-center"
          >
            <Page
              pageNumber={currentPage}
              width={maxWidth - 16}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        )}
      </div>

      {/* PDF navigation bar */}
      {numPages > 0 && (
        <div className="flex items-center justify-between px-2 py-1.5 border-t bg-muted/10 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={prevPage}
            disabled={currentPage <= 1}
            aria-label="Précédent"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground font-medium">
            {currentPage} / {numPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={nextPage}
            disabled={currentPage >= numPages}
            aria-label="Suivant"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          {onOpenFull && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-auto"
              onClick={onOpenFull}
              title="Plein écran"
              aria-label="Agrandir"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// INLINE IMAGE PREVIEW
// ============================================================================

function InlineImagePreview({
  url,
  fileName,
  onOpenFull,
  className,
}: {
  url: string
  fileName: string
  onOpenFull?: () => void
  className?: string
}) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)

  if (error) {
    return (
      <div
        className={cn(
          'rounded-xl bg-muted/30 flex flex-col items-center justify-center gap-2 p-6',
          className
        )}
        style={{ minHeight: 200 }}
      >
        <FileImage className="h-12 w-12 text-blue-400/50" />
        <p className="text-xs text-muted-foreground">Impossible de charger l'image</p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl overflow-hidden bg-muted/10 flex flex-col', className)}>
      <div
        className="flex-1 flex items-center justify-center overflow-auto p-2 relative"
        style={{ minHeight: 200, maxHeight: 400 }}
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
          </div>
        )}
        <img
          src={url}
          alt={fileName}
          className={cn(
            'max-w-full max-h-full object-contain transition-all duration-200 rounded shadow-sm cursor-pointer',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
          style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          onClick={onOpenFull}
        />
      </div>

      {/* Image controls */}
      {loaded && (
        <div className="flex items-center justify-center gap-0.5 px-2 py-1.5 border-t bg-muted/10">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            disabled={scale <= 0.5}
            aria-label="Dézoomer"
          >
            <ZoomOut className="h-3 w-3" />
          </Button>
          <span className="text-[10px] text-muted-foreground w-8 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
            disabled={scale >= 3}
            aria-label="Zoomer"
          >
            <ZoomIn className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            aria-label="Actualiser"
          >
            <RotateCw className="h-3 w-3" />
          </Button>
          {onOpenFull && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-auto"
              onClick={onOpenFull}
              title="Plein écran"
              aria-label="Agrandir"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// INLINE TEXT PREVIEW
// ============================================================================

function InlineTextPreview({ url, className }: { url: string; className?: string }) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(url)
      .then((r) => r.text())
      .then((t) => {
        if (!cancelled) {
          // Limit display to first 3000 chars
          setText(t.length > 3000 ? t.substring(0, 3000) + '\n\n… (tronqué)' : t)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setText(null)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (loading) {
    return (
      <div
        className={cn('rounded-xl bg-muted/30 flex items-center justify-center p-4', className)}
        style={{ minHeight: 200 }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
      </div>
    )
  }

  if (!text) {
    return (
      <div
        className={cn('rounded-xl bg-muted/30 flex items-center justify-center p-4', className)}
        style={{ minHeight: 100 }}
      >
        <p className="text-xs text-muted-foreground">Impossible de charger le fichier</p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl overflow-hidden border bg-background', className)}>
      <pre className="p-3 text-[11px] leading-relaxed text-foreground/80 overflow-auto max-h-[400px] whitespace-pre-wrap break-words font-mono">
        {text}
      </pre>
    </div>
  )
}

// ============================================================================
// FILE ICON HELPER
// ============================================================================

function FileIcon({ mimeType }: { mimeType: string | null }) {
  if (mimeType?.includes('pdf')) return <FileText className="h-12 w-12 text-red-500/60" />
  if (mimeType?.startsWith('image/')) return <FileImage className="h-12 w-12 text-blue-500/60" />
  if (mimeType?.includes('sheet') || mimeType?.includes('excel'))
    return <FileSpreadsheet className="h-12 w-12 text-green-600/60" />
  if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint'))
    return <Presentation className="h-12 w-12 text-orange-500/60" />
  if (mimeType?.includes('word') || mimeType?.includes('document'))
    return <FileText className="h-12 w-12 text-blue-600/60" />
  return <File className="h-12 w-12 text-muted-foreground/40" />
}
