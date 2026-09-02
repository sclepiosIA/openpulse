import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getHealthBadgeColor, getHealthIcon, getHealthLabel } from '@/hooks/production/useDeploymentHealth'
import type { DeploymentHealthStatus } from '@/hooks/production/useDeploymentFilters'

interface DeploymentHealthIndicatorProps {
  status: DeploymentHealthStatus
  score: number
  reasons?: string[]
  size?: 'sm' | 'md' | 'lg'
  showScore?: boolean
}

export function DeploymentHealthIndicator({
  status,
  score,
  reasons = [],
  size = 'md',
  showScore = false
}: DeploymentHealthIndicatorProps) {
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const content = (
    <Badge className={`${getHealthBadgeColor(status)} ${sizeClasses[size]} gap-1.5`}>
      <span>{getHealthIcon(status)}</span>
      <span>{getHealthLabel(status)}</span>
      {showScore && <span className="ml-1">({score}%)</span>}
    </Badge>
  )

  if (reasons.length === 0) {
    return content
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-semibold text-xs">Score de santé: {score}%</p>
            {reasons.length > 0 && (
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Problèmes détectés:</p>
                <ul className="text-xs space-y-0.5">
                  {reasons.map((reason, idx) => (
                    <li key={idx}>• {reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
