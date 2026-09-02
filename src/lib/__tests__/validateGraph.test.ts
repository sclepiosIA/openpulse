import { describe, it, expect } from 'vitest';
import { validateWorkflowGraph, getIssuesForNode } from '../workflow/validateGraph';
import type { Node, Edge } from '@xyflow/react';

const makeNode = (id: string, type: string, data: Record<string, unknown> = {}): Node =>
  ({ id, type, data, position: { x: 0, y: 0 } } as unknown as Node);

const makeEdge = (id: string, source: string, target: string): Edge =>
  ({ id, source, target } as unknown as Edge);

describe('validateWorkflowGraph', () => {
  it('returns no issues for a single connected trigger -> action workflow', () => {
    const nodes: Node[] = [
      makeNode('t1', 'trigger'),
      makeNode('a1', 'action', { action_type: 'send_email', config: { to: 'a@b', subject: 'hi' } }),
    ];
    const edges: Edge[] = [makeEdge('e1', 't1', 'a1')];
    expect(validateWorkflowGraph(nodes, edges)).toEqual([]);
  });

  it('flags multiple triggers as errors on the extras (keeps the first)', () => {
    const nodes: Node[] = [
      makeNode('t1', 'trigger'),
      makeNode('t2', 'trigger'),
      makeNode('t3', 'trigger'),
    ];
    const issues = validateWorkflowGraph(nodes, []);
    // First trigger is silent, the next two must be reported as errors
    const triggerErrors = issues.filter((i) => i.message.includes('Plusieurs déclencheurs'));
    expect(triggerErrors).toHaveLength(2);
    expect(triggerErrors.every((i) => i.severity === 'error')).toBe(true);
    expect(triggerErrors.map((i) => i.node_id).sort()).toEqual(['t2', 't3']);
  });

  it('flags orphan (non-trigger, no incoming edge) as warning', () => {
    const nodes: Node[] = [
      makeNode('t1', 'trigger'),
      makeNode('a1', 'action', { action_type: 'send_email', config: { to: 'a@b', subject: 'x' } }),
    ];
    const orphan = validateWorkflowGraph(nodes, []);
    const orphanIssues = orphan.filter((i) => i.message.includes('non connecté'));
    expect(orphanIssues).toHaveLength(1);
    expect(orphanIssues[0].node_id).toBe('a1');
    expect(orphanIssues[0].severity).toBe('warning');
  });

  it('flags action missing required config fields', () => {
    const nodes: Node[] = [
      makeNode('t1', 'trigger'),
      makeNode('a1', 'action', { action_type: 'send_email', config: {} }),
    ];
    const edges: Edge[] = [makeEdge('e1', 't1', 'a1')];
    const issues = validateWorkflowGraph(nodes, edges);
    const incomplete = issues.find((i) => i.node_id === 'a1' && i.message.includes('Configuration incomplète'));
    expect(incomplete).toBeDefined();
    expect(incomplete?.message).toContain('to');
    expect(incomplete?.message).toContain('subject');
  });

  it('flags action without action_type as error', () => {
    const nodes: Node[] = [
      makeNode('t1', 'trigger'),
      makeNode('a1', 'action', {}),
    ];
    const edges: Edge[] = [makeEdge('e1', 't1', 'a1')];
    const issues = validateWorkflowGraph(nodes, edges);
    const typeMissing = issues.find((i) => i.node_id === 'a1' && i.severity === 'error');
    expect(typeMissing).toBeDefined();
    expect(typeMissing?.message).toContain("Type d'action");
  });

  it('flags condition missing field or operator', () => {
    const nodes: Node[] = [
      makeNode('t1', 'trigger'),
      makeNode('c1', 'condition', { config: { field: 'statut' } }),
    ];
    const edges: Edge[] = [makeEdge('e1', 't1', 'c1')];
    const issues = validateWorkflowGraph(nodes, edges);
    const condIssue = issues.find((i) => i.node_id === 'c1' && i.message.includes('Condition'));
    expect(condIssue?.severity).toBe('warning');
  });

  it('flags delay without amount', () => {
    const nodes: Node[] = [
      makeNode('t1', 'trigger'),
      makeNode('d1', 'delay', { config: { amount: 0 } }),
    ];
    const edges: Edge[] = [makeEdge('e1', 't1', 'd1')];
    const issues = validateWorkflowGraph(nodes, edges);
    const delayIssue = issues.find((i) => i.node_id === 'd1' && i.message.includes('Délai'));
    expect(delayIssue?.severity).toBe('warning');
  });

  it('ignores empty graphs', () => {
    expect(validateWorkflowGraph([], [])).toEqual([]);
  });
});

describe('getIssuesForNode', () => {
  it('filters issues by node id', () => {
    const issues = [
      { node_id: 'a', severity: 'error' as const, message: 'one' },
      { node_id: 'b', severity: 'warning' as const, message: 'two' },
      { node_id: 'a', severity: 'warning' as const, message: 'three' },
    ];
    const aIssues = getIssuesForNode(issues, 'a');
    expect(aIssues).toHaveLength(2);
    expect(aIssues.map((i) => i.message)).toEqual(['one', 'three']);
  });

  it('returns empty array when no match', () => {
    expect(getIssuesForNode([], 'x')).toEqual([]);
  });
});
