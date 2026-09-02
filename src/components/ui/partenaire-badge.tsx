import { Badge } from "@/components/ui/badge";
import { Landmark, Factory, Briefcase, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface PartenaireBadgeProps {
  type: 'institutionnel' | 'industriel' | 'prestataire';
  nom?: string;
  ville?: string;
  partenaireId?: string;
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

export function PartenaireBadge({ 
  type, 
  nom, 
  ville, 
  partenaireId, 
  size = "default",
  showLink = true,
  className,
  onUnclassifiedClick,
  threadData,
}: PartenaireBadgeProps) {
  const config = {
    institutionnel: {
      icon: Landmark,
      className: 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300',
      label: 'Institutionnel'
    },
    industriel: {
      icon: Factory,
      className: 'bg-orange-100 hover:bg-orange-200 text-orange-800 border-orange-300',
      label: 'Industriel'
    },
    prestataire: {
      icon: Briefcase,
      className: 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300',
      label: 'Prestataire'
    }
  };

  const { icon: Icon, className: typeClassName, label } = config[type] || config.prestataire;

  // Si pas de partenaire lié, afficher "Non classé"
  if (!partenaireId && !nom) {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "gap-1 text-muted-foreground transition-colors",
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
        <Mail className={cn(
          size === "sm" && "h-3 w-3",
          size === "default" && "h-3.5 w-3.5",
          size === "lg" && "h-4 w-4"
        )} />
        <span>Non classé</span>
      </Badge>
    );
  }

  const content = (
    <Badge 
      className={cn(
        typeClassName,
        "gap-1.5 font-medium border cursor-pointer",
        size === "sm" && "text-xs py-0.5 px-2",
        size === "lg" && "text-base py-1.5 px-3",
        className
      )}
      aria-label={`Partenaire ${label}: ${nom || 'Sans nom'}`}
    >
      <Icon className={cn(
        "flex-shrink-0",
        size === "sm" && "h-3 w-3",
        size === "default" && "h-3.5 w-3.5",
        size === "lg" && "h-4 w-4"
      )} />
      <span className="truncate">
        {nom || 'Partenaire'} {ville && `(${ville})`}
      </span>
    </Badge>
  );

  if (showLink && partenaireId) {
    return (
      <Link to={`/partenaires/${partenaireId}`} className="inline-block">
        {content}
      </Link>
    );
  }

  return content;
}
