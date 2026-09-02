import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, Clock, AlertTriangle, Circle } from "lucide-react"
import { Task } from "@/types/gantt"

interface TaskStatsOverviewProps {
  tasks: Task[]
  onFilterClick?: (status: string) => void
}

export function TaskStatsOverview({ tasks, onFilterClick }: TaskStatsOverviewProps) {
  const stats = [
    {
      status: "A faire",
      icon: Circle,
      count: tasks.filter(t => t.statut === "A faire").length,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      borderColor: "border-l-blue-500"
    },
    {
      status: "En cours",
      icon: Clock,
      count: tasks.filter(t => t.statut === "En cours").length,
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950",
      borderColor: "border-l-orange-500"
    },
    {
      status: "Bloqué",
      icon: AlertTriangle,
      count: tasks.filter(t => t.statut === "Bloqué").length,
      color: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-950",
      borderColor: "border-l-red-500"
    },
    {
      status: "Terminé",
      icon: CheckCircle2,
      count: tasks.filter(t => t.statut === "Terminé").length,
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950",
      borderColor: "border-l-green-500"
    }
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card 
          key={stat.status}
          className={`cursor-pointer hover:shadow-md transition-all border-l-4 ${stat.borderColor} ${stat.bgColor}`}
          onClick={() => onFilterClick?.(stat.status)}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.count}</p>
                <p className="text-xs text-muted-foreground">{stat.status}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
