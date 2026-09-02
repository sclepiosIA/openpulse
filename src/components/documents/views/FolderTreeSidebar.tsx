import { memo } from "react";
import {
  FolderOpen,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Share2,
  User,
  Loader2,
  Cloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useFolderTree } from "@/hooks/documents/useFolderTree";
import { useNextcloudFolderTree } from "@/hooks/documents/useNextcloudFolderTree";
import { useNextcloudStatus } from "@/hooks/documents/useNextcloudFiles";
import { TreeNode } from "./TreeNode";
import { NextcloudTreeNode } from "./NextcloudTreeNode";

interface FolderTreeSidebarProps {
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  className?: string;
}

export const FolderTreeSidebar = memo(function FolderTreeSidebar({
  selectedFolderId,
  onFolderSelect,
  className,
}: FolderTreeSidebarProps) {
  const {
    sharedFolders,
    personalFolders,
    isLoading,
    expandedIds,
    toggleExpand,
    expandAll,
    collapseAll,
  } = useFolderTree();

  // Nextcloud integration
  const { data: nextcloudStatus } = useNextcloudStatus();
  const { tree: nextcloudFolders, isLoading: nextcloudLoading } = useNextcloudFolderTree();
  const isNextcloudConnected = nextcloudStatus?.connected === true;

  const handleRootClick = () => {
    onFolderSelect(null);
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full border-r bg-muted/30", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="text-sm font-medium">Dossiers</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => expandedIds.size > 0 ? collapseAll() : expandAll()}
          title={expandedIds.size > 0 ? "Tout réduire" : "Tout développer"} aria-label="Déplier">
          <ChevronsUpDown className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Root folder */}
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md transition-colors",
              "hover:bg-accent/50",
              selectedFolderId === null && "bg-accent text-accent-foreground font-medium"
            )}
            onClick={handleRootClick}
          >
            <FolderOpen className="h-4 w-4 text-primary" />
            <span className="text-sm">Mes documents</span>
          </div>

          {/* Shared folders section */}
          {sharedFolders.length > 0 && (
            <Collapsible defaultOpen className="mt-3">
              <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1 w-full hover:bg-accent/30 rounded-md group">
                <ChevronDown className="h-3 w-3 text-muted-foreground group-data-[state=closed]:hidden" />
                <ChevronRight className="h-3 w-3 text-muted-foreground group-data-[state=open]:hidden" />
                <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Espaces partagés
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1">
                  {sharedFolders.map(folder => (
                    <TreeNode
                      key={folder.id}
                      node={folder}
                      level={0}
                      selectedId={selectedFolderId}
                      onSelect={onFolderSelect}
                      onToggle={toggleExpand}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Personal folders section */}
          {personalFolders.length > 0 && (
            <Collapsible defaultOpen className="mt-3">
              <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1 w-full hover:bg-accent/30 rounded-md group">
                <ChevronDown className="h-3 w-3 text-muted-foreground group-data-[state=closed]:hidden" />
                <ChevronRight className="h-3 w-3 text-muted-foreground group-data-[state=open]:hidden" />
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Mes dossiers
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1">
                  {personalFolders.map(folder => (
                    <TreeNode
                      key={folder.id}
                      node={folder}
                      level={0}
                      selectedId={selectedFolderId}
                      onSelect={onFolderSelect}
                      onToggle={toggleExpand}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Nextcloud section */}
          {isNextcloudConnected && (
            <Collapsible defaultOpen className="mt-3">
              <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1 w-full hover:bg-accent/30 rounded-md group">
                <ChevronDown className="h-3 w-3 text-muted-foreground group-data-[state=closed]:hidden" />
                <ChevronRight className="h-3 w-3 text-muted-foreground group-data-[state=open]:hidden" />
                <Cloud className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Serveur Nextcloud
                </span>
                <span className="ml-auto w-2 h-2 rounded-full bg-green-500" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1">
                  {/* Nextcloud root folder */}
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 ml-3 cursor-pointer rounded-md transition-colors",
                      "hover:bg-accent/50",
                      selectedFolderId === "nextcloud:/" && "bg-accent text-accent-foreground font-medium"
                    )}
                    onClick={() => onFolderSelect("nextcloud:/")}
                  >
                    <Cloud className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Racine Nextcloud</span>
                  </div>
                  
                  {nextcloudLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    nextcloudFolders.map(folder => (
                      <NextcloudTreeNode
                        key={folder.id}
                        node={folder}
                        level={1}
                        selectedId={selectedFolderId}
                        onSelect={onFolderSelect}
                      />
                    ))
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Empty state */}
          {sharedFolders.length === 0 && personalFolders.length === 0 && !isNextcloudConnected && (
            <div className="px-2 py-8 text-center text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Aucun dossier</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});
