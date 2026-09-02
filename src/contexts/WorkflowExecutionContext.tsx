import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ValidationIssue } from '@/lib/workflow/validateGraph';

export type NodeExecStatus = 'pending' | 'success' | 'failed' | 'simulated' | 'skipped' | 'scheduled';

export interface NodeExecution {
  status: NodeExecStatus;
  error?: string;
  output?: Record<string, unknown> | null;
  durationMs?: number | null;
  branch?: 'true' | 'false';
}

interface ExecCtx {
  nodeStatuses: Record<string, NodeExecution>;
  setNodeStatuses: (s: Record<string, NodeExecution>) => void;
  clearStatuses: () => void;
  validationIssues: ValidationIssue[];
  setValidationIssues: (i: ValidationIssue[]) => void;
  executedEdgeIds: Set<string>;
  setExecutedEdgeIds: (s: Set<string>) => void;
  lastRunMeta: { run_id: string; is_dry_run: boolean; at: string } | null;
  setLastRunMeta: (m: { run_id: string; is_dry_run: boolean; at: string } | null) => void;
}

const Ctx = createContext<ExecCtx | null>(null);

export function WorkflowExecutionProvider({ children }: { children: ReactNode }) {
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeExecution>>({});
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [executedEdgeIds, setExecutedEdgeIds] = useState<Set<string>>(new Set());
  const [lastRunMeta, setLastRunMeta] = useState<ExecCtx['lastRunMeta']>(null);

  const value = useMemo<ExecCtx>(
    () => ({
      nodeStatuses,
      setNodeStatuses,
      clearStatuses: () => {
        setNodeStatuses({});
        setExecutedEdgeIds(new Set());
        setLastRunMeta(null);
      },
      validationIssues,
      setValidationIssues,
      executedEdgeIds,
      setExecutedEdgeIds,
      lastRunMeta,
      setLastRunMeta,
    }),
    [nodeStatuses, validationIssues, executedEdgeIds, lastRunMeta]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkflowExecution() {
  const ctx = useContext(Ctx);
  // Fallback safe pour les nodes utilisés hors builder (templates, démo)
  if (!ctx) {
    return {
      nodeStatuses: {} as Record<string, NodeExecution>,
      setNodeStatuses: () => {},
      clearStatuses: () => {},
      validationIssues: [],
      setValidationIssues: () => {},
      executedEdgeIds: new Set<string>(),
      setExecutedEdgeIds: () => {},
      lastRunMeta: null,
      setLastRunMeta: () => {},
    } as ExecCtx;
  }
  return ctx;
}
