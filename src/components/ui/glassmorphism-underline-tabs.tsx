import * as React from 'react'
import { cn } from '@/lib/utils'

interface Tab {
  value: string
  label: string
  shortLabel?: string
}

interface GlassmorphismUnderlineTabsProps {
  tabs: Tab[]
  value: string
  onValueChange: (value: string) => void
  className?: string
}

export function GlassmorphismUnderlineTabs({
  tabs,
  value,
  onValueChange,
  className,
}: GlassmorphismUnderlineTabsProps) {
  return (
    <div className={cn('flex items-center gap-1 p-1 rounded-xl', className)}>
      {tabs.map((tab) => {
        const isActive = value === tab.value
        return (
          <button
            key={tab.value}
            onClick={() => onValueChange(tab.value)}
            className={cn(
              'relative px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg',
              isActive ? 'text-white' : 'text-white/60 hover:text-white/80'
            )}
          >
            <span className="hidden md:inline">{tab.label}</span>
            <span className="md:hidden">{tab.shortLabel || tab.label}</span>

            {/* Underline indicator */}
            <span
              className={cn(
                'absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-200',
                isActive
                  ? 'w-3/4 bg-card shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                  : 'w-0 bg-transparent'
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
