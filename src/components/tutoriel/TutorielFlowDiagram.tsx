/**
 * TutorielFlowDiagram - Diagrammes de flux animés
 */
import { memo, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { ArrowRight, CheckCircle2, Circle, Loader2 } from 'lucide-react'

interface FlowStep {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
}

interface TutorielFlowDiagramProps {
  steps: FlowStep[]
  direction?: 'horizontal' | 'vertical'
  animationDuration?: number
  className?: string
  autoPlay?: boolean
  loop?: boolean
}

export const TutorielFlowDiagram = memo(({ 
  steps, 
  direction = 'horizontal',
  animationDuration = 1500,
  className,
  autoPlay = true,
  loop = true
}: TutorielFlowDiagramProps) => {
  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    if (!autoPlay) return

    const interval = setInterval(() => {
      setActiveIndex(prev => {
        if (prev >= steps.length - 1) {
          return loop ? -1 : steps.length - 1
        }
        return prev + 1
      })
    }, animationDuration)

    return () => clearInterval(interval)
  }, [steps.length, animationDuration, autoPlay, loop])

  const isHorizontal = direction === 'horizontal'

  return (
    <div 
      className={cn(
        "flex gap-2",
        isHorizontal ? "flex-row items-center" : "flex-col",
        className
      )}
    >
      {steps.map((step, index) => {
        const isActive = index === activeIndex
        const isComplete = index < activeIndex
        const isPending = index > activeIndex

        return (
          <div key={step.id} className={cn("flex items-center gap-2", !isHorizontal && "flex-col")}>
            {/* Step node */}
            <div 
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300 min-w-[120px]",
                isActive && "border-primary bg-primary/10 scale-105 shadow-lg",
                isComplete && "border-success bg-success/10",
                isPending && "border-border bg-muted/50 opacity-60"
              )}
            >
              {/* Icon */}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                isActive && "bg-primary text-primary-foreground",
                isComplete && "bg-success text-success-foreground",
                isPending && "bg-muted text-muted-foreground"
              )}>
                {isActive && <Loader2 className="h-5 w-5 animate-spin" />}
                {isComplete && <CheckCircle2 className="h-5 w-5" />}
                {isPending && (step.icon || <Circle className="h-5 w-5" />)}
              </div>

              {/* Label */}
              <span className={cn(
                "text-sm font-medium text-center transition-colors",
                isActive && "text-primary",
                isComplete && "text-success",
                isPending && "text-muted-foreground"
              )}>
                {step.label}
              </span>

              {/* Description */}
              {step.description && isActive && (
                <p className="text-xs text-muted-foreground text-center max-w-[100px] animate-fade-in">
                  {step.description}
                </p>
              )}
            </div>

            {/* Arrow connector */}
            {index < steps.length - 1 && (
              <div className={cn(
                "transition-all duration-300",
                isComplete ? "text-success" : "text-muted-foreground/40"
              )}>
                <ArrowRight className={cn(
                  "h-5 w-5",
                  !isHorizontal && "rotate-90"
                )} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
})

TutorielFlowDiagram.displayName = 'TutorielFlowDiagram'

/**
 * Simple workflow with icons and pulse animation
 */
interface WorkflowItem {
  id: string
  label: string
  icon: React.ReactNode
  color?: string
}

interface TutorielWorkflowProps {
  items: WorkflowItem[]
  activeIndex?: number
  className?: string
}

export const TutorielWorkflow = memo(({ items, activeIndex = -1, className }: TutorielWorkflowProps) => {
  return (
    <div className={cn("flex items-center justify-center gap-4 flex-wrap", className)}>
      {items.map((item, index) => {
        const isActive = index === activeIndex
        
        return (
          <div key={item.id} className="flex items-center gap-3">
            <div 
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-lg transition-all",
                isActive && "scale-110"
              )}
            >
              <div 
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                  isActive ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground"
                )}
                style={isActive ? {} : { backgroundColor: item.color ? `${item.color}20` : undefined }}
              >
                {item.icon}
              </div>
              <span className={cn(
                "text-xs font-medium",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </div>
            
            {index < items.length - 1 && (
              <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
            )}
          </div>
        )
      })}
    </div>
  )
})

TutorielWorkflow.displayName = 'TutorielWorkflow'
