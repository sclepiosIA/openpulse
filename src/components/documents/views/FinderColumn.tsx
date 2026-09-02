import { memo, useRef, useEffect, useCallback, useState } from "react";
import { Folder, ChevronRight, FileText, FileImage, File, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFolderContents } from "@/hooks/documents/useFolderTree";
import { FolderShareIndicator } from "@/components/documents/folders/FolderShareIndicator";
import type { DocumentFolder, FolderShareInfo } from "@/types/folders";

interface FinderColumnProps {
  parentFolderId: string | null;
  selectedId: string | null;
  selectedType: 'folder' | 'document' | null;
  onSelectFolder: (folder: DocumentFolder, mode?: 'hover' | 'commit') => void;
  onSelectDocument: (doc: any) => void;
  onHoverDocument?: (doc: any | null) => void;
  onToggleSelect?: (doc: any) => void;
  selectedDocIds?: Set<string>;
  isActive?: boolean;
  selectedIndex?: number;
  isLastColumn?: boolean;
}

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith('image/')) return FileImage;
  if (mimeType?.includes('pdf')) return FileText;
  return File;
}

function mapFinderPerms(perms: any[] | undefined): FolderShareInfo[] {
  if (!Array.isArray(perms)) return [];
  return perms.map((p: any) => {
    if (p.user_id && p.user) {
      const u = Array.isArray(p.user) ? p.user[0] : p.user;
      return { type: 'user' as const, name: u ? [u.prenom, u.nom].filter(Boolean).join(' ') || 'Utilisateur' : 'Utilisateur', avatar_url: u?.avatar_url, access_level: p.access_level };
    }
    if (p.group_id && p.group) {
      const g = Array.isArray(p.group) ? p.group[0] : p.group;
      return { type: 'group' as const, name: g?.name || 'Groupe', color: g?.color, access_level: p.access_level };
    }
    return null;
  }).filter(Boolean) as FolderShareInfo[];
}

// Hook to detect if device supports hover (desktop) - computed inside component for reliability
function useSupportsHover() {
  const [supportsHover, setSupportsHover] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    setSupportsHover(mediaQuery?.matches ?? false);
    
    const handler = (e: MediaQueryListEvent) => setSupportsHover(e.matches);
    mediaQuery?.addEventListener?.('change', handler);
    return () => mediaQuery?.removeEventListener?.('change', handler);
  }, []);
  
  return supportsHover;
}

export const FinderColumn = memo(function FinderColumn({
  parentFolderId,
  selectedId,
  selectedType,
  onSelectFolder,
  onSelectDocument,
  onHoverDocument,
  onToggleSelect,
  selectedDocIds,
  isActive = false,
  selectedIndex = -1,
  isLastColumn = false,
}: FinderColumnProps) {
  const { folders, documents, isLoading } = useFolderContents(parentFolderId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  
  // Detect hover capability (desktop vs touch)
  const supportsHover = useSupportsHover();
  
  // Hover timers for macOS-like delayed open
  const folderHoverTimer = useRef<NodeJS.Timeout | null>(null);
  const documentHoverTimer = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to selected item when selectedIndex changes (keyboard navigation)
  useEffect(() => {
    if (selectedIndex >= 0 && isActive) {
      const itemRef = itemRefs.current.get(selectedIndex);
      if (itemRef) {
        itemRef.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, isActive]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (folderHoverTimer.current) clearTimeout(folderHoverTimer.current);
      if (documentHoverTimer.current) clearTimeout(documentHoverTimer.current);
    };
  }, []);

  // Folder hover handlers - macOS style (open on hover with small delay)
  const handleFolderMouseEnter = useCallback((folder: DocumentFolder) => {
    if (!supportsHover) return;
    
    if (folderHoverTimer.current) clearTimeout(folderHoverTimer.current);
    
    // Delay before opening folder content (macOS uses ~150ms)
    folderHoverTimer.current = setTimeout(() => {
      onSelectFolder(folder, 'hover');
    }, 150);
  }, [supportsHover, onSelectFolder]);

  const handleFolderMouseLeave = useCallback(() => {
    if (folderHoverTimer.current) {
      clearTimeout(folderHoverTimer.current);
      folderHoverTimer.current = null;
    }
  }, []);

  // Document hover handlers - show preview on hover
  const handleDocumentMouseEnter = useCallback((doc: any) => {
    if (!supportsHover || !onHoverDocument) return;
    
    if (documentHoverTimer.current) clearTimeout(documentHoverTimer.current);
    
    // Small delay for smoother UX (avoid flicker when traversing)
    documentHoverTimer.current = setTimeout(() => {
      onHoverDocument(doc);
    }, 100);
  }, [supportsHover, onHoverDocument]);

  const handleDocumentMouseLeave = useCallback(() => {
    if (documentHoverTimer.current) {
      clearTimeout(documentHoverTimer.current);
      documentHoverTimer.current = null;
    }
  }, []);

  if (isLoading) {
    return (
      <div className="finder-column finder-column-enter w-[220px] min-w-[220px] h-full border-r border-border/40 flex items-center justify-center bg-muted/5">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/60" />
      </div>
    );
  }

  const isEmpty = folders.length === 0 && documents.length === 0;

  if (isEmpty) {
    return (
      <div className="finder-column finder-column-enter w-[220px] min-w-[220px] h-full border-r border-border/40 bg-muted/5" />
    );
  }

  // Combined items for index tracking
  let currentIndex = 0;

  return (
    <ScrollArea className={cn(
      "finder-column finder-column-enter w-[220px] min-w-[220px] h-full border-r border-border/40",
      isActive && "bg-muted/5"
    )}>
      <div ref={scrollRef} className="py-0.5">
        {/* Folders */}
        {folders.map((folder) => {
          const itemIndex = currentIndex++;
          const isSelected = selectedType === 'folder' && selectedId === folder.id;
          const isKeyboardHighlighted = isActive && selectedIndex === itemIndex;
          
          return (
            <div
              key={folder.id}
              ref={(el) => {
                if (el) itemRefs.current.set(itemIndex, el);
              }}
              className={cn(
                "group flex items-center gap-2.5 mx-1 px-2.5 py-[7px] cursor-pointer rounded-md transition-all duration-150",
                "hover:bg-accent/30",
                isSelected && "bg-primary/15 text-primary dark:text-primary-foreground",
                !isSelected && isKeyboardHighlighted && "bg-accent/40 ring-1 ring-primary/30"
              )}
              onClick={() => onSelectFolder(folder, 'commit')}
              onMouseEnter={() => handleFolderMouseEnter(folder)}
              onMouseLeave={handleFolderMouseLeave}
            >
              <Folder 
                className="h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105" 
                style={{ 
                  color: isSelected ? 'hsl(var(--primary))' : (folder.color || 'hsl(207, 35%, 55%)'),
                  fill: isSelected ? 'hsl(var(--primary) / 0.15)' : (folder.color ? `${folder.color}20` : 'transparent')
                }}
              />
              <span className={cn(
                "text-[13px] truncate flex-1",
                isSelected && "font-medium"
              )}>{folder.name}</span>
              {(folder as any).is_restricted != null && (
                <FolderShareIndicator
                  isRestricted={(folder as any).is_restricted}
                  folderType={folder.folder_type}
                  sharedWith={mapFinderPerms((folder as any).document_folder_permissions)}
                  maxAvatars={2}
                  variant="compact"
                />
              )}
              <ChevronRight className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground/40 transition-opacity",
                isSelected && "text-primary/60"
              )} />
            </div>
          );
        })}

        {/* Documents - no separator, continuous flow like macOS */}
        {documents.map((doc) => {
          const itemIndex = currentIndex++;
          const isSelected = selectedType === 'document' && selectedId === doc.id;
          const isKeyboardHighlighted = isActive && selectedIndex === itemIndex;
          const isMultiSelected = selectedDocIds?.has(doc.id) ?? false;
          const FileIcon = getFileIcon(doc.mime_type);
          
          return (
            <div
              key={doc.id}
              ref={(el) => {
                if (el) itemRefs.current.set(itemIndex, el);
              }}
              className={cn(
                "group flex items-center gap-2.5 mx-1 px-2.5 py-[7px] cursor-pointer rounded-md transition-all duration-150",
                "hover:bg-accent/30",
                isSelected && "bg-primary/15 text-primary dark:text-primary-foreground",
                !isSelected && isMultiSelected && "bg-primary/10 ring-1 ring-primary/20",
                !isSelected && !isMultiSelected && isKeyboardHighlighted && "bg-accent/40 ring-1 ring-primary/30"
              )}
              onClick={(e) => {
                if ((e.metaKey || e.ctrlKey) && onToggleSelect) {
                  onToggleSelect(doc);
                } else {
                  onSelectDocument(doc);
                }
              }}
              onMouseEnter={() => handleDocumentMouseEnter(doc)}
              onMouseLeave={handleDocumentMouseLeave}
            >
              {/* Multi-select checkbox indicator */}
              {selectedDocIds && selectedDocIds.size > 0 && (
                <div className={cn(
                  "w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 transition-colors",
                  isMultiSelected
                    ? "bg-primary border-primary"
                    : "border-muted-foreground/30"
                )}>
                  {isMultiSelected && (
                    <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              )}
              <FileIcon className={cn(
                "h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105",
                (isSelected || isMultiSelected) ? "text-primary" : "text-muted-foreground/70"
              )} />
              <span className={cn(
                "text-[13px] truncate",
                (isSelected || isMultiSelected) && "font-medium"
              )}>{doc.name}</span>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
});
