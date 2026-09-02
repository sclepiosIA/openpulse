import { LucideIcon, FileQuestion, Search, Settings, Inbox, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyStateType = 
  | 'no-results' 
  | 'empty' 
  | 'not-configured' 
  | 'error'
  | 'custom';

interface EmptyStateProps {
  type?: EmptyStateType;
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const defaultConfig: Record<EmptyStateType, { icon: LucideIcon; title: string; description: string }> = {
  'no-results': {
    icon: Search,
    title: 'Aucun résultat trouvé',
    description: 'Essayez de modifier vos critères de recherche ou vos filtres.',
  },
  'empty': {
    icon: Inbox,
    title: 'Aucun élément',
    description: 'Il n\'y a rien à afficher pour le moment.',
  },
  'not-configured': {
    icon: Settings,
    title: 'Configuration requise',
    description: 'Veuillez configurer cette fonctionnalité pour commencer.',
  },
  'error': {
    icon: AlertCircle,
    title: 'Une erreur est survenue',
    description: 'Impossible de charger les données. Veuillez réessayer.',
  },
  'custom': {
    icon: FileQuestion,
    title: 'État vide',
    description: 'Aucune donnée disponible.',
  },
};

const sizeClasses = {
  sm: {
    container: 'py-8 px-4',
    icon: 'h-10 w-10',
    title: 'text-base',
    description: 'text-sm',
  },
  md: {
    container: 'py-12 px-4',
    icon: 'h-14 w-14',
    title: 'text-lg',
    description: 'text-sm',
  },
  lg: {
    container: 'py-16 px-4',
    icon: 'h-20 w-20',
    title: 'text-xl',
    description: 'text-base',
  },
};

export function EmptyState({
  type = 'empty',
  icon: CustomIcon,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = 'md',
}: EmptyStateProps) {
  const config = defaultConfig[type];
  const Icon = CustomIcon || config.icon;
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;
  const sizes = sizeClasses[size];

  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center text-center animate-fade-in",
        sizes.container,
        className
      )}
      role="status"
      aria-label={displayTitle}
    >
      <div className="relative mb-4">
        <Icon 
          className={cn(
            "text-muted-foreground/40",
            sizes.icon,
            type === 'error' && "text-destructive/40"
          )} 
          aria-hidden="true"
        />
        {type === 'no-results' && (
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary/10 animate-ping" />
        )}
      </div>
      
      <h3 className={cn("font-semibold mb-2", sizes.title)}>
        {displayTitle}
      </h3>
      
      <p className={cn("text-muted-foreground mb-6 max-w-md", sizes.description)}>
        {displayDescription}
      </p>
      
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <Button 
              onClick={action.onClick} 
              variant={action.variant || 'default'}
              size={size === 'sm' ? 'sm' : 'default'}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button 
              onClick={secondaryAction.onClick} 
              variant="outline"
              size={size === 'sm' ? 'sm' : 'default'}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
