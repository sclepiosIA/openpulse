import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCalendarNotifications } from '@/hooks/calendar/useCalendarNotifications';
import { Bell, AlertTriangle, Clock } from 'lucide-react';

import { Task } from '@/types/gantt';

interface CalendarNotificationsProps {
  tasks: Task[];
  currentUserId?: string;
  onTaskClick: (taskId: string) => void;
}

export function CalendarNotifications({ tasks, currentUserId, onTaskClick }: CalendarNotificationsProps) {
  const notifications = useCalendarNotifications(tasks, currentUserId);

  const getIcon = (type: string) => {
    switch (type) {
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'today':
      case 'deadline':
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative"
          aria-label={
            notifications.length > 0
              ? `Notifications (${notifications.length} non lue${notifications.length > 1 ? 's' : ''})`
              : 'Notifications'
          }
          title="Notifications"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {notifications.length > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
              aria-hidden="true"
            >
              {notifications.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <h4 className="font-medium">Notifications</h4>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune notification
            </p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => onTaskClick(notif.taskId)}
                    className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      {getIcon(notif.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{notif.taskTitle}</p>
                        <p className="text-xs text-muted-foreground">{notif.message}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}