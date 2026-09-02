import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useRolePermissions, type RolePermissions, type TeamType, type AppRole } from '@/hooks/auth/useRolePermissions';
import { FullPageLoader } from '@/components/ui/full-page-loader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RouteGuardProps {
  children: ReactNode;
  /** Permission requise (au moins une doit être vraie si tableau) */
  requiredPermission?: keyof RolePermissions | (keyof RolePermissions)[];
  /** Équipes autorisées */
  allowedTeams?: TeamType[];
  /** Rôles explicitement refusés (prioritaire sur allowedTeams) */
  disallowedRoles?: AppRole[];
  /** Réservé aux admins (inclut le rôle direction qui hérite des privilèges admin) */
  adminOnly?: boolean;
  /** Réservé STRICTEMENT au rôle 'admin' (exclut direction). Pour pages système sensibles. */
  strictAdminOnly?: boolean;
  /** Route de redirection si non autorisé (par défaut: affiche un message) */
  redirectTo?: string;
  /** Message personnalisé */
  accessDeniedMessage?: string;
}

export function RouteGuard({ 
  children, 
  requiredPermission,
  allowedTeams,
  disallowedRoles,
  adminOnly = false,
  strictAdminOnly = false,
  redirectTo,
  accessDeniedMessage
}: RouteGuardProps) {
  const permissions = useRolePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  // Afficher un loader pendant le chargement
  if (permissions.isLoading) {
    return <FullPageLoader />;
  }

  // Vérifier si l'utilisateur est autorisé
  let isAuthorized = true;
  let denialReason = '';
  let requiredRoleLabel = '';

  // Refus explicite par rôle (prioritaire, ne peut être bypass par admin)
  if (disallowedRoles && disallowedRoles.length > 0 && permissions.role && disallowedRoles.includes(permissions.role)) {
    isAuthorized = false;
    denialReason = 'Votre rôle n\'a pas accès à cette page.';
    requiredRoleLabel = `tout rôle sauf : ${disallowedRoles.join(', ')}`;
  }

  // Vérification admin strict (role === 'admin' uniquement, exclut direction)
  if (isAuthorized && strictAdminOnly && permissions.role !== 'admin') {
    isAuthorized = false;
    denialReason = 'Cette page est réservée aux administrateurs système.';
    requiredRoleLabel = 'admin (strict, hors direction)';
  }

  // Vérification admin (inclut direction via héritage)
  if (isAuthorized && adminOnly && !permissions.isAdmin) {
    isAuthorized = false;
    denialReason = 'Cette page est réservée aux administrateurs.';
    requiredRoleLabel = 'admin ou direction';
  }

  // Vérification des équipes
  if (isAuthorized && allowedTeams && allowedTeams.length > 0) {
    if (!permissions.team || !allowedTeams.includes(permissions.team)) {
      if (!permissions.isAdmin) { // Admin bypass team restrictions
        isAuthorized = false;
        denialReason = `Cette page est réservée aux équipes : ${allowedTeams.join(', ')}.`;
        requiredRoleLabel = `équipe : ${allowedTeams.join(', ')}`;
      }
    }
  }

  // Vérification des permissions
  if (isAuthorized && requiredPermission) {
    const permsToCheck = Array.isArray(requiredPermission) 
      ? requiredPermission 
      : [requiredPermission];
    
    const hasAnyPermission = permsToCheck.some(
      perm => permissions[perm] === true
    );
    
    if (!hasAnyPermission) {
      isAuthorized = false;
      denialReason = 'Vous n\'avez pas les permissions nécessaires pour accéder à cette page.';
      requiredRoleLabel = `permission : ${permsToCheck.join(' ou ')}`;
    }
  }

  // Si autorisé, afficher le contenu
  if (isAuthorized) {
    return <>{children}</>;
  }

  // Si redirection configurée — jamais silencieuse : on log en console DEV
  // pour faciliter le debug Playwright. En prod, la redirection reste rapide.
  if (redirectTo) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[RouteGuard] Redirect', { from: location.pathname, to: redirectTo, reason: denialReason });
    }
    return <Navigate to={redirectTo} replace state={{ from: location, denialReason, requiredRoleLabel }} />;
  }

  // Afficher la page d'accès refusé (contrat stable pour Playwright)
  return (
    <div
      className="container mx-auto max-w-2xl py-16 px-4"
      role="alert"
      aria-labelledby="access-denied-title"
      data-testid="access-denied"
    >
      <Card className="border-destructive/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <Lock className="h-8 w-8 text-destructive" aria-hidden="true" />
          </div>
          <CardTitle id="access-denied-title" className="text-2xl text-destructive" data-testid="access-denied-title">
            Accès refusé
          </CardTitle>
          <CardDescription className="text-base" data-testid="access-denied-reason">
            {accessDeniedMessage || denialReason}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p data-testid="access-denied-current-role">
              Votre rôle actuel : <strong className="text-foreground">{permissions.role || 'Non défini'}</strong>
            </p>
            {requiredRoleLabel && (
              <p data-testid="access-denied-required-role">
                Rôle requis : <strong className="text-foreground">{requiredRoleLabel}</strong>
              </p>
            )}
            {permissions.team && (
              <p data-testid="access-denied-current-team">
                Votre équipe : <strong className="text-foreground">{permissions.team}</strong>
              </p>
            )}
          </div>
          
          <div className="flex justify-center gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)}
              className="gap-2"
              data-testid="access-denied-back"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Retour
            </Button>
            <Button onClick={() => navigate('/')} data-testid="access-denied-home">
              Tableau de bord
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground pt-4">
            Si vous pensez qu'il s'agit d'une erreur, contactez un administrateur.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

