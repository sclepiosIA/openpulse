import { useState } from 'react';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CustomDashboard } from '@/types/report';
import { ShareDialog } from './ShareDialog';

const { ROWS, mockFrom, mockMutateAsync } = vi.hoisted(() => {
  const ROWS = [
    { id: 'u1', prenom: 'Alice', nom: 'Dupont', email: 'alice@t.co', actif: true },
    { id: 'u2', prenom: 'Bob', nom: 'Martin', email: 'bob@t.co', actif: true },
  ];
  const makeBuilder = () => {
    const result = { data: ROWS, error: null };
    const builder: Record<string, unknown> = {};
    const methods = [
      'select', 'eq', 'neq', 'gte', 'lte', 'in', 'order', 'limit',
      'insert', 'update', 'delete', 'upsert', 'ilike', 'range',
    ];
    for (const m of methods) {
      builder[m] = vi.fn(() => builder);
    }
    builder.single = vi.fn(() => Promise.resolve({ data: ROWS[0], error: null }));
    builder.maybeSingle = vi.fn(() => Promise.resolve({ data: ROWS[0], error: null }));
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    builder.catch = (reject: (e: unknown) => unknown) =>
      Promise.resolve(result).catch(reject);
    return builder;
  };
  const mockFrom = vi.fn(() => makeBuilder());
  const mockMutateAsync = vi.fn(() => Promise.resolve(undefined));
  return { ROWS, mockFrom, mockMutateAsync };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/hooks/dashboard/useCustomDashboards', () => ({
  useUpdateDashboard: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

vi.mock('lucide-react', () => ({
  X: () => null,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children?: ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
  }) => (
    <input
      type="checkbox"
      role="switch"
      data-testid="share-switch"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children?: ReactNode }) => <label>{children}</label>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
}));

function makeDashboard(overrides: Partial<CustomDashboard> = {}): CustomDashboard {
  return {
    id: 'd1',
    name: 'Mon rapport',
    is_shared: true,
    shared_with: ['u1'],
    ...overrides,
  } as unknown as CustomDashboard;
}

function renderDialog(dashboard: CustomDashboard, onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ShareDialog open={true} onOpenChange={onOpenChange} dashboard={dashboard} />
    </QueryClientProvider>
  );
  return { ...utils, onOpenChange };
}

describe('ShareDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le titre, le switch activé et le membre partagé avec son nom complet', async () => {
    renderDialog(makeDashboard());

    expect(screen.getByText('Partager le rapport')).toBeTruthy();
    const switchEl = screen.getByTestId('share-switch');
    expect((switchEl as HTMLInputElement).checked).toBe(true);

    await waitFor(() => {
      expect(screen.getByText('Alice Dupont')).toBeTruthy();
    });
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(screen.getByText('Utilisateurs autorisés')).toBeTruthy();
  });

  it('propose dans le select uniquement les membres non encore partagés', async () => {
    renderDialog(makeDashboard());

    await waitFor(() => {
      expect(screen.getByText('Bob Martin')).toBeTruthy();
    });
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('Ajouter un membre…');
    expect(options).toContain('Bob Martin');
    expect(options).not.toContain('Alice Dupont');
    expect(ROWS).toHaveLength(2);
  });

  it("masque la section des utilisateurs quand le partage est désactivé puis l'affiche après activation du switch", () => {
    renderDialog(makeDashboard({ is_shared: false, shared_with: [] }));

    expect(screen.queryByText('Utilisateurs autorisés')).toBeNull();

    fireEvent.click(screen.getByTestId('share-switch'));

    expect(screen.getByText('Utilisateurs autorisés')).toBeTruthy();
  });

  it('enregistre via mutateAsync avec le patch attendu puis ferme le dialog', async () => {
    const { onOpenChange } = renderDialog(makeDashboard());

    await waitFor(() => {
      expect(screen.getByText('Alice Dupont')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Enregistrer'));
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: 'd1',
      patch: { is_shared: true, shared_with: ['u1'] },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ajoute un membre via le select et l'inclut dans le patch à l'enregistrement", async () => {
    renderDialog(makeDashboard());

    await waitFor(() => {
      expect(screen.getByText('Bob Martin')).toBeTruthy();
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'u2' } });

    await waitFor(() => {
      expect(screen.getAllByTestId('badge')).toHaveLength(2);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Enregistrer'));
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: 'd1',
      patch: { is_shared: true, shared_with: ['u1', 'u2'] },
    });
  });

  it('retire un membre quand on clique sur le bouton de suppression du badge', async () => {
    renderDialog(makeDashboard());

    await waitFor(() => {
      expect(screen.getByText('Alice Dupont')).toBeTruthy();
    });

    const badge = screen.getByTestId('badge');
    const removeBtn = badge.querySelector('button');
    expect(removeBtn).not.toBeNull();
    if (removeBtn) {
      fireEvent.click(removeBtn);
    }

    expect(screen.queryByTestId('badge')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByText('Enregistrer'));
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: 'd1',
      patch: { is_shared: true, shared_with: [] },
    });
  });

  it("appelle onOpenChange(false) sans muter quand on clique sur Annuler", async () => {
    const { onOpenChange } = renderDialog(makeDashboard());

    fireEvent.click(screen.getByText('Annuler'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});