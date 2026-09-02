import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('@/hooks/tasks/useTaches', () => ({
  useCreateTache: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({
    data: [
      { id: 'p1', prenom: 'Jean', nom: 'Dupont' },
    ],
  }),
}));

vi.mock('@/hooks/catalogue/useCategories', () => ({
  useCategories: () => ({
    data: [
      { id: 'c1', nom: 'Administratif' },
      { id: 'c2', nom: 'Formation' },
    ],
  }),
}));

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissement: () => ({
    data: { id: 'e1', nom: 'Test Etab', statut: 'Prospect' },
  }),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/config/phases', () => ({
  getPhaseByStatus: () => 'commercial',
  getCumulativeCategoriesUpToPhase: () => ['Administratif', 'Formation'],
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn() },
}));

describe('CreateTaskDialog', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  const renderDialog = async () => {
    const { CreateTaskDialog } = await import('@/components/tasks/CreateTaskDialog');
    return render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(CreateTaskDialog, {
          etablissementId: 'e1',
          triggerButton: React.createElement('button', null, 'Nouvelle tâche'),
        })
      )
    );
  };

  it('should render trigger button', async () => {
    await renderDialog();
    expect(screen.getByText('Nouvelle tâche')).toBeInTheDocument();
  }, 15000);

  it('should open dialog when trigger clicked', async () => {
    await renderDialog();
    fireEvent.click(screen.getByText('Nouvelle tâche'));
    expect(screen.getByText('Créer une nouvelle tâche')).toBeInTheDocument();
  });

  it('should show required form fields', async () => {
    await renderDialog();
    fireEvent.click(screen.getByText('Nouvelle tâche'));

    expect(screen.getByLabelText(/Titre/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(screen.getByText('Catégorie *')).toBeInTheDocument();
    expect(screen.getByText('Priorité')).toBeInTheDocument();
  });

  it('should show Annuler and Créer buttons', async () => {
    await renderDialog();
    fireEvent.click(screen.getByText('Nouvelle tâche'));

    expect(screen.getByText('Annuler')).toBeInTheDocument();
    expect(screen.getByText('Créer la tâche')).toBeInTheDocument();
  });

  it('should show responsable select', async () => {
    await renderDialog();
    fireEvent.click(screen.getByText('Nouvelle tâche'));

    expect(screen.getByText('Responsable')).toBeInTheDocument();
  });
});
