import { Mail, CheckSquare, Building2, ExternalLink, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AIAction } from '@/hooks/pulse/usePulseAIChat';

interface AIActionCardProps {
  action: AIAction;
  onExecute: (action: AIAction) => void;
}

const ACTION_CONFIG = {
  open_email_composer: {
    icon: Mail,
    title: 'Email préparé',
    buttonText: 'Ouvrir et envoyer',
    color: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-500',
  },
  created_task: {
    icon: CheckSquare,
    title: 'Tâche créée',
    buttonText: 'Voir la tâche',
    color: 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-800',
    iconColor: 'text-green-500',
  },
  created_etablissement: {
    icon: Building2,
    title: 'Établissement créé',
    buttonText: 'Voir l\'établissement',
    color: 'bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800',
    iconColor: 'text-purple-500',
  },
  updated_etablissement: {
    icon: Pencil,
    title: 'Établissement mis à jour',
    buttonText: 'Voir les modifications',
    color: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-500',
  },
  open_task: {
    icon: CheckSquare,
    title: 'Tâche',
    buttonText: 'Voir la tâche',
    color: 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-800',
    iconColor: 'text-green-500',
  },
  open_etablissement: {
    icon: Building2,
    title: 'Établissement',
    buttonText: 'Voir l\'établissement',
    color: 'bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800',
    iconColor: 'text-purple-500',
  },
  open_email: {
    icon: Mail,
    title: 'Email',
    buttonText: 'Voir l\'email',
    color: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-500',
  },
};

export function AIActionCard({ action, onExecute }: AIActionCardProps) {
  const config = ACTION_CONFIG[action.type];

  if (!config) {
    return null;
  }

  const Icon = config.icon;
  
  // Get description based on action type
  const getDescription = () => {
    switch (action.type) {
      case 'open_email_composer':
        const to = action.data?.to?.join(', ') || 'Destinataire non spécifié';
        const subject = action.data?.subject || 'Sans sujet';
        return (
          <>
            <div className="text-xs text-muted-foreground">À: {to}</div>
            <div className="text-sm font-medium truncate">{subject}</div>
          </>
        );
      case 'created_task':
      case 'open_task':
        return (
          <div className="text-sm font-medium truncate">
            {action.data?.titre || action.data?.title || 'Nouvelle tâche'}
          </div>
        );
      case 'created_etablissement':
      case 'updated_etablissement':
      case 'open_etablissement':
        return (
          <div className="text-sm font-medium truncate">
            {action.data?.nom || 'Établissement'}
            {action.data?.ville && <span className="text-muted-foreground"> ({action.data.ville})</span>}
          </div>
        );
      case 'open_email':
        return (
          <div className="text-sm font-medium truncate">
            {action.data?.subject || action.data?.ai_generated_title || 'Email'}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={cn(
      "rounded-lg border p-3 mt-2",
      config.color
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg bg-background/50", config.iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            {config.title}
          </div>
          {getDescription()}
        </div>
        
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0 gap-1.5"
          onClick={() => onExecute(action)}
        >
          {config.buttonText}
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
