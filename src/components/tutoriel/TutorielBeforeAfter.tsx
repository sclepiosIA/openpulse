/**
 * TutorielBeforeAfter - Composant comparatif avant/après avec slider
 */
import { memo, useState } from 'react'
import { cn } from '@/lib/utils'

interface TutorielBeforeAfterProps {
  before: React.ReactNode
  after: React.ReactNode
  beforeLabel?: string
  afterLabel?: string
  direction?: 'horizontal' | 'vertical'
  className?: string
  defaultPosition?: number
}

export const TutorielBeforeAfter = memo(
  ({
    before,
    after,
    beforeLabel = 'Avant',
    afterLabel = 'Après',
    direction = 'horizontal',
    className,
    defaultPosition = 50,
  }: TutorielBeforeAfterProps) => {
    const [position, setPosition] = useState(defaultPosition)

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const newPosition =
        direction === 'horizontal' ? (x / rect.width) * 100 : (y / rect.height) * 100

      setPosition(Math.max(5, Math.min(95, newPosition)))
    }

    const isHorizontal = direction === 'horizontal'

    return (
      <div
        className={cn(
          'relative rounded-xl overflow-hidden border-2 border-border cursor-ew-resize select-none',
          !isHorizontal && 'cursor-ns-resize',
          className
        )}
        onMouseMove={handleMouseMove}
      >
        {/* After (full, behind) */}
        <div className="w-full h-full">{after}</div>

        {/* Before (clipped, on top) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            clipPath: isHorizontal
              ? `inset(0 ${100 - position}% 0 0)`
              : `inset(0 0 ${100 - position}% 0)`,
          }}
        >
          {before}
        </div>

        {/* Divider line */}
        <div
          className={cn(
            'absolute bg-card shadow-lg z-10',
            isHorizontal ? 'w-1 h-full top-0' : 'h-1 w-full left-0'
          )}
          style={{
            [isHorizontal ? 'left' : 'top']: `${position}%`,
            transform: isHorizontal ? 'translateX(-50%)' : 'translateY(-50%)',
          }}
        >
          {/* Handle */}
          <div
            className={cn(
              'absolute bg-card rounded-full shadow-lg border-2 border-primary',
              isHorizontal
                ? 'w-8 h-8 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                : 'w-8 h-8 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
            )}
          >
            <div className="w-full h-full flex items-center justify-center text-primary">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                {isHorizontal ? (
                  <>
                    <path d="M18 8l4 4-4 4" />
                    <path d="M6 8l-4 4 4 4" />
                  </>
                ) : (
                  <>
                    <path d="M8 6l4-4 4 4" />
                    <path d="M8 18l4 4 4-4" />
                  </>
                )}
              </svg>
            </div>
          </div>
        </div>

        {/* Labels */}
        <div
          className={cn(
            'absolute text-xs font-medium pointer-events-none',
            isHorizontal ? 'top-3 left-3' : 'top-3 left-3'
          )}
        >
          <span className="px-2 py-1 bg-destructive/90 text-destructive-foreground rounded-md">
            {beforeLabel}
          </span>
        </div>
        <div
          className={cn(
            'absolute text-xs font-medium pointer-events-none',
            isHorizontal ? 'top-3 right-3' : 'bottom-3 right-3'
          )}
        >
          <span className="px-2 py-1 bg-success/90 text-success-foreground rounded-md">
            {afterLabel}
          </span>
        </div>
      </div>
    )
  }
)

TutorielBeforeAfter.displayName = 'TutorielBeforeAfter'

/**
 * Simple side-by-side comparison (non-interactive)
 */
interface TutorielComparisonProps {
  before: React.ReactNode
  after: React.ReactNode
  beforeLabel?: string
  afterLabel?: string
  className?: string
}

export const TutorielComparison = memo(
  ({
    before,
    after,
    beforeLabel = 'Avant',
    afterLabel = 'Après',
    className,
  }: TutorielComparisonProps) => {
    return (
      <div className={cn('grid grid-cols-2 gap-4', className)}>
        <div className="rounded-xl border-2 border-destructive/30 overflow-hidden">
          <div className="bg-destructive/10 px-3 py-1.5 border-b border-destructive/20">
            <span className="text-xs font-medium text-destructive">{beforeLabel}</span>
          </div>
          <div className="p-4">{before}</div>
        </div>
        <div className="rounded-xl border-2 border-success/30 overflow-hidden">
          <div className="bg-success/10 px-3 py-1.5 border-b border-success/20">
            <span className="text-xs font-medium text-success">{afterLabel}</span>
          </div>
          <div className="p-4">{after}</div>
        </div>
      </div>
    )
  }
)

TutorielComparison.displayName = 'TutorielComparison'
