import { useState, useCallback, useRef } from "react";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FinderDropZoneProps {
  onFilesDropped: (files: File[]) => void;
  isUploading: boolean;
  uploadProgress?: { current: number; total: number };
  children: React.ReactNode;
  className?: string;
}

export function FinderDropZone({
  onFilesDropped,
  isUploading,
  uploadProgress,
  children,
  className,
}: FinderDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesDropped(files);
    }
  }, [onFilesDropped]);

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Drag overlay */}
      {isDragOver && !isUploading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg transition-all pointer-events-none">
          <div className="flex flex-col items-center gap-3 p-6 bg-background/90 rounded-xl shadow-xl border border-primary/20">
            <div className="p-3 bg-primary/10 rounded-full">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">Déposez vos fichiers ici</p>
              <p className="text-xs text-muted-foreground mt-1">
                Les fichiers seront uploadés dans le dossier courant
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload progress overlay */}
      {isUploading && (
        <div className="absolute bottom-3 right-3 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg border">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs font-medium">
            {uploadProgress
              ? `Upload ${uploadProgress.current}/${uploadProgress.total}...`
              : "Upload en cours..."}
          </span>
        </div>
      )}
    </div>
  );
}
