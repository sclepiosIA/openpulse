import { memo, useRef, useEffect, useCallback, useState } from "react";
import { Folder, ChevronRight, FileText, FileImage, File, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNextcloudFolderContents, NextcloudFile } from "@/hooks/documents/useNextcloudFolderTree";

interface NextcloudFinderColumnProps {
  path: string;
  selectedId: string | null;
  selectedType: 'folder' | 'file' | null;
  onSelectFolder: (folder: NextcloudFile, mode?: 'hover' | 'commit') => void;
  onSelectFile: (file: NextcloudFile) => void;
  onHoverFile?: (file: NextcloudFile | null) => void;
  isActive?: boolean;
  selectedIndex?: number;
  isLastColumn?: boolean;
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return FileImage;
  if (['pdf'].includes(ext)) return FileText;
  return File;
}

// Hook to detect if device supports hover (desktop)
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

export const NextcloudFinderColumn = memo(function NextcloudFinderColumn({
  path,
  selectedId,
  selectedType,
  onSelectFolder,
  onSelectFile,
  onHoverFile,
  isActive = false,
  selectedIndex = -1,
  isLastColumn = false,
}: NextcloudFinderColumnProps) {
  const query = useNextcloudFolderContents(path);
  const folders = query.data?.folders ?? [];
  const files = query.data?.files ?? [];
  const isLoading = query.isLoading;
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  
  const supportsHover = useSupportsHover();
  
  const folderHoverTimer = useRef<NodeJS.Timeout | null>(null);
  const fileHoverTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (selectedIndex >= 0 && isActive) {
      const itemRef = itemRefs.current.get(selectedIndex);
      if (itemRef) {
        itemRef.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, isActive]);

  useEffect(() => {
    return () => {
      if (folderHoverTimer.current) clearTimeout(folderHoverTimer.current);
      if (fileHoverTimer.current) clearTimeout(fileHoverTimer.current);
    };
  }, []);

  const handleFolderMouseEnter = useCallback((folder: NextcloudFile) => {
    if (!supportsHover) return;
    
    if (folderHoverTimer.current) clearTimeout(folderHoverTimer.current);
    
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

  const handleFileMouseEnter = useCallback((file: NextcloudFile) => {
    if (!supportsHover || !onHoverFile) return;
    
    if (fileHoverTimer.current) clearTimeout(fileHoverTimer.current);
    
    fileHoverTimer.current = setTimeout(() => {
      onHoverFile(file);
    }, 100);
  }, [supportsHover, onHoverFile]);

  const handleFileMouseLeave = useCallback(() => {
    if (fileHoverTimer.current) {
      clearTimeout(fileHoverTimer.current);
      fileHoverTimer.current = null;
    }
  }, []);

  if (isLoading) {
    return (
      <div className="finder-column finder-column-enter w-[220px] min-w-[220px] h-full border-r border-border/40 flex items-center justify-center bg-muted/5">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/60" />
      </div>
    );
  }

  const isEmpty = folders.length === 0 && files.length === 0;

  if (isEmpty) {
    return (
      <div className="finder-column finder-column-enter w-[220px] min-w-[220px] h-full border-r border-border/40 bg-muted/5 flex items-center justify-center">
        <p className="text-xs text-muted-foreground">Dossier vide</p>
      </div>
    );
  }

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
          const isSelected = selectedType === 'folder' && selectedId === folder.path;
          const isKeyboardHighlighted = isActive && selectedIndex === itemIndex;
          
          return (
            <div
              key={folder.path}
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
                  color: isSelected ? 'hsl(var(--primary))' : 'hsl(207, 35%, 55%)',
                  fill: isSelected ? 'hsl(var(--primary) / 0.15)' : 'transparent'
                }}
              />
              <span className={cn(
                "text-[13px] truncate flex-1",
                isSelected && "font-medium"
              )}>{folder.name}</span>
              <ChevronRight className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground/40 transition-opacity",
                isSelected && "text-primary/60"
              )} />
            </div>
          );
        })}

        {/* Files */}
        {files.map((file) => {
          const itemIndex = currentIndex++;
          const isSelected = selectedType === 'file' && selectedId === file.path;
          const isKeyboardHighlighted = isActive && selectedIndex === itemIndex;
          const FileIcon = getFileIcon(file.name);
          
          return (
            <div
              key={file.path}
              ref={(el) => {
                if (el) itemRefs.current.set(itemIndex, el);
              }}
              className={cn(
                "group flex items-center gap-2.5 mx-1 px-2.5 py-[7px] cursor-pointer rounded-md transition-all duration-150",
                "hover:bg-accent/30",
                isSelected && "bg-primary/15 text-primary dark:text-primary-foreground",
                !isSelected && isKeyboardHighlighted && "bg-accent/40 ring-1 ring-primary/30"
              )}
              onClick={() => onSelectFile(file)}
              onMouseEnter={() => handleFileMouseEnter(file)}
              onMouseLeave={handleFileMouseLeave}
            >
              <FileIcon className={cn(
                "h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105",
                isSelected ? "text-primary" : "text-muted-foreground/70"
              )} />
              <span className={cn(
                "text-[13px] truncate",
                isSelected && "font-medium"
              )}>{file.name}</span>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
});
