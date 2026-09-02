import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CategoryTree, QONTO_CATEGORIES, sanitizeCode, type TresorerieCategory } from './tresorerieCategoryTree';

const {
  AUTH_STATE,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const mockNavigate = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  const mockFrom = vi.fn(() => builder);

  return {
    AUTH_STATE,
    mockNavigate,
    mockToastSuccess,
    mockToastError,
    mockFrom,
    builder,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    title,
    className,
    'aria-label': ariaLabel,
    'aria-expanded': ariaExpanded,
  }: {
    children?: ReactNode;
    onClick?: () => void;
    title?: string;
    className?: string;
    'aria-label'?: string;
    'aria-expanded'?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={className}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock('@/components/ui/collapsible', async () => {
  const ReactModule = await import('react');
  const CollapsibleContext = ReactModule.createContext<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
  } | null>(null);

  return {
    Collapsible: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      children?: ReactNode;
    }) => (
      <CollapsibleContext.Provider value={{ open, onOpenChange }}>
        <div>{children}</div>
      </CollapsibleContext.Provider>
    ),
    CollapsibleTrigger: ({
      asChild,
      children,
    }: {
      asChild?: boolean;
      children?: React.ReactElement<{ onClick?: () => void }>;
    }) => {
      const ctx = ReactModule.useContext(CollapsibleContext);
      if (!ctx || !children) return null;
      const handleClick = () => ctx.onOpenChange(!ctx.open);
      if (asChild && ReactModule.isValidElement(children)) {
        return ReactModule.cloneElement(children, {
          onClick: handleClick,
        });
      }
      return (
        <button type="button" onClick={handleClick}>
          {children}
        </button>
      );
    },
    CollapsibleContent: ({ children }: { children?: ReactNode }) => {
      const ctx = ReactModule.useContext(CollapsibleContext);
      if (!ctx?.open) return null;
      return <div>{children}</div>;
    },
  };
});

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Plus: Icon,
    Pencil: Icon,
    Trash2: Icon,
    FolderTree: Icon,
    Folder: Icon,
    Tag: Icon,
    ChevronRight: Icon,
    GripVertical: Icon,
  };
});

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children?: ReactNode }) => <div data-testid="dnd-context">{children}</div>,
  PointerSensor: function PointerSensor() {},
  useSensor: vi.fn(() => ({ sensor: 'pointer' })),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
  closestCenter: vi.fn(),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children?: ReactNode }) => <div data-testid="sortable-context">{children}</div>,
  useSortable: vi.fn(() => ({
    attributes: { 'data-sortable': 'true' },
    listeners: { onPointerDown: vi.fn() },
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => undefined),
    },
  },
}));

vi.mock('@dnd-kit/modifiers', () => ({
  restrictToVerticalAxis: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('tresorerieCategoryTree', () => {
  it('sanitizeCode transforme correctement le texte métier', () => {
    expect(sanitizeCode('Loyer bureau')).toBe('LOYER_BUREAU');
    expect(sanitizeCode('Échéance/TVA 20%')).toBe('ECHEANCE_TVA_20');
    expect(sanitizeCode('  déjà__prêt  ')).toBe('DEJA_PRET');
  });

  it('expose les catégories Qonto attendues', () => {
    expect(QONTO_CATEGORIES).toHaveLength(17);
    expect(QONTO_CATEGORIES[0]).toEqual({ value: 'office_rental', label: 'Loyer bureau' });
    expect(QONTO_CATEGORIES.find((c) => c.value === 'salary')?.label).toBe('Salaires');
    expect(QONTO_CATEGORIES.find((c) => c.value === 'social_contribution')?.label).toBe(
      'Cotisations sociales et patronales'
    );
  });

  it('affiche un état vide quand aucune catégorie n’est fournie', () => {
    const wrapper = createWrapper();
    render(
      <CategoryTree
        categories={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddChild={vi.fn()}
        onDragEnd={vi.fn()}
      />,
      { wrapper }
    );

    expect(screen.getByText('Aucune catégorie')).toBeInTheDocument();
  });

  it('rend l’arborescence triée, affiche les badges métier et déclenche les actions', () => {
    const wrapper = createWrapper();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onAddChild = vi.fn();
    const onDragEnd = vi.fn();

    const categories: TresorerieCategory[] = [
      {
        id: 'root-b',
        code: 'ROOT_B',
        nom: 'Racine B',
        type: 'depense',
        couleur: null,
        icone: null,
        parent_id: null,
        niveau: 0,
        ordre: 2,
        actif: true,
        est_calculee: false,
        formule_calcul: null,
      },
      {
        id: 'child-a2',
        code: 'CHILD_A2',
        nom: 'Enfant A2',
        type: 'depense',
        couleur: '#00ff00',
        icone: null,
        parent_id: 'root-a',
        niveau: 1,
        ordre: 2,
        actif: true,
        est_calculee: false,
        formule_calcul: null,
      },
      {
        id: 'root-a',
        code: 'ROOT_A',
        nom: 'Racine A',
        type: 'recette',
        couleur: '#ff0000',
        icone: null,
        parent_id: null,
        niveau: 0,
        ordre: 1,
        actif: true,
        est_calculee: false,
        formule_calcul: null,
      },
      {
        id: 'child-a1',
        code: 'CHILD_A1',
        nom: 'Enfant A1',
        type: 'depense',
        couleur: null,
        icone: null,
        parent_id: 'root-a',
        niveau: 1,
        ordre: 1,
        actif: false,
        est_calculee: false,
        formule_calcul: null,
      },
      {
        id: 'leaf-a1-1',
        code: 'LEAF_A1_1',
        nom: 'Feuille A1-1',
        type: 'depense',
        couleur: null,
        icone: null,
        parent_id: 'child-a1',
        niveau: 2,
        ordre: 1,
        actif: true,
        est_calculee: false,
        formule_calcul: null,
      },
      {
        id: 'orphan',
        code: 'ORPHAN',
        nom: 'Orpheline',
        type: 'depense',
        couleur: null,
        icone: null,
        parent_id: 'missing-parent',
        niveau: 0,
        ordre: 3,
        actif: true,
        est_calculee: false,
        formule_calcul: null,
      },
    ];

    const { container } = render(
      <CategoryTree
        categories={categories}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddChild={onAddChild}
        onDragEnd={onDragEnd}
      />,
      { wrapper }
    );

    const allText = container.textContent ?? '';
    expect(allText.indexOf('Racine A')).toBeLessThan(allText.indexOf('Enfant A1'));
    expect(allText.indexOf('Enfant A1')).toBeLessThan(allText.indexOf('Feuille A1-1'));
    expect(allText.indexOf('Feuille A1-1')).toBeLessThan(allText.indexOf('Enfant A2'));
    expect(allText.indexOf('Enfant A2')).toBeLessThan(allText.indexOf('Racine B'));
    expect(allText.indexOf('Racine B')).toBeLessThan(allText.indexOf('Orpheline'));

    expect(screen.getByText('ROOT_A')).toBeInTheDocument();
    expect(screen.getByText('CHILD_A1')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();

    const addButtons = screen.getAllByTitle('Ajouter une sous-catégorie');
    fireEvent.click(addButtons[0]);
    expect(onAddChild).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'root-a',
        nom: 'Racine A',
        niveau: 0,
      })
    );

    const editButtons = container.querySelectorAll('button.h-7.w-7.p-0');
    fireEvent.click(editButtons[1]);
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'root-a',
        code: 'ROOT_A',
      })
    );

    fireEvent.click(editButtons[2]);
    expect(onDelete).toHaveBeenCalledWith('root-a');
  });

  it('réduit et redéveloppe les enfants via le trigger collapsible', () => {
    const wrapper = createWrapper();

    const categories: TresorerieCategory[] = [
      {
        id: 'r1',
        code: 'R1',
        nom: 'Racine',
        type: 'depense',
        couleur: null,
        icone: null,
        parent_id: null,
        niveau: 0,
        ordre: 1,
        actif: true,
        est_calculee: false,
        formule_calcul: null,
      },
      {
        id: 'c1',
        code: 'C1',
        nom: 'Enfant',
        type: 'depense',
        couleur: null,
        icone: null,
        parent_id: 'r1',
        niveau: 1,
        ordre: 1,
        actif: true,
        est_calculee: false,
        formule_calcul: null,
      },
    ];

    render(
      <CategoryTree
        categories={categories}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddChild={vi.fn()}
        onDragEnd={vi.fn()}
      />,
      { wrapper }
    );

    expect(screen.getByText('Enfant')).toBeInTheDocument();

    const toggle = screen.getByLabelText('Réduire');
    fireEvent.click(toggle);
    expect(screen.queryByText('Enfant')).not.toBeInTheDocument();

    const expand = screen.getByLabelText('Développer');
    fireEvent.click(expand);
    expect(screen.getByText('Enfant')).toBeInTheDocument();
  });
});