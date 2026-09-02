
import { getWorkloadColor, getWorkloadLabel } from "@/lib/teamUtils";

interface WorkloadIndicatorProps {
  workload: 'low' | 'medium' | 'high';
  taskCount?: number;
}

export function WorkloadIndicator({ workload, taskCount }: WorkloadIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${getWorkloadColor(workload)}`} />
      <span className="text-xs text-muted-foreground">
        {getWorkloadLabel(workload)}
        {taskCount !== undefined && ` (${taskCount})`}
      </span>
    </div>
  );
}
