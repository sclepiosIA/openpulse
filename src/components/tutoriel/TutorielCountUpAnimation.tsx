/**
 * TutorielCountUpAnimation - Animation de comptage pour les KPIs
 */
import { memo, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface TutorielCountUpAnimationProps {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
  delay?: number
}

export const TutorielCountUpAnimation = memo(({ 
  value, 
  duration = 2000, 
  prefix = '', 
  suffix = '',
  decimals = 0,
  className,
  delay = 0
}: TutorielCountUpAnimationProps) => {
  const [displayValue, setDisplayValue] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)

  useEffect(() => {
    const startTimeout = setTimeout(() => {
      setHasStarted(true)
    }, delay)

    return () => clearTimeout(startTimeout)
  }, [delay])

  useEffect(() => {
    if (!hasStarted) return

    const startTime = Date.now()
    const startValue = 0

    const animate = () => {
      const now = Date.now()
      const progress = Math.min((now - startTime) / duration, 1)
      
      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3)
      
      const current = startValue + (value - startValue) * eased
      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration, hasStarted])

  const formattedValue = decimals > 0 
    ? displayValue.toFixed(decimals)
    : Math.round(displayValue).toLocaleString('fr-FR')

  return (
    <span className={cn("tabular-nums transition-opacity", !hasStarted && "opacity-0", className)}>
      {prefix}{formattedValue}{suffix}
    </span>
  )
})

TutorielCountUpAnimation.displayName = 'TutorielCountUpAnimation'

/**
 * Animated progress bar
 */
interface TutorielProgressBarProps {
  value: number
  maxValue?: number
  duration?: number
  delay?: number
  className?: string
  color?: 'primary' | 'success' | 'warning' | 'destructive'
}

export const TutorielProgressBar = memo(({ 
  value, 
  maxValue = 100,
  duration = 1500,
  delay = 0,
  className,
  color = 'primary'
}: TutorielProgressBarProps) => {
  const [width, setWidth] = useState(0)
  
  useEffect(() => {
    const timeout = setTimeout(() => {
      setWidth((value / maxValue) * 100)
    }, delay)
    return () => clearTimeout(timeout)
  }, [value, maxValue, delay])

  const colorClasses = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    destructive: 'bg-destructive'
  }

  return (
    <div className={cn("h-2 bg-muted rounded-full overflow-hidden", className)}>
      <div 
        className={cn(
          "h-full rounded-full transition-all ease-out",
          colorClasses[color]
        )}
        style={{ 
          width: `${width}%`,
          transitionDuration: `${duration}ms`
        }}
      />
    </div>
  )
})

TutorielProgressBar.displayName = 'TutorielProgressBar'

/**
 * Animated chart bar
 */
interface TutorielChartBarProps {
  value: number
  maxValue: number
  label?: string
  delay?: number
  className?: string
}

export const TutorielChartBar = memo(({ 
  value, 
  maxValue, 
  label,
  delay = 0,
  className 
}: TutorielChartBarProps) => {
  const [height, setHeight] = useState(0)
  
  useEffect(() => {
    const timeout = setTimeout(() => {
      setHeight((value / maxValue) * 100)
    }, delay)
    return () => clearTimeout(timeout)
  }, [value, maxValue, delay])

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="h-32 w-8 bg-muted rounded-t-md relative overflow-hidden flex items-end">
        <div 
          className="w-full bg-primary rounded-t-md transition-all duration-1000 ease-out"
          style={{ height: `${height}%` }}
        />
      </div>
      {label && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  )
})

TutorielChartBar.displayName = 'TutorielChartBar'
