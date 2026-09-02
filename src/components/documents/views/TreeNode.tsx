import { memo } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FolderShareIndicator } from "@/components/documents/folders/FolderShareIndicator";
import type { FolderTreeNode } from "@/types/folders";

interface TreeNodeProps {
  node: FolderTreeNode;
  level: number;
  selectedId: string | null;
  onSelect: (folderId: string | null) => void;
  onToggle: (folderId: string) => void;
}

export const TreeNode = memo(function TreeNode({
  node,
  level,
  selectedId,
  onSelect,
  onToggle,
}: TreeNodeProps) {
  const isSelected = selectedId === node.id;
  const hasChildren = node.children.length > 0;
  const isShared = node.folderType === 'shared';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(node.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggle(node.id);
    }
  };

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1.5 cursor-pointer rounded-md transition-colors",
          "hover:bg-accent/50",
          isSelected && "bg-accent text-accent-foreground font-medium"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Expand/Collapse button */}
        <button
          onClick={handleToggle}
          className={cn(
            "p-0.5 rounded hover:bg-accent",
            !hasChildren && "invisible"
          )}
        >
          {node.isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Folder icon */}
        {node.isExpanded ? (
          <FolderOpen 
            className="h-4 w-4 shrink-0" 
            style={{ color: node.color || 'hsl(var(--primary))' }}
          />
        ) : (
          <Folder 
            className="h-4 w-4 shrink-0" 
            style={{ color: node.color || 'hsl(var(--muted-foreground))' }}
          />
        )}

        {/* Name */}
        <span className="truncate text-sm flex-1">{node.name}</span>

        {/* Sharing indicator */}
        {(node.isRestricted || node.folderType === 'shared') && (
          <FolderShareIndicator
            isRestricted={node.isRestricted ?? false}
            folderType={node.folderType}
            sharedWith={node.sharedWith || []}
            variant="mini"
          />
        )}

        {/* Document count */}
        {node.documentsCount > 0 && (
          <Badge 
            variant="secondary" 
            className="h-5 px-1.5 text-[10px] font-normal shrink-0"
          >
            {node.documentsCount}
          </Badge>
        )}
      </div>

      {/* Children */}
      {node.isExpanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
});
