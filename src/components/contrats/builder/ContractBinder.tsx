import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  MoreHorizontal,
  Trash2,
  Copy,
  Edit2,
  Lock,
  Unlock,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ContractSection } from "@/hooks/contracts/useContractSections";
import { useDeleteSection, useUpdateSection, useCreateSection } from "@/hooks/contracts/useContractSections";
import { toast } from "sonner";

interface ContractBinderProps {
  sections: ContractSection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddSection: (parentId?: string) => void;
  onReorder: (sections: { id: string; ordre: number; parent_id: string | null }[]) => void;
  isLoading?: boolean;
}

export function ContractBinder({
  sections,
  selectedId,
  onSelect,
  onAddSection,
  onReorder,
  isLoading
}: ContractBinderProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const deleteSection = useDeleteSection();
  const updateSection = useUpdateSection();
  const createSection = useCreateSection();

  const handleDuplicate = async (section: ContractSection) => {
    if (!section.contrat_id) return;
    // Trouver le plus grand ordre parmi les frères
    const siblings = sections.filter(s => s.parent_id === section.parent_id);
    const maxOrdre = siblings.reduce((max, s) => Math.max(max, s.ordre), 0);
    try {
      await createSection.mutateAsync({
        contrat_id: section.contrat_id,
        parent_id: section.parent_id,
        titre: `${section.titre} (copie)`,
        contenu_html: section.contenu_html || "",
        ordre: maxOrdre + 1,
        type: section.type,
        variables_values: section.variables_values || {},
        metadata: section.metadata || {},
        is_locked: false,
      });
      toast.success("Section dupliquée");
    } catch {
      // toast d'erreur déjà géré par le hook
    }
  };

  const toggleExpanded = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  const startEditing = (section: ContractSection) => {
    setEditingId(section.id);
    setEditingTitle(section.titre);
  };

  const saveTitle = (section: ContractSection) => {
    if (editingTitle.trim() && editingTitle !== section.titre) {
      updateSection.mutate({
        id: section.id,
        contrat_id: section.contrat_id!,
        titre: editingTitle.trim()
      });
    }
    setEditingId(null);
  };

  const handleDelete = (section: ContractSection) => {
    if (confirm(`Supprimer "${section.titre}" et tous ses sous-éléments ?`)) {
      deleteSection.mutate({ id: section.id, contrat_id: section.contrat_id! });
    }
  };

  const toggleLock = (section: ContractSection) => {
    updateSection.mutate({
      id: section.id,
      contrat_id: section.contrat_id!,
      is_locked: !section.is_locked
    });
  };

  const getIcon = (section: ContractSection, isExpanded: boolean) => {
    if (section.children?.length) {
      return isExpanded ? <FolderOpen className="h-4 w-4 text-amber-500" /> : <Folder className="h-4 w-4 text-amber-500" />;
    }
    switch (section.type) {
      case 'section':
        return <Folder className="h-4 w-4 text-blue-500" />;
      case 'article':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'clause':
        return <FileText className="h-4 w-4 text-purple-500" />;
      case 'annexe':
        return <FileText className="h-4 w-4 text-orange-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const renderSection = (section: ContractSection, depth: number = 0) => {
    const isExpanded = expandedIds.has(section.id);
    const isSelected = selectedId === section.id;
    const isEditing = editingId === section.id;
    const hasChildren = section.children && section.children.length > 0;

    return (
      <div key={section.id}>
        <div
          className={cn(
            "group flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
            isSelected 
              ? "bg-primary/10 text-primary border-l-2 border-primary" 
              : "hover:bg-muted/50",
            section.is_locked && "opacity-60"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => onSelect(section.id)}
        >
          {/* Drag handle */}
          <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />

          {/* Expand/collapse */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(section.id);
              }}
              className="p-0.5 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}

          {/* Icon */}
          {getIcon(section, isExpanded)}

          {/* Title */}
          {isEditing ? (
            <Input
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={() => saveTitle(section)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle(section);
                if (e.key === 'Escape') setEditingId(null);
              }}
              className="h-6 text-sm py-0 px-1"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 text-sm truncate">{section.titre}</span>
          )}

          {/* Lock indicator */}
          {section.is_locked && (
            <Lock className="h-3 w-3 text-muted-foreground" />
          )}

          {/* Actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Plus d'options"
                title="Plus d'options"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAddSection(section.id)}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter sous-section
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startEditing(section)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Renommer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleLock(section)}>
                {section.is_locked ? (
                  <>
                    <Unlock className="h-4 w-4 mr-2" />
                    Déverrouiller
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Verrouiller
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDuplicate(section)}>
                <Copy className="h-4 w-4 mr-2" />
                Dupliquer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => handleDelete(section)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {section.children!.map((child) => renderSection(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={`contract-binder-skeleton-${i}`} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <span className="text-sm font-medium">Structure</span>
        <Button variant="ghost" size="sm" onClick={() => onAddSection()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto p-2">
        {sections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucune section</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => onAddSection()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une section
            </Button>
          </div>
        ) : (
          sections.map((section) => renderSection(section))
        )}
      </div>
    </div>
  );
}
