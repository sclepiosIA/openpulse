import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { TaskGroup, getGroupStats } from '@/lib/agendaUtils';
import { cn } from '@/lib/utils';

interface AgendaTimelineSectionProps {
  group: TaskGroup;
  onTaskClick: (task: any) => void;
  viewMode: 'compact' | 'detailed';
  onMarkDone?: (taskId: string) => void;
  onPostpone?: (taskId: string) => void;
  onArchive?: (taskId: string) => void;
}

export function AgendaTimelineSection({
  group,
  onTaskClick,
  viewMode,
  onMarkDone,
  onPostpone,
  onArchive,
}: AgendaTimelineSectionProps) {
  const [isOpen, setIsOpen] = useState(group.defaultOpen);
  const stats = getGroupStats(group.tasks);

  return (
    <div className="relative animate-fade-in">
      {/* Timeline dot */}
      <div
        className="absolute left-0 top-6 w-4 h-4 rounded-full border-4 border-background z-10"
        style={{ backgroundColor: group.color }}
      />

      {/* Timeline line (will be connected by parent container) */}
      <div className="absolute left-2 top-10 bottom-0 w-0.5 bg-border" />

      {/* Content */}
      <div className="ml-8">
        <Card className={cn(
          'border-l-4 transition-all duration-200',
          isOpen ? 'shadow-md' : 'shadow-sm hover:shadow-md'
        )} style={{ borderLeftColor: group.color }}>
          <CardHeader
            className="cursor-pointer select-none pb-3"
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform" />
                )}
                
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>{group.emoji}</span>
                  <span>{group.title}</span>
                </CardTitle>

                <Badge variant="secondary">
                  {group.tasks.length} tâche{group.tasks.length > 1 ? 's' : ''}
                </Badge>
              </div>

              {/* Section stats */}
              <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>📊</span>
                  <span>{stats.completionRate}% terminé</span>
                </div>
                
                {stats.avgDelay > 0 && (
                  <div className="flex items-center gap-2 text-destructive">
                    <span>⏰</span>
                    <span>{stats.avgDelay}j de retard moy.</span>
                  </div>
                )}

                {stats.assigneeCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span>👥</span>
                    <span>{stats.assigneeCount} responsable{stats.assigneeCount > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {isOpen && stats.total > 0 && (
              <div className="mt-3 space-y-1">
                <Progress value={stats.completionRate} className="h-1.5" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{stats.completed} / {stats.total} terminées</span>
                  <span>{stats.completionRate}%</span>
                </div>
              </div>
            )}
          </CardHeader>

          {isOpen && (
            <CardContent className="space-y-3 pt-0">
              {group.tasks.map((task, index) => (
                <div
                  key={task.id}
                  className="animate-fade-in"
                  style={{
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  <TaskCard
                    task={task}
                    onClick={() => onTaskClick(task)}
                    showDate={false}
                    compact={viewMode === 'compact'}
                    showQuickActions={true}
                    onMarkDone={onMarkDone}
                    onPostpone={onPostpone}
                    onArchive={onArchive}
                  />
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
