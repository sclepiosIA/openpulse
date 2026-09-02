import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { Category } from "@/hooks/catalogue/useCategories"
import type { PhaseKey } from "@/config/phases"
import { PHASE_GROUPS } from "@/config/phases"

interface PhaseCategoriesProps {
  phase: PhaseKey
  categories: Category[]
  isLoading: boolean
}

export function PhaseCategories({ phase, categories, isLoading }: PhaseCategoriesProps) {
  const phaseConfig = PHASE_GROUPS[phase]

  if (isLoading) {
    return (
      <div className="flex gap-2 flex-wrap">
        {[1, 2, 3].map((i) => (
          <Skeleton key={`phase-categories-skeleton-${i}`} className="h-6 w-24" />
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="text-sm font-medium mb-2">
        Catégories disponibles pour la phase {phaseConfig.label} :
      </p>
      <div className="flex gap-2 flex-wrap">
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune catégorie configurée pour cette phase. 
            Les catégories attendues sont : {phaseConfig.categories.join(", ")}
          </p>
        ) : (
          categories.map((cat) => (
            <Badge
              key={cat.id}
              variant="outline"
              style={{
                borderColor: cat.couleur,
                backgroundColor: `${cat.couleur}15`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full mr-1.5"
                style={{ backgroundColor: cat.couleur }}
              />
              {cat.nom}
            </Badge>
          ))
        )}
      </div>
    </div>
  )
}
