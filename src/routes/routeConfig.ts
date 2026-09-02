/**
 * Configuration centralisée des routes et de leurs propriétés d'affichage.
 * Utilisée pour déterminer quelles pages utilisent un header immersif (pas de breadcrumb).
 */

/** Routes avec header immersif intégré — pas de header global affiché */
const IMMERSIVE_HEADER_PATHS = [
  '/',
  '/dashboard',
  '/pulse',
  '/emails',
  '/people',
  '/tresorerie',
  '/etablissements',
  '/support',
  '/rd',
  '/todos',
  '/documents',
  '/prise-rdv',
  '/calendrier',
  '/groupes',
  '/partenaires',
  '/prospects',
  '/apporteurs-affaires',
  '/analyse-geographique',
  '/deploiement',
  '/production',
  '/projets',
  '/gantt',
  '/parametres',
  '/profil',
  '/facturation',
  '/contrats',
  '/rapports',
  '/rapports-custom',
  '/formulaires',
  '/forecasting',
  '/automatisations',
  '/activite',
  '/churn',
  '/playbooks-csm',
  '/live-chat',
] as const

/** Routes mobiles PWA standalone — header mobile masqué aussi */
const MOBILE_STANDALONE_PATHS = [
  '/m/mail',
  '/m/todos',
  '/m/pulse',
  '/m/calendrier',
  '/m/documents',
  '/m/prise-rdv',
  '/m/jarvis',
  '/m/install',
] as const

/** Vérifie si le pathname correspond à un header immersif */
export function isImmersiveHeaderPath(pathname: string): boolean {
  return IMMERSIVE_HEADER_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'))
}

/** Vérifie si le pathname correspond à une route mobile standalone */
export function isMobileStandalonePath(pathname: string): boolean {
  return MOBILE_STANDALONE_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  )
}

/** Vérifie si le header mobile doit être masqué (immersif OU mobile standalone) */
export function shouldHideMobileHeader(pathname: string): boolean {
  return isImmersiveHeaderPath(pathname) || isMobileStandalonePath(pathname)
}

/** Vérifie si le header desktop doit être masqué */
export function shouldHideDesktopHeader(pathname: string): boolean {
  return isImmersiveHeaderPath(pathname)
}
