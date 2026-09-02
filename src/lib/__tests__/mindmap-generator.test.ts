import { describe, it, expect } from 'vitest';
import { generateMindMap } from '../mindmap-generator';
import type { TranscriptionSessionWithDetails } from '@/types/transcription';

const baseSession = (): TranscriptionSessionWithDetails =>
  ({
    id: 's1',
    title: 'Réunion COMEX',
    summary: '',
    participants: [],
    decisions: [],
    next_steps: [],
  } as unknown as TranscriptionSessionWithDetails);

describe('mindmap-generator', () => {
  it('always returns at least the root node', () => {
    const map = generateMindMap(baseSession());
    expect(map.nodes.length).toBeGreaterThanOrEqual(1);
    const root = map.nodes.find((n) => n.id === 'root');
    expect(root).toBeDefined();
    expect(root?.type).toBe('root');
    expect(root?.data.label).toBe('Réunion COMEX');
    // Root has no incoming edges
    expect(map.edges.find((e) => e.target === 'root')).toBeUndefined();
  });

  it('creates a summary branch with topic nodes for each sentence (up to 4)', () => {
    const s = baseSession();
    s.summary =
      'La réunion a porté sur la roadmap produit. Plusieurs décisions ont été prises. ' +
      'Le budget 2026 a été revu. Une nouvelle étude utilisateur est planifiée. Cinquième phrase ignorée.';
    const map = generateMindMap(s);
    const summaryNode = map.nodes.find((n) => n.id === 'summary');
    expect(summaryNode).toBeDefined();
    // At most 4 child sentences
    const children = map.nodes.filter((n) => n.id.startsWith('summary-'));
    expect(children.length).toBeLessThanOrEqual(4);
    expect(children.length).toBeGreaterThan(0);
    // Each child has a connecting edge from the summary topic
    children.forEach((c) => {
      expect(map.edges.find((e) => e.source === 'summary' && e.target === c.id)).toBeDefined();
    });
  });

  it('creates a decisions branch with one node per decision', () => {
    const s = baseSession();
    s.decisions = [
      { decision: 'Choisir le fournisseur X', owner: 'Alice' },
      { decision: 'Décaler la release', owner: null },
    ] as unknown as TranscriptionSessionWithDetails['decisions'];
    const map = generateMindMap(s);
    const decisionsNode = map.nodes.find((n) => n.id === 'decisions');
    expect(decisionsNode).toBeDefined();
    const items = map.nodes.filter((n) => n.id.startsWith('decision-'));
    expect(items).toHaveLength(2);
    expect(items[0].data.description).toContain('Alice');
    expect(items[1].data.description).toBeUndefined();
  });

  it('creates an actions branch with animated edges', () => {
    const s = baseSession();
    s.next_steps = [
      { task: 'Envoyer le compte-rendu', assignee: 'Bob', deadline: '2026-06-01' },
    ] as unknown as TranscriptionSessionWithDetails['next_steps'];
    const map = generateMindMap(s);
    const actionsNode = map.nodes.find((n) => n.id === 'actions');
    expect(actionsNode).toBeDefined();
    const childEdge = map.edges.find((e) => e.source === 'actions');
    expect(childEdge?.animated).toBe(true);
  });

  it('creates a participants branch when participants are present', () => {
    const s = baseSession();
    s.participants = [
      { display_name: 'Camille M.' },
      { display_name: 'Lina M.' },
    ] as unknown as TranscriptionSessionWithDetails['participants'];
    const map = generateMindMap(s);
    const participantsNode = map.nodes.find((n) => n.id === 'participants');
    expect(participantsNode).toBeDefined();
    expect(map.nodes.filter((n) => n.id.startsWith('participant-'))).toHaveLength(2);
  });

  it('truncates long labels with ellipsis', () => {
    const s = baseSession();
    const longText = 'x'.repeat(80);
    s.decisions = [{ decision: longText }] as unknown as TranscriptionSessionWithDetails['decisions'];
    const map = generateMindMap(s);
    const decision = map.nodes.find((n) => n.id === 'decision-0');
    expect(decision?.data.label.endsWith('...')).toBe(true);
    expect(decision?.data.label.length).toBeLessThanOrEqual(50);
  });
});
