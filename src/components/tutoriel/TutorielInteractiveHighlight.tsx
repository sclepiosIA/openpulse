/**
 * TutorielInteractiveHighlight - Système de surbrillance avec numéros d'étape
 */
import { memo } from 'react'
import { cn } from '@/lib/utils'

interface HighlightZone {
  id: string
  x: number
  y: number
  width: number
  height: number
  stepNumber: number
  label: string
  description?: string
}

interface TutorielInteractiveHighlightProps {
  zones: HighlightZone[]
  activeZone?: string
  children: React.ReactNode
  className?: string
}

export const TutorielInteractiveHighlight = memo(({ 
  zones, 
  activeZone,
  children,
  className 
}: TutorielInteractiveHighlightProps) => {
  return (
    <div className={cn("relative", className)}>
      {/* Content */}
      <div className="relative">
        {children}
      </div>

      {/* Highlight zones */}
      {zones.map((zone) => {
        const isActive = activeZone === zone.id
        return (
          <div
            key={zone.id}
            className={cn(
              "absolute pointer-events-none transition-all duration-300",
              isActive && "z-40"
            )}
            style={{
              left: `${zone.x}%`,
              top: `${zone.y}%`,
              width: `${zone.width}%`,
              height: `${zone.height}%`
            }}
          >
            {/* Pulsing border */}
            <div 
              className={cn(
                "absolute inset-0 rounded-lg border-2 transition-all",
                isActive 
                  ? "border-primary shadow-[0_0_0_4px_rgba(var(--primary-rgb),0.2)] animate-pulse" 
                  : "border-primary/30"
              )}
            />

            {/* Step number badge */}
            <div 
              className={cn(
                "absolute -top-3 -left-3 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                isActive 
                  ? "bg-primary text-primary-foreground scale-110 shadow-lg" 
                  : "bg-muted text-muted-foreground"
              )}
            >
              {zone.stepNumber}
            </div>

            {/* Tooltip */}
            {isActive && (
              <div className="absolute left-full top-0 ml-4 bg-popover text-popover-foreground p-3 rounded-lg shadow-xl border min-w-[200px] animate-fade-in z-50">
                <p className="font-semibold text-sm">{zone.label}</p>
                {zone.description && (
                  <p className="text-xs text-muted-foreground mt-1">{zone.description}</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
})

TutorielInteractiveHighlight.displayName = 'TutorielInteractiveHighlight'

/**
 * Spotlight effect - darkens everything except the target
 */
interface SpotlightProps {
  x: number
  y: number
  width: number
  height: number
  active: boolean
  children: React.ReactNode
}

export const TutorielSpotlight = memo(({ x, y, width, height, active, children }: SpotlightProps) => {
  if (!active) return <>{children}</>

  return (
    <div className="relative">
      {children}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="w-full h-full">
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect 
                x={`${x}%`} 
                y={`${y}%`} 
                width={`${width}%`} 
                height={`${height}%`} 
                fill="black"
                rx="8"
              />
            </mask>
          </defs>
          <rect 
            width="100%" 
            height="100%" 
            fill="rgba(0,0,0,0.6)" 
            mask="url(#spotlight-mask)"
          />
        </svg>
      </div>
    </div>
  )
})

TutorielSpotlight.displayName = 'TutorielSpotlight'
