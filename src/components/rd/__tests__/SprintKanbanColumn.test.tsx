import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SprintKanbanColumn } from '../SprintKanbanColumn';

vi.mock('../UserStoryCard', () => ({
  UserStoryCard: ({ story }: any) => <div data-testid="story-card">{story.titre}</div>,
}));

const column = { id: 'todo' as const, label: 'À faire', color: '#3b82f6' };

describe('SprintKanbanColumn', () => {
  it('renders column label', () => {
    render(
      <DndContext>
        <SprintKanbanColumn column={column} stories={[]} projetId="p1" />
      </DndContext>
    );
    expect(screen.getByText('À faire')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(
      <DndContext>
        <SprintKanbanColumn column={column} stories={[]} projetId="p1" />
      </DndContext>
    );
    expect(screen.getByText('Glissez des stories ici')).toBeInTheDocument();
  });

  it('renders story count badge', () => {
    const stories = [
      { id: 's1', titre: 'Story 1', statut: 'todo', priorite: 'medium', points: 3 } as any,
      { id: 's2', titre: 'Story 2', statut: 'todo', priorite: 'high', points: 5 } as any,
    ];
    render(
      <DndContext>
        <SprintKanbanColumn column={column} stories={stories} projetId="p1" />
      </DndContext>
    );
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('8 pts')).toBeInTheDocument();
  });

  it('renders story cards', () => {
    const stories = [{ id: 's1', titre: 'Ma Story', statut: 'todo', priorite: 'low', points: 2 } as any];
    render(
      <DndContext>
        <SprintKanbanColumn column={column} stories={stories} projetId="p1" />
      </DndContext>
    );
    expect(screen.getByText('Ma Story')).toBeInTheDocument();
  });
});
