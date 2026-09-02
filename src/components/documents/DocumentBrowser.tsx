import { useState, useMemo } from 'react'
import { Search, Filter, LayoutGrid, List, SortAsc, FolderOpen, Loader2, FileX } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useDocuments } from '@/hooks/documents/useDocuments'
import { DocumentCard } from './DocumentCard'
import { DocumentUpload } from './DocumentUpload'
import type {
  DocumentFilters,
  DocumentSort,
  DocumentSortField,
  DocumentWithRelations,
} from '@/types/documents'
import { MIME_TYPE_CATEGORIES } from '@/types/documents'

interface DocumentBrowserProps {
  relatedEtablissementId?: string
  relatedTacheId?: string
  relatedProfileId?: string
  showUpload?: boolean
  className?: string
  compact?: boolean
  onDocumentSelect?: (document: DocumentWithRelations) => void
}

const SORT_OPTIONS: { value: DocumentSortField; label: string }[] = [
  { value: 'created_at', label: 'Date de création' },
  { value: 'updated_at', label: 'Dernière modification' },
  { value: 'name', label: 'Nom' },
  { value: 'file_size_bytes', label: 'Taille' },
]

const MIME_FILTER_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Images' },
  { value: 'word', label: 'Word' },
  { value: 'excel', label: 'Excel' },
  { value: 'powerpoint', label: 'PowerPoint' },
  { value: 'text', label: 'Texte' },
  { value: 'video', label: 'Vidéo' },
  { value: 'audio', label: 'Audio' },
]

export function DocumentBrowser({
  relatedEtablissementId,
  relatedTacheId,
  relatedProfileId,
  showUpload = true,
  className,
  compact = false,
  onDocumentSelect,
}: DocumentBrowserProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMimeTypes, setSelectedMimeTypes] = useState<string[]>([])
  const [sort, setSort] = useState<DocumentSort>({ field: 'created_at', order: 'desc' })

  // Construire les filtres
  const filters = useMemo((): DocumentFilters => {
    const f: DocumentFilters = {}

    if (searchQuery.length >= 2) {
      f.search = searchQuery
    }

    if (selectedMimeTypes.length > 0) {
      // Convertir les catégories en types MIME
      const mimeTypes: string[] = []
      selectedMimeTypes.forEach((cat) => {
        const types = MIME_TYPE_CATEGORIES[cat as keyof typeof MIME_TYPE_CATEGORIES]
        if (types) {
          mimeTypes.push(...types)
        }
      })
      f.mimeTypes = mimeTypes
    }

    if (relatedEtablissementId) {
      f.relatedEtablissementId = relatedEtablissementId
    }
    if (relatedTacheId) {
      f.relatedTacheId = relatedTacheId
    }
    if (relatedProfileId) {
      f.relatedProfileId = relatedProfileId
    }

    return f
  }, [searchQuery, selectedMimeTypes, relatedEtablissementId, relatedTacheId, relatedProfileId])

  const { data: documents = [], isLoading, error } = useDocuments(filters, sort)

  const toggleMimeFilter = (category: string) => {
    setSelectedMimeTypes((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    )
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedMimeTypes([])
  }

  const hasActiveFilters = searchQuery.length > 0 || selectedMimeTypes.length > 0

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header avec upload */}
      {showUpload && !compact && (
        <DocumentUpload
          options={{
            relatedEtablissementId,
            relatedTacheId,
            relatedProfileId,
          }}
        />
      )}

      {/* Barre de recherche et filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher des documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl bg-card/80 border-primary/10 backdrop-blur-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Filtre par type */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-lg bg-card/80 hover:bg-card border-slate-200/50"
              >
                <Filter className="w-4 h-4" />
                Type
                {selectedMimeTypes.length > 0 && (
                  <Badge variant="secondary" className="ml-1 rounded-md">
                    {selectedMimeTypes.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Types de fichiers</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {MIME_FILTER_OPTIONS.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={selectedMimeTypes.includes(option.value)}
                  onCheckedChange={() => toggleMimeFilter(option.value)}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tri */}
          <Select
            value={sort.field}
            onValueChange={(value: DocumentSortField) => setSort((s) => ({ ...s, field: value }))}
          >
            <SelectTrigger className="w-[160px] rounded-lg bg-card/80 border-slate-200/50">
              <SortAsc className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Toggle vue */}
          <div className="flex items-center border border-slate-200/50 rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className={cn(
                'h-8 w-8 rounded-none',
                viewMode === 'grid' && 'bg-primary/10 text-primary'
              )}
              onClick={() => setViewMode('grid')}
              aria-label="Grille"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className={cn(
                'h-8 w-8 rounded-none',
                viewMode === 'list' && 'bg-primary/10 text-primary'
              )}
              onClick={() => setViewMode('list')}
              aria-label="Liste"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filtres actifs */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {selectedMimeTypes.map((type) => (
            <Badge key={type} variant="secondary" className="gap-1 rounded-md">
              {MIME_FILTER_OPTIONS.find((o) => o.value === type)?.label}
              <button
                onClick={() => toggleMimeFilter(type)}
                className="ml-1 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="rounded-lg hover:bg-primary/5 hover:text-primary"
          >
            Effacer les filtres
          </Button>
        </div>
      )}

      {/* Contenu */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center">
          <FileX className="w-12 h-12 mb-4" />
          <p className="text-sm">Erreur lors du chargement des documents</p>
          <p className="text-xs mt-2 max-w-md break-words">
            {(error as any)?.message || 'Détails indisponibles'}
          </p>
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FolderOpen className="w-12 h-12 mb-4" />
          <p className="text-sm font-medium">Aucun document</p>
          <p className="text-xs mt-1">
            {hasActiveFilters
              ? 'Essayez de modifier vos filtres'
              : 'Uploadez votre premier document'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              viewMode="grid"
              onPreview={onDocumentSelect}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              viewMode="list"
              onPreview={onDocumentSelect}
            />
          ))}
        </div>
      )}

      {/* Compteur */}
      {documents.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {documents.length} document{documents.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
