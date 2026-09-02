import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface EmailEtablissementBadgeProps {
  etablissementId?: string;
  etablissementNom?: string;
  etablissementVille?: string;
  size?: "sm" | "default" | "lg";
  showLink?: boolean;
  className?: string;
  onUnclassifiedClick?: () => void;
  threadData?: {
    id: string;
    subject: string;
    participants: any;
  };
}

export function EmailEtablissementBadge({
  etablissementId,
  etablissementNom,
  etablissementVille,
  size = "default",
  showLink = false,
  className,
  onUnclassifiedClick,
  threadData,
}: EmailEtablissementBadgeProps) {
  const navigate = useNavigate();

  if (!etablissementId || !etablissementNom) {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "flex items-center gap-1 text-muted-foreground transition-colors",
          onUnclassifiedClick && "cursor-pointer hover:bg-gray-100 hover:text-foreground hover:border-gray-400",
          size === "sm" && "text-xs px-2 py-0.5",
          size === "lg" && "text-base px-3 py-1.5",
          className
        )}
        onClick={(e) => {
          if (onUnclassifiedClick) {
            e.stopPropagation();
            onUnclassifiedClick();
          }
        }}
        title={onUnclassifiedClick ? "Cliquer pour classifier" : undefined}
      >
        <Building2 className={cn(
          size === "sm" && "h-3 w-3",
          size === "default" && "h-3.5 w-3.5",
          size === "lg" && "h-4 w-4"
        )} />
        Non classé
      </Badge>
    );
  }

  const content = (
    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
      <Building2 className={cn(
        "shrink-0",
        size === "sm" && "h-3 w-3",
        size === "default" && "h-3.5 w-3.5",
        size === "lg" && "h-4 w-4"
      )} />
      <div className="flex flex-col items-start min-w-0 overflow-hidden">
        <span className="font-medium truncate max-w-[160px]">{etablissementNom}</span>
        {etablissementVille && (
          <span className={cn(
            "text-muted-foreground truncate max-w-[160px]",
            size === "sm" && "text-[10px]",
            size === "default" && "text-xs",
            size === "lg" && "text-sm"
          )}>
            {etablissementVille}
          </span>
        )}
      </div>
      {showLink && <ExternalLink className="h-3 w-3 ml-1 shrink-0" />}
    </div>
  );

  if (showLink) {
    return (
      <Button
        variant="outline"
        size={size === "sm" ? "sm" : size === "lg" ? "lg" : "default"}
        onClick={() => navigate(`/etablissements/${etablissementId}`)}
        className={cn("h-auto", className)}
      >
        {content}
      </Button>
    );
  }

  return (
    <Badge
      className={cn(
        "bg-cyan-100 hover:bg-cyan-200 text-cyan-800 border-cyan-300 border",
        "flex items-center gap-1.5 cursor-pointer transition-colors font-medium",
        "max-w-[220px] overflow-hidden",
        size === "sm" && "text-xs px-2 py-0.5",
        size === "lg" && "text-base px-3 py-1.5",
        className
      )}
      onClick={() => navigate(`/etablissements/${etablissementId}`)}
    >
      {content}
    </Badge>
  );
}
