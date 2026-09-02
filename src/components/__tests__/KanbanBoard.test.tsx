import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock all hooks used by KanbanBoard
const mockTaches = [
  { id: 't1', titre: 'Tâche 1', statut: 'A faire', priorite: 'high', archive: false, etablissement_id: 'e1' },
  { id: 't2', titre: 'Tâche 2', statut: 'En cours', priorite: 'medium', archive: false, etablissement_id: 'e1' },
  { id: 't3', titre: 'Tâche 3', statut: 'Terminé', priorite: 'low', archive: false, etablissement_id: 'e1' },
  { id: 't4', titre: 'Tâche archivée', statut: 'A faire', priorite: 'medium', archive: true, etablissement_id: 'e1' },
];

vi.mock('@/hooks/tasks/useTaches', () => ({
  useTaches: () => ({ data: mockTaches, isLoading: false }),
  useTachesByEtablissement: () => ({ data: mockTaches, isLoading: false }),
  useUpdateTache: () => ({ mutateAsync: vi.fn() }),
  useArchiveTache: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/components/TacheDocuments', () => ({
  TacheDocuments: () => React.createElement('div', null, 'Documents mock'),
}));

// KanbanBoard imports TacheDocuments from @/components/tasks/TacheDocuments
// which calls useAuth() internally. Mock the actual import path.
vi.mock('@/components/tasks/TacheDocuments', () => ({
  TacheDocuments: () => React.createElement('div', null, 'Documents mock'),
}));

vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: { id: 'u1', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'u1', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

describe('KanbanBoard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  const renderKanban = async (props = {}) => {
    const { KanbanBoard } = await import('@/components/pipeline/KanbanBoard');
    return render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(MemoryRouter, null,
          React.createElement(KanbanBoard, { etablissementId: 'e1', ...props })
        )
      )
    );
  };

  it('should render 4 columns', async () => {
    await renderKanban();

    expect(screen.getByText('À faire')).toBeInTheDocument();
    expect(screen.getByText('En cours')).toBeInTheDocument();
    expect(screen.getByText('Bloqué')).toBeInTheDocument();
    expect(screen.getByText('Terminé')).toBeInTheDocument();
  });

  it('should render Vue Kanban header', async () => {
    await renderKanban();
    expect(screen.getByText('Vue Kanban')).toBeInTheDocument();
  });

  it('should show archived toggle', async () => {
    await renderKanban();
    expect(screen.getByText('Afficher archivées')).toBeInTheDocument();
  });

  it('should display non-archived tasks by default', async () => {
    await renderKanban();

    expect(screen.getByText('Tâche 1')).toBeInTheDocument();
    expect(screen.getByText('Tâche 2')).toBeInTheDocument();
    expect(screen.getByText('Tâche 3')).toBeInTheDocument();
    expect(screen.queryByText('Tâche archivée')).not.toBeInTheDocument();
  });

  it('should show task counts in badges', async () => {
    await renderKanban();

    // At least one badge should show a count
    const badges = screen.getAllByText(/^[0-9]+$/);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('should render without etablissementId', async () => {
    const { KanbanBoard } = await import('@/components/pipeline/KanbanBoard');
    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(MemoryRouter, null,
          React.createElement(KanbanBoard, {})
        )
      )
    );

    expect(screen.getByText('Vue Kanban')).toBeInTheDocument();
  });
});
