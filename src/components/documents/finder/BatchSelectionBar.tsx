import { Download, X, CheckSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface BatchSelectionBarProps {
  selectedCount: number;
  onDownload: () => void;
  onClearSelection: () => void;
  isDownloading: boolean;
  downloadProgress: number;
  className?: string;
}

export function BatchSelectionBar({
  selectedCount,
  onDownload,
  onClearSelection,
  isDownloading,
  downloadProgress,
  className,
}: BatchSelectionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 border-t bg-primary/5 animate-in slide-in-from-bottom-2 duration-200",
        className
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <CheckSquare className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium truncate">
          {selectedCount} fichier{selectedCount > 1 ? "s" : ""} sélectionné{selectedCount > 1 ? "s" : ""}
        </span>
      </div>

      {isDownloading && (
        <Progress
          value={downloadProgress}
          className="h-1.5 w-24"
          aria-label={`Téléchargement du lot en cours (${Math.round(downloadProgress)}%)`}
        />
      )}

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="default"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={onDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {isDownloading ? "Téléchargement..." : "Télécharger"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClearSelection}
          disabled={isDownloading} aria-label="Fermer">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
