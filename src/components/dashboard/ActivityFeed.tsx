import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Activity as ActivityIcon, AlertCircle, Users, Filter } from "lucide-react"
import { ActivityCard, Activity } from "./ActivityCard"
import { useActivityFeed } from "@/hooks/activity/useActivityFeed"
import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { IconCircle } from "@/components/ui/icon-circle"
import { cn } from "@/lib/utils"

type ActivityFilter = 'all' | 'status_change' | 'task_added' | 'document_added'

const filterLabels = {
  all: 'Tous',
  status_change: 'Statuts',
  task_added: 'Tâches',
  document_added: 'Documents'
}

export function ActivityFeed() {
  const { myActivity, requiredActions, teamActivity, isLoading } = useActivityFeed()
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all')

  const filterActivities = (activities: Activity[]) => {
    if (activeFilter === 'all') return activities
    return activities.filter(a => a.type === activeFilter)
  }

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-success" />
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={`activity-feed-skeleton-${i}`} className="h-32 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      {/* Premium accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-success" />
      
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <IconCircle 
              icon={ActivityIcon} 
              variant="gradient" 
              color="primary" 
              size="md"
            />
            <div>
              <CardTitle className="text-lg">
                Mon Activité Récente & Actions Requises
              </CardTitle>
              <CardDescription className="text-sm mt-1">
                Suivez vos modifications et les actions urgentes nécessitant votre attention
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 lg:p-6">
        <Tabs defaultValue="my-activity" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
            <TabsList className="grid w-full sm:w-auto grid-cols-3 gap-1 bg-muted/50 p-1">
              <TabsTrigger 
                value="my-activity" 
                className="text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <ActivityIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                Mon Activité
                {myActivity.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {myActivity.length}
                  </Badge>
                )}
              </TabsTrigger>
              
              <TabsTrigger 
                value="required-actions" 
                className="text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                Actions
                {requiredActions.length > 0 && (
                  <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs animate-pulse">
                    {requiredActions.length}
                  </Badge>
                )}
              </TabsTrigger>
              
              <TabsTrigger 
                value="team-activity" 
                className="text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                Équipe
                {teamActivity.length > 0 && (
                  <Badge variant="outline" className="ml-1 px-1.5 py-0 text-xs">
                    {teamActivity.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Quick filters - Desktop */}
            <div className="hidden sm:flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              {(Object.keys(filterLabels) as ActivityFilter[]).map(filter => (
                <Button
                  key={filter}
                  variant={activeFilter === filter ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    "text-xs h-7 px-2.5 transition-all duration-200",
                    activeFilter === filter && "shadow-glow-blue"
                  )}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filterLabels[filter]}
                </Button>
              ))}
            </div>

            {/* Quick filters - Mobile */}
            <div className="sm:hidden flex items-center gap-2 w-full">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as ActivityFilter)}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(filterLabels) as ActivityFilter[]).map(filter => (
                    <SelectItem key={filter} value={filter} className="text-xs">
                      {filterLabels[filter]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* My Activity */}
          <TabsContent value="my-activity" className="space-y-3 mt-4">
            {filterActivities(myActivity).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-3">
                  <ActivityIcon className="w-12 h-12 opacity-30" />
                </div>
                <p className="font-medium">Aucune activité récente</p>
                <p className="text-xs mt-1">Vos modifications apparaîtront ici</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filterActivities(myActivity).map((activity, index) => (
                  <ActivityCard key={activity.id} activity={activity} index={index} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Required Actions */}
          <TabsContent value="required-actions" className="space-y-3 mt-4">
            {filterActivities(requiredActions).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <div className="p-4 rounded-full bg-success/10 w-fit mx-auto mb-3">
                  <AlertCircle className="w-12 h-12 text-success opacity-50" />
                </div>
                <p className="font-medium">Aucune action requise</p>
                <p className="text-xs mt-1">Vous êtes à jour sur tous vos dossiers</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filterActivities(requiredActions).map((activity, index) => (
                  <ActivityCard key={activity.id} activity={activity} index={index} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Team Activity */}
          <TabsContent value="team-activity" className="space-y-3 mt-4">
            {filterActivities(teamActivity).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-3">
                  <Users className="w-12 h-12 opacity-30" />
                </div>
                <p className="font-medium">Aucune activité d'équipe récente</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filterActivities(teamActivity).map((activity, index) => (
                  <ActivityCard key={activity.id} activity={activity} index={index} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
