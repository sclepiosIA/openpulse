import * as React from 'react'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type IconCircleVariant = 'filled' | 'outlined' | 'gradient' | 'soft' | 'premium'
export type IconCircleSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type IconCircleColor =
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'muted'
  | 'white'

const sizeClasses: Record<IconCircleSize, { container: string; icon: string }> = {
  xs: { container: 'w-6 h-6', icon: 'w-3 h-3' },
  sm: { container: 'w-8 h-8', icon: 'w-4 h-4' },
  md: { container: 'w-10 h-10', icon: 'w-5 h-5' },
  lg: { container: 'w-12 h-12', icon: 'w-6 h-6' },
  xl: { container: 'w-14 h-14', icon: 'w-7 h-7' },
  '2xl': { container: 'w-16 h-16', icon: 'w-8 h-8' },
}

const variantColorClasses: Record<IconCircleVariant, Record<IconCircleColor, string>> = {
  filled: {
    primary: 'bg-primary text-primary-foreground',
    accent: 'bg-accent text-accent-foreground',
    success: 'bg-success text-success-foreground',
    warning: 'bg-warning text-warning-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
    muted: 'bg-muted text-muted-foreground',
    white: 'bg-card/10 text-white',
  },
  outlined: {
    primary: 'border-2 border-primary text-primary bg-transparent',
    accent: 'border-2 border-accent text-accent bg-transparent',
    success: 'border-2 border-success text-success bg-transparent',
    warning: 'border-2 border-warning text-warning bg-transparent',
    destructive: 'border-2 border-destructive text-destructive bg-transparent',
    muted: 'border-2 border-muted-foreground/30 text-muted-foreground bg-transparent',
    white: 'border-2 border-white/30 text-white bg-transparent',
  },
  gradient: {
    primary:
      'bg-gradient-to-br from-primary to-primary-dark text-primary-foreground shadow-lg shadow-primary/20',
    accent:
      'bg-gradient-to-br from-accent to-orange-600 text-accent-foreground shadow-lg shadow-accent/20',
    success: 'bg-gradient-to-br from-success to-cyan-600 text-white shadow-lg shadow-success/20',
    warning: 'bg-gradient-to-br from-warning to-amber-600 text-white shadow-lg shadow-warning/20',
    destructive:
      'bg-gradient-to-br from-destructive to-red-700 text-white shadow-lg shadow-destructive/20',
    muted: 'bg-gradient-to-br from-muted to-slate-300 text-muted-foreground',
    white: 'bg-gradient-to-br from-white/20 to-white/5 text-white shadow-lg',
  },
  soft: {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent/10 text-accent',
    success: 'bg-success/20 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
    muted: 'bg-muted text-muted-foreground',
    white: 'bg-card/10 text-white',
  },
  // Premium variant inspired by OpenPulse home page - with deep shadows and borders
  premium: {
    primary:
      'bg-gradient-to-br from-primary/15 to-primary/5 text-primary border-2 border-primary/30 shadow-[0_4px_20px_hsl(var(--primary)/0.15)] hover:shadow-[0_8px_30px_hsl(var(--primary)/0.25)] transition-shadow',
    accent:
      'bg-gradient-to-br from-accent/15 to-accent/5 text-accent border-2 border-accent/30 shadow-[0_4px_20px_hsl(var(--accent)/0.15)]',
    success:
      'bg-gradient-to-br from-success/15 to-success/5 text-success border-2 border-success/30 shadow-[0_4px_20px_hsl(var(--success)/0.15)]',
    warning:
      'bg-gradient-to-br from-warning/15 to-warning/5 text-warning border-2 border-warning/30 shadow-[0_4px_20px_hsl(var(--warning)/0.15)]',
    destructive:
      'bg-gradient-to-br from-destructive/15 to-destructive/5 text-destructive border-2 border-destructive/30 shadow-[0_4px_20px_hsl(var(--destructive)/0.15)]',
    muted:
      'bg-gradient-to-br from-muted/50 to-muted/20 text-muted-foreground border-2 border-muted/30',
    white:
      'bg-card/10 text-white border-2 border-white/20 shadow-[0_4px_20px_rgba(255,255,255,0.1)] backdrop-blur-sm',
  },
}

export interface IconCircleProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon
  variant?: IconCircleVariant
  size?: IconCircleSize
  color?: IconCircleColor
  animate?: boolean
}

const IconCircle = React.forwardRef<HTMLDivElement, IconCircleProps>(
  (
    {
      icon: Icon,
      variant = 'filled',
      size = 'md',
      color = 'primary',
      animate = false,
      className,
      ...props
    },
    ref
  ) => {
    // Premium variant uses rounded-2xl instead of rounded-full
    const radiusClass = variant === 'premium' ? 'rounded-2xl' : 'rounded-full'

    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          'flex items-center justify-center shrink-0',
          radiusClass,
          // Size
          sizeClasses[size].container,
          // Variant + Color
          variantColorClasses[variant][color],
          // Animation
          animate && 'transition-transform duration-300 hover:scale-110',
          className
        )}
        {...props}
      >
        <Icon className={cn(sizeClasses[size].icon)} />
      </div>
    )
  }
)

IconCircle.displayName = 'IconCircle'

export { IconCircle }
