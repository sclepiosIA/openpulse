import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TeamMemberDetailDialog } from './TeamMemberDetailDialog';

const {
  TASKS,
  ETABS,
  PROFILE,
  STATS,
  toastSpy,
  invalidateQueriesSpy,
  sanitizeSupabaseErrorSpy,
  mockUseTaches,
  mockUseEtablissements,
  mockFrom,
  mockUpdate,
  mockEq,
  builder,
} = vi.hoisted(() => {
  const TASKS = [
    { id: 't1', responsable_id: 'p1', priorite: 'high', statut: 'En cours', titre: 'Task 1', echeance: '2099-01-01' },
    { id: 't2', responsable_id: 'p1', priorite: 'medium', statut: 'Terminé', titre: 'Task 2', echeance: '2099-01-02' },
    { id: 't3', responsable_id: 'p1', priorite: 'low', statut: 'A faire', titre: 'Task 3', echeance: '2099-01-03' },
    { id: 't4', responsable_id: 'other', priorite: 'high', statut: 'En cours', titre: 'Other Task', echeance: '2099-01-04' },
  ];

  const ETABS = [
    { id: 'e1', nom: 'Projet Alpha', ville: 'Paris', region: 'IDF', statut: 'Actif', type: 'Hôtel', progression: 75, commercial_id: 'p1', chef_projet_id: null, csm_id: null },
    { id: 'e2', nom: 'Projet Beta', ville: 'Lyon', region: 'ARA', statut: 'Planifié', type: 'Restaurant', progression: 30, commercial_id: null, chef_projet_id: 'p1', csm_id: null },
    { id: 'e3', nom: 'Projet Gamma', ville: 'Lille', region: 'HDF', statut: 'Clos', type: 'Bureau', progression: 100, commercial_id: null, chef_projet_id: null, csm_id: 'other' },
  ];

  const PROFILE = {
    id: 'p1',
    user_id: 'u1',
    prenom: 'Jean',
    nom: 'Dupont',
    email: 'jean@example.com',
    role: 'member',
    fonction: 'Chef de projet',
    avatar_url: 'https://img.test/a.png',
    linkedin_url: 'https://linkedin.com/in/jean',
  };

  const STATS = {
    completionRate: 66,
    tasksCompleted: 2,
    totalTasks: 3,
    workload: 58,
    tasksInProgress: 1,
    tasksOverdue: 0,
    avgCompletionTime: 5,
    lastActivity: new Date('2024-05-20T00:00:00.000Z'),
  };

  const toastSpy = vi.fn();
  const invalidateQueriesSpy = vi.fn();
  const sanitizeSupabaseErrorSpy = vi.fn(() => 'Erreur lisible');

  const mockUseTaches = vi.fn(() => ({ data: TASKS }));
  const mockUseEtablissements = vi.fn(() => ({ data: ETABS }));

  const builder = {} as Record<string, unknown>;

  const resolvedSuccess = Promise.resolve({ data: {}, error: null });

  const chain = vi.fn(() => builder);
  builder.select = chain;
  builder.gte = chain;
  builder.lte = chain;
  builder.in = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.insert = chain;
  builder.delete = chain;
  builder.single = vi.fn(() => Promise.resolve({ data: {}, error: null }));
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: {}, error: null }));
  builder.catch = resolvedSuccess.catch.bind(resolvedSuccess);
  builder.then = resolvedSuccess.then.bind(resolvedSuccess);

  const mockEq = vi.fn(() => Promise.resolve({ data: {}, error: null }));
  builder.eq = mockEq;

  const mockUpdate = vi.fn(() => builder);
  builder.update = mockUpdate;

  const mockFrom = vi.fn(() => builder);

  return {
    TASKS,
    ETABS,
    PROFILE,
    STATS,
    toastSpy,
    invalidateQueriesSpy,
    sanitizeSupabaseErrorSpy,
    mockUseTaches,
    mockUseEtablissements,
    mockFrom,
    mockUpdate,
    mockEq,
    builder,
  };
});

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: invalidateQueriesSpy,
    }),
  };
});

vi.mock('@/hooks/tasks/useTaches', () => ({
  useTaches: mockUseTaches,
}));

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissements: mockUseEtablissements,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorSpy,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/teamUtils', () => ({
  formatLastActivity: (date: Date | null) => (date ? 'il y a 2 jours' : 'Jamais'),
  getCompletionRateColor: () => 'text-green-600',
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h1 className={className}>{children}</h1>,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => <button type="button" data-value={value}>{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value: number }) => <div data-testid="progress">{value}</div>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input value={value} onChange={onChange} {...props} />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock('@/components/ui/UserAvatar', () => ({
  UserAvatar: ({ name }: { name: string }) => <div>{name}</div>,
}));

vi.mock('@/components/ui/UserAvatarUpload', () => ({
  UserAvatarUpload: ({ onUploadComplete }: { onUploadComplete?: (url: string | null) => void }) => (
    <button type="button" onClick={() => onUploadComplete?.('https://img.test/new.png')}>
      Upload avatar
    </button>
  ),
}));

vi.mock('./WorkloadIndicator', () => ({
  WorkloadIndicator: ({ workload }: { workload: number }) => <div>Workload: {workload}</div>,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
}));

vi.mock('lucide-react', () => ({
  Building2: () => <span>building</span>,
  Clock: () => <span>clock</span>,
  Linkedin: () => <span>linkedin</span>,
  ExternalLink: () => <span>external</span>,
  Save: () => <span>save</span>,
  Loader2: () => <span>loader</span>,
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

describe('TeamMemberDetailDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTaches.mockReturnValue({ data: TASKS });
    mockUseEtablissements.mockReturnValue({ data: ETABS });
    mockFrom.mockReturnValue(builder);
    mockUpdate.mockReturnValue(builder);
    mockEq.mockResolvedValue({ data: {}, error: null });
    sanitizeSupabaseErrorSpy.mockReturnValue('Erreur lisible');
  });

  it('affiche les informations métier du membre, ses tâches et ses projets', () => {
    render(
      <TeamMemberDetailDialog
        open
        onOpenChange={vi.fn()}
        profile={PROFILE}
        stats={STATS}
        canEditProfiles
        currentUserId="u1"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getAllByText('Jean Dupont').length).toBeGreaterThan(0);
    expect(screen.getByText('Chef de projet')).toBeInTheDocument();
    expect(screen.getByText('jean@example.com')).toBeInTheDocument();

    expect(screen.getByText('66%')).toBeInTheDocument();
    expect(screen.getByText('2 / 3 tâches')).toBeInTheDocument();
    expect(screen.getByText('Workload: 58')).toBeInTheDocument();
    expect(screen.getByText('5j')).toBeInTheDocument();
    expect(screen.getByText('il y a 2 jours')).toBeInTheDocument();
    expect(screen.getByText('20/05/2024')).toBeInTheDocument();

    expect(screen.getByText('Projet Alpha')).toBeInTheDocument();
    expect(screen.getByText('Paris - IDF')).toBeInTheDocument();
    expect(screen.getByText('Projet Beta')).toBeInTheDocument();
    expect(screen.getByText('Lyon - ARA')).toBeInTheDocument();
    expect(screen.queryByText('Projet Gamma')).not.toBeInTheDocument();

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
    expect(screen.getByText('Task 3')).toBeInTheDocument();
    expect(screen.queryByText('Other Task')).not.toBeInTheDocument();

    expect(screen.getAllByText('Haute').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Moyenne').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Basse').length).toBeGreaterThan(0);
  });

  it('retourne null si profile ou stats est absent', () => {
    const { rerender, container } = render(
      <TeamMemberDetailDialog
        open
        onOpenChange={vi.fn()}
        profile={null}
        stats={STATS}
      />,
      { wrapper: createWrapper() },
    );

    expect(container).toBeEmptyDOMElement();

    rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: 0, gcTime: 0 },
              mutations: { retry: 0 },
            },
          })
        }
      >
        <TeamMemberDetailDialog
          open
          onOpenChange={vi.fn()}
          profile={PROFILE}
          stats={null}
        />
      </QueryClientProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('sauvegarde le lien linkedin valide et invalide les profils', async () => {
    render(
      <TeamMemberDetailDialog
        open
        onOpenChange={vi.fn()}
        profile={PROFILE}
        stats={STATS}
        canEditProfiles
        currentUserId="u1"
      />,
      { wrapper: createWrapper() },
    );

    const input = screen.getByDisplayValue('https://linkedin.com/in/jean');
    fireEvent.change(input, { target: { value: 'https://linkedin.com/in/jean-dupont' } });

    const saveButton = screen.getAllByRole('button').find((button) => {
      const text = button.textContent ?? '';
      return text.includes('Enregistrer') || text.includes('save');
    });

    expect(saveButton).toBeDefined();
    if (saveButton) {
      fireEvent.click(saveButton);
    }

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('profiles');
    });

    expect(mockUpdate).toHaveBeenCalledWith({ linkedin_url: 'https://linkedin.com/in/jean-dupont' });
    expect(mockEq).toHaveBeenCalledWith('id', 'p1');
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Profil mis à jour',
        description: 'Le lien LinkedIn a été enregistré.',
      }),
    );
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['profiles'] });
  });

  it('affiche le message de validation inline et ne sauvegarde pas si l’url linkedin est invalide', async () => {
    render(
      <TeamMemberDetailDialog
        open
        onOpenChange={vi.fn()}
        profile={PROFILE}
        stats={STATS}
        canEditProfiles
        currentUserId="u1"
      />,
      { wrapper: createWrapper() },
    );

    const input = screen.getByDisplayValue('https://linkedin.com/in/jean');
    fireEvent.change(input, { target: { value: 'https://example.com/profil' } });

    expect(screen.getByText('Doit pointer vers linkedin.com')).toBeInTheDocument();

    const saveButton = screen.getAllByRole('button').find((button) => {
      const text = button.textContent ?? '';
      return text.includes('Enregistrer') || text.includes('save');
    });

    expect(saveButton).toBeDefined();
    if (saveButton) {
      fireEvent.click(saveButton);
    }

    await waitFor(() => {
      expect(mockFrom).not.toHaveBeenCalled();
    });

    expect(toastSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Lien invalide',
      }),
    );
  });

  it('gère une erreur supabase lors de la sauvegarde', async () => {
    mockEq.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

    render(
      <TeamMemberDetailDialog
        open
        onOpenChange={vi.fn()}
        profile={PROFILE}
        stats={STATS}
        canEditProfiles
        currentUserId="u1"
      />,
      { wrapper: createWrapper() },
    );

    const input = screen.getByDisplayValue('https://linkedin.com/in/jean');
    fireEvent.change(input, { target: { value: 'https://linkedin.com/in/echec' } });

    const saveButton = screen.getAllByRole('button').find((button) => {
      const text = button.textContent ?? '';
      return text.includes('Enregistrer') || text.includes('save');
    });

    expect(saveButton).toBeDefined();
    if (saveButton) {
      fireEvent.click(saveButton);
    }

    await waitFor(() => {
      expect(sanitizeSupabaseErrorSpy).toHaveBeenCalledWith({ message: 'x' });
    });

    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erreur',
        description: 'Erreur lisible',
        variant: 'destructive',
      }),
    );
  });
});