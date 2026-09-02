import { useState, useEffect } from "react";
import { FolderInput, FolderOpen, ChevronRight, Home, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useFolders, useMoveToFolder, useFolderBreadcrumb } from "@/hooks/documents/useFolders";
import type { DocumentFolder } from "@/types/folders";

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
  currentFolderId?: string | null;
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  documentId,
  documentName,
  currentFolderId,
}: MoveToFolderDialogProps) {
  const [browseFolderId, setBrowseFolderId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  const { folders, isLoading } = useFolders(browseFolderId);
  const breadcrumbQuery = useFolderBreadcrumb(browseFolderId);
  const breadcrumb = breadcrumbQuery.data ?? [];
  const moveToFolder = useMoveToFolder();

  // Reset on open
  useEffect(() => {
    if (open) {
      setBrowseFolderId(null);
      setSelectedFolderId(null);
    }
  }, [open]);

  const handleMove = () => {
    moveToFolder.mutate(
      { documentId, folderId: selectedFolderId },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const handleFolderDoubleClick = (folder: DocumentFolder) => {
    setBrowseFolderId(folder.id);
    setSelectedFolderId(null);
  };

  const handleFolderClick = (folder: DocumentFolder) => {
    setSelectedFolderId(folder.id);
  };

  const handleBreadcrumbClick = (folderId: string | null) => {
    setBrowseFolderId(folderId);
    setSelectedFolderId(folderId);
  };

  const isCurrentFolder = selectedFolderId === currentFolderId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5" />
            Déplacer le document
          </DialogTitle>
          <DialogDescription>
            Sélectionnez le dossier de destination pour "{documentName}"
          </DialogDescription>
        </DialogHeader>

        {/* Breadcrumb navigation */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground bg-muted/50 p-2 rounded-md overflow-x-auto">
          <button
            onClick={() => handleBreadcrumbClick(null)}
            className={cn(
              "flex items-center gap-1 hover:text-foreground transition-colors shrink-0",
              browseFolderId === null && "text-foreground font-medium"
            )}
          >
            <Home className="h-4 w-4" />
            <span>Racine</span>
          </button>
          {breadcrumb.map((item: { id: string | null; name: string }) => (
            <div key={item.id} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="h-4 w-4" />
              <button
                onClick={() => handleBreadcrumbClick(item.id)}
                className={cn(
                  "hover:text-foreground transition-colors",
                  browseFolderId === item.id && "text-foreground font-medium"
                )}
              >
                {item.name}
              </button>
            </div>
          ))}
        </div>

        {/* Folder list */}
        <ScrollArea className="h-[300px] border rounded-md p-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : folders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FolderOpen className="h-10 w-10 mb-2" />
              <p className="text-sm">Aucun sous-dossier</p>
              <p className="text-xs mt-1">
                {browseFolderId === null 
                  ? "Créez des dossiers pour organiser vos documents"
                  : "Ce dossier ne contient pas de sous-dossiers"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleFolderClick(folder)}
                  onDoubleClick={() => handleFolderDoubleClick(folder)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors",
                    "hover:bg-accent",
                    selectedFolderId === folder.id && "bg-accent ring-2 ring-primary"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-lg",
                    folder.color ? `bg-${folder.color}-100` : "bg-primary/10"
                  )}>
                    <FolderOpen className={cn(
                      "h-4 w-4",
                      folder.color ? `text-${folder.color}-600` : "text-primary"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{folder.name}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Selected folder info */}
        <div className="text-sm">
          <span className="text-muted-foreground">Destination : </span>
          <span className="font-medium">
            {selectedFolderId === null 
              ? "Racine (Mes documents)" 
              : folders.find(f => f.id === selectedFolderId)?.name || 
                breadcrumb.find((b: { id: string | null; name: string }) => b.id === selectedFolderId)?.name ||
                "Dossier sélectionné"
            }
          </span>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleMove} 
            disabled={isCurrentFolder || moveToFolder.isPending}
          >
            {moveToFolder.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Déplacement...
              </>
            ) : (
              "Déplacer ici"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
