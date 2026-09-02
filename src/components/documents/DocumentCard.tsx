import { useState } from 'react'
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  File,
  MoreHorizontal,
  Download,
  Trash2,
  Share2,
  Eye,
  Link2,
  FolderInput,
  Edit,
} from 'lucide-react'

// Types MIME éditables dans DocSpace
const DOCSPACE_EDITABLE_MIMES = [
  // Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // OpenDocument
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
]

const isEditableInDocSpace = (mimeType: string): boolean => {
  return DOCSPACE_EDITABLE_MIMES.includes(mimeType)
}

const isNativeEditorDocument = (doc: { source_type?: string | null }): boolean => {
  return doc.source_type === 'native_editor'
}

type NativeDocType = 'Doc' | 'Sheet' | 'Pres' | null

const getNativeDocType = (doc: {
  source_type?: string | null
  mime_type: string
  name: string
}): NativeDocType => {
  if (doc.source_type !== 'native_editor') return null
  if (doc.mime_type === 'text/html' || doc.name.endsWith('.html')) return 'Doc'
  if (doc.mime_type === 'application/json') {
    if (
      doc.name.toLowerCase().includes('présentation') ||
      doc.name.toLowerCase().includes('presentation') ||
      doc.name.toLowerCase().includes('slides')
    )
      return 'Pres'
    return 'Sheet'
  }
  return 'Doc'
}

const NATIVE_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  Doc: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    label: 'Doc',
  },
  Sheet: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    label: 'Sheet',
  },
  Pres: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-300',
    label: 'Pres',
  },
}
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import { safeFormatDistanceToNow } from '@/lib/safeDate'
import { fr } from 'date-fns/locale'
import type { DocumentWithRelations } from '@/types/documents'
import { formatFileSize, getMimeTypeCategory } from '@/types/documents'
import { useDocumentDownload } from '@/hooks/documents/useDocumentUpload'
import { useDeleteDocument } from '@/hooks/documents/useDocuments'
import { MoveToFolderDialog } from './folders/MoveToFolderDialog'
import { ShareDocumentDialog } from './dialogs/ShareDocumentDialog'

interface DocumentCardProps {
  document: DocumentWithRelations
  onPreview?: (document: DocumentWithRelations) => void
  onShare?: (document: DocumentWithRelations) => void
  onEdit?: (document: DocumentWithRelations) => void
  className?: string
  viewMode?: 'grid' | 'list'
  currentFolderId?: string | null
}

const MIME_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  image: FileImage,
  excel: FileSpreadsheet,
  word: FileText,
  powerpoint: FileText,
  video: FileVideo,
  audio: FileAudio,
  text: FileText,
  other: File,
}

const MIME_COLORS: Record<string, string> = {
  pdf: 'text-red-500',
  image: 'text-green-500',
  excel: 'text-emerald-600',
  word: 'text-blue-600',
  powerpoint: 'text-orange-500',
  video: 'text-purple-500',
  audio: 'text-pink-500',
  text: 'text-muted-foreground',
  other: 'text-muted-foreground',
}

export function DocumentCard({
  document,
  onPreview,
  onShare,
  onEdit,
  className,
  viewMode = 'grid',
  currentFolderId,
}: DocumentCardProps) {
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const downloadMutation = useDocumentDownload()
  const deleteMutation = useDeleteDocument()

  const category = getMimeTypeCategory(document.mime_type)
  const Icon = MIME_ICONS[category] || File
  const nativeType = getNativeDocType(document)
  const iconColor = MIME_COLORS[category] || 'text-muted-foreground'

  const handleDownload = () => {
    downloadMutation.mutate({
      id: document.id,
      storage_path: document.storage_path,
      storage_bucket: document.storage_bucket,
      name: document.name,
    })
  }

  const handleDelete = () => {
    if (window.confirm('Supprimer ce document ?')) {
      deleteMutation.mutate(document.id)
    }
  }

  // Récupérer la première relation pour l'affichage
  const firstRelation = document.relations?.[0]
  const linkedEntity =
    firstRelation?.etablissement ||
    firstRelation?.tache ||
    firstRelation?.groupe ||
    firstRelation?.partenaire

  const isEditable = isEditableInDocSpace(document.mime_type) || isNativeEditorDocument(document)

  const handleDoubleClick = () => {
    if (isEditable && onEdit) {
      onEdit(document)
    } else if (onPreview) {
      onPreview(document)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleDoubleClick()
    }
  }

  const ariaLabel = isEditable
    ? `Modifier le document ${document.name}`
    : `Aperçu du document ${document.name}`

  const menuContent = (
    <>
      {isEditable && onEdit && (
        <DropdownMenuItem onClick={() => onEdit(document)}>
          <Edit className="w-4 h-4 mr-2" />
          Modifier
        </DropdownMenuItem>
      )}
      {onPreview && (
        <DropdownMenuItem onClick={() => onPreview(document)}>
          <Eye className="w-4 h-4 mr-2" />
          Aperçu
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={handleDownload}>
        <Download className="w-4 h-4 mr-2" />
        Télécharger
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setShowMoveDialog(true)}>
        <FolderInput className="w-4 h-4 mr-2" />
        Déplacer vers...
      </DropdownMenuItem>
      {onShare && (
        <DropdownMenuItem
          onClick={() => {
            onShare(document)
            setShowShareDialog(true)
          }}
        >
          <Share2 className="w-4 h-4 mr-2" />
          Partager
        </DropdownMenuItem>
      )}
      {!onShare && (
        <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
          <Share2 className="w-4 h-4 mr-2" />
          Partager
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDelete}>
        <Trash2 className="w-4 h-4 mr-2" />
        Supprimer
      </DropdownMenuItem>
    </>
  )

  const contextMenuContent = (
    <>
      {isEditable && onEdit && (
        <ContextMenuItem onClick={() => onEdit(document)}>
          <Edit className="w-4 h-4 mr-2" />
          Modifier
        </ContextMenuItem>
      )}
      {onPreview && (
        <ContextMenuItem onClick={() => onPreview(document)}>
          <Eye className="w-4 h-4 mr-2" />
          Aperçu
        </ContextMenuItem>
      )}
      <ContextMenuItem onClick={handleDownload}>
        <Download className="w-4 h-4 mr-2" />
        Télécharger
      </ContextMenuItem>
      <ContextMenuItem onClick={() => setShowMoveDialog(true)}>
        <FolderInput className="w-4 h-4 mr-2" />
        Déplacer vers...
      </ContextMenuItem>
      {onShare && (
        <ContextMenuItem
          onClick={() => {
            onShare(document)
            setShowShareDialog(true)
          }}
        >
          <Share2 className="w-4 h-4 mr-2" />
          Partager
        </ContextMenuItem>
      )}
      {!onShare && (
        <ContextMenuItem onClick={() => setShowShareDialog(true)}>
          <Share2 className="w-4 h-4 mr-2" />
          Partager
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem className="text-destructive focus:text-destructive" onClick={handleDelete}>
        <Trash2 className="w-4 h-4 mr-2" />
        Supprimer
      </ContextMenuItem>
    </>
  )

  if (viewMode === 'list') {
    return (
      <>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                'flex items-center gap-4 p-3 border border-slate-200/50 rounded-xl hover:bg-primary/5 hover:border-primary/10 transition-all group cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                className
              )}
              onDoubleClick={handleDoubleClick}
              onKeyDown={handleKeyDown}
              role="button"
              tabIndex={0}
              aria-label={ariaLabel}
            >
              <div
                className={cn(
                  'p-2.5 rounded-xl bg-gradient-to-br from-white to-slate-50 shadow-sm',
                  iconColor
                )}
              >
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{document.name}</p>
                  {nativeType && (
                    <span
                      className={cn(
                        'shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded',
                        NATIVE_TYPE_STYLES[nativeType].bg,
                        NATIVE_TYPE_STYLES[nativeType].text
                      )}
                    >
                      {NATIVE_TYPE_STYLES[nativeType].label}
                    </span>
                  )}
                  {linkedEntity && (
                    <Badge variant="outline" className="text-xs shrink-0 rounded-md">
                      <Link2 className="w-3 h-3 mr-1" />
                      {'nom' in linkedEntity ? linkedEntity.nom : (linkedEntity as any).titre}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>{formatFileSize(document.file_size_bytes)}</span>
                  <span>•</span>
                  <span>
                    {safeFormatDistanceToNow(document.created_at, { addSuffix: true, locale: fr })}
                  </span>
                </div>
              </div>

              {document.shares && document.shares.length > 0 && (
                <div
                  className="flex items-center gap-1 shrink-0"
                  title={`Partagé avec ${document.shares.length} collaborateur${document.shares.length > 1 ? 's' : ''}`}
                >
                  <Share2 className="w-3.5 h-3.5 text-primary/60" />
                  <span className="text-xs font-medium text-primary/70">
                    {document.shares.length}
                  </span>
                </div>
              )}

              {document.tags && document.tags.length > 0 && (
                <div className="hidden md:flex items-center gap-1">
                  {document.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs rounded-md">
                      {tag}
                    </Badge>
                  ))}
                  {document.tags.length > 2 && (
                    <span className="text-xs text-muted-foreground">
                      +{document.tags.length - 2}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onPreview && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg bg-slate-50/80 hover:bg-slate-100 border border-transparent hover:border-slate-200/50"
                    onClick={() => onPreview(document)}
                    aria-label="Voir"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg bg-slate-50/80 hover:bg-slate-100 border border-transparent hover:border-slate-200/50"
                  onClick={handleDownload}
                  aria-label="Télécharger"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg bg-slate-50/80 hover:bg-slate-100 border border-transparent hover:border-slate-200/50"
                      aria-label="Plus d'options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover">
                    {menuContent}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="bg-popover">{contextMenuContent}</ContextMenuContent>
        </ContextMenu>

        <MoveToFolderDialog
          open={showMoveDialog}
          onOpenChange={setShowMoveDialog}
          documentId={document.id}
          documentName={document.name}
          currentFolderId={currentFolderId}
        />
      </>
    )
  }

  // Mode grille
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Card
            className={cn(
              'group hover:shadow-lg hover:border-primary/20 transition-all cursor-pointer overflow-hidden rounded-xl border-slate-200/50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              className
            )}
            onDoubleClick={handleDoubleClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label={ariaLabel}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div
                  className={cn(
                    'p-3 rounded-xl bg-gradient-to-br from-white to-slate-50 shadow-sm',
                    iconColor
                  )}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 bg-card/80 hover:bg-card border border-slate-200/50 transition-opacity"
                      aria-label="Plus d'options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover">
                    {menuContent}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-1.5 mb-1">
                <h4 className="font-medium text-sm truncate" title={document.name}>
                  {document.name}
                </h4>
                {nativeType && (
                  <span
                    className={cn(
                      'shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded',
                      NATIVE_TYPE_STYLES[nativeType].bg,
                      NATIVE_TYPE_STYLES[nativeType].text
                    )}
                  >
                    {NATIVE_TYPE_STYLES[nativeType].label}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span>{formatFileSize(document.file_size_bytes)}</span>
                <span>•</span>
                <span>
                  {safeFormatDistanceToNow(document.created_at, { addSuffix: true, locale: fr })}
                </span>
                {document.shares && document.shares.length > 0 && (
                  <>
                    <span>•</span>
                    <span
                      className="inline-flex items-center gap-1 text-primary/70"
                      title={`Partagé avec ${document.shares.length} collaborateur${document.shares.length > 1 ? 's' : ''}`}
                    >
                      <Share2 className="w-3 h-3" />
                      {document.shares.length}
                    </span>
                  </>
                )}
              </div>

              {linkedEntity && (
                <Badge variant="outline" className="text-xs mb-2 rounded-md">
                  <Link2 className="w-3 h-3 mr-1" />
                  {'nom' in linkedEntity ? linkedEntity.nom : (linkedEntity as any).titre}
                </Badge>
              )}

              {document.tags && document.tags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {document.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs rounded-md">
                      {tag}
                    </Badge>
                  ))}
                  {document.tags.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{document.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </ContextMenuTrigger>
        <ContextMenuContent className="bg-popover">{contextMenuContent}</ContextMenuContent>
      </ContextMenu>

      <MoveToFolderDialog
        open={showMoveDialog}
        onOpenChange={setShowMoveDialog}
        documentId={document.id}
        documentName={document.name}
        currentFolderId={currentFolderId}
      />

      <ShareDocumentDialog
        document={document}
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
      />
    </>
  )
}
