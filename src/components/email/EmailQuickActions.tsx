import { Archive, Mail, MailOpen, Trash2, MoreHorizontal, Star, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface EmailQuickActionsProps {
  threadId: string;
  isUnread: boolean;
  isStarred: boolean;
  onArchive: () => void;
  onToggleRead: () => void;
  onToggleStar: () => void;
  onDelete: () => void;
  onMarkAsSpam?: () => void;
  onAssignInterlocutor?: () => void;
  className?: string;
}

export function EmailQuickActions({
  threadId,
  isUnread,
  isStarred,
  onArchive,
  onToggleRead,
  onToggleStar,
  onDelete,
  onMarkAsSpam,
  onAssignInterlocutor,
  className,
}: EmailQuickActionsProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div 
        className={cn(
          "flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-primary/10"
              onClick={onArchive} aria-label="Archiver">
              <Archive className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Archiver</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-primary/10"
              onClick={onToggleRead} aria-label="Marquer comme lu">
              {isUnread ? (
                <MailOpen className="h-4 w-4" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isUnread ? "Marquer comme lu" : "Marquer comme non lu"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8",
                isStarred ? "text-yellow-500" : "hover:text-yellow-500"
              )}
              onClick={onToggleStar} aria-label="Favori">
              <Star className={cn("h-4 w-4", isStarred && "fill-yellow-500")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isStarred ? "Retirer des favoris" : "Ajouter aux favoris"}
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" aria-label="Plus d'options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onAssignInterlocutor && (
              <>
                <DropdownMenuItem onSelect={onAssignInterlocutor}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Attribuer cet interlocuteur
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
            {onMarkAsSpam && (
              <DropdownMenuItem onSelect={onMarkAsSpam}>
                Marquer comme spam
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}
