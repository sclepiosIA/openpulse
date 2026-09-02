import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { TRIGGER_LABELS, type WorkflowTriggerType } from '@/types/workflow';
import { useWorkflowExecution } from '@/contexts/WorkflowExecutionContext';
import { NodeStatusBadge, getNodeRingClass } from '../NodeStatusBadge';
import { getIssuesForNode } from '@/lib/workflow/validateGraph';

export const TriggerNode = memo(({ id, data, selected }: NodeProps) => {
  const tt = (data as any).trigger_type as WorkflowTriggerType | undefined;
  const { nodeStatuses, validationIssues } = useWorkflowExecution();
  const exec = nodeStatuses[id];
  const issues = getIssuesForNode(validationIssues, id);
  const ringExec = getNodeRingClass(exec, issues);

  return (
    <div
      className={`relative px-4 py-3 rounded-lg border-2 bg-gradient-to-br from-primary/10 to-primary/5 shadow-sm min-w-[200px] ${
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-primary/40'
      } ${ringExec}`}
    >
      <NodeStatusBadge execution={exec} issues={issues} />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-md bg-primary/20">
          <Zap className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">Déclencheur</span>
      </div>
      <div className="text-sm font-medium text-foreground">
        {(data as any).label || (tt ? TRIGGER_LABELS[tt] : 'Trigger')}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" />
    </div>
  );
});
TriggerNode.displayName = 'TriggerNode';
