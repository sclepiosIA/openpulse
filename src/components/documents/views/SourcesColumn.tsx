import { memo } from "react";
import { FolderOpen, Cloud, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SourcesColumnProps {
  selectedSource: 'local' | 'nextcloud' | null;
  onSelectSource: (source: 'local' | 'nextcloud') => void;
  isNextcloudConnected: boolean;
}

export const SourcesColumn = memo(function SourcesColumn({
  selectedSource,
  onSelectSource,
  isNextcloudConnected,
}: SourcesColumnProps) {
  return (
    <ScrollArea className="finder-column w-[220px] min-w-[220px] h-full border-r border-border/40 bg-muted/10">
      <div className="py-0.5">
        {/* Local Documents */}
        <div
          className={cn(
            "group flex items-center gap-2.5 mx-1 px-2.5 py-[7px] cursor-pointer rounded-md transition-all duration-150",
            "hover:bg-accent/30",
            selectedSource === 'local' && "bg-primary/15 text-primary dark:text-primary-foreground"
          )}
          onClick={() => onSelectSource('local')}
        >
          <FolderOpen 
            className={cn(
              "h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105",
              selectedSource === 'local' ? "text-primary" : "text-blue-500"
            )}
          />
          <span className={cn(
            "text-[13px] truncate flex-1",
            selectedSource === 'local' && "font-medium"
          )}>Mes documents</span>
          <ChevronRight className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground/40 transition-opacity",
            selectedSource === 'local' && "text-primary/60"
          )} />
        </div>

        {/* Nextcloud */}
        {isNextcloudConnected && (
          <div
            className={cn(
              "group flex items-center gap-2.5 mx-1 px-2.5 py-[7px] cursor-pointer rounded-md transition-all duration-150",
              "hover:bg-accent/30",
              selectedSource === 'nextcloud' && "bg-primary/15 text-primary dark:text-primary-foreground"
            )}
            onClick={() => onSelectSource('nextcloud')}
          >
            <Cloud 
              className={cn(
                "h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105",
                selectedSource === 'nextcloud' ? "text-primary" : "text-sky-500"
              )}
            />
            <span className={cn(
              "text-[13px] truncate flex-1",
              selectedSource === 'nextcloud' && "font-medium"
            )}>Serveur Nextcloud</span>
            <ChevronRight className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground/40 transition-opacity",
              selectedSource === 'nextcloud' && "text-primary/60"
            )} />
          </div>
        )}
      </div>
    </ScrollArea>
  );
});
