import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('@/hooks/tasks/useTaches', () => ({
  useUpdateTache: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({
    data: [
      { id: 'p1', prenom: 'Jean', nom: 'Dupont' },
      { id: 'p2', prenom: 'Marie', nom: 'Martin' },
    ],
  }),
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn() },
}));

const mockTache = {
  id: 'task-1',
  titre: 'Tâche test',
  description: 'Description test',
  priorite: 'medium' as const,
  statut: 'A faire' as const,
  echeance: '2025-12-31',
  etablissement_id: 'e1',
  categorie_id: 'c1',
  archive: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
} as any;

describe('TaskForm', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  const renderTaskForm = async (mode: 'edit' | 'assign' = 'edit') => {
    const { TaskForm } = await import('@/components/tasks/TaskForm');
    return render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(TaskForm, { tache: mockTache, mode })
      )
    );
  };

  it('should render edit button by default in edit mode', async () => {
    await renderTaskForm('edit');
    expect(screen.getByText('Modifier')).toBeInTheDocument();
  }, 15000);

  it('should render assign button in assign mode', async () => {
    await renderTaskForm('assign');
    expect(screen.getByText('Assigner')).toBeInTheDocument();
  });

  it('should open dialog when trigger is clicked', async () => {
    await renderTaskForm('edit');

    fireEvent.click(screen.getByText('Modifier'));
    expect(screen.getByText('Modifier la tâche')).toBeInTheDocument();
  });

  it('should show form fields in edit mode', async () => {
    await renderTaskForm('edit');
    fireEvent.click(screen.getByText('Modifier'));

    expect(screen.getByLabelText('Titre')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByText('Priorité')).toBeInTheDocument();
    expect(screen.getByText('Responsable')).toBeInTheDocument();
  });

  it('should show cancel and submit buttons', async () => {
    await renderTaskForm('edit');
    fireEvent.click(screen.getByText('Modifier'));

    expect(screen.getByText('Annuler')).toBeInTheDocument();
    expect(screen.getByText('Enregistrer')).toBeInTheDocument();
  });

  it('should pre-fill form with task data', async () => {
    await renderTaskForm('edit');
    fireEvent.click(screen.getByText('Modifier'));

    const titreInput = screen.getByLabelText('Titre') as HTMLInputElement;
    expect(titreInput.value).toBe('Tâche test');
  });

  it('should show assign dialog title', async () => {
    await renderTaskForm('assign');
    fireEvent.click(screen.getByText('Assigner'));

    expect(screen.getByText('Assigner la tâche')).toBeInTheDocument();
  });
});
