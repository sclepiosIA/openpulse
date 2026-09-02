/**
 * Design tokens et configuration pour l'expérience mobile
 * Tokens utilisés à travers l'application pour garantir la cohérence
 */

export const mobileDesignTokens = {
  breakpoints: {
    xs: 320,
    sm: 375,
    md: 768,
    lg: 1024,
  },
  touchTargets: {
    min: 44,        // Minimum WCAG
    comfortable: 48, // Recommandé
    large: 56,      // Pour actions principales
  },
  spacing: {
    section: 'py-6 px-4',
    card: 'p-4',
    compact: 'p-2',
    touchArea: 'p-3',
    safeArea: {
      top: 'pt-safe',
      bottom: 'pb-safe',
    }
  },
  typography: {
    mobile: {
      h1: 'text-2xl font-bold leading-tight',
      h2: 'text-xl font-semibold leading-tight',
      h3: 'text-lg font-medium',
      body: 'text-base leading-relaxed',
      small: 'text-sm',
      tiny: 'text-[13px]',
    }
  },
  animations: {
    fast: '150ms',
    normal: '250ms',
    slow: '350ms',
    reducedMotion: '10ms',
  },
  swipe: {
    threshold: 50,      // Distance minimum pour déclencher swipe
    velocity: 0.3,      // Vélocité minimum
    maxDistance: 120,   // Distance max du swipe
  }
} as const;

export type MobileTokens = typeof mobileDesignTokens;
