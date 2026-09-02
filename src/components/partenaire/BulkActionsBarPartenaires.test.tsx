import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BulkActionsBarPartenaires } from './BulkActionsBarPartenaires';

const {
  PROFILES,
  mockFrom,
  mockUpdate,
  mockIn,
  mockMutateAsync,
  mockToast,
} = vi.hoisted(() => {
  const PROFILES = [{ id: 'prof-1', prenom: 'Alice', nom: 'Martin' }];
  const okResult = { data: null, error: null };

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    update: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: (resolve: (v: { data: null; error: null }) => unknown) => resolve(okResult),
    catch: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: { notes: '' }, error: null });

  const mockFrom = vi.fn(() => builder);
  const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
  const mockToast = vi.fn();

  return {
    PROFILES,
    mockFrom,
    mockUpdate: builder.update,
    mockIn: builder.in,
    mockMutateAsync,
    mockToast,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/hooks/crm/usePartenaires', () => ({
  useDeletePartenaire: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: PROFILES }),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

type DivProps = React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode };
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: React.ReactNode;
  variant?: string;
  size?: string;
  asChild?: boolean;
};
type OpenProps = { children?: React.ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void };

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, variant, size, asChild, ...rest }: BtnProps) => (
    <button {...rest}>{children}</button>
  ),
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }: OpenProps) => (open ? <div>{children}</div> : null),
  AlertDialogContent: ({ children }: DivProps) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: DivProps) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: DivProps) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: DivProps) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: DivProps) => <div>{children}</div>,
  AlertDialogCancel: ({ children, ...rest }: BtnProps) => <button {...rest}>{children}</button>,
  AlertDialogAction: ({ children, ...rest }: BtnProps) => (
    <button data-testid="alert-dialog-action" {...rest}>{children}</button>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: OpenProps) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: DivProps) => <div>{children}</div>,
  DialogHeader: ({ children }: DivProps) => <div>{children}</div>,
  DialogTitle: ({ children }: DivProps) => <div>{children}</div>,
  DialogDescription: ({ children }: DivProps) => <div>{children}</div>,
  DialogFooter: ({ children }: DivProps) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: DivProps) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode; asChild?: boolean }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: DivProps) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...rest }: BtnProps) => <button {...rest}>{children}</button>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: DivProps) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: DivProps) => <div>{children}</div>,
  SelectItem: ({ children }: BtnProps & { value?: string }) => <button>{children}</button>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, onClick }: { children?: React.ReactNode; variant?: string; className?: string; onClick?: () => void }) => (
    <span data-testid="badge" onClick={onClick}>{children}</span>
  ),
}));

function renderBar(selectedIds: string[], onClearSelection = vi.fn(), onExport = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <BulkActionsBarPartenaires
        selectedIds={selectedIds}
        onClearSelection={onClearSelection}
        onExport={onExport}
      />
    </QueryClientProvider>
  );
  return { ...utils, onClearSelection, onExport };
}

describe('BulkActionsBarPartenaires', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le compteur au singulier pour un seul partenaire', () => {
    renderBar(['p1']);
    expect(screen.getByText('1 partenaire sélectionné')).toBeTruthy();
  });

  it('affiche le compteur au pluriel pour plusieurs partenaires', () => {
    renderBar(['p1', 'p2', 'p3']);
    expect(screen.getByText('3 partenaires sélectionnés')).toBeTruthy();
  });

  it('appelle onClearSelection au clic sur le bouton Annuler la sélection', () => {
    const { onClearSelection } = renderBar(['p1']);
    fireEvent.click(screen.getByRole('button', { name: 'Annuler la sélection' }));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('appelle onExport avec le bon format depuis le menu Exporter', () => {
    const { onExport } = renderBar(['p1']);
    fireEvent.click(screen.getByText('Exporter en CSV'));
    expect(onExport).toHaveBeenCalledWith('csv');
    fireEvent.click(screen.getByText('Exporter en PDF'));
    expect(onExport).toHaveBeenCalledWith('pdf');
  });

  it('supprime chaque partenaire sélectionné et affiche un toast de succès', async () => {
    const { onClearSelection } = renderBar(['p1', 'p2']);

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la sélection' }));
    expect(screen.getByText('Confirmer la suppression')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByTestId('alert-dialog-action'));
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    expect(mockMutateAsync).toHaveBeenNthCalledWith(1, 'p1');
    expect(mockMutateAsync).toHaveBeenNthCalledWith(2, 'p2');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Suppression réussie',
        description: '2 partenaire(s) supprimé(s)',
      })
    );
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('affiche un toast destructif si la suppression échoue', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('boom'));
    const { onClearSelection } = renderBar(['p1']);

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la sélection' }));
    await act(async () => {
      fireEvent.click(screen.getByTestId('alert-dialog-action'));
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erreur',
        description: 'Impossible de supprimer les partenaires',
        variant: 'destructive',
      })
    );
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it('met à jour le statut en masse via supabase au clic sur Prospect', async () => {
    const { onClearSelection } = renderBar(['p1', 'p2']);

    await act(async () => {
      fireEvent.click(screen.getByText('Prospect'));
    });

    expect(mockFrom).toHaveBeenCalledWith('partenaires');
    expect(mockUpdate).toHaveBeenCalledWith({ statut_relation: 'prospect' });
    expect(mockIn).toHaveBeenCalledWith('id', ['p1', 'p2']);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Statut mis à jour',
        description: '2 partenaire(s) → prospect',
      })
    );
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('ouvre le dialogue d assignation avec la liste des responsables', () => {
    renderBar(['p1']);
    fireEvent.click(screen.getByText('Assigner'));
    expect(screen.getByText('Assigner un responsable')).toBeTruthy();
    expect(screen.getByText('Alice Martin')).toBeTruthy();
  });

  it('ouvre le dialogue de tags et permet d ajouter un tag dans la liste', () => {
    renderBar(['p1']);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter des tags' }));
    expect(screen.getAllByText('Ajouter des tags').length).toBeGreaterThan(0);

    const input = screen.getByPlaceholderText('Nouveau tag...');
    fireEvent.change(input, { target: { value: 'vip' } });
    fireEvent.click(screen.getByText('Ajouter'));

    expect(screen.getByTestId('badge').textContent).toContain('vip');
    expect(screen.getByText('Appliquer 1 tag(s)')).toBeTruthy();
  });

  it('retire un tag de la liste au clic sur le badge', () => {
    renderBar(['p1']);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter des tags' }));

    const input = screen.getByPlaceholderText('Nouveau tag...');
    fireEvent.change(input, { target: { value: 'vip' } });
    fireEvent.click(screen.getByText('Ajouter'));
    expect(screen.getByTestId('badge')).toBeTruthy();

    fireEvent.click(screen.getByTestId('badge'));
    expect(screen.queryByTestId('badge')).toBeNull();
    expect(screen.getByText('Appliquer 0 tag(s)')).toBeTruthy();
  });
});