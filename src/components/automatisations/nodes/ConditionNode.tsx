import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { useWorkflowExecution } from '@/contexts/WorkflowExecutionContext';
import { NodeStatusBadge, getNodeRingClass } from '../NodeStatusBadge';
import { getIssuesForNode } from '@/lib/workflow/validateGraph';

export const ConditionNode = memo(({ id, data, selected }: NodeProps) => {
  const cfg = (data as any).config || {};
  const { nodeStatuses, validationIssues } = useWorkflowExecution();
  const exec = nodeStatuses[id];
  const issues = getIssuesForNode(validationIssues, id);
  const ringExec = getNodeRingClass(exec, issues);
  const branchTaken = (exec?.output as any)?.branch as 'true' | 'false' | undefined;

  return (
    <div
      className={`relative px-4 py-3 rounded-lg border-2 bg-gradient-to-br from-amber-500/10 to-amber-500/5 shadow-sm min-w-[200px] ${
        selected ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-amber-500/40'
      } ${ringExec}`}
    >
      <NodeStatusBadge execution={exec} issues={issues} />
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-md bg-amber-500/20">
          <GitBranch className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          Condition
        </span>
      </div>
      <div className="text-sm font-medium text-foreground">{(data as any).label || 'Condition'}</div>
      {cfg.field && (
        <div className="text-xs text-muted-foreground mt-1 truncate">
          {cfg.field} {cfg.operator} {String(cfg.value ?? '')}
        </div>
      )}
      <div className="flex justify-between mt-2 text-[10px]">
        <span className={branchTaken === 'true' ? 'text-emerald-600 font-bold' : 'text-emerald-600'}>
          ✓ vrai{branchTaken === 'true' ? ' ←' : ''}
        </span>
        <span className={branchTaken === 'false' ? 'text-red-600 font-bold' : 'text-red-600'}>
          ✗ faux{branchTaken === 'false' ? ' ←' : ''}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: '25%' }}
        className="!bg-emerald-500 !w-3 !h-3"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: '75%' }}
        className="!bg-red-500 !w-3 !h-3"
      />
    </div>
  );
});
ConditionNode.displayName = 'ConditionNode';
