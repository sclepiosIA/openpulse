import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmailThreadHoverCardContent } from "./EmailThreadHoverCard";
import { cn } from "@/lib/utils";
import type { EmailThread } from "@/types/email";

interface EmailThreadPreviewOverlayProps {
  thread: EmailThread | null;
  onClose: () => void;
  onMouseEnterOverlay?: () => void;
}

export function EmailThreadPreviewOverlay({ thread, onClose, onMouseEnterOverlay }: EmailThreadPreviewOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!thread) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [thread, onClose]);

  if (!thread) return null;

  return (
    <div
      ref={overlayRef}
      className={cn(
        "absolute top-2 left-2 bottom-2 z-30",
        "w-80 lg:w-96",
        "bg-popover border rounded-lg shadow-xl",
        "flex flex-col overflow-hidden",
        "animate-in slide-in-from-left-4 fade-in-0 duration-200"
      )}
      onMouseEnter={(e) => {
        e.stopPropagation();
        onMouseEnterOverlay?.();
      }}
      onMouseLeave={() => {
        onClose();
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <h3 className="font-medium text-sm truncate flex-1 mr-2">
          Aperçu rapide
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onClose} aria-label="Fermer">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <EmailThreadHoverCardContent thread={thread} />
        </div>
      </ScrollArea>
    </div>
  );
}
