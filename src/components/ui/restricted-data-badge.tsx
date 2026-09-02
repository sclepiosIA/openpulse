import { Badge } from "@/components/ui/badge"
import { AlertCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface RestrictedDataBadgeProps {
  className?: string
}

export function RestrictedDataBadge({ className }: RestrictedDataBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-xs gap-1 ${className}`}>
            <AlertCircle className="h-3 w-3" />
            Données restreintes
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Lecture limitée par les permissions de sécurité</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}