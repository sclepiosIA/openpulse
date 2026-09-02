import { useState, useCallback, useRef, useEffect } from "react";
import { debug } from "@/lib/debug";
import { ChevronLeft, ChevronRight, Loader2, Cloud, FolderOpen, Upload } from "lucide-react";
import {
  type SourceType,
  type LocalPathItem,
  type NextcloudPathItem,
} from "./FinderColumnView.helpers";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FinderColumn } from "./FinderColumn";
import { NextcloudFinderColumn } from "./NextcloudFinderColumn";
import { SourcesColumn } from "./SourcesColumn";
import { useFolderContents } from "@/hooks/documents/useFolderTree";
import { useFolders } from "@/hooks/documents/useFolders";
import { useNextcloudStatus } from "@/hooks/documents/useNextcloudFiles";
import { getNextcloudDownloadUrl } from "@/hooks/documents/useNextcloudStorage";
import { useNextcloudFolderContents, type NextcloudFile } from "@/hooks/documents/useNextcloudFolderTree";
import { useDeleteDocument } from "@/hooks/documents/useDocuments";
import { useToggleColorTag } from "@/hooks/documents/useDocumentColorTags";
import { useToggleFolderColorTag } from "@/hooks/documents/useFolderColorTags";
import { useDocumentUpload } from "@/hooks/documents/useDocumentUpload";
import { useBatchDownload } from "@/hooks/documents/useBatchDownload";
import { FinderDropZone } from "@/components/documents/finder/FinderDropZone";
import { BatchSelectionBar } from "@/components/documents/finder/BatchSelectionBar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DocumentFolder } from "@/types/folders";
import type { DocumentWithRelations } from "@/types/documents";

interface FinderColumnViewProps {
  onDocumentSelect?: (document: DocumentWithRelations) => void;
  onDocumentPreview?: (document: DocumentWithRelations) => void;
  className?: string;
}
import { type ColorTagId } from "@/components/documents/finder/ColorTagsBar";
import { RenameDocumentDialog } from "@/components/documents/dialogs/RenameDocumentDialog";
import { RenameFolderDialog } from "@/components/documents/folders/RenameFolderDialog";
import { useFinderKeyboardNav } from "./useFinderKeyboardNav";
import {
  LocalDocumentPreviewPanel,
  LocalFolderPreviewPanel,
  NextcloudPreviewPanel,
} from "./FinderPreviewPanels";

export function FinderColumnView({
  onDocumentSelect,
  onDocumentPreview,
  className,
}: FinderColumnViewProps) {
  // Source selection: local documents or Nextcloud
  const [activeSource, setActiveSource] = useState<SourceType>('local');
  const { data: nextcloudStatus } = useNextcloudStatus();
  const isNextcloudConnected = nextcloudStatus?.connected === true;

  // Local path represents the column structure: [root, folder1, folder2, ...]
  const [localPath, setLocalPath] = useState<LocalPathItem[]>([{ id: null, type: 'folder' }]);
  // Nextcloud path: array of path segments
  const [nextcloudPath, setNextcloudPath] = useState<NextcloudPathItem[]>([{ path: "/", name: "Nextcloud" }]);
  
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [selectedNextcloudFile, setSelectedNextcloudFile] = useState<NextcloudFile | null>(null);
  const [hoveredDocument, setHoveredDocument] = useState<any | null>(null);
  const [hoveredNextcloudFile, setHoveredNextcloudFile] = useState<NextcloudFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  
  // Track selected index for each column (for keyboard navigation)
  const [selectedIndices, setSelectedIndices] = useState<number[]>([0]);
  // Track selected index for Nextcloud columns
  const [nextcloudSelectedIndices, setNextcloudSelectedIndices] = useState<number[]>([0]);
  // History for forward/back navigation
  const [historyIndex, setHistoryIndex] = useState(0);
  const [localPathHistory, setLocalPathHistory] = useState<LocalPathItem[][]>([[{ id: null, type: 'folder' }]]);
  
  // Dialog states for actions
  const [documentToRename, setDocumentToRename] = useState<DocumentWithRelations | null>(null);
  const [folderToRename, setFolderToRename] = useState<DocumentFolder | null>(null);
  const [previewFolder, setPreviewFolder] = useState<DocumentFolder | null>(null);
  
  // Hooks for actions
  const { mutate: deleteDocument, isPending: isDeleting } = useDeleteDocument();
  const { deleteFolder, isDeleting: isDeletingFolder } = useFolders();
  const { toggleTag, isPending: isTogglingTag } = useToggleColorTag();
  const { toggleTag: toggleFolderTag, isPending: isTogglingFolderTag } = useToggleFolderColorTag();
  
  // Multi-select for batch download
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const { downloadBatch, isDownloading: isBatchDownloading, progress: batchProgress } = useBatchDownload();
  
  // Drag & drop upload
  const { uploadFiles, isUploading, uploads } = useDocumentUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // The document to show in preview (hovered takes precedence, then selected)
  const previewDocument = activeSource === 'local' 
    ? (hoveredDocument || selectedDocument)
    : null;
  const previewNextcloudFile = activeSource === 'nextcloud'
    ? (hoveredNextcloudFile || selectedNextcloudFile)
    : null;

  // Get contents of the active (last) column for keyboard navigation
  const activeColumnIndex = localPath.length - 1;
  const activeParentId = localPath[activeColumnIndex]?.id ?? null;
  const { folders: activeFolders, documents: activeDocuments } = useFolderContents(activeParentId);
  
  // Get Nextcloud contents for active column
  const activeNextcloudColumnIndex = nextcloudPath.length - 1;
  const activeNextcloudPath = nextcloudPath[activeNextcloudColumnIndex]?.path ?? "/";
  const { data: activeNextcloudData } = useNextcloudFolderContents(activeNextcloudPath);
  const nextcloudFolders = activeNextcloudData?.folders ?? [];
  const nextcloudFiles = activeNextcloudData?.files ?? [];
  
  // Combined items for keyboard navigation: folders first, then documents/files
  const activeItems = activeSource === 'local' ? [
    ...activeFolders.map(f => ({ ...f, itemType: 'folder' as const })),
    ...activeDocuments.map(d => ({ ...d, itemType: 'document' as const }))
  ] : [];
  
  const activeNextcloudItems = activeSource === 'nextcloud' ? [
    ...nextcloudFolders.map(f => ({ ...f, itemType: 'folder' as const })),
    ...nextcloudFiles.map(f => ({ ...f, itemType: 'file' as const }))
  ] : [];

  // Fetch preview URL when previewDocument changes
  useEffect(() => {
    let cancelled = false;
    
    async function fetchPreviewUrl() {
      if (!previewDocument?.storage_path || !previewDocument?.storage_bucket) {
        setPreviewUrl(null);
        return;
      }
      
      setLoadingPreview(true);
      
      try {
        const { data, error } = await supabase.storage
          .from(previewDocument.storage_bucket)
          .createSignedUrl(previewDocument.storage_path, 3600);
        
        if (!cancelled && data?.signedUrl) {
          setPreviewUrl(data.signedUrl);
        }
      } catch (err) {
        debug.error("Error fetching preview URL:", err);
        if (!cancelled) setPreviewUrl(null);
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    }
    
    fetchPreviewUrl();
    return () => { cancelled = true; };
  }, [previewDocument?.id]);

  // Fetch preview URL for Nextcloud files
  const [ncPreviewUrl, setNcPreviewUrl] = useState<string | null>(null);
  const [ncPreviewLoading, setNcPreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    
    async function fetchNcPreviewUrl() {
      if (!previewNextcloudFile || previewNextcloudFile.isDirectory) {
        setNcPreviewUrl(null);
        return;
      }
      
      setNcPreviewLoading(true);
      try {
        const url = await getNextcloudDownloadUrl(previewNextcloudFile.path);
        if (!cancelled && url) {
          setNcPreviewUrl(url);
        }
      } catch (err) {
        debug.error("Error fetching NC preview URL:", err);
        if (!cancelled) setNcPreviewUrl(null);
      } finally {
        if (!cancelled) setNcPreviewLoading(false);
      }
    }
    
    fetchNcPreviewUrl();
    return () => { cancelled = true; };
  }, [previewNextcloudFile?.path]);

  // Auto-scroll to the right when path changes
  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          left: scrollRef.current.scrollWidth,
          behavior: 'smooth'
        });
      }, 50);
    }
  }, [localPath.length, nextcloudPath.length]);

  // Keyboard navigation extracted to hook (called after handlers are defined below)

  const selectItemAtIndex = useCallback((index: number) => {
    if (index < 0 || index >= activeItems.length) return;
    
    const item = activeItems[index];
    if (item.itemType === 'folder') {
      setSelectedDocument(null);
      setHoveredDocument(null);
    } else {
      setSelectedDocument(item);
      onDocumentSelect?.(item as any);
    }
  }, [activeItems, onDocumentSelect]);

  const selectNextcloudItemAtIndex = useCallback((index: number) => {
    if (index < 0 || index >= activeNextcloudItems.length) return;
    
    const item = activeNextcloudItems[index];
    if (item.itemType === 'folder') {
      setSelectedNextcloudFile(null);
      setHoveredNextcloudFile(null);
    } else {
      setSelectedNextcloudFile(item as NextcloudFile);
      setHoveredNextcloudFile(null);
    }
  }, [activeNextcloudItems]);

  const handleFolderSelect = useCallback((folder: DocumentFolder, columnIndex: number, mode: 'hover' | 'commit' = 'commit') => {
    const newPath = [...localPath.slice(0, columnIndex + 1), { id: folder.id, type: 'folder' as const, folder }];
    setLocalPath(newPath);
    
    // Set preview folder when entering a folder
    setPreviewFolder(folder);
    
    if (mode === 'commit') {
      const newHistory = [...localPathHistory.slice(0, historyIndex + 1), newPath];
      setLocalPathHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
    
    setSelectedIndices(prev => {
      const next = prev.slice(0, columnIndex + 1);
      next.push(0);
      return next;
    });
    setSelectedDocument(null);
    setHoveredDocument(null);
  }, [localPath, localPathHistory, historyIndex]);

  // Nextcloud folder selection
  const handleNextcloudFolderSelect = useCallback((folder: NextcloudFile, mode: 'hover' | 'commit' = 'commit') => {
    if (mode === 'commit') {
      setNextcloudPath(prev => [...prev, { path: folder.path, name: folder.name }]);
      setSelectedNextcloudFile(null);
      setHoveredNextcloudFile(null);
      // Add new index for the new column
      setNextcloudSelectedIndices(prev => [...prev, 0]);
    }
  }, []);

  // Nextcloud file selection
  const handleNextcloudFileSelect = useCallback((file: NextcloudFile) => {
    setSelectedNextcloudFile(file);
    setHoveredNextcloudFile(null);
    // Update selected index for keyboard navigation
    const fileIndex = nextcloudFolders.length + nextcloudFiles.findIndex(f => f.path === file.path);
    if (fileIndex >= 0) {
      setNextcloudSelectedIndices(prev => {
        const next = [...prev];
        next[activeNextcloudColumnIndex] = fileIndex;
        return next;
      });
    }
  }, [nextcloudFolders.length, nextcloudFiles, activeNextcloudColumnIndex]);

  const handleDocumentSelect = useCallback((doc: any, columnIndex: number) => {
    setLocalPath(prev => prev.slice(0, columnIndex + 1));
    setSelectedDocument(doc);
    setHoveredDocument(null);
    setPreviewFolder(null); // Clear folder preview when selecting a document
    onDocumentSelect?.(doc);
    
    const docIndex = activeFolders.length + activeDocuments.findIndex(d => d.id === doc.id);
    setSelectedIndices(prev => {
      const next = [...prev.slice(0, columnIndex + 1)];
      next[columnIndex] = docIndex >= 0 ? docIndex : 0;
      return next;
    });
  }, [onDocumentSelect, activeFolders.length, activeDocuments]);

  const handleHoverDocument = useCallback((doc: any | null) => {
    setHoveredDocument(doc);
  }, []);

  const goBack = useCallback(() => {
    if (activeSource === 'local' && localPath.length > 1) {
      const newPath = localPath.slice(0, -1);
      setLocalPath(newPath);
      setSelectedIndices(prev => prev.slice(0, -1));
      setSelectedDocument(null);
      setHoveredDocument(null);
    } else if (activeSource === 'nextcloud' && nextcloudPath.length > 1) {
      setNextcloudPath(prev => prev.slice(0, -1));
      setSelectedNextcloudFile(null);
      setHoveredNextcloudFile(null);
    }
  }, [activeSource, localPath, nextcloudPath]);

  const goForward = useCallback(() => {
    if (activeSource === 'local' && historyIndex < localPathHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setLocalPath(localPathHistory[newIndex]);
      setSelectedIndices(new Array(localPathHistory[newIndex].length).fill(0));
      setSelectedDocument(null);
      setHoveredDocument(null);
    }
  }, [activeSource, historyIndex, localPathHistory]);

  const goToRoot = useCallback(() => {
    if (activeSource === 'local') {
      const rootPath = [{ id: null, type: 'folder' as const }];
      setLocalPath(rootPath);
      setSelectedIndices([0]);
      setSelectedDocument(null);
      setHoveredDocument(null);
    } else {
      setNextcloudPath([{ path: "/", name: "Nextcloud" }]);
      setSelectedNextcloudFile(null);
      setHoveredNextcloudFile(null);
    }
  }, [activeSource]);

  const handleSourceSelect = useCallback((source: SourceType) => {
    setActiveSource(source);
    setSelectedDocument(null);
    setHoveredDocument(null);
    setSelectedNextcloudFile(null);
    setHoveredNextcloudFile(null);
    // Reset indices for the active source
    if (source === 'local') {
      setSelectedIndices([0]);
    } else {
      setNextcloudSelectedIndices([0]);
    }
  }, []);

  const handlePreview = () => {
    if (previewDocument) {
      onDocumentPreview?.(previewDocument);
    }
  };

  // Multi-select toggle (Cmd/Ctrl + click)
  const handleToggleSelect = useCallback((doc: DocumentWithRelations) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(doc.id)) {
        next.delete(doc.id);
      } else {
        next.add(doc.id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedDocIds(new Set());
  }, []);

  const handleBatchDownload = useCallback(() => {
    const selectedDocs = activeDocuments.filter(d => selectedDocIds.has(d.id));
    if (selectedDocs.length > 0) {
      downloadBatch(selectedDocs as DocumentWithRelations[]);
    }
  }, [activeDocuments, selectedDocIds, downloadBatch]);

  // Drag & drop upload handler
  const currentFolderId = localPath[localPath.length - 1]?.id ?? null;
  
  const handleFilesDropped = useCallback(async (files: File[]) => {
    await uploadFiles(files, { folderId: currentFolderId || undefined });
  }, [uploadFiles, currentFolderId]);

  // File input handler for upload button
  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await uploadFiles(files, { folderId: currentFolderId || undefined });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadFiles, currentFolderId]);

  const handleDownloadLocal = async () => {
    if (!previewDocument) return;
    try {
      const { data, error } = await supabase.storage
        .from(previewDocument.storage_bucket)
        .download(previewDocument.storage_path);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = previewDocument.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Téléchargement lancé");
    } catch (error) {
      debug.error("Download error:", error);
      toast.error("Erreur lors du téléchargement");
    }
  };

  const handleCopyPath = () => {
    if (!previewDocument) return;
    const path = `${previewDocument.storage_bucket}/${previewDocument.storage_path}`;
    navigator.clipboard.writeText(path);
    toast.success("Chemin copié");
  };

  const handleDeleteLocal = () => {
    if (!previewDocument) return;
    if (confirm(`Supprimer "${previewDocument.name}" ?`)) {
      deleteDocument(previewDocument.id);
      setSelectedDocument(null);
      setHoveredDocument(null);
    }
  };

  const handleTagToggle = (tagId: ColorTagId) => {
    if (!previewDocument) return;
    const currentTags = (previewDocument.color_tags as string[]) || [];
    toggleTag(previewDocument.id, currentTags, tagId);
  };

  const handleFolderTagToggle = (tagId: ColorTagId) => {
    if (!previewFolder) return;
    const currentTags = ((previewFolder as any).color_tags as string[]) || [];
    toggleFolderTag(previewFolder.id, currentTags, tagId);
  };

  const handleCopyFolderPath = () => {
    if (!previewFolder) return;
    navigator.clipboard.writeText(previewFolder.name);
    toast.success("Nom du dossier copié");
  };

  const handleDeleteFolder = () => {
    if (!previewFolder) return;
    if (confirm(`Supprimer le dossier "${previewFolder.name}" et tout son contenu ?`)) {
      deleteFolder(previewFolder.id);
      setPreviewFolder(null);
      // Go back to parent
      if (localPath.length > 1) {
        setLocalPath(prev => prev.slice(0, -1));
      }
    }
  };

  const handleNextcloudDownload = async () => {
    if (previewNextcloudFile) {
      try {
        const url = await getNextcloudDownloadUrl(previewNextcloudFile.path);
        if (url) {
          window.open(url, '_blank');
        }
      } catch (error) {
        debug.error("Download error:", error);
        toast.error("Erreur lors du téléchargement");
      }
    }
  };

  const handleCopyNextcloudPath = () => {
    if (!previewNextcloudFile) return;
    navigator.clipboard.writeText(previewNextcloudFile.path);
    toast.success("Chemin copié");
  };

  const canGoBack = activeSource === 'local' ? localPath.length > 1 : nextcloudPath.length > 1;
  const canGoForward = activeSource === 'local' && historyIndex < localPathHistory.length - 1;

  useFinderKeyboardNav({
    activeSource,
    activeItems, activeColumnIndex, selectedIndices, setSelectedIndices,
    localPathLength: localPath.length, previewDocument, onDocumentPreview,
    handleFolderSelect, selectItemAtIndex,
    activeNextcloudItems, activeNextcloudColumnIndex, nextcloudSelectedIndices,
    setNextcloudSelectedIndices, nextcloudPathLength: nextcloudPath.length,
    previewNextcloudFile, handleNextcloudFolderSelect, selectNextcloudItemAtIndex,
    handleNextcloudDownload, goBack,
  });

  return (
    <FinderDropZone
      onFilesDropped={handleFilesDropped}
      isUploading={isUploading}
      uploadProgress={uploads.length > 0 ? { current: uploads.filter(u => u.status === 'success').length, total: uploads.length } : undefined}
      className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]"
    >
    <div 
      ref={containerRef}
      className={cn("flex flex-col h-full outline-none bg-background rounded-lg border overflow-hidden", className)}
      tabIndex={0}
    >
      {/* Hidden file input for upload button */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />
      {/* macOS-style toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b bg-gradient-to-b from-muted/60 to-muted/30">
        {/* Navigation buttons */}
        <div className="flex items-center gap-0.5 mr-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "h-7 w-7 rounded-md",
              !canGoBack && "opacity-40 cursor-not-allowed"
            )}
            onClick={goBack}
            disabled={!canGoBack} aria-label="Précédent">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "h-7 w-7 rounded-md",
              !canGoForward && "opacity-40 cursor-not-allowed"
            )}
            onClick={goForward}
            disabled={!canGoForward} aria-label="Suivant">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Breadcrumb path */}
        <div className="flex items-center gap-1 text-sm flex-1 min-w-0">
          {activeSource === 'local' ? (
            <>
              <button
                className={cn(
                  "hover:bg-accent/50 px-1.5 py-0.5 rounded transition-colors truncate flex items-center gap-1",
                  localPath.length === 1 && "font-medium text-foreground"
                )}
                onClick={goToRoot}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Mes documents
              </button>
              {localPath.slice(1).map((item: LocalPathItem, index: number) => (
                <span key={item.id || index} className="flex items-center gap-1 min-w-0">
                  <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                  <button
                    className={cn(
                      "hover:bg-accent/50 px-1.5 py-0.5 rounded transition-colors truncate max-w-[150px]",
                      index === localPath.length - 2 && "font-medium text-foreground"
                    )}
                    onClick={() => {
                      setLocalPath(prev => prev.slice(0, index + 2));
                      setSelectedIndices(prev => prev.slice(0, index + 2));
                      setSelectedDocument(null);
                      setHoveredDocument(null);
                    }}
                  >
                    {item.folder?.name}
                  </button>
                </span>
              ))}
            </>
          ) : (
            <>
              <button
                className={cn(
                  "hover:bg-accent/50 px-1.5 py-0.5 rounded transition-colors truncate flex items-center gap-1",
                  nextcloudPath.length === 1 && "font-medium text-foreground"
                )}
                onClick={goToRoot}
              >
                <Cloud className="h-3.5 w-3.5 text-sky-500" />
                Nextcloud
              </button>
              {nextcloudPath.slice(1).map((item: NextcloudPathItem, index: number) => (
                <span key={item.path} className="flex items-center gap-1 min-w-0">
                  <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                  <button
                    className={cn(
                      "hover:bg-accent/50 px-1.5 py-0.5 rounded transition-colors truncate max-w-[150px]",
                      index === nextcloudPath.length - 2 && "font-medium text-foreground"
                    )}
                    onClick={() => {
                      setNextcloudPath(prev => prev.slice(0, index + 2));
                      setSelectedNextcloudFile(null);
                      setHoveredNextcloudFile(null);
                    }}
                  >
                    {item.name}
                  </button>
                </span>
              ))}
            </>
          )}
        </div>
        
        {/* Upload button */}
        {activeSource === 'local' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Importer
          </Button>
        )}
      </div>
      <div className="flex flex-1 overflow-hidden">
        <ScrollArea className="flex-1">
          <div 
            ref={scrollRef} 
            className="flex h-full"
            style={{ scrollBehavior: 'smooth' }}
          >
            {/* Sources column */}
            <SourcesColumn
              selectedSource={activeSource}
              onSelectSource={handleSourceSelect}
              isNextcloudConnected={isNextcloudConnected}
            />

            {/* Local document columns */}
            {activeSource === 'local' && localPath.map((item: LocalPathItem, index: number) => (
              <FinderColumn
                key={`${item.id || 'root'}-${index}`}
                parentFolderId={item.id}
                selectedId={
                  index < localPath.length - 1 
                    ? localPath[index + 1].id 
                    : selectedDocument?.id
                }
                selectedType={
                  index < localPath.length - 1 
                    ? 'folder' 
                    : selectedDocument ? 'document' : null
                }
                onSelectFolder={(folder, mode) => handleFolderSelect(folder, index, mode)}
                onSelectDocument={(doc) => handleDocumentSelect(doc, index)}
                onHoverDocument={index === localPath.length - 1 ? handleHoverDocument : undefined}
                onToggleSelect={handleToggleSelect}
                selectedDocIds={selectedDocIds}
                isActive={index === localPath.length - 1}
                selectedIndex={selectedIndices[index] ?? -1}
                isLastColumn={index === localPath.length - 1 && !selectedDocument}
              />
            ))}

            {/* Nextcloud columns */}
            {activeSource === 'nextcloud' && nextcloudPath.map((item: NextcloudPathItem, index: number) => (
              <NextcloudFinderColumn
                key={`nextcloud-${item.path}-${index}`}
                path={item.path}
                selectedId={
                  index < nextcloudPath.length - 1 
                    ? nextcloudPath[index + 1].path 
                    : selectedNextcloudFile?.path ?? null
                }
                selectedType={
                  index < nextcloudPath.length - 1 
                    ? 'folder' 
                    : selectedNextcloudFile ? 'file' : null
                }
                onSelectFolder={handleNextcloudFolderSelect}
                onSelectFile={handleNextcloudFileSelect}
                onHoverFile={index === nextcloudPath.length - 1 ? setHoveredNextcloudFile : undefined}
                isActive={index === nextcloudPath.length - 1}
                selectedIndex={nextcloudSelectedIndices[index] ?? -1}
                isLastColumn={index === nextcloudPath.length - 1 && !selectedNextcloudFile}
              />
            ))}

            {/* Local document preview panel */}
            {previewDocument && (
              <LocalDocumentPreviewPanel
                previewDocument={previewDocument}
                previewUrl={previewUrl}
                loadingPreview={loadingPreview}
                isTogglingTag={isTogglingTag}
                isDeleting={isDeleting}
                onPreview={handlePreview}
                onDownload={handleDownloadLocal}
                onRename={() => setDocumentToRename(previewDocument)}
                onCopy={handleCopyPath}
                onDelete={handleDeleteLocal}
                onTagToggle={handleTagToggle}
              />
            )}

            {/* Local folder preview panel */}
            {previewFolder && !previewDocument && activeSource === 'local' && (
              <LocalFolderPreviewPanel
                previewFolder={previewFolder}
                isTogglingFolderTag={isTogglingFolderTag}
                isDeletingFolder={isDeletingFolder}
                onRename={() => setFolderToRename(previewFolder)}
                onCopy={handleCopyFolderPath}
                onDelete={handleDeleteFolder}
                onTagToggle={handleFolderTagToggle}
              />
            )}

            {/* Nextcloud file preview panel */}
            {previewNextcloudFile && (
              <NextcloudPreviewPanel
                previewNextcloudFile={previewNextcloudFile}
                ncPreviewUrl={ncPreviewUrl}
                ncPreviewLoading={ncPreviewLoading}
                onDownload={handleNextcloudDownload}
                onCopy={handleCopyNextcloudPath}
              />
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
      
      {/* Batch selection bar */}
      {activeSource === 'local' && selectedDocIds.size > 0 && (
        <BatchSelectionBar
          selectedCount={selectedDocIds.size}
          onDownload={handleBatchDownload}
          onClearSelection={clearSelection}
          isDownloading={isBatchDownloading}
          downloadProgress={batchProgress}
        />
      )}
      
      {/* Dialog de renommage document */}
      <RenameDocumentDialog
        document={documentToRename}
        open={!!documentToRename}
        onOpenChange={(open) => !open && setDocumentToRename(null)}
      />
      
      {/* Dialog de renommage dossier */}
      <RenameFolderDialog
        folder={folderToRename}
        open={!!folderToRename}
        onOpenChange={(open) => !open && setFolderToRename(null)}
      />
    </div>
    </FinderDropZone>
  );
}
