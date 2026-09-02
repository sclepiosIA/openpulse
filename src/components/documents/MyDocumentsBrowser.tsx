import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  Filter,
  SortAsc,
  FolderOpen,
  Loader2,
  FileX,
  Upload,
  FolderPlus,
  Plus,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  Users,
  Cloud,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useDocuments } from "@/hooks/documents/useDocuments";
import { useQueryClient } from "@tanstack/react-query";
import { useFolders } from "@/hooks/documents/useFolders";

import { useNativeDocumentLoad } from "@/hooks/documents/useNativeDocumentLoad";
import { DocumentCard } from "./DocumentCard";
import { DocumentUpload } from "./DocumentUpload";
import { FolderCard } from "./folders/FolderCard";
import { FolderBreadcrumb } from "./folders/FolderBreadcrumb";
import { CreateFolderDialog } from "./folders/CreateFolderDialog";
import { RenameFolderDialog } from "./folders/RenameFolderDialog";
import { DeleteFolderDialog } from "./folders/DeleteFolderDialog";
import { DocumentPreviewDialog } from "./DocumentPreviewDialog";
import { DocSpaceEditorDialog } from "./DocSpaceEditorDialog";
import { NewDocumentDialog, type NativeEditorType } from "./dialogs/NewDocumentDialog";
import { NativeEditorDialog } from "./editors/NativeEditorDialog";
import { FolderTreeSidebar } from "./views/FolderTreeSidebar";
import { FinderColumnView } from "./views/FinderColumnView";
import { ViewModeSelector } from "./views/ViewModeSelector";
import { DocumentContentPane } from "./views/DocumentContentPane";
import { ShareDocumentDialog } from "./dialogs/ShareDocumentDialog";
import { FolderPermissionsDialog } from "./dialogs/FolderPermissionsDialog";
import { ManageGroupsDialog } from "./dialogs/ManageGroupsDialog";
import { NextcloudImportDialog } from "./dialogs/NextcloudImportDialog";
import { useIsMobile } from "@/hooks/ui/use-mobile";
import type { DocumentFilters, DocumentSort, DocumentSortField, DocumentWithRelations } from "@/types/documents";
import type { DocumentFolder, DocumentViewStyle } from "@/types/folders";
import { MIME_TYPE_CATEGORIES } from "@/types/documents";

interface MyDocumentsBrowserProps {
  className?: string;
  onDocumentSelect?: (document: DocumentWithRelations) => void;
}

const SORT_OPTIONS: { value: DocumentSortField; label: string }[] = [
  { value: 'created_at', label: 'Date de création' },
  { value: 'updated_at', label: 'Dernière modification' },
  { value: 'name', label: 'Nom' },
  { value: 'file_size_bytes', label: 'Taille' },
];

const MIME_FILTER_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Images' },
  { value: 'word', label: 'Word' },
  { value: 'excel', label: 'Excel' },
  { value: 'powerpoint', label: 'PowerPoint' },
  { value: 'text', label: 'Texte' },
  { value: 'video', label: 'Vidéo' },
  { value: 'audio', label: 'Audio' },
];

const FOLDER_TEMPLATES = [
  { name: "Contrats", icon: "📁" },
  { name: "Factures", icon: "📁" },
  { name: "Rapports", icon: "📁" },
  { name: "Correspondances", icon: "📁" },
  { name: "Administratif", icon: "📁" },
  { name: "Archives", icon: "📁" },
];

// Storage key for view preferences
const VIEW_STYLE_KEY = 'documents-view-style';
const CONTENT_MODE_KEY = 'documents-content-mode';
const SIDEBAR_COLLAPSED_KEY = 'documents-sidebar-collapsed';

export function MyDocumentsBrowser({
  className,
  onDocumentSelect,
}: MyDocumentsBrowserProps) {
  const isMobile = useIsMobile();
  const { loadContent: loadNativeContent, isLoading: isLoadingNativeContent } = useNativeDocumentLoad();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  
  // View preferences with localStorage persistence
  const [viewStyle, setViewStyle] = useState<DocumentViewStyle>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(VIEW_STYLE_KEY) as DocumentViewStyle) || 'tree';
    }
    return 'tree';
  });
  const [contentMode, setContentMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(CONTENT_MODE_KEY) as 'grid' | 'list') || 'grid';
    }
    return 'grid';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    }
    return false;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMimeTypes, setSelectedMimeTypes] = useState<string[]>([]);
  const [sort, setSort] = useState<DocumentSort>({ field: 'created_at', order: 'desc' });
  
  // Dialogs state
  const [folderToRename, setFolderToRename] = useState<DocumentFolder | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<DocumentFolder | null>(null);
  const [previewDocument, setPreviewDocument] = useState<DocumentWithRelations | null>(null);
  const [editDocument, setEditDocument] = useState<DocumentWithRelations | null>(null);
  const [showNewDocDialog, setShowNewDocDialog] = useState(false);
  const [nativeEditorState, setNativeEditorState] = useState<{
    open: boolean;
    type: NativeEditorType;
    name: string;
    documentId?: string;
    initialContent?: string;
  }>({ open: false, type: 'native_doc', name: '' });
  const [shareDocument, setShareDocument] = useState<DocumentWithRelations | null>(null);
  const [folderForPermissions, setFolderForPermissions] = useState<DocumentFolder | null>(null);
  const [showGroupsDialog, setShowGroupsDialog] = useState(false);
  const [showNextcloudImport, setShowNextcloudImport] = useState(false);

  // Persist view preferences
  useEffect(() => {
    localStorage.setItem(VIEW_STYLE_KEY, viewStyle);
  }, [viewStyle]);

  useEffect(() => {
    localStorage.setItem(CONTENT_MODE_KEY, contentMode);
  }, [contentMode]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Fetch folders for current level (for classic view)
  const { folders, isLoading: foldersLoading, createFolder, isCreating } = useFolders(currentFolderId);

  // Build filters
  const filters = useMemo((): DocumentFilters & { folderId?: string | null } => {
    const f: DocumentFilters & { folderId?: string | null } = {};
    
    if (searchQuery.length >= 2) {
      f.search = searchQuery;
    }
    
    if (selectedMimeTypes.length > 0) {
      const mimeTypes: string[] = [];
      selectedMimeTypes.forEach(cat => {
        const types = MIME_TYPE_CATEGORIES[cat as keyof typeof MIME_TYPE_CATEGORIES];
        if (types) {
          mimeTypes.push(...types);
        }
      });
      f.mimeTypes = mimeTypes;
    }

    f.folderId = currentFolderId;
    return f;
  }, [searchQuery, selectedMimeTypes, currentFolderId]);

  const { data: documents = [], isLoading: documentsLoading, error } = useDocuments(filters, sort);

  // Filter documents by folder (client-side)
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // folder_id is now typed in DocumentWithRelations
      const docFolderId = doc.folder_id;
      if (currentFolderId === null) {
        return docFolderId === null || docFolderId === undefined;
      }
      return docFolderId === currentFolderId;
    });
  }, [documents, currentFolderId]);

  const isLoading = foldersLoading || documentsLoading;
  const isRootEmpty = currentFolderId === null && folders.length === 0;

  const toggleMimeFilter = (category: string) => {
    setSelectedMimeTypes(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedMimeTypes([]);
  };

  const hasActiveFilters = searchQuery.length > 0 || selectedMimeTypes.length > 0;

  const handleFolderClick = (folder: DocumentFolder | { id: string }) => {
    setCurrentFolderId(folder.id);
  };

  const handleNavigate = (folderId: string | null) => {
    setCurrentFolderId(folderId);
  };

  const handleCreateTemplateFolder = (name: string) => {
    createFolder({
      name,
      parent_folder_id: currentFolderId,
    });
  };

  // Determine if a document is a native editor document
  const isNativeEditorDoc = (doc: DocumentWithRelations): boolean => {
    return doc.source_type === 'native_editor';
  };

  // Detect native editor type from mime type / path
  const getBaseNativeType = (doc: DocumentWithRelations): NativeEditorType => {
    if (doc.mime_type === 'text/html' || doc.storage_path?.endsWith('.html')) return 'native_doc';
    return 'native_sheet'; // Default for JSON, refined after content load
  };

  // Detect sheet vs presentation from JSON content
  const detectJsonEditorType = (content: string): NativeEditorType => {
    try {
      const parsed = JSON.parse(content);
      if (parsed?.slides && Array.isArray(parsed.slides)) return 'native_pres';
    } catch {
      // Not valid JSON
    }
    return 'native_sheet';
  };

  const handleEditDocument = async (doc: DocumentWithRelations) => {
    if (!isNativeEditorDoc(doc)) {
      setEditDocument(doc);
      return;
    }

    // Native editor document — load content and open native editor
    // Par identifiant : une page n'a pas de chemin de stockage.
    const content = await loadNativeContent(doc.id);
    let editorType = getBaseNativeType(doc);

    // For JSON docs, detect type from content structure
    if (editorType === 'native_sheet' && content) {
      editorType = detectJsonEditorType(content);
    }

    setNativeEditorState({
      open: true,
      type: editorType,
      name: doc.name,
      documentId: doc.id,
      initialContent: content || undefined,
    });
  };

  // Render Tree View
  const renderTreeView = () => (
    <div className="flex h-[calc(100vh-280px)] min-h-[400px] border rounded-lg overflow-hidden">
      {/* Collapsible Sidebar */}
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "w-0 overflow-hidden" : "w-[250px] min-w-[250px]"
      )}>
        <FolderTreeSidebar
          selectedFolderId={currentFolderId}
          onFolderSelect={handleNavigate}
        />
      </div>

      {/* Toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 border-r bg-muted/30 rounded-none"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label="Basculer le panneau">
        {sidebarCollapsed ? (
          <PanelLeft className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </Button>

      {/* Content pane */}
      <div className="flex-1 overflow-hidden">
        <DocumentContentPane
          folderId={currentFolderId}
          viewMode={contentMode}
          filters={filters}
          sort={sort}
          onFolderClick={handleFolderClick}
          onFolderRename={setFolderToRename}
          onFolderDelete={setFolderToDelete}
          onDocumentPreview={setPreviewDocument}
          onDocumentEdit={handleEditDocument}
        />
      </div>
    </div>
  );

  // Render Finder View
  const renderFinderView = () => (
    <div className="border rounded-lg overflow-hidden">
      <FinderColumnView
        onDocumentSelect={onDocumentSelect}
        onDocumentPreview={setPreviewDocument}
      />
    </div>
  );

  // Render Classic View (original)
  const renderClassicView = () => (
    <>
      {/* Breadcrumb for classic view */}
      <FolderBreadcrumb 
        currentFolderId={currentFolderId} 
        onNavigate={handleNavigate} 
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center">
          <FileX className="w-12 h-12 mb-4" />
          <p className="text-sm">Erreur lors du chargement</p>
        </div>
      ) : (
        <>
          {/* Folders section */}
          {folders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  Dossiers
                  <Badge variant="secondary" className="text-xs font-normal">
                    {folders.length}
                  </Badge>
                </h3>
              </div>
              {contentMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {folders.map(folder => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      onClick={() => handleFolderClick(folder)}
                      onRename={() => setFolderToRename(folder)}
                      onDelete={() => setFolderToDelete(folder)}
                      onManagePermissions={() => setFolderForPermissions(folder)}
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
                      onClick={() => handleFolderClick(folder)}
                      onRename={() => setFolderToRename(folder)}
                      onDelete={() => setFolderToDelete(folder)}
                      onManagePermissions={() => setFolderForPermissions(folder)}
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
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileX className="h-4 w-4 text-muted-foreground" />
                  Documents
                  <Badge variant="secondary" className="text-xs font-normal">
                    {filteredDocuments.length}
                  </Badge>
                </h3>
              </div>
              {contentMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredDocuments.map(doc => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      viewMode="grid"
                      onPreview={(d) => setPreviewDocument(d)}
                      onEdit={(d) => handleEditDocument(d)}
                      onShare={(d) => setShareDocument(d)}
                      currentFolderId={currentFolderId}
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
                      onPreview={(d) => setPreviewDocument(d)}
                      onEdit={(d) => handleEditDocument(d)}
                      onShare={(d) => setShareDocument(d)}
                      currentFolderId={currentFolderId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {folders.length === 0 && filteredDocuments.length === 0 && !isRootEmpty && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FolderOpen className="w-12 h-12 mb-4" />
              <p className="text-sm font-medium">Ce dossier est vide</p>
            </div>
          )}
        </>
      )}
    </>
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with main actions */}
      <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
        {/* View selector and breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <ViewModeSelector
            viewStyle={viewStyle}
            onViewStyleChange={setViewStyle}
            contentMode={contentMode}
            onContentModeChange={setContentMode}
          />
          {viewStyle !== 'finder' && !isMobile && (
            <FolderBreadcrumb 
              currentFolderId={currentFolderId} 
              onNavigate={handleNavigate} 
            />
          )}
        </div>
        
        {/* Action buttons - Compact on mobile */}
        <div className="flex items-center gap-2">
          {isMobile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8">
                  <Plus className="h-4 w-4" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover">
                <DropdownMenuItem onClick={() => setShowNewDocDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nouveau document
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Importer des fichiers
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <CreateFolderDialog 
                  parentFolderId={currentFolderId}
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
                      <FolderPlus className="h-4 w-4" />
                      Nouveau dossier
                    </DropdownMenuItem>
                  }
                />
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="default" className="gap-2" onClick={() => setShowNewDocDialog(true)}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nouveau</span>
              </Button>
              <CreateFolderDialog 
                parentFolderId={currentFolderId}
                trigger={
                  <Button variant="outline" className="gap-2">
                    <FolderPlus className="h-4 w-4" />
                    <span className="hidden sm:inline">Nouveau dossier</span>
                  </Button>
                }
              />
              <DocumentUpload
                options={{
                  folderId: currentFolderId ?? undefined
                }}
              />
              <Button variant="outline" className="gap-2" onClick={() => setShowGroupsDialog(true)}>
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Groupes</span>
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setShowNextcloudImport(true)}>
                <Cloud className="h-4 w-4" />
                <span className="hidden lg:inline">Import Nextcloud</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Welcome zone for new users - only in classic/tree views */}
      {isRootEmpty && !isLoading && !hasActiveFilters && viewStyle !== 'finder' && (
        <div className="border-2 border-dashed border-primary/30 rounded-xl p-6 bg-primary/5">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <FolderOpen className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Bienvenue dans vos documents
            </h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Organisez vos fichiers avec des dossiers et sous-dossiers.
              Commencez par créer votre premier dossier.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground text-center flex items-center justify-center gap-2">
              <Sparkles className="h-3 w-3" />
              Dossiers suggérés
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {FOLDER_TEMPLATES.map(template => (
                <Button
                  key={template.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleCreateTemplateFolder(template.name)}
                  disabled={isCreating}
                  className="gap-2"
                >
                  <Plus className="h-3 w-3" />
                  {template.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search and filters - hide for finder view */}
      {viewStyle !== 'finder' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher des documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Type filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Type
                  {selectedMimeTypes.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {selectedMimeTypes.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover">
                <DropdownMenuLabel>Types de fichiers</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {MIME_FILTER_OPTIONS.map(option => (
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

            {/* Sort */}
            <Select
              value={sort.field}
              onValueChange={(value: DocumentSortField) => setSort(s => ({ ...s, field: value }))}
            >
              <SelectTrigger className="w-[160px]">
                <SortAsc className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Active filters */}
      {hasActiveFilters && viewStyle !== 'finder' && (
        <div className="flex items-center gap-2 flex-wrap">
          {selectedMimeTypes.map(type => (
            <Badge key={type} variant="secondary" className="gap-1">
              {MIME_FILTER_OPTIONS.find(o => o.value === type)?.label}
              <button
                onClick={() => toggleMimeFilter(type)}
                className="ml-1 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Effacer les filtres
          </Button>
        </div>
      )}

      {/* Main content based on view style */}
      {viewStyle === 'tree' && renderTreeView()}
      {viewStyle === 'finder' && renderFinderView()}
      {viewStyle === 'classic' && renderClassicView()}

      {/* Dialogs */}
      <RenameFolderDialog
        folder={folderToRename}
        open={!!folderToRename}
        onOpenChange={(open) => !open && setFolderToRename(null)}
      />
      
      <DeleteFolderDialog
        folder={folderToDelete}
        open={!!folderToDelete}
        onOpenChange={(open) => !open && setFolderToDelete(null)}
        onDeleted={() => setFolderToDelete(null)}
      />

      <DocumentPreviewDialog
        document={previewDocument}
        open={!!previewDocument}
        onOpenChange={(open) => !open && setPreviewDocument(null)}
        onEdit={(doc) => {
          setPreviewDocument(null);
          handleEditDocument(doc);
        }}
      />

      <DocSpaceEditorDialog
        document={editDocument}
        open={!!editDocument}
        onOpenChange={(open) => !open && setEditDocument(null)}
      />

      <NewDocumentDialog
        open={showNewDocDialog}
        onOpenChange={setShowNewDocDialog}
        onCreateDocument={(name, type) => {
          setShowNewDocDialog(false);
          setNativeEditorState({ open: true, type, name });
        }}
        onImportFile={() => {
          setShowNewDocDialog(false);
          fileInputRef.current?.click();
        }}
        onAIDocumentCreated={(html, title) => {
          setNativeEditorState({ open: true, type: 'native_doc', name: title, initialContent: html });
        }}
      />

      <NativeEditorDialog
        open={nativeEditorState.open}
        onOpenChange={(open) => {
          setNativeEditorState(prev => ({ ...prev, open }));
          if (!open) {
            // Refresh document list when editor closes
            queryClient.invalidateQueries({ queryKey: ['documents'] });
          }
        }}
        editorType={nativeEditorState.type}
        documentId={nativeEditorState.documentId}
        documentName={nativeEditorState.name}
        initialContent={nativeEditorState.initialContent}
        folderId={currentFolderId}
      />

      <ShareDocumentDialog
        document={shareDocument}
        open={!!shareDocument}
        onOpenChange={(open) => !open && setShareDocument(null)}
      />

      <FolderPermissionsDialog
        folder={folderForPermissions}
        open={!!folderForPermissions}
        onOpenChange={(open) => !open && setFolderForPermissions(null)}
      />

      <ManageGroupsDialog
        open={showGroupsDialog}
        onOpenChange={setShowGroupsDialog}
      />

      <NextcloudImportDialog
        open={showNextcloudImport}
        onOpenChange={setShowNextcloudImport}
      />
    </div>
  );
}
