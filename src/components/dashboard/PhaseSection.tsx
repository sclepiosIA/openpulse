import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { useState } from "react"
import { StatusCard } from "./StatusCard"
import { cn, formatNumber } from "@/lib/utils"

interface StatusData {
  count: number
  percentage: number
  totalPassages: number
  totalValue: number
}

interface PhaseSectionProps {
  name: string
  icon: React.ReactNode
  color: string
  statuses: {
    name: string
    data: StatusData
    icon: React.ReactNode
    colorClasses: string
  }[]
  onStatusClick: (status: string) => void
}

export function PhaseSection({ name, icon, color, statuses, onStatusClick }: PhaseSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const totalCount = statuses.reduce((sum, s) => sum + s.data.count, 0)
  const totalValue = statuses.reduce((sum, s) => sum + s.data.totalValue, 0)

  if (totalCount === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          "w-full flex items-center justify-between p-4 rounded-lg hover:bg-accent/50 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white", color)}>
            {icon}
          </div>
          <div className="text-left">
            <h4 className="font-semibold text-base">{name}</h4>
            <div className="text-sm text-muted-foreground">
              {totalCount} établissements • {formatNumber(totalValue)}€
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{totalCount}</Badge>
          <ChevronDown className={cn(
            "h-5 w-5 transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-2 pb-4 px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {statuses
            .filter(s => s.data.count > 0)
            .map((status) => (
              <StatusCard
                key={status.name}
                statut={status.name}
                count={status.data.count}
                totalValue={status.data.totalValue}
                totalPassages={status.data.totalPassages}
                percentage={status.data.percentage}
                icon={status.icon}
                colorClasses={status.colorClasses}
                onClick={() => onStatusClick(status.name)}
              />
            ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
