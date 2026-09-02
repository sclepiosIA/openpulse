import { Badge } from '@/components/ui/badge'
import { safeNum } from '@/lib/formatters'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getHealthBadgeColor, getHealthIcon, getHealthLabel } from '@/hooks/crm/useCustomerHealth'
import type { CustomerHealthStatus, CustomerHealthScore } from '@/hooks/crm/useCustomerHealth'

interface CustomerHealthIndicatorProps {
  status: CustomerHealthStatus
  score?: number
  healthData?: CustomerHealthScore
  size?: 'sm' | 'md' | 'lg'
  showScore?: boolean
}

export function CustomerHealthIndicator({
  status,
  score,
  healthData,
  size = 'md',
  showScore = false,
}: CustomerHealthIndicatorProps) {
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  const content = (
    <Badge className={`${getHealthBadgeColor(status)} ${sizeClasses[size]}`}>
      {getHealthIcon(status)} {getHealthLabel(status)}
      {showScore && score !== undefined && ` (${score})`}
    </Badge>
  )

  if (!healthData || status === 'onboarding') {
    return content
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            {score !== undefined && (
              <p className="font-semibold text-sm">Score de santé: {score}/100</p>
            )}

            {healthData.factors && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Facteurs:</p>
                <div className="text-xs space-y-0.5">
                  <div className="flex justify-between">
                    <span>Adoption:</span>
                    <span className="font-medium">
                      {safeNum(healthData.factors.adoption).toFixed(0)}/100
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Support:</span>
                    <span className="font-medium">
                      {safeNum(healthData.factors.support).toFixed(0)}/100
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Paiement:</span>
                    <span className="font-medium">
                      {safeNum(healthData.factors.payment).toFixed(0)}/100
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Engagement:</span>
                    <span className="font-medium">
                      {safeNum(healthData.factors.engagement).toFixed(0)}/100
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Feedback:</span>
                    <span className="font-medium">
                      {safeNum(healthData.factors.feedback).toFixed(0)}/100
                    </span>
                  </div>
                </div>
              </div>
            )}

            {healthData.alerts.length > 0 && (
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Alertes:</p>
                <ul className="text-xs space-y-0.5">
                  {healthData.alerts.map((alert, idx) => (
                    <li key={idx}>• {alert}</li>
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
