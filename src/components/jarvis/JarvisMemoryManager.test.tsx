/* @vitest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisMemoryManager } from './JarvisMemoryManager';

const {
  MEMORIES,
  TOAST,
  addMemoryMock,
  deleteMemoryMock,
  clearCategoryMock,
  getMemoriesByCategoryMock,
  useJarvisMemoryMock,
  tabState,
} = vi.hoisted(() => {
  const MEMORIES = [
    {
      id: 'm1',
      category: 'preference',
      key: 'Ton',
      value: 'Professionnel et concis',
      importance: 4,
      updated_at: '2024-05-10T00:00:00.000Z',
    },
    {
      id: 'm2',
      category: 'preference',
      key: 'Langue',
      value: 'Répondre en français',
      importance: 5,
      updated_at: '2024-05-11T00:00:00.000Z',
    },
    {
      id: 'm3',
      category: 'fact',
      key: 'Ville',
      value: 'Lyon',
      importance: 3,
      updated_at: '2024-05-12T00:00:00.000Z',
    },
  ];

  const TOAST = vi.fn();
  const addMemoryMock = vi.fn().mockResolvedValue(undefined);
  const deleteMemoryMock = vi.fn().mockResolvedValue(undefined);
  const clearCategoryMock = vi.fn().mockResolvedValue(undefined);
  const getMemoriesByCategoryMock = vi.fn((category: string) =>
    MEMORIES.filter((m) => m.category === category)
  );
  const useJarvisMemoryMock = vi.fn();
  const tabState = { current: 'preference' as string };

  return {
    MEMORIES,
    TOAST,
    addMemoryMock,
    deleteMemoryMock,
    clearCategoryMock,
    getMemoriesByCategoryMock,
    useJarvisMemoryMock,
    tabState,
  };
});

vi.mock('@/hooks/jarvis/useJarvisMemory', () => ({
  useJarvisMemory: useJarvisMemoryMock,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: TOAST }),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    Brain: Icon,
    Plus: Icon,
    Trash2: Icon,
    Heart: Icon,
    Lightbulb: Icon,
    MessageSquare: Icon,
    Settings2: Icon,
    Star: Icon,
    AlertCircle: Icon,
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    className?: string;
    variant?: string;
    size?: string;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className} data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
  }) => <input value={value} onChange={onChange} placeholder={placeholder} />,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
    rows,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    placeholder?: string;
    rows?: number;
  }) => <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} />,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <div>
      <select aria-label="Catégorie" value={value} onChange={(e) => onValueChange?.(e.target.value)}>
        <option value="preference">Préférences</option>
        <option value="fact">Faits</option>
        <option value="instruction">Instructions</option>
        <option value="context">Contexte</option>
      </select>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>value</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    className?: string;
  }) => <button onClick={onClick} className={className}>{children}</button>,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ value, children }: { value?: string; onValueChange?: (value: string) => void; children: React.ReactNode }) => {
    if (value) tabState.current = value;
    return <div>{children}</div>;
  },
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { value?: string; className?: string; children: React.ReactNode }) => <button>{children}</button>,
  TabsContent: ({ value, children }: { value?: string; children: React.ReactNode; className?: string }) => (
    value === tabState.current ? <div data-testid={`tab-content-${value}`}>{children}</div> : null
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className}>loading</div>,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('JarvisMemoryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche l’état de chargement avec les skeletons', () => {
    useJarvisMemoryMock.mockReturnValue({
      memories: [],
      isLoading: true,
      addMemory: addMemoryMock,
      deleteMemory: deleteMemoryMock,
      clearCategory: clearCategoryMock,
      getMemoriesByCategory: getMemoriesByCategoryMock,
      isAdding: false,
      isDeleting: false,
    });

    render(<JarvisMemoryManager />, { wrapper: createWrapper() });

    expect(screen.getAllByTestId('skeleton')).toHaveLength(8);
    expect(screen.queryByText('Mémoire de Jarvis')).not.toBeInTheDocument();
  });

  it('affiche les statistiques et les mémoires de catégorie avec les valeurs métier réelles', () => {
    useJarvisMemoryMock.mockReturnValue({
      memories: MEMORIES,
      isLoading: false,
      addMemory: addMemoryMock,
      deleteMemory: deleteMemoryMock,
      clearCategory: clearCategoryMock,
      getMemoriesByCategory: getMemoriesByCategoryMock,
      isAdding: false,
      isDeleting: false,
    });

    render(<JarvisMemoryManager />, { wrapper: createWrapper() });

    expect(screen.getByText('Mémoire de Jarvis')).toBeInTheDocument();
    expect(screen.getByText('3 éléments mémorisés')).toBeInTheDocument();
    expect(screen.getByText('Comment Jarvis doit se comporter ou répondre')).toBeInTheDocument();
    expect(screen.getByText('Ton')).toBeInTheDocument();
    expect(screen.getByText('Professionnel et concis')).toBeInTheDocument();
    expect(screen.getByText('Langue')).toBeInTheDocument();
    expect(screen.getByText('Répondre en français')).toBeInTheDocument();
    expect(getMemoriesByCategoryMock).toHaveBeenCalledWith('preference');
    expect(getMemoriesByCategoryMock).toHaveBeenCalledWith('fact');
    expect(getMemoriesByCategoryMock).toHaveBeenCalledWith('instruction');
    expect(getMemoriesByCategoryMock).toHaveBeenCalledWith('context');
  });

  it('ouvre le dialogue et ajoute une mémoire puis déclenche le toast de succès', async () => {
    useJarvisMemoryMock.mockReturnValue({
      memories: MEMORIES,
      isLoading: false,
      addMemory: addMemoryMock,
      deleteMemory: deleteMemoryMock,
      clearCategory: clearCategoryMock,
      getMemoriesByCategory: getMemoriesByCategoryMock,
      isAdding: false,
      isDeleting: false,
    });

    render(<JarvisMemoryManager />, { wrapper: createWrapper() });

    fireEvent.click(screen.getAllByText('Ajouter')[0]);

    fireEvent.change(screen.getByPlaceholderText('Ex: Nom préféré, Email de travail, Ton de réponse...'), {
      target: { value: 'Nom préféré' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ex: Appelle-moi Jean, toujours utiliser un ton professionnel...'), {
      target: { value: 'Appelle-moi Alex' },
    });

    fireEvent.click(screen.getAllByText('Ajouter').at(-1) as HTMLElement);

    await waitFor(() => {
      expect(addMemoryMock).toHaveBeenCalledWith({
        category: 'preference',
        key: 'Nom préféré',
        value: 'Appelle-moi Alex',
        importance: 3,
      });
    });

    expect(TOAST).toHaveBeenCalledWith({
      title: 'Mémoire ajoutée',
      description: 'Jarvis se souviendra de "Nom préféré"',
    });
  });

  it('supprime une mémoire et déclenche le toast correspondant', async () => {
    useJarvisMemoryMock.mockReturnValue({
      memories: MEMORIES,
      isLoading: false,
      addMemory: addMemoryMock,
      deleteMemory: deleteMemoryMock,
      clearCategory: clearCategoryMock,
      getMemoriesByCategory: getMemoriesByCategoryMock,
      isAdding: false,
      isDeleting: false,
    });

    render(<JarvisMemoryManager />, { wrapper: createWrapper() });

    const cards = screen.getAllByTestId('card');
    const tonCard = cards.find((c) => within(c).queryByText('Ton')) as HTMLElement;
    expect(tonCard).toBeTruthy();

    fireEvent.click(within(tonCard).getByText('Supprimer'));

    await waitFor(() => {
      expect(deleteMemoryMock).toHaveBeenCalledWith('Ton');
    });

    expect(TOAST).toHaveBeenCalledWith({
      title: 'Mémoire supprimée',
      description: 'Jarvis a oublié "Ton"',
    });
  });

  it('vide une catégorie et affiche le toast de succès', async () => {
    useJarvisMemoryMock.mockReturnValue({
      memories: MEMORIES,
      isLoading: false,
      addMemory: addMemoryMock,
      deleteMemory: deleteMemoryMock,
      clearCategory: clearCategoryMock,
      getMemoriesByCategory: getMemoriesByCategoryMock,
      isAdding: false,
      isDeleting: false,
    });

    render(<JarvisMemoryManager />, { wrapper: createWrapper() });

    fireEvent.click(screen.getAllByText('Tout effacer')[0]);
    fireEvent.click(screen.getByText('Vider la catégorie'));

    await waitFor(() => {
      expect(clearCategoryMock).toHaveBeenCalledWith('preference');
    });

    expect(TOAST).toHaveBeenCalledWith({
      title: 'Catégorie vidée',
      description: 'Toutes les mémoires de type "Préférences" ont été supprimées',
    });
  });

  it('affiche une erreur via toast quand le vidage de catégorie échoue', async () => {
    clearCategoryMock.mockRejectedValueOnce(new Error('x'));

    useJarvisMemoryMock.mockReturnValue({
      memories: MEMORIES,
      isLoading: false,
      addMemory: addMemoryMock,
      deleteMemory: deleteMemoryMock,
      clearCategory: clearCategoryMock,
      getMemoriesByCategory: getMemoriesByCategoryMock,
      isAdding: false,
      isDeleting: false,
    });

    render(<JarvisMemoryManager />, { wrapper: createWrapper() });

    fireEvent.click(screen.getAllByText('Tout effacer')[0]);
    fireEvent.click(screen.getByText('Vider la catégorie'));

    await waitFor(() => {
      expect(clearCategoryMock).toHaveBeenCalledWith('preference');
    });

    expect(TOAST).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de vider cette catégorie',
      variant: 'destructive',
    });
  });
});