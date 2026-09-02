import { Folder, MoreVertical, Pencil, Trash2, FolderOpen, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { FolderShareIndicator } from "./FolderShareIndicator";
import type { FolderWithSharing } from "@/types/folders";

interface FolderCardProps {
  folder: FolderWithSharing;
  onClick: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onManagePermissions?: () => void;
  isSelected?: boolean;
  viewMode?: 'grid' | 'list';
}

export function FolderCard({
  folder,
  onClick,
  onRename,
  onDelete,
  onManagePermissions,
  isSelected = false,
  viewMode = 'grid'
}: FolderCardProps) {
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  if (viewMode === 'list') {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isSelected && "bg-accent border-primary"
        )}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label={`Ouvrir le dossier ${folder.name}`}
        onKeyDown={handleKeyDown}
      >
        <div className={cn(
          "p-2 rounded-lg",
          folder.color ? `bg-${folder.color}-100` : "bg-primary/10"
        )}>
          <Folder className={cn(
            "h-5 w-5",
            folder.color ? `text-${folder.color}-600` : "text-primary"
          )} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-medium truncate">{folder.name}</p>
            <FolderShareIndicator
              isRestricted={folder.is_restricted}
              folderType={folder.folder_type}
              sharedWith={folder.shared_with || []}
            />
          </div>
          <p className="text-sm text-muted-foreground">Dossier</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={handleMenuClick}>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Plus d'options">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }}>
              <FolderOpen className="h-4 w-4 mr-2" />
              Ouvrir
            </DropdownMenuItem>
            {onRename && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
                <Pencil className="h-4 w-4 mr-2" />
                Renommer
              </DropdownMenuItem>
            )}
            {onManagePermissions && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onManagePermissions(); }}>
                <Shield className="h-4 w-4 mr-2" />
                Permissions
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer transition-all hover:bg-accent/50 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected && "bg-accent border-primary shadow-md"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Ouvrir le dossier ${folder.name}`}
      onKeyDown={handleKeyDown}
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={handleMenuClick}>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Plus d'options">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }}>
              <FolderOpen className="h-4 w-4 mr-2" />
              Ouvrir
            </DropdownMenuItem>
            {onRename && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
                <Pencil className="h-4 w-4 mr-2" />
                Renommer
              </DropdownMenuItem>
            )}
            {onManagePermissions && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onManagePermissions(); }}>
                <Shield className="h-4 w-4 mr-2" />
                Permissions
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={cn(
        "p-4 rounded-xl",
        folder.color ? `bg-${folder.color}-100` : "bg-primary/10"
      )}>
        <Folder className={cn(
          "h-10 w-10",
          folder.color ? `text-${folder.color}-600` : "text-primary"
        )} />
      </div>
      
      <div className="flex items-center gap-1 justify-center max-w-full px-1">
        <p className="font-medium text-center text-sm truncate">
          {folder.name}
        </p>
        <FolderShareIndicator
          isRestricted={folder.is_restricted}
          folderType={folder.folder_type}
          sharedWith={folder.shared_with || []}
        />
      </div>
    </div>
  );
}
