import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Lock } from 'lucide-react';
import { useRolePermissions } from '@/hooks/auth/useRolePermissions';
import { Skeleton } from '@/components/ui/skeleton';

interface RoleGuardProps {
  children: ReactNode;
  requiredPermission?: keyof ReturnType<typeof useRolePermissions>;
  fallback?: ReactNode;
  showFallback?: boolean;
}

export function RoleGuard({ 
  children, 
  requiredPermission, 
  fallback,
  showFallback = true 
}: RoleGuardProps) {
  const permissions = useRolePermissions();

  // Afficher un loader pendant le chargement
  if (permissions.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  // Vérifier la permission si requise
  if (requiredPermission && !permissions[requiredPermission]) {
    if (!showFallback) {
      return null;
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Accès restreint</CardTitle>
          </div>
          <CardDescription>
            Vous n'avez pas les permissions nécessaires pour accéder à cette section.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">Permission requise :</p>
              <p>
                Cette fonctionnalité est réservée aux utilisateurs avec les droits{' '}
                <span className="font-semibold text-foreground">
                  {permissions.isAdmin ? 'admin' : permissions.role || 'spécifiques'}
                </span>.
              </p>
              <p className="mt-2">
                Si vous pensez qu'il s'agit d'une erreur, contactez un administrateur.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
