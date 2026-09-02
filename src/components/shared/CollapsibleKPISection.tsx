import { useState, useEffect, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { ChevronDown, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

interface CollapsibleKPISectionProps {
  /** Unique storage key for localStorage persistence */
  storageKey: string
  /** Content to render when expanded */
  children: ReactNode
  /** Whether to show by default on first visit (default: false) */
  defaultOpen?: boolean
  /** Label for the toggle button (default: "KPIs") */
  label?: string
  /** Additional className for the container */
  className?: string
  /** Show icon in toggle button (default: true) */
  showIcon?: boolean
}

export function CollapsibleKPISection({
  storageKey,
  children,
  defaultOpen = false,
  label = "KPIs",
  className,
  showIcon = true
}: CollapsibleKPISectionProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey)
      return stored !== null ? stored === 'true' : defaultOpen
    }
    return defaultOpen
  })

  const handleToggle = (open: boolean) => {
    setIsOpen(open)
    localStorage.setItem(storageKey, String(open))
  }

  return (
    <Collapsible open={isOpen} onOpenChange={handleToggle} className={className}>
      <CollapsibleContent className="animate-in slide-in-from-top-2 duration-200">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

interface KPIToggleButtonProps {
  /** Unique storage key - must match CollapsibleKPISection */
  storageKey: string
  /** Label for the button (default: "KPIs") */
  label?: string
  /** Show icon (default: true) */
  showIcon?: boolean
  /** Additional className */
  className?: string
  /** Callback when toggled */
  onToggle?: (isOpen: boolean) => void
}

export function KPIToggleButton({
  storageKey,
  label,
  showIcon = true,
  className,
  onToggle
}: KPIToggleButtonProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(storageKey) === 'true'
    }
    return false
  })

  // Sync with localStorage changes (e.g., from CollapsibleKPISection)
  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem(storageKey)
      setIsOpen(stored === 'true')
    }
    
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [storageKey])

  const handleClick = () => {
    const newValue = !isOpen
    setIsOpen(newValue)
    localStorage.setItem(storageKey, String(newValue))
    onToggle?.(newValue)
    
    // Dispatch storage event for other components
    window.dispatchEvent(new StorageEvent('storage', { key: storageKey }))
  }

  // If a custom className is passed, use it entirely (for glassmorphism headers)
  const hasCustomClass = className && className.includes('bg-');
  
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      aria-label={label ? `${isOpen ? 'Masquer' : 'Afficher'} les ${label}` : (isOpen ? 'Masquer les KPIs' : 'Afficher les KPIs')}
      aria-expanded={isOpen}
      className={cn(
        !hasCustomClass && "h-7 px-2 text-xs",
        className
      )}
    >
      {showIcon && <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />}
      {label && <span className="ml-1 hidden sm:inline">{label}</span>}
      <ChevronDown className={cn("h-3 w-3 ml-1 transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
    </Button>
  )
}
