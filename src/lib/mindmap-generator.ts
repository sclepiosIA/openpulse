import type { TranscriptionSessionWithDetails } from '@/types/transcription';

export interface MindMapNode {
  id: string;
  type: 'root' | 'topic' | 'decision' | 'action' | 'participant';
  data: {
    label: string;
    description?: string;
    color?: string;
  };
  position: { x: number; y: number };
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}

export interface MindMapData {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

/**
 * Generates a mind map structure from a transcription session.
 * Arranges nodes in a radial layout around the root.
 */
export function generateMindMap(session: TranscriptionSessionWithDetails): MindMapData {
  const nodes: MindMapNode[] = [];
  const edges: MindMapEdge[] = [];

  // Root node
  const rootId = 'root';
  nodes.push({
    id: rootId,
    type: 'root',
    data: { label: session.title, color: 'hsl(var(--primary))' },
    position: { x: 0, y: 0 },
  });

  let branchIndex = 0;
  const totalBranches =
    (session.participants?.length ? 1 : 0) +
    (session.decisions?.length ? 1 : 0) +
    (session.next_steps?.length ? 1 : 0) +
    (session.summary ? 1 : 0);

  const angleStep = (2 * Math.PI) / Math.max(totalBranches, 1);
  const radius1 = 250;
  const radius2 = 450;

  const getBranchPosition = (index: number, level: number) => {
    const r = level === 1 ? radius1 : radius2;
    const angle = angleStep * index - Math.PI / 2;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  };

  // Summary topics from the summary text
  if (session.summary) {
    const summaryId = 'summary';
    const pos = getBranchPosition(branchIndex, 1);
    nodes.push({
      id: summaryId,
      type: 'topic',
      data: { label: 'Résumé', color: 'hsl(210, 70%, 55%)' },
      position: pos,
    });
    edges.push({ id: `e-root-${summaryId}`, source: rootId, target: summaryId });

    // Extract key sentences (first 4 sentences)
    const sentences = session.summary
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10)
      .slice(0, 4);

    sentences.forEach((sentence, i) => {
      const nodeId = `summary-${i}`;
      const childAngle = angleStep * branchIndex + (i - sentences.length / 2) * 0.3;
      nodes.push({
        id: nodeId,
        type: 'topic',
        data: { label: sentence.length > 60 ? sentence.slice(0, 57) + '...' : sentence },
        position: {
          x: Math.cos(childAngle - Math.PI / 2) * radius2,
          y: Math.sin(childAngle - Math.PI / 2) * radius2,
        },
      });
      edges.push({ id: `e-${summaryId}-${nodeId}`, source: summaryId, target: nodeId });
    });

    branchIndex++;
  }

  // Decisions
  if (session.decisions?.length) {
    const decisionsId = 'decisions';
    const pos = getBranchPosition(branchIndex, 1);
    nodes.push({
      id: decisionsId,
      type: 'topic',
      data: { label: 'Décisions', color: 'hsl(150, 60%, 45%)' },
      position: pos,
    });
    edges.push({ id: `e-root-${decisionsId}`, source: rootId, target: decisionsId });

    session.decisions.forEach((decision, i) => {
      const nodeId = `decision-${i}`;
      const childAngle = angleStep * branchIndex + (i - session.decisions.length / 2) * 0.35;
      nodes.push({
        id: nodeId,
        type: 'decision',
        data: {
          label: decision.decision.length > 50 ? decision.decision.slice(0, 47) + '...' : decision.decision,
          description: decision.owner ? `Responsable: ${decision.owner}` : undefined,
          color: 'hsl(150, 60%, 45%)',
        },
        position: {
          x: Math.cos(childAngle - Math.PI / 2) * radius2,
          y: Math.sin(childAngle - Math.PI / 2) * radius2,
        },
      });
      edges.push({ id: `e-${decisionsId}-${nodeId}`, source: decisionsId, target: nodeId });
    });
    branchIndex++;
  }

  // Next steps (actions)
  if (session.next_steps?.length) {
    const actionsId = 'actions';
    const pos = getBranchPosition(branchIndex, 1);
    nodes.push({
      id: actionsId,
      type: 'topic',
      data: { label: 'Actions', color: 'hsl(30, 80%, 55%)' },
      position: pos,
    });
    edges.push({ id: `e-root-${actionsId}`, source: rootId, target: actionsId });

    session.next_steps.forEach((step, i) => {
      const nodeId = `action-${i}`;
      const childAngle = angleStep * branchIndex + (i - session.next_steps.length / 2) * 0.35;
      const label = step.task.length > 50 ? step.task.slice(0, 47) + '...' : step.task;
      const desc = [step.assignee, step.deadline].filter(Boolean).join(' • ');
      nodes.push({
        id: nodeId,
        type: 'action',
        data: { label, description: desc || undefined, color: 'hsl(30, 80%, 55%)' },
        position: {
          x: Math.cos(childAngle - Math.PI / 2) * radius2,
          y: Math.sin(childAngle - Math.PI / 2) * radius2,
        },
      });
      edges.push({ id: `e-${actionsId}-${nodeId}`, source: actionsId, target: nodeId, animated: true });
    });
    branchIndex++;
  }

  // Participants
  if (session.participants?.length) {
    const participantsId = 'participants';
    const pos = getBranchPosition(branchIndex, 1);
    nodes.push({
      id: participantsId,
      type: 'topic',
      data: { label: 'Participants', color: 'hsl(270, 50%, 55%)' },
      position: pos,
    });
    edges.push({ id: `e-root-${participantsId}`, source: rootId, target: participantsId });

    session.participants.forEach((p, i) => {
      const nodeId = `participant-${i}`;
      const childAngle = angleStep * branchIndex + (i - session.participants!.length / 2) * 0.35;
      nodes.push({
        id: nodeId,
        type: 'participant',
        data: { label: p.display_name, color: 'hsl(270, 50%, 55%)' },
        position: {
          x: Math.cos(childAngle - Math.PI / 2) * radius2,
          y: Math.sin(childAngle - Math.PI / 2) * radius2,
        },
      });
      edges.push({ id: `e-${participantsId}-${nodeId}`, source: participantsId, target: nodeId });
    });
  }

  return { nodes, edges };
}
