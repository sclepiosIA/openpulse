import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface TimelineCardProps {
  accentColor?: 'primary' | 'success' | 'warning' | 'accent' | 'cyan'
  icon?: LucideIcon
  isActive?: boolean
  showDot?: boolean
  animateOnHover?: boolean
  className?: string
  children?: React.ReactNode
}

const accentColorClasses = {
  primary: {
    border: 'border-l-primary',
    dot: 'bg-primary',
    glow: 'shadow-glow-blue',
    ring: 'ring-primary/30'
  },
  success: {
    border: 'border-l-success',
    dot: 'bg-success',
    glow: 'shadow-glow-cyan',
    ring: 'ring-success/30'
  },
  warning: {
    border: 'border-l-warning',
    dot: 'bg-warning',
    glow: 'shadow-glow-orange',
    ring: 'ring-warning/30'
  },
  accent: {
    border: 'border-l-accent',
    dot: 'bg-accent',
    glow: 'shadow-glow-orange',
    ring: 'ring-accent/30'
  },
  cyan: {
    border: 'border-l-success',
    dot: 'bg-success',
    glow: 'shadow-glow-cyan',
    ring: 'ring-success/30'
  }
}

function TimelineCard({ 
  className, 
  accentColor = 'primary', 
  icon: Icon, 
  isActive = false, 
  showDot = true,
  animateOnHover = true,
  children
}: TimelineCardProps) {
  const colors = accentColorClasses[accentColor]
  
  return (
    <motion.div
      className={cn(
        "relative pl-6 group",
        className
      )}
      whileHover={animateOnHover ? { x: 4 } : undefined}
      transition={{ duration: 0.2 }}
    >
      {/* Vertical timeline line */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 rounded-full transition-all duration-300",
        colors.border.replace('border-l-', 'bg-'),
        isActive && colors.glow
      )} />
      
      {/* Dot indicator */}
      {showDot && (
        <div className="absolute left-0 top-4 -translate-x-[calc(50%-2px)]">
          <div className={cn(
            "relative w-4 h-4 rounded-full",
            colors.dot,
            "transition-all duration-300",
            isActive && "ring-4 " + colors.ring
          )}>
            {/* Pulse animation for active state */}
            {isActive && (
              <div className={cn(
                "absolute inset-0 rounded-full animate-pulse-ring",
                colors.dot
              )} />
            )}
          </div>
        </div>
      )}
      
      {/* Icon in timeline */}
      {Icon && (
        <div className={cn(
          "absolute -left-3 top-2 w-8 h-8 rounded-full flex items-center justify-center",
          "bg-background border-2 transition-all duration-300",
          colors.border.replace('border-l-', 'border-'),
          "group-hover:scale-110"
        )}>
          <Icon className={cn("h-4 w-4", colors.dot.replace('bg-', 'text-'))} />
        </div>
      )}
      
      {/* Content */}
      <div className={cn(
        "bg-card border rounded-lg p-4 transition-all duration-300",
        "hover:shadow-card-hover hover:border-primary/30"
      )}>
        {children}
      </div>
    </motion.div>
  )
}

interface TimelineContainerProps {
  className?: string
  children: React.ReactNode
}

function TimelineContainer({ className, children }: TimelineContainerProps) {
  return (
    <div className={cn("relative space-y-4", className)}>
      {children}
    </div>
  )
}

export { TimelineCard, TimelineContainer }
