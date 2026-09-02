import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserStoryCard } from '../UserStoryCard';
import type { RDUserStory, RDSprint } from '@/types/rd';

// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

const makeStory = (overrides: Partial<RDUserStory> = {}): RDUserStory => ({
  id: 'us1',
  titre: 'Implémenter auth SSO',
  description: 'En tant que admin je veux SSO',
  statut: 'a_faire',
  priorite: 'high',
  points: 8,
  projet_id: 'p1',
  sprint_id: null,
  epic_id: null,
  epic: null,
  responsable_id: null,
  responsable: null,
  ordre: 1,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  ...overrides,
} as RDUserStory);

const sprints: RDSprint[] = [
  { id: 'sp1', nom: 'Sprint 1', statut: 'actif', projet_id: 'p1', date_debut: '2026-03-01', date_fin: '2026-03-14', objectif: '', created_at: '', updated_at: '' } as RDSprint,
];

describe('UserStoryCard', () => {
  it('renders story title', () => {
    render(<UserStoryCard story={makeStory()} projetId="p1" sprints={sprints} />);
    expect(screen.getByText('Implémenter auth SSO')).toBeInTheDocument();
  });

  it('renders points badge', () => {
    render(<UserStoryCard story={makeStory()} projetId="p1" sprints={sprints} />);
    expect(screen.getByText('8 pts')).toBeInTheDocument();
  });

  it('renders priority badge', () => {
    render(<UserStoryCard story={makeStory()} projetId="p1" sprints={sprints} />);
    expect(screen.getByText('Haute')).toBeInTheDocument();
  });

  it('renders description when not compact', () => {
    render(<UserStoryCard story={makeStory()} projetId="p1" sprints={sprints} />);
    expect(screen.getByText(/En tant que admin/)).toBeInTheDocument();
  });

  it('hides description in compact mode', () => {
    render(<UserStoryCard story={makeStory()} projetId="p1" sprints={sprints} compact />);
    expect(screen.queryByText(/En tant que admin/)).not.toBeInTheDocument();
  });

  it('renders responsable name when assigned', () => {
    render(
      <UserStoryCard
        story={makeStory({ responsable: { id: 'u1', prenom: 'Jean', nom: 'D' } as any })}
        projetId="p1"
        sprints={sprints}
      />
    );
    expect(screen.getByText('Jean')).toBeInTheDocument();
  });

  it('renders epic dot when epic present', () => {
    const { container } = render(
      <UserStoryCard
        story={makeStory({ epic: { id: 'e1', titre: 'Auth', couleur: '#ff0000' } as any })}
        projetId="p1"
        sprints={sprints}
      />
    );
    const dot = container.querySelector('.rounded-full[style*="background-color"]');
    expect(dot).toBeInTheDocument();
  });
});
