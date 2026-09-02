/**
 * TutorielAnimatedDemo - Composant de démonstration animée avec cursor simulé
 */
import { memo, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { MousePointer2 } from 'lucide-react'

interface AnimationStep {
  type: 'click' | 'hover' | 'highlight' | 'wait' | 'move'
  x?: number
  y?: number
  duration: number
  label?: string
}

interface TutorielAnimatedDemoProps {
  steps: AnimationStep[]
  children: React.ReactNode
  autoPlay?: boolean
  loop?: boolean
  className?: string
}

export const TutorielAnimatedDemo = memo(({ 
  steps, 
  children, 
  autoPlay = true, 
  loop = true,
  className 
}: TutorielAnimatedDemoProps) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [cursorPosition, setCursorPosition] = useState({ x: 50, y: 50 })
  const [isClicking, setIsClicking] = useState(false)
  const [highlightActive, setHighlightActive] = useState(false)

  useEffect(() => {
    if (!autoPlay || steps.length === 0) return

    const step = steps[currentStep]
    if (!step) return

    // Update cursor position
    if (step.x !== undefined && step.y !== undefined) {
      setCursorPosition({ x: step.x, y: step.y })
    }

    // Handle step type
    if (step.type === 'click') {
      const clickTimeout = setTimeout(() => {
        setIsClicking(true)
        setTimeout(() => setIsClicking(false), 150)
      }, step.duration / 2)
      
      const nextTimeout = setTimeout(() => {
        setCurrentStep(prev => (prev + 1) % (loop ? steps.length : Math.min(prev + 1, steps.length - 1)))
      }, step.duration)
      
      return () => {
        clearTimeout(clickTimeout)
        clearTimeout(nextTimeout)
      }
    }

    if (step.type === 'highlight') {
      setHighlightActive(true)
      const timeout = setTimeout(() => {
        setHighlightActive(false)
        setCurrentStep(prev => (prev + 1) % (loop ? steps.length : Math.min(prev + 1, steps.length - 1)))
      }, step.duration)
      return () => clearTimeout(timeout)
    }

    const timeout = setTimeout(() => {
      setCurrentStep(prev => (prev + 1) % (loop ? steps.length : Math.min(prev + 1, steps.length - 1)))
    }, step.duration)

    return () => clearTimeout(timeout)
  }, [currentStep, steps, autoPlay, loop])

  const currentLabel = steps[currentStep]?.label

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      {/* Content */}
      <div className="relative">
        {children}
      </div>

      {/* Animated cursor */}
      <div
        className={cn(
          "absolute pointer-events-none z-50 transition-all duration-500 ease-out",
          isClicking && "scale-90"
        )}
        style={{
          left: `${cursorPosition.x}%`,
          top: `${cursorPosition.y}%`,
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div className="relative">
          <MousePointer2 
            className={cn(
              "h-6 w-6 text-primary drop-shadow-lg transition-transform",
              isClicking && "scale-90"
            )} 
          />
          {isClicking && (
            <div className="absolute top-0 left-0 w-8 h-8 -translate-x-1 -translate-y-1 rounded-full bg-primary/30 animate-ping" />
          )}
        </div>
      </div>

      {/* Highlight overlay */}
      {highlightActive && (
        <div className="absolute inset-0 bg-primary/10 animate-pulse pointer-events-none" />
      )}

      {/* Step label */}
      {currentLabel && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border text-sm font-medium animate-fade-in">
          {currentLabel}
        </div>
      )}
    </div>
  )
})

TutorielAnimatedDemo.displayName = 'TutorielAnimatedDemo'
