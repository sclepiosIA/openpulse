import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function MarketingStatistiques() {
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <header className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <BarChart3 className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Statistiques marketing</h1>
          <p className="text-sm text-muted-foreground">
            Suivi des performances des actions marketing.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Bientôt disponible</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Cette page accueillera prochainement les indicateurs et graphiques de suivi marketing.
          Indique-moi quels KPIs et visualisations tu souhaites y voir apparaître.
        </CardContent>
      </Card>
    </div>
  )
}
