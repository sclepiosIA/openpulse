import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Loader2, Building2, Users } from 'lucide-react'
import { useGroupeActivities, useGroupeActivityStats } from '@/hooks/crm/useGroupeActivities'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Link } from 'react-router-dom'

interface GroupeActivitiesTimelineProps {
  groupeId: string
}

const activityIcons: Record<string, string> = {
  qbr: '📊',
  training: '🎓',
  support_ticket: '🎫',
  escalation: '🚨',
  renewal: '🔄',
  upsell: '💰',
  nps_survey: '📝',
  health_change: '❤️',
  note: '📌',
  meeting: '👥',
  email: '📧',
  incident: '⚠️'
}

const activityLabels: Record<string, string> = {
  qbr: 'QBR',
  training: 'Formation',
  support_ticket: 'Support',
  escalation: 'Escalation',
  renewal: 'Renouvellement',
  upsell: 'Upsell',
  nps_survey: 'Enquête NPS',
  health_change: 'Changement santé',
  note: 'Note',
  meeting: 'Réunion',
  email: 'Email',
  incident: 'Incident'
}

export function GroupeActivitiesTimeline({ groupeId }: GroupeActivitiesTimelineProps) {
  const { data: activities, isLoading } = useGroupeActivities(groupeId, { limit: 50 })
  const { stats } = useGroupeActivityStats(groupeId)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Historique Groupe
            </CardTitle>
            <CardDescription>
              Activités consolidées de tous les établissements
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {stats.total} activité{stats.total > 1 ? 's' : ''}
            </Badge>
            {stats.recentCount > 0 && (
              <Badge variant="outline" className="text-emerald-600">
                {stats.recentCount} ce mois
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{stats.byStatus.completed}</p>
            <p className="text-xs text-muted-foreground">Terminées</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{stats.byStatus.in_progress}</p>
            <p className="text-xs text-muted-foreground">En cours</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{stats.byStatus.scheduled}</p>
            <p className="text-xs text-muted-foreground">Planifiées</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{stats.recentCount}</p>
            <p className="text-xs text-muted-foreground">30 derniers jours</p>
          </div>
        </div>

        {!activities || activities.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              Aucune activité enregistrée pour les établissements de ce groupe
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {activities.map((activity) => (
              <div 
                key={activity.id} 
                className="flex gap-4 p-4 border rounded-lg hover:bg-accent/5 transition-colors"
              >
                <div className="text-2xl">{activityIcons[activity.activity_type] || '📋'}</div>
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{activity.title}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(activity.activity_date), { 
                            addSuffix: true, 
                            locale: fr 
                          })}
                        </span>
                        <span>•</span>
                        <Link 
                          to={`/etablissements/${activity.etablissement_id}`}
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          <Building2 className="h-3 w-3" />
                          {activity.etablissement_nom}
                        </Link>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline">
                        {activityLabels[activity.activity_type] || activity.activity_type}
                      </Badge>
                      <Badge 
                        variant={
                          activity.status === 'completed' ? 'default' :
                          activity.status === 'in_progress' ? 'secondary' : 'outline'
                        }
                      >
                        {activity.status === 'completed' ? 'Terminé' :
                         activity.status === 'in_progress' ? 'En cours' :
                         activity.status === 'scheduled' ? 'Planifié' : activity.status}
                      </Badge>
                    </div>
                  </div>
                  {activity.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{activity.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
