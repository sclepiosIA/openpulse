import { useState, useCallback, useRef } from 'react'
import { Upload, X, FileIcon, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useDocumentUpload } from '@/hooks/documents/useDocumentUpload'
import { formatFileSize } from '@/types/documents'
import type { DocumentUploadOptions } from '@/types/documents'

interface DocumentUploadProps {
  onDocumentUploaded?: (documentId: string) => void
  options?: DocumentUploadOptions
  maxFiles?: number
  className?: string
  compact?: boolean
}

export function DocumentUpload({
  onDocumentUploaded,
  options,
  maxFiles = 10,
  className,
  compact = false,
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploads, uploadFiles, removeUpload, isUploading } = useDocumentUpload()

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files).slice(0, maxFiles)
      if (files.length > 0) {
        const results = await uploadFiles(files, options)
        results.forEach((doc) => {
          if (doc?.id && onDocumentUploaded) {
            onDocumentUploaded(doc.id)
          }
        })
      }
    },
    [maxFiles, uploadFiles, options, onDocumentUploaded]
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).slice(0, maxFiles)
      if (files.length > 0) {
        const results = await uploadFiles(files, options)
        results.forEach((doc) => {
          if (doc?.id && onDocumentUploaded) {
            onDocumentUploaded(doc.id)
          }
        })
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [maxFiles, uploadFiles, options, onDocumentUploaded]
  )

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />
      default:
        return null
    }
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="rounded-lg bg-card/80 hover:bg-card border-slate-200/50 gap-2"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          Ajouter un document
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Zone de drop - compacte */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl px-4 py-4 text-center cursor-pointer transition-all flex items-center justify-center gap-3',
          isDragging
            ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
            : 'border-slate-300/50 hover:border-primary/50 hover:bg-primary/5'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload
          className={cn(
            'w-5 h-5 shrink-0 transition-colors',
            isDragging ? 'text-primary' : 'text-muted-foreground'
          )}
        />
        <p className="text-sm">
          <span className="font-medium">Glissez-déposez</span>
          <span className="text-muted-foreground">
            {' '}
            ou cliquez (max {maxFiles} fichiers, 200Mo)
          </span>
        </p>
      </div>

      {/* Liste des uploads en cours */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, index) => (
            <div
              key={`${upload.file.name}-${index}`}
              className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50/80 to-white/60 rounded-xl border border-slate-200/30"
            >
              <FileIcon className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{upload.file.name}</p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatFileSize(upload.file.size)}
                  </span>
                </div>
                {upload.status === 'uploading' && (
                  <Progress
                    value={upload.progress}
                    className="h-1 mt-2"
                    aria-label={`Progression de l'upload de ${upload.file.name}`}
                  />
                )}
                {upload.status === 'error' && upload.error && (
                  <p className="text-xs text-destructive mt-1">{upload.error}</p>
                )}
              </div>
              <div className="shrink-0">{getStatusIcon(upload.status)}</div>
              {(upload.status === 'success' || upload.status === 'error') && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 rounded-md"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeUpload(upload.file)
                  }}
                  aria-label="Fermer"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
