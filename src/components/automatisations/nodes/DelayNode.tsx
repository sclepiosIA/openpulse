import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { useWorkflowExecution } from '@/contexts/WorkflowExecutionContext';
import { NodeStatusBadge, getNodeRingClass } from '../NodeStatusBadge';
import { getIssuesForNode } from '@/lib/workflow/validateGraph';

export const DelayNode = memo(({ id, data, selected }: NodeProps) => {
  const cfg = (data as any).config || {};
  const { nodeStatuses, validationIssues } = useWorkflowExecution();
  const exec = nodeStatuses[id];
  const issues = getIssuesForNode(validationIssues, id);
  const ringExec = getNodeRingClass(exec, issues);

  return (
    <div
      className={`relative px-4 py-3 rounded-lg border-2 bg-gradient-to-br from-blue-500/10 to-blue-500/5 shadow-sm min-w-[200px] ${
        selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-blue-500/40'
      } ${ringExec}`}
    >
      <NodeStatusBadge execution={exec} issues={issues} />
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-md bg-blue-500/20">
          <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
          Délai
        </span>
      </div>
      <div className="text-sm font-medium text-foreground">
        Attendre {cfg.amount ?? 1} {cfg.unit ?? 'minutes'}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
});
DelayNode.displayName = 'DelayNode';
