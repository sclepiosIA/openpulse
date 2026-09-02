import React from 'react'
import { Button } from '@/components/ui/button'
import { Minimize2, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobileDashboardMode } from '@/hooks/analytics/useMobileDashboard'

interface MobileCompactToggleProps {
  mode: MobileDashboardMode
  onToggle: () => void
  className?: string
  variant?: 'default' | 'ghost-white'
}

export function MobileCompactToggle({
  mode,
  onToggle,
  className,
  variant = 'default',
}: MobileCompactToggleProps) {
  const isCompact = mode === 'compact'

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className={cn(
        'gap-1.5 h-8 px-2.5 text-xs font-medium rounded-lg transition-all',
        variant === 'ghost-white'
          ? 'text-white/80 hover:text-white hover:bg-card/20'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        className
      )}
    >
      {isCompact ? (
        <>
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">Complet</span>
        </>
      ) : (
        <>
          <Minimize2 className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">Compact</span>
        </>
      )}
    </Button>
  )
}
