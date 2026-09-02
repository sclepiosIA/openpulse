/**
 * Jarvis Design System v14.0 - Premium Apple-like Design Tokens
 *
 * Centralized design tokens for consistent visual identity across all Jarvis components
 */

// Color palette using HSL for theme compatibility
export const JARVIS_COLORS = {
  // Primary gradient stops
  primary: {
    from: 'hsl(var(--primary))',
    to: 'hsl(200 85% 25%)',
    glow: 'hsl(var(--primary) / 0.3)',
    subtle: 'hsl(var(--primary) / 0.1)',
  },

  // Status colors
  status: {
    online: 'hsl(142 76% 45%)',
    thinking: 'hsl(43 96% 56%)',
    error: 'hsl(0 84% 60%)',
    offline: 'hsl(var(--muted-foreground))',
  },

  // Message bubbles
  bubbles: {
    user: {
      bg: 'bg-gradient-to-br from-primary to-primary/90',
      text: 'text-primary-foreground',
      shadow: 'shadow-lg shadow-primary/20',
    },
    assistant: {
      bg: 'bg-muted/60',
      text: 'text-foreground',
      border: 'border border-border/30',
    },
  },

  // Glassmorphism
  glass: {
    light: 'bg-card/60 backdrop-blur-xl border border-white/20',
    medium: 'bg-card/40 backdrop-blur-lg border border-white/15',
    dark: 'bg-black/30 backdrop-blur-xl border border-white/10',
  },
} as const

// Animation presets
export const JARVIS_ANIMATIONS = {
  // Spring animations
  spring: {
    bouncy: { type: 'spring', stiffness: 400, damping: 20 },
    smooth: { type: 'spring', stiffness: 200, damping: 25 },
    gentle: { type: 'spring', stiffness: 100, damping: 30 },
  },

  // Timing functions
  easing: {
    apple: [0.25, 0.46, 0.45, 0.94],
    smooth: [0.4, 0, 0.2, 1],
    bouncy: [0.68, -0.55, 0.265, 1.55],
  },

  // Duration presets (ms)
  duration: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 500,
    slowest: 800,
  },

  // Common variants
  fadeIn: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  },

  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  },

  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },

  slideInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
} as const

// Layout constants
export const JARVIS_LAYOUT = {
  // Border radius
  radius: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl',
    full: 'rounded-full',
  },

  // Spacing
  spacing: {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
    xl: 'gap-6',
  },

  // Padding
  padding: {
    xs: 'p-1',
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4',
    xl: 'p-6',
  },

  // Max widths for messages
  messageWidth: {
    mobile: 'max-w-[85%]',
    desktop: 'max-w-[75%]',
  },

  // Input heights
  input: {
    min: 'min-h-[44px]',
    max: 'max-h-[150px]',
  },

  // Safe areas
  safeArea: {
    top: 'pt-[env(safe-area-inset-top)]',
    bottom: 'pb-[env(safe-area-inset-bottom)]',
    all: 'p-[env(safe-area-inset-top)] p-[env(safe-area-inset-right)] p-[env(safe-area-inset-bottom)] p-[env(safe-area-inset-left)]',
  },
} as const

// Typography presets
export const JARVIS_TYPOGRAPHY = {
  heading: {
    xl: 'text-2xl font-bold tracking-tight',
    lg: 'text-xl font-semibold tracking-tight',
    md: 'text-lg font-semibold',
    sm: 'text-base font-medium',
  },

  body: {
    lg: 'text-base leading-relaxed',
    md: 'text-[15px] leading-relaxed',
    sm: 'text-sm leading-normal',
    xs: 'text-xs',
  },

  label: {
    primary: 'text-sm font-medium text-foreground',
    secondary: 'text-sm text-muted-foreground',
    tertiary: 'text-xs text-muted-foreground/60',
  },
} as const

// Component-specific styles
export const JARVIS_COMPONENTS = {
  // Header styles
  header: {
    base: 'relative flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-xl border-b border-border/40',
    glass:
      'relative flex items-center justify-between px-4 py-3 bg-card/60 dark:bg-black/40 backdrop-blur-2xl border-b border-white/20',
  },

  // Button styles
  button: {
    icon: 'h-9 w-9 rounded-full transition-all duration-200',
    iconSm: 'h-7 w-7 rounded-full transition-all duration-200',
    primary:
      'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30',
    ghost: 'hover:bg-muted/80 text-muted-foreground hover:text-foreground',
    glass: 'bg-card/20 backdrop-blur-sm border border-white/30 hover:bg-card/30',
  },

  // Card styles
  card: {
    base: 'rounded-2xl bg-background border border-border/50 shadow-sm',
    glass:
      'rounded-2xl bg-card/60 dark:bg-black/40 backdrop-blur-xl border border-white/20 shadow-xl',
    elevated: 'rounded-2xl bg-background shadow-xl shadow-black/5 border border-border/30',
  },

  // Input styles
  input: {
    base: 'rounded-3xl bg-muted/50 border border-border/50 focus:border-primary/30 focus:bg-muted/70 transition-all duration-200',
    glass:
      'rounded-3xl bg-card/40 dark:bg-black/20 backdrop-blur-xl border border-white/20 focus:border-primary/40 transition-all duration-200',
  },
} as const

// Export combined design system
export const JARVIS_DESIGN = {
  colors: JARVIS_COLORS,
  animations: JARVIS_ANIMATIONS,
  layout: JARVIS_LAYOUT,
  typography: JARVIS_TYPOGRAPHY,
  components: JARVIS_COMPONENTS,
} as const

export type JarvisDesignSystem = typeof JARVIS_DESIGN
