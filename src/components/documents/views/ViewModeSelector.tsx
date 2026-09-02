import { memo } from "react";
import { FolderTree, Columns3, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/ui/use-mobile";
import type { DocumentViewStyle } from "@/types/folders";

interface ViewModeSelectorProps {
  viewStyle: DocumentViewStyle;
  onViewStyleChange: (style: DocumentViewStyle) => void;
  contentMode: 'grid' | 'list';
  onContentModeChange: (mode: 'grid' | 'list') => void;
  className?: string;
}

const VIEW_STYLE_OPTIONS: { value: DocumentViewStyle; label: string; icon: typeof FolderTree }[] = [
  { value: 'tree', label: 'Arborescence', icon: FolderTree },
  { value: 'finder', label: 'Colonnes (Finder)', icon: Columns3 },
  { value: 'classic', label: 'Classique', icon: LayoutGrid },
];

export const ViewModeSelector = memo(function ViewModeSelector({
  viewStyle,
  onViewStyleChange,
  contentMode,
  onContentModeChange,
  className,
}: ViewModeSelectorProps) {
  const isMobile = useIsMobile();
  const currentOption = VIEW_STYLE_OPTIONS.find(o => o.value === viewStyle);
  const CurrentIcon = currentOption?.icon || FolderTree;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* View style dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 h-8">
            <CurrentIcon className="h-4 w-4" />
            {/* Hide label on mobile */}
            {!isMobile && <span>{currentOption?.label}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-popover">
          <DropdownMenuLabel>Mode d'affichage</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup 
            value={viewStyle} 
            onValueChange={(v) => onViewStyleChange(v as DocumentViewStyle)}
          >
            {VIEW_STYLE_OPTIONS.map(option => {
              const Icon = option.icon;
              return (
                <DropdownMenuRadioItem key={option.value} value={option.value} className="gap-2">
                  <Icon className="h-4 w-4" />
                  {option.label}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Grid/List toggle - only show for tree and classic views */}
      {viewStyle !== 'finder' && (
        <div className="flex items-center border rounded-md">
          <Button
            variant={contentMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8 rounded-r-none"
            onClick={() => onContentModeChange('grid')} aria-label="Grille">
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={contentMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8 rounded-l-none"
            onClick={() => onContentModeChange('list')} aria-label="Liste">
            <List className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
});
