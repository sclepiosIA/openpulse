import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface EtablissementProgressProps {
  progression: number
}

export function EtablissementProgress({ progression }: EtablissementProgressProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Progression générale</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progression</span>
          <span className="text-sm font-medium">{progression}%</span>
        </div>
        <Progress value={progression || 0} className="h-3" />
      </CardContent>
    </Card>
  )
}