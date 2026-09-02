import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePartenaireActivities } from "@/hooks/crm/usePartenaireActivities";
import { Mail, UserPlus, TrendingUp, FileText, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface PartenaireActivitiesTimelineProps {
  partenaireId: string;
}

export function PartenaireActivitiesTimeline({ partenaireId }: PartenaireActivitiesTimelineProps) {
  const { data: activities = [], isLoading } = usePartenaireActivities(partenaireId);
  
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'contact_added': return <UserPlus className="h-4 w-4" />;
      case 'status_change': return <TrendingUp className="h-4 w-4" />;
      case 'note': return <FileText className="h-4 w-4" />;
      case 'meeting': return <Calendar className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };
  
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400';
      case 'contact_added': return 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400';
      case 'status_change': return 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400';
      case 'note': return 'bg-gray-100 text-foreground dark:bg-gray-800 dark:text-muted-foreground';
      case 'meeting': return 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400';
      default: return 'bg-gray-100 text-foreground dark:bg-gray-800 dark:text-muted-foreground';
    }
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline des activités</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Timeline des activités</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Aucune activité récente
          </p>
        ) : (
          <div className="space-y-4">
            {activities.filter(a => a.date).map((activity) => (
              <div key={activity.id} className="flex items-start gap-4">
                <div className={`p-2 rounded-full ${getActivityColor(activity.type)} shrink-0`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{activity.title}</p>
                  {activity.description && (
                    <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                  )}
                  <Badge variant="outline" className="text-xs mt-2">
                    {formatDistanceToNow(new Date(activity.date!), { 
                      addSuffix: true, 
                      locale: fr 
                    })}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
