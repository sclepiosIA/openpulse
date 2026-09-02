import { Badge } from "@/components/ui/badge";
import { Building2, Users } from "lucide-react";

interface GroupeBadgeProps {
  type: 'GHT' | 'Groupe Cliniques' | 'Consortium' | 'Autre';
  nom?: string;
  className?: string;
  showIcon?: boolean;
}

export function GroupeBadge({ type, nom, className, showIcon = true }: GroupeBadgeProps) {
  const config = {
    'GHT': {
      label: 'GHT',
      variant: 'default' as const,
      icon: Building2,
      className: 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300'
    },
    'Groupe Cliniques': {
      label: 'Groupe',
      variant: 'default' as const,
      icon: Users,
      className: 'bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-300'
    },
    'Consortium': {
      label: 'Consortium',
      variant: 'default' as const,
      icon: Building2,
      className: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border-indigo-300'
    },
    'Autre': {
      label: 'Groupe',
      variant: 'secondary' as const,
      icon: Users,
      className: ''
    }
  };

  const { label, variant, icon: Icon, className: typeClassName } = config[type];

  return (
    <Badge 
      variant={variant} 
      className={`${typeClassName} ${className || ''}`}
    >
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {nom || label}
    </Badge>
  );
}
