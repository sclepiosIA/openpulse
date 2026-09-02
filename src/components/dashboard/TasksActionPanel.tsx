import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, User, BarChart3, ArrowRight, CheckCircle2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { IconCircle } from "@/components/ui/icon-circle"
import { motion } from "framer-motion"

interface Task {
  id: string
  titre: string
  statut?: string
  echeance?: string
  etablissement?: {
    nom: string
  }
}

interface TasksActionPanelProps {
  urgentTasks: Task[]
  myTasks: Task[]
  allTasks: Task[]
  myTasksProgress: number
  globalProgress: number
}

export function TasksActionPanel({
  urgentTasks,
  myTasks,
  allTasks,
  myTasksProgress,
  globalProgress
}: TasksActionPanelProps) {
  const navigate = useNavigate()

  const formatDeadline = (deadline: string) => {
    try {
      return formatDistanceToNow(new Date(deadline), {
        addSuffix: true,
        locale: fr
      })
    } catch {
      return ''
    }
  }

  const tabs = [
    {
      value: "urgent",
      label: "Urgentes",
      icon: AlertTriangle,
      count: urgentTasks.length,
      tasks: urgentTasks,
      color: "destructive" as const,
      colorClass: "text-destructive",
      badgeVariant: "destructive" as const,
      progress: undefined,
      progressLabel: "",
      description: "< 7 jours",
      route: '/projets?filter=urgent',
      accentGradient: "from-destructive to-red-700"
    },
    {
      value: "my-tasks",
      label: "Mes tâches",
      icon: User,
      count: myTasks.length,
      tasks: myTasks,
      color: "primary" as const,
      colorClass: "text-primary",
      badgeVariant: "default" as const,
      progress: myTasksProgress,
      progressLabel: "Taux de complétion",
      description: "Assignées à moi",
      route: '/projets?filter=my-tasks',
      accentGradient: "from-primary to-primary-dark"
    },
    {
      value: "all",
      label: "Toutes",
      icon: BarChart3,
      count: allTasks.length,
      tasks: allTasks,
      color: "success" as const,
      colorClass: "text-success",
      badgeVariant: "secondary" as const,
      progress: globalProgress,
      progressLabel: "Progression globale",
      description: "Vue d'ensemble",
      route: '/projets',
      accentGradient: "from-success to-primary-light"
    }
  ]

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      {/* Premium accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-success" />
      
      <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
        <CardTitle className="flex items-center gap-3">
          <IconCircle 
            icon={BarChart3} 
            variant="gradient" 
            color="primary" 
            size="md"
          />
          <span>Mes Tâches</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col">
        <Tabs defaultValue="urgent" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <TabsTrigger 
                  key={tab.value} 
                  value={tab.value} 
                  className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {tab.label}
                  {tab.count > 0 && (
                    <Badge 
                      variant={tab.badgeVariant} 
                      className={cn(
                        "ml-1 px-1.5 py-0 text-xs",
                        tab.value === 'urgent' && tab.count > 0 && "animate-pulse"
                      )}
                    >
                      {tab.count}
                    </Badge>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {tabs.map(tab => (
            <TabsContent 
              key={tab.value} 
              value={tab.value} 
              className="flex-1 space-y-4 mt-4 flex flex-col"
            >
              {/* Impact number */}
              <motion.div 
                className="flex items-center justify-between"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div>
                  <div className={cn("text-4xl font-black", tab.colorClass)}>
                    {tab.count}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {tab.description}
                  </p>
                </div>
                <IconCircle 
                  icon={tab.icon} 
                  variant={tab.count > 0 ? "gradient" : "soft"} 
                  color={tab.color}
                  size="lg"
                />
              </motion.div>

              {/* Progress bar with gradient */}
              {tab.progress !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{tab.progressLabel}</span>
                    <span className={cn("font-bold", tab.colorClass)}>{tab.progress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className={cn("h-full rounded-full bg-gradient-to-r", tab.accentGradient)}
                      initial={{ width: 0 }}
                      animate={{ width: `${tab.progress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )}

              {/* Task list with border accent */}
              {tab.tasks.length > 0 ? (
                <div className="space-y-2 pt-2 border-t flex-1 overflow-y-auto">
                  <p className="text-sm font-medium text-muted-foreground">Aperçu :</p>
                  <ul className="space-y-2">
                    {tab.tasks.slice(0, 3).map((task, index) => (
                      <motion.li 
                        key={task.id} 
                        className={cn(
                          "text-sm flex items-start gap-2 p-2 rounded-lg border-l-2",
                          "bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer",
                          tab.value === 'urgent' && "border-l-destructive",
                          tab.value === 'my-tasks' && "border-l-primary",
                          tab.value === 'all' && "border-l-success"
                        )}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => navigate(`/projets`)}
                      >
                        <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">
                            {task.titre}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {task.etablissement?.nom}
                            {task.echeance && ` • ${formatDeadline(task.echeance)}`}
                          </p>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                  {tab.tasks.length > 3 && (
                    <p className="text-xs text-muted-foreground pt-1">
                      et {tab.tasks.length - 3} autre{tab.tasks.length - 3 > 1 ? 's' : ''}...
                    </p>
                  )}
                </div>
              ) : (
                <div className="pt-2 border-t text-center py-8 flex-1 flex flex-col items-center justify-center">
                  <div className="p-3 rounded-full bg-success/10 mb-2">
                    <CheckCircle2 className="h-8 w-8 text-success opacity-50" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {tab.value === 'urgent' && '🎉 Tout est sous contrôle !'}
                    {tab.value === 'my-tasks' && 'Aucune tâche assignée'}
                    {tab.value === 'all' && 'Aucune tâche'}
                  </p>
                </div>
              )}

              {/* CTA button with hover glow */}
              <Button
                variant="outline"
                className={cn(
                  "w-full mt-auto group",
                  "hover:shadow-glow-blue hover:border-primary transition-all duration-300"
                )}
                onClick={() => navigate(tab.route)}
              >
                Voir toutes les tâches
                <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
