/**
 * SkipLinks - Liens d'évitement pour l'accessibilité (WCAG 2.1)
 * Permettent aux utilisateurs de clavier/lecteur d'écran de sauter directement au contenu principal
 */
export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="fixed top-2 left-2 z-[100] bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-transform -translate-y-16 focus:translate-y-0"
      >
        Aller au contenu principal
      </a>
      <a
        href="#main-navigation"
        className="fixed top-2 left-48 z-[100] bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-transform -translate-y-16 focus:translate-y-0"
      >
        Aller à la navigation
      </a>
    </div>
  )
}
