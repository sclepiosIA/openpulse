import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Tags colorés style macOS Finder
export const FINDER_COLOR_TAGS = [
  { id: 'red', color: 'bg-red-500', hoverColor: 'hover:bg-red-600', ringColor: 'ring-red-400', label: 'Rouge' },
  { id: 'orange', color: 'bg-orange-500', hoverColor: 'hover:bg-orange-600', ringColor: 'ring-orange-400', label: 'Orange' },
  { id: 'yellow', color: 'bg-yellow-500', hoverColor: 'hover:bg-yellow-600', ringColor: 'ring-yellow-400', label: 'Jaune' },
  { id: 'green', color: 'bg-green-500', hoverColor: 'hover:bg-green-600', ringColor: 'ring-green-400', label: 'Vert' },
  { id: 'blue', color: 'bg-blue-500', hoverColor: 'hover:bg-blue-600', ringColor: 'ring-blue-400', label: 'Bleu' },
  { id: 'purple', color: 'bg-purple-500', hoverColor: 'hover:bg-purple-600', ringColor: 'ring-purple-400', label: 'Violet' },
  { id: 'gray', color: 'bg-gray-500', hoverColor: 'hover:bg-gray-600', ringColor: 'ring-gray-400', label: 'Gris' },
] as const;

export type ColorTagId = typeof FINDER_COLOR_TAGS[number]['id'];

interface ColorTagsBarProps {
  selectedTags: string[];
  onTagToggle: (tagId: ColorTagId) => void;
  disabled?: boolean;
  className?: string;
}

export function ColorTagsBar({ selectedTags, onTagToggle, disabled, className }: ColorTagsBarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("flex items-center justify-center gap-2", className)}>
        {FINDER_COLOR_TAGS.map((tag) => {
          const isSelected = selectedTags.includes(tag.id);
          
          return (
            <Tooltip key={tag.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onTagToggle(tag.id)}
                  className={cn(
                    "w-5 h-5 rounded-full transition-all duration-150 flex items-center justify-center",
                    tag.color,
                    tag.hoverColor,
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                    tag.ringColor,
                    isSelected && "ring-2 ring-offset-2 ring-offset-background",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                  aria-label={`Tag ${tag.label}`}
                  aria-pressed={isSelected}
                >
                  {isSelected && (
                    <Check className="h-3 w-3 text-white drop-shadow-sm" strokeWidth={3} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {tag.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
