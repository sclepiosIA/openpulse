import { useState } from 'react'
import { File, FileText, FileImage, Loader2 } from 'lucide-react'
import { Document, Page } from 'react-pdf'
import { cn } from '@/lib/utils'
import type { DocumentFolder } from '@/types/folders'

// Import centralized PDF.js worker configuration
import '@/lib/pdfjs'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

export type SourceType = 'local' | 'nextcloud'

export interface LocalPathItem {
  id: string | null
  type: 'folder'
  folder?: DocumentFolder
}

export interface NextcloudPathItem {
  path: string
  name: string
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`
}

export function getFileTypeLabel(mimeType: string): string {
  if (mimeType?.includes('pdf')) return 'Document PDF'
  if (mimeType?.startsWith('image/')) return 'Image'
  if (mimeType?.includes('word') || mimeType?.includes('document')) return 'Document Word'
  if (mimeType?.includes('sheet') || mimeType?.includes('excel')) return 'Feuille de calcul'
  if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) return 'Présentation'
  return 'Document'
}

interface PreviewThumbnailProps {
  document: { mime_type?: string | null; name?: string }
  previewUrl: string | null
}

export function PreviewThumbnail({ document, previewUrl }: PreviewThumbnailProps) {
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false)
  const [thumbnailError, setThumbnailError] = useState(false)

  const isPdf = document.mime_type?.includes('pdf')
  const isImage = document.mime_type?.startsWith('image/')

  if (!previewUrl) {
    return (
      <div className="w-56 h-72 rounded-xl bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center shadow-sm">
        {isPdf ? (
          <FileText className="h-16 w-16 text-red-500" />
        ) : isImage ? (
          <FileImage className="h-16 w-16 text-blue-500" />
        ) : (
          <File className="h-16 w-16 text-primary/60" />
        )}
      </div>
    )
  }

  if (isImage) {
    return (
      <div className="w-56 h-72 rounded-xl overflow-hidden shadow-md bg-muted/30 flex items-center justify-center">
        {!thumbnailLoaded && !thumbnailError && (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
        )}
        {thumbnailError ? (
          <FileImage className="h-16 w-16 text-blue-500/50" />
        ) : (
          <img
            src={previewUrl}
            alt={document.name}
            className={cn(
              'w-full h-full object-cover transition-opacity duration-200',
              thumbnailLoaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => setThumbnailLoaded(true)}
            onError={() => setThumbnailError(true)}
          />
        )}
      </div>
    )
  }

  if (isPdf) {
    return (
      <div className="w-56 h-72 rounded-lg overflow-hidden shadow-md bg-card flex items-center justify-center">
        <Document
          file={previewUrl}
          loading={
            <div className="flex items-center justify-center w-full h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
            </div>
          }
          error={
            <div className="flex items-center justify-center w-full h-full bg-muted/30">
              <FileText className="h-16 w-16 text-red-500/50" />
            </div>
          }
          className="flex items-center justify-center"
        >
          <Page pageNumber={1} width={200} renderTextLayer={false} renderAnnotationLayer={false} />
        </Document>
      </div>
    )
  }

  return (
    <div className="w-56 h-72 rounded-xl bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center shadow-sm">
      <File className="h-16 w-16 text-primary/60" />
    </div>
  )
}
