import { useLocation } from 'react-router-dom'

export function usePublicRoute() {
  const location = useLocation()
  const publicRoutes = [
    '/utilisateurs',
    '/enquete-satisfaction-solution',
    '/auth/reset-password',
    '/dpo-exemple',
    '/mentions-legales',
    '/politique-confidentialite',
    '/rdv',
    '/f',
    '/test',
  ]
  const isPublicRoute = publicRoutes.includes(location.pathname)
  // Routes d'installation PWA publiques (pour charger le manifest avant auth)
  // Inclut /m/install (liste des apps) et /m/{app}/install (page d'installation spécifique)
  const isMobileInstallRoute =
    /^\/m\/[^/]+\/install$/.test(location.pathname) || location.pathname === '/m/install'
  // Route publique de prise de RDV
  const isBookingRoute = location.pathname.startsWith('/rdv/')
  const isFormRoute = location.pathname.startsWith('/f/')
  const isTransferRoute = location.pathname.startsWith('/transfer/')
  return isPublicRoute || isMobileInstallRoute || isBookingRoute || isFormRoute || isTransferRoute
}
