import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Lock, Eye } from 'lucide-react';
import { useRolePermissions } from '@/hooks/auth/useRolePermissions';
import { Badge } from '@/components/ui/badge';

interface PermissionBannerProps {
  type?: 'restricted' | 'readonly' | 'info';
  message?: string;
  className?: string;
}

export function PermissionBanner({ 
  type = 'info', 
  message,
  className 
}: PermissionBannerProps) {
  const permissions = useRolePermissions();

  const getIcon = () => {
    switch (type) {
      case 'restricted':
        return <Lock className="h-4 w-4" />;
      case 'readonly':
        return <Eye className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'restricted':
        return 'Accès limité';
      case 'readonly':
        return 'Lecture seule';
      default:
        return 'Information';
    }
  };

  const getDefaultMessage = () => {
    if (message) return message;

    if (permissions.viewScope === 'managed') {
      return 'Vous ne voyez que les données liées à vos projets et établissements.';
    }

    if (type === 'readonly') {
      return 'Vous pouvez consulter ces données mais pas les modifier.';
    }

    if (type === 'restricted') {
      return 'Certaines fonctionnalités sont réservées aux administrateurs.';
    }

    return null;
  };

  const defaultMessage = getDefaultMessage();
  if (!defaultMessage) return null;

  return (
    <Alert className={className} variant={type === 'restricted' ? 'destructive' : 'default'}>
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <AlertTitle className="mb-0">{getTitle()}</AlertTitle>
            {permissions.role && (
              <Badge variant="outline" className="text-xs">
                {permissions.role}
              </Badge>
            )}
          </div>
          <AlertDescription className="text-sm">
            {defaultMessage}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}
