import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CategoryItem {
  id: string;
  code: string;
  nom: string;
  couleur?: string | null;
  parent_id?: string | null;
  niveau?: number | null;
}

interface CategorySelectProps {
  value: string | null;
  onSelect: (code: string) => void;
  categories: CategoryItem[];
  disabled?: boolean;
  placeholder?: string;
}

export function CategorySelect({
  value,
  onSelect,
  categories,
  disabled = false,
  placeholder = "Sélectionner..."
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const parents = categories.filter(c => (c.niveau ?? 1) === 1);
    const children = categories.filter(c => (c.niveau ?? 1) === 2);
    const parentIds = new Set(parents.map(p => p.id));

    const groups: { parent: CategoryItem; children: CategoryItem[] }[] = [];

    for (const parent of parents) {
      const subs = children.filter(c => c.parent_id === parent.id);
      groups.push({ parent, children: subs });
    }

    // Orphan level-2 categories (no valid parent)
    const orphans = children.filter(c => !c.parent_id || !parentIds.has(c.parent_id));
    if (orphans.length > 0) {
      groups.push({ parent: { id: "__orphans", code: "__orphans", nom: "Autres" }, children: orphans });
    }

    return groups;
  }, [categories]);

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    const cat = categories.find(c => c.code === value);
    if (!cat) return value;
    // Find parent name
    if (cat.parent_id) {
      const parent = categories.find(c => c.id === cat.parent_id);
      if (parent) return `${parent.nom} > ${cat.nom}`;
    }
    return cat.nom;
  }, [value, categories]);

  const selectedColor = useMemo(() => {
    if (!value) return null;
    return categories.find(c => c.code === value)?.couleur || null;
  }, [value, categories]);

  if (disabled) {
    return (
      <div className="flex items-center gap-1.5 h-auto min-h-[1.75rem] w-full px-2">
        {value ? (
          selectedColor && <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedColor }} />
        ) : (
          <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0 bg-orange-500" />
        )}
        <span className={cn("text-sm whitespace-normal break-words text-left", !value && "text-orange-500 font-medium")}>{selectedLabel || "Non catégorisé"}</span>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="justify-between h-auto min-h-[1.75rem] px-2 w-full font-normal hover:bg-muted/50"
        >
          <div className="flex items-center gap-1.5">
            {value ? (
              selectedColor && <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedColor }} />
            ) : (
              <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0 bg-orange-500" />
            )}
            <span className={cn("text-sm whitespace-normal break-words text-left", !value && "text-orange-500 font-medium")}>{selectedLabel || "Non catégorisé"}</span>
          </div>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher une catégorie..." />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>Aucune catégorie trouvée</CommandEmpty>
            {grouped.map((group) => {
              // If parent has children, show grouped
              if (group.children.length > 0) {
                return (
                  <CommandGroup key={group.parent.id} heading={group.parent.nom}>
                    {group.children.map((child) => (
                      <CommandItem
                        key={child.code}
                        value={`${group.parent.nom} ${child.nom}`}
                        onSelect={() => {
                          onSelect(child.code);
                          setOpen(false);
                        }}
                        className="pl-4"
                      >
                        <div className="flex items-center gap-2 w-full">
                          {child.couleur && (
                            <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: child.couleur }} />
                          )}
                          <span className="truncate">{child.nom}</span>
                        </div>
                        <Check className={cn("ml-auto h-4 w-4 shrink-0", value === child.code ? "opacity-100" : "opacity-0")} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              }
              // Parent without children is itself selectable
              return (
                <CommandGroup key={group.parent.id}>
                  <CommandItem
                    value={group.parent.nom}
                    onSelect={() => {
                      onSelect(group.parent.code);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {group.parent.couleur && (
                        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.parent.couleur }} />
                      )}
                      <span className="truncate">{group.parent.nom}</span>
                    </div>
                    <Check className={cn("ml-auto h-4 w-4 shrink-0", value === group.parent.code ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
