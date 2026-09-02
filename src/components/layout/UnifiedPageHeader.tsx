import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconCircle } from '@/components/ui/icon-circle'

interface UnifiedPageHeaderProps {
  /** Main title of the page */
  title: string
  /** Optional subtitle/description */
  subtitle?: string
  /** Optional icon component from lucide-react */
  icon?: LucideIcon
  /** Optional action buttons to display on the right */
  actions?: ReactNode
  /** Additional className for the container */
  className?: string
  /** Whether to make the header sticky (default: true) */
  sticky?: boolean
  /** Content to render below the header (e.g., tabs, filters) */
  children?: ReactNode
  /** Visual variant: 'default' or 'immersive' for premium pages */
  variant?: 'default' | 'immersive'
}

export function UnifiedPageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
  sticky = true,
  children,
  variant = 'default',
}: UnifiedPageHeaderProps) {
  return (
    <div
      className={cn(
        'border-b',
        variant === 'immersive'
          ? 'border-primary/10 bg-marque-papier backdrop-blur-md'
          : 'border-border/50 bg-gradient-to-r from-primary/5 via-background to-background backdrop-blur-sm',
        sticky && 'sticky top-0 z-20',
        className
      )}
    >
      <div className="px-2 sm:px-3 md:px-4 py-2 sm:py-3">
        {/* Main header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
          {/* Left side: Icon + Title/Subtitle */}
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <IconCircle
                icon={Icon}
                variant="gradient"
                color="primary"
                size="md"
                className="hidden md:flex shadow-lg shadow-primary/10"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-[34px] sm:leading-[38px] font-light text-foreground truncate tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-muted-foreground truncate hidden lg:block mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right side: Actions */}
          {actions && (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">{actions}</div>
          )}
        </div>

        {/* Optional children (tabs, filters, etc.) */}
        {children && <div className="mt-2 sm:mt-3">{children}</div>}
      </div>
    </div>
  )
}
