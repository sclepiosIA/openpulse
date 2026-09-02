import * as React from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface StarRatingProps {
  value: number
  onChange: (value: number) => void
  max?: number
  size?: number
  className?: string
  showValue?: boolean
  labels?: string[]
}

const StarRating = React.forwardRef<HTMLDivElement, StarRatingProps>(
  ({ value, onChange, max = 5, size = 24, className, showValue = true, labels = [] }, ref) => {
    const [hoverValue, setHoverValue] = React.useState<number | null>(null)

    const getLabel = (val: number) => {
      if (labels.length === 0) return ""
      const index = Math.max(0, Math.min(val - 1, labels.length - 1))
      return labels[index]
    }

    return (
      <div ref={ref} className={cn("flex flex-col gap-2", className)}>
        <div className="flex items-center gap-1">
          {Array.from({ length: max }, (_, i) => {
            const starValue = i + 1
            const isFilled = starValue <= (hoverValue ?? value)
            
            return (
              <button
                key={i}
                type="button"
                onClick={() => onChange(starValue)}
                onMouseEnter={() => setHoverValue(starValue)}
                onMouseLeave={() => setHoverValue(null)}
                className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                aria-label={`${starValue} étoile${starValue > 1 ? 's' : ''}`}
              >
                <Star
                  size={size}
                  className={cn(
                    "transition-colors",
                    isFilled
                      ? "fill-yellow-500 text-yellow-500"
                      : "fill-none text-muted-foreground"
                  )}
                />
              </button>
            )
          })}
        </div>
        {showValue && (
          <div className="text-sm text-muted-foreground">
            {value > 0 ? (
              <>
                <span className="font-medium text-foreground">{value}/{max}</span>
                {getLabel(value) && <span className="ml-2">- {getLabel(value)}</span>}
              </>
            ) : (
              <span>Non évalué</span>
            )}
          </div>
        )}
      </div>
    )
  }
)
StarRating.displayName = "StarRating"

export { StarRating }
