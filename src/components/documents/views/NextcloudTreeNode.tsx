import { memo, useState } from "react";
import { FolderOpen, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNextcloudFolderContents, createNextcloudFolderId, getNextcloudPathFromId } from "@/hooks/documents/useNextcloudFolderTree";
import type { NextcloudTreeNode as NextcloudTreeNodeType } from "@/hooks/documents/useNextcloudFolderTree";

interface NextcloudTreeNodeProps {
  node: NextcloudTreeNodeType;
  level: number;
  selectedId: string | null;
  onSelect: (folderId: string | null) => void;
}

export const NextcloudTreeNode = memo(function NextcloudTreeNode({
  node,
  level,
  selectedId,
  onSelect,
}: NextcloudTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const path = getNextcloudPathFromId(node.id) || node.nextcloudPath;
  
  // Charger les sous-dossiers seulement quand on déploie
  const { data, isLoading } = useNextcloudFolderContents(path);
  const subfolders = data?.folders || [];
  const hasChildren = subfolders.length > 0;

  const isSelected = selectedId === node.id;
  const paddingLeft = 8 + level * 12;

  const handleClick = () => {
    onSelect(node.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 py-1 px-1 cursor-pointer rounded-md transition-colors",
          "hover:bg-accent/50",
          isSelected && "bg-accent text-accent-foreground font-medium"
        )}
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={handleToggle}
          className="h-4 w-4 flex items-center justify-center shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : hasChildren || !data ? (
            isExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )
          ) : (
            <span className="w-3" />
          )}
        </button>

        {/* Folder icon */}
        <FolderOpen className="h-4 w-4 text-blue-500 shrink-0" />

        {/* Folder name */}
        <span className="text-sm truncate flex-1">
          {node.name}
        </span>
      </div>

      {/* Children */}
      {isExpanded && !isLoading && subfolders.length > 0 && (
        <div>
          {subfolders.map(subfolder => (
            <NextcloudTreeNode
              key={subfolder.path}
              node={{
                id: createNextcloudFolderId(subfolder.path),
                name: subfolder.name,
                parentId: node.id,
                folderType: 'personal',
                icon: null,
                color: null,
                documentsCount: 0,
                subfoldersCount: 0,
                isExpanded: false,
                isLoading: false,
                children: [],
                nextcloudPath: subfolder.path,
                isNextcloud: true,
              }}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
});
