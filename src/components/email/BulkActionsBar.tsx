import { Button } from "@/components/ui/button";
import { MailOpen, Archive, AlertOctagon, Trash2, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkActionsBarProps {
  selectedCount: number;
  onMarkAsRead: () => void;
  onMarkAsProcessed: () => void;
  onArchive: () => void;
  onMarkAsSpam: () => void;
  onDelete: () => void;
  onClear: () => void;
  isProcessing?: boolean;
}

export function BulkActionsBar({
  selectedCount,
  onMarkAsRead,
  onMarkAsProcessed,
  onArchive,
  onMarkAsSpam,
  onDelete,
  onClear,
  isProcessing = false,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div 
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-3 px-4 py-3 rounded-xl",
        "bg-background/95 backdrop-blur-md border shadow-lg",
        "animate-in slide-in-from-bottom-4 duration-300"
      )}
    >
      {/* Count */}
      <div className="flex items-center gap-2 pr-3 border-r">
        <span className="text-sm font-medium">
          {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClear} aria-label="Fermer">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
          onClick={onMarkAsRead}
          disabled={isProcessing}
        >
          <MailOpen className="h-4 w-4" />
          <span className="hidden sm:inline">Lu</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
          onClick={onMarkAsProcessed}
          disabled={isProcessing}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="hidden sm:inline">Traité</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
          onClick={onArchive}
          disabled={isProcessing}
        >
          <Archive className="h-4 w-4" />
          <span className="hidden sm:inline">Archiver</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
          onClick={onMarkAsSpam}
          disabled={isProcessing}
        >
          <AlertOctagon className="h-4 w-4" />
          <span className="hidden sm:inline">Spam</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
          disabled={isProcessing}
        >
          <Trash2 className="h-4 w-4" />
          <span className="hidden sm:inline">Supprimer</span>
        </Button>
      </div>
    </div>
  );
}
