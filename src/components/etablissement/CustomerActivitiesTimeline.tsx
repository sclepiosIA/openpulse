import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Plus, Loader2 } from 'lucide-react'
import { useCustomerActivities } from '@/hooks/crm/useCustomerActivities'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

interface CustomerActivitiesTimelineProps {
  etablissementId: string
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
  incident: '⚠️',
  call: '📞',
  visio: '🖥️',
  demo: '🎬',
  document: '📄',
  linkedin: '💼'
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
  incident: 'Incident',
  call: 'Appel',
  visio: 'Visio',
  demo: 'Démo',
  document: 'Document',
  linkedin: 'LinkedIn'
}

export function CustomerActivitiesTimeline({ etablissementId }: CustomerActivitiesTimelineProps) {
  const { data: activities, isLoading } = useCustomerActivities(etablissementId, { limit: 50 })

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
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Historique client
          </CardTitle>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter activité
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!activities || activities.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Aucune activité enregistrée
          </p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex gap-4 p-4 border rounded-lg hover:bg-accent/5 transition-colors">
                <div className="text-2xl">{activityIcons[activity.activity_type]}</div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{activity.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.activity_date), { 
                          addSuffix: true, 
                          locale: fr 
                        })}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {activityLabels[activity.activity_type]}
                    </Badge>
                  </div>
                  {activity.description && (
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                  )}
                  {activity.metadata && Object.keys(activity.metadata).length > 0 && activity.metadata.generated !== true && (
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                      {Object.entries(activity.metadata).map(([key, value]) => (
                        <div key={key}>
                          <span className="font-medium">{key}:</span> {String(value)}
                        </div>
                      ))}
                    </div>
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
