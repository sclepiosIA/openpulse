import * as React from "react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface GlowBadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'accent'
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
  glow?: boolean
  className?: string
  children?: React.ReactNode
}

const variantClasses = {
  default: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    glow: 'shadow-[0_0_10px_hsl(var(--muted)/0.5)]'
  },
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    glow: 'shadow-glow-blue'
  },
  success: {
    bg: 'bg-success/10',
    text: 'text-success',
    glow: 'shadow-glow-cyan'
  },
  warning: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    glow: 'shadow-glow-orange'
  },
  accent: {
    bg: 'bg-accent/10',
    text: 'text-accent',
    glow: 'shadow-glow-orange'
  }
}

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5'
}

function GlowBadge({ 
  className, 
  variant = 'default', 
  size = 'md',
  pulse = false,
  glow = false,
  children
}: GlowBadgeProps) {
  const variantStyle = variantClasses[variant]
  
  return (
    <motion.div
      className={cn(
        "inline-flex items-center justify-center font-medium rounded-full",
        "transition-all duration-300",
        variantStyle.bg,
        variantStyle.text,
        sizeClasses[size],
        glow && variantStyle.glow,
        pulse && "animate-pulse",
        className
      )}
      whileHover={{ scale: 1.05 }}
    >
      {children}
    </motion.div>
  )
}

export { GlowBadge }
