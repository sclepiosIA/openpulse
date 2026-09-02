import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, FolderTree, Folder, Tag, ChevronRight, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

export interface TresorerieCategory {
  id: string;
  code: string;
  nom: string;
  type: string;
  couleur: string | null;
  icone: string | null;
  parent_id: string | null;
  niveau: number;
  ordre: number;
  actif: boolean;
  est_calculee: boolean;
  formule_calcul: string | null;
}

export const QONTO_CATEGORIES = [
  { value: 'office_rental', label: 'Loyer bureau' },
  { value: 'office_supplies', label: 'Fournitures bureau' },
  { value: 'software', label: 'Logiciels' },
  { value: 'insurance', label: 'Assurances' },
  { value: 'telecom', label: 'Télécom' },
  { value: 'meal', label: 'Repas' },
  { value: 'bank_fee', label: 'Frais bancaires' },
  { value: 'tax', label: 'Taxes / TVA' },
  { value: 'transport', label: 'Transport' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'salary', label: 'Salaires' },
  { value: 'social_contribution', label: 'Cotisations sociales et patronales' },
  { value: 'utility', label: 'Services publics' },
  { value: 'subscription', label: 'Abonnements' },
  { value: 'professional_services', label: 'Services pro' },
  { value: 'education', label: 'Formation' },
  { value: 'entertainment', label: 'Divertissement' },
];

export function sanitizeCode(text: string): string {
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

interface CategoryRowProps {
  category: TresorerieCategory;
  children: TresorerieCategory[];
  allCategories: TresorerieCategory[];
  onEdit: (category: TresorerieCategory) => void;
  onDelete: (id: string) => void;
  onAddChild: (parent: TresorerieCategory) => void;
}

function SortableCategoryRow({ category, children, allCategories, onEdit, onDelete, onAddChild }: CategoryRowProps) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = children.length > 0;
  const canAddChild = true;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const getIcon = () => {
    if (category.niveau === 0) return <FolderTree className="h-4 w-4" />;
    if (category.niveau === 1) return <Folder className="h-4 w-4" />;
    return <Tag className="h-4 w-4" />;
  };

  const getStyle = () => {
    if (category.niveau === 0) return "font-bold bg-muted/50";
    if (category.niveau === 1) return "font-semibold bg-muted/20";
    return "font-normal";
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "border-b last:border-b-0",
          getStyle(),
          isDragging && "z-50 relative shadow-lg"
        )}
      >
        <div className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-2 flex-1" style={{ paddingLeft: `${category.niveau * 20}px` }}>
            <button
              className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            {hasChildren ? (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={isOpen ? "Réduire" : "Développer"}
                  title={isOpen ? "Réduire" : "Développer"}
                  aria-expanded={isOpen}
                  className="h-6 w-6 p-0"
                >
                  <ChevronRight className={cn(
                    "h-4 w-4 transition-transform",
                    isOpen && "rotate-90"
                  )} />
                </Button>
              </CollapsibleTrigger>
            ) : (
              <span className="w-6" />
            )}
            <span className={cn(
              "p-1 rounded",
              category.niveau === 0 && "text-primary",
              category.niveau === 1 && "text-muted-foreground",
              category.niveau >= 2 && "text-muted-foreground/70"
            )}>
              {getIcon()}
            </span>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{category.code}</code>
            <span className="truncate">{category.nom}</span>
            {category.couleur && (
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: category.couleur }} />
            )}
            {!category.actif && (
              <Badge variant="secondary" className="text-xs">Inactive</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canAddChild && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-primary hover:text-primary"
                onClick={() => onAddChild(category)}
                title="Ajouter une sous-catégorie"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(category)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => onDelete(category.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
      {hasChildren && (
        <CollapsibleContent>
          {children.map(child => (
            <SortableCategoryRow
              key={child.id}
              category={child}
              children={allCategories.filter(c => c.parent_id === child.id).sort((a, b) => a.ordre - b.ordre)}
              allCategories={allCategories}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

interface CategoryTreeProps {
  categories: TresorerieCategory[];
  onEdit: (category: TresorerieCategory) => void;
  onDelete: (id: string) => void;
  onAddChild: (parent: TresorerieCategory) => void;
  onDragEnd: (event: DragEndEvent) => void;
}

export function CategoryTree({ categories, onEdit, onDelete, onAddChild, onDragEnd }: CategoryTreeProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const flattenCategories = (cats: TresorerieCategory[], parentId: string | null): string[] => {
    const siblings = cats
      .filter(c => parentId === null
        ? (!c.parent_id || !cats.some(p => p.id === c.parent_id))
        : c.parent_id === parentId
      )
      .sort((a, b) => a.ordre - b.ordre);
    const result: string[] = [];
    for (const s of siblings) {
      result.push(s.id);
      result.push(...flattenCategories(cats, s.id));
    }
    return result;
  };

  const rootCategories = categories.filter(c =>
    !c.parent_id || !categories.some(p => p.id === c.parent_id)
  ).sort((a, b) => a.ordre - b.ordre);

  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucune catégorie
      </div>
    );
  }

  const allIds = flattenCategories(categories, null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      modifiers={[restrictToVerticalAxis]}
    >
      <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
        <div className="divide-y">
          {rootCategories.map(cat => (
            <SortableCategoryRow
              key={cat.id}
              category={cat}
              children={categories.filter(c => c.parent_id === cat.id).sort((a, b) => a.ordre - b.ordre)}
              allCategories={categories}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
