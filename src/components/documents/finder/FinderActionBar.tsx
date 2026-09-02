import { Eye, Download, Pencil, Copy, FolderInput, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FinderAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'destructive';
}

interface FinderActionBarProps {
  onPreview?: () => void;
  onDownload?: () => void;
  onRename?: () => void;
  onCopy?: () => void;
  onMove?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  className?: string;
  // Pour masquer certaines actions
  hidePreview?: boolean;
  hideDownload?: boolean;
  hideRename?: boolean;
  hideCopy?: boolean;
  hideMove?: boolean;
  hideShare?: boolean;
  hideDelete?: boolean;
}

export function FinderActionBar({
  onPreview,
  onDownload,
  onRename,
  onCopy,
  onMove,
  onShare,
  onDelete,
  disabled,
  className,
  hidePreview,
  hideDownload,
  hideRename,
  hideCopy,
  hideMove,
  hideShare,
  hideDelete,
}: FinderActionBarProps) {
  const actions: FinderAction[] = [
    !hidePreview && onPreview && {
      id: 'preview',
      icon: <Eye className="h-4 w-4" />,
      label: 'Aperçu',
      onClick: onPreview,
    },
    !hideDownload && onDownload && {
      id: 'download',
      icon: <Download className="h-4 w-4" />,
      label: 'Télécharger',
      onClick: onDownload,
    },
    !hideRename && onRename && {
      id: 'rename',
      icon: <Pencil className="h-4 w-4" />,
      label: 'Renommer',
      onClick: onRename,
    },
    !hideCopy && onCopy && {
      id: 'copy',
      icon: <Copy className="h-4 w-4" />,
      label: 'Copier',
      onClick: onCopy,
    },
    !hideMove && onMove && {
      id: 'move',
      icon: <FolderInput className="h-4 w-4" />,
      label: 'Déplacer',
      onClick: onMove,
    },
    !hideShare && onShare && {
      id: 'share',
      icon: <Share2 className="h-4 w-4" />,
      label: 'Partager',
      onClick: onShare,
    },
    !hideDelete && onDelete && {
      id: 'delete',
      icon: <Trash2 className="h-4 w-4" />,
      label: 'Supprimer',
      onClick: onDelete,
      variant: 'destructive' as const,
    },
  ].filter(Boolean) as FinderAction[];

  if (actions.length === 0) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("flex items-center justify-center gap-1", className)}>
        {actions.map((action) => (
          <Tooltip key={action.id}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={action.variant === 'destructive' ? 'ghost' : 'ghost'}
                size="icon"
                className={cn(
                  "h-8 w-8",
                  action.variant === 'destructive' && "text-destructive hover:text-destructive hover:bg-destructive/10"
                )}
                disabled={disabled || action.disabled}
                onClick={action.onClick}
              >
                {action.icon}
                <span className="sr-only">{action.label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {action.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
