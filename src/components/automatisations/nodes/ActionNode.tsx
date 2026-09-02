import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Sparkles } from 'lucide-react';
import { ACTION_LABELS, type WorkflowActionType } from '@/types/workflow';
import { useWorkflowExecution } from '@/contexts/WorkflowExecutionContext';
import { NodeStatusBadge, getNodeRingClass } from '../NodeStatusBadge';
import { getIssuesForNode } from '@/lib/workflow/validateGraph';

export const ActionNode = memo(({ id, data, selected }: NodeProps) => {
  const at = (data as any).action_type as WorkflowActionType | undefined;
  const { nodeStatuses, validationIssues } = useWorkflowExecution();
  const exec = nodeStatuses[id];
  const issues = getIssuesForNode(validationIssues, id);
  const ringExec = getNodeRingClass(exec, issues);

  return (
    <div
      className={`relative px-4 py-3 rounded-lg border-2 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 shadow-sm min-w-[200px] ${
        selected ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-emerald-500/40'
      } ${ringExec}`}
    >
      <NodeStatusBadge execution={exec} issues={issues} />
      <Handle type="target" position={Position.Top} className="!bg-emerald-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-md bg-emerald-500/20">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          Action
        </span>
      </div>
      <div className="text-sm font-medium text-foreground">
        {(data as any).label || (at ? ACTION_LABELS[at] : 'Action')}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="success"
        style={{ left: '35%' }}
        className="!bg-emerald-500 !w-3 !h-3"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="error"
        style={{ left: '70%' }}
        className="!bg-red-500 !w-3 !h-3"
        title="Branche d'erreur"
      />
      <div className="absolute -bottom-5 left-[33%] text-[9px] text-emerald-600 font-medium">ok</div>
      <div className="absolute -bottom-5 left-[68%] text-[9px] text-red-600 font-medium">err</div>
    </div>
  );
});
ActionNode.displayName = 'ActionNode';
