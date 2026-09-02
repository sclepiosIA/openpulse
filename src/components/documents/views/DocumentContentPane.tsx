import { memo, useMemo } from "react";
import { FolderOpen, FileX, Loader2, FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DocumentCard } from "../DocumentCard";
import { DocumentUpload } from "../DocumentUpload";
import { CreateFolderDialog } from "../folders/CreateFolderDialog";
import { FolderCard } from "../folders/FolderCard";
import { NextcloudContentPane } from "../NextcloudContentPane";
import { useFolders } from "@/hooks/documents/useFolders";
import { useDocuments } from "@/hooks/documents/useDocuments";
import { isNextcloudFolderId } from "@/hooks/documents/useNextcloudFolderTree";
import type { DocumentFolder } from "@/types/folders";
import type { DocumentWithRelations, DocumentFilters, DocumentSort } from "@/types/documents";

interface DocumentContentPaneProps {
  folderId: string | null;
  viewMode: 'grid' | 'list';
  filters?: DocumentFilters;
  sort?: DocumentSort;
  onFolderClick: (folder: DocumentFolder | { id: string }) => void;
  onFolderRename: (folder: DocumentFolder) => void;
  onFolderDelete: (folder: DocumentFolder) => void;
  onDocumentPreview: (doc: DocumentWithRelations) => void;
  onDocumentEdit: (doc: DocumentWithRelations) => void;
  className?: string;
}

export const DocumentContentPane = memo(function DocumentContentPane({
  folderId,
  viewMode,
  filters = {},
  sort = { field: 'created_at', order: 'desc' },
  onFolderClick,
  onFolderRename,
  onFolderDelete,
  onDocumentPreview,
  onDocumentEdit,
  className,
}: DocumentContentPaneProps) {
  // Si c'est un dossier Nextcloud, afficher le contenu Nextcloud
  if (folderId && isNextcloudFolderId(folderId)) {
    return (
      <NextcloudContentPane
        folderId={folderId}
        viewMode={viewMode}
        onFolderClick={(id) => onFolderClick({ id })}
        className={className}
      />
    );
  }

  // Sinon, comportement normal pour les dossiers locaux
  return (
    <LocalDocumentContentPane
      folderId={folderId}
      viewMode={viewMode}
      filters={filters}
      sort={sort}
      onFolderClick={onFolderClick as (folder: DocumentFolder) => void}
      onFolderRename={onFolderRename}
      onFolderDelete={onFolderDelete}
      onDocumentPreview={onDocumentPreview}
      onDocumentEdit={onDocumentEdit}
      className={className}
    />
  );
});

// Composant interne pour les documents locaux (ancien comportement)
const LocalDocumentContentPane = memo(function LocalDocumentContentPane({
  folderId,
  viewMode,
  filters = {},
  sort = { field: 'created_at', order: 'desc' },
  onFolderClick,
  onFolderRename,
  onFolderDelete,
  onDocumentPreview,
  onDocumentEdit,
  className,
}: Omit<DocumentContentPaneProps, 'onFolderClick'> & { onFolderClick: (folder: DocumentFolder) => void }) {
  const { folders, isLoading: foldersLoading } = useFolders(folderId);
  
  // Merge folder filter with user filters
  const mergedFilters = useMemo(() => ({
    ...filters,
    folderId,
  }), [filters, folderId]);

  const { data: documents = [], isLoading: documentsLoading } = useDocuments(mergedFilters, sort);

  // Filter documents by folder (client-side fallback)
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // folder_id is now typed in DocumentWithRelations
      const docFolderId = doc.folder_id;
      if (folderId === null) {
        return docFolderId === null || docFolderId === undefined;
      }
      return docFolderId === folderId;
    });
  }, [documents, folderId]);

  const isLoading = foldersLoading || documentsLoading;
  const isEmpty = folders.length === 0 && filteredDocuments.length === 0;

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-muted-foreground", className)}>
        <FolderOpen className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm font-medium mb-1">Ce dossier est vide</p>
        <p className="text-xs mb-4">Ajoutez des dossiers ou des documents</p>
        <div className="flex items-center gap-2">
          <CreateFolderDialog
            parentFolderId={folderId}
            trigger={
              <Button variant="outline" size="sm" className="gap-2">
                <FolderPlus className="h-4 w-4" />
                Nouveau dossier
              </Button>
            }
          />
          <DocumentUpload
            options={{ folderId } as any}
            compact
          />
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="p-4 space-y-4">
        {/* Folders section */}
        {folders.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Dossiers</h3>
              <Badge variant="secondary" className="text-xs">
                {folders.length}
              </Badge>
            </div>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {folders.map(folder => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onClick={() => onFolderClick(folder)}
                    onRename={() => onFolderRename(folder)}
                    onDelete={() => onFolderDelete(folder)}
                    viewMode="grid"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {folders.map(folder => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onClick={() => onFolderClick(folder)}
                    onRename={() => onFolderRename(folder)}
                    onDelete={() => onFolderDelete(folder)}
                    viewMode="list"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Separator */}
        {folders.length > 0 && filteredDocuments.length > 0 && (
          <div className="border-t" />
        )}

        {/* Documents section */}
        {filteredDocuments.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileX className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Documents</h3>
              <Badge variant="secondary" className="text-xs">
                {filteredDocuments.length}
              </Badge>
            </div>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredDocuments.map(doc => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    viewMode="grid"
                    onPreview={onDocumentPreview}
                    onEdit={onDocumentEdit}
                    currentFolderId={folderId}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocuments.map(doc => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    viewMode="list"
                    onPreview={onDocumentPreview}
                    onEdit={onDocumentEdit}
                    currentFolderId={folderId}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );
});
