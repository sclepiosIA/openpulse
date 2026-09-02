import { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

interface CRMTableWrapperProps {
  children: ReactNode
  className?: string
  /** Minimum width for the table scroll container */
  minWidth?: string
  /** Whether to wrap in a Card component */
  withCard?: boolean
}

/**
 * Wrapper component for CRM tables providing consistent styling,
 * horizontal scroll behavior, and responsive handling.
 */
export function CRMTableWrapper({ 
  children, 
  className,
  minWidth = "900px",
  withCard = true
}: CRMTableWrapperProps) {
  const content = (
    <div className="overflow-x-auto scrollbar-hide">
      <div 
        className="rounded-md border inline-block min-w-full"
        style={{ minWidth }}
      >
        {children}
      </div>
    </div>
  )

  if (!withCard) return content

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-0">
        {content}
      </CardContent>
    </Card>
  )
}
