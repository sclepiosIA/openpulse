import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';

type LocalVersion = {
  id: string;
  documentId: string;
  content: string;
  kind: string;
  name: string;
  createdAt: string;
  size: number;
  auto: boolean;
};

const {
  AUTH_CONTEXT,
  DIFF_OPS,
  DIFF_SUMMARY,
  SAVED_VERSION,
  VERSION_ONE,
  VERSIONS,
  mockDeleteVersion,
  mockDiffLines,
  mockFrom,
  mockListVersions,
  mockNormalizeForDiff,
  mockRenameVersion,
  mockSaveVersion,
  mockSummarizeDiff,
  mockSupabaseGetSession,
  mockSupabaseGetUser,
  mockSupabaseOnAuthStateChange,
  mockToastError,
  mockToastSuccess,
} = vi.hoisted(() => {
  const VERSION_ONE: LocalVersion = {
    id: 'version-1',
    documentId: 'doc-1',
    content: 'ligne actuelle\nligne supprimée',
    kind: 'document',
    name: 'Version initiale',
    createdAt: '2024-01-02T10:30:00.000Z',
    size: 1536,
    auto: false,
  };

  const VERSION_TWO: LocalVersion = {
    id: 'version-2',
    documentId: 'doc-1',
    content: 'ancien contenu automatique',
    kind: 'document',
    name: 'Avant modification',
    createdAt: '2024-01-03T11:45:00.000Z',
    size: 3072,
    auto: true,
  };

  const SAVED_VERSION: LocalVersion = {
    id: 'version-saved',
    documentId: 'doc-1',
    content: 'ligne actuelle\nligne ajoutée',
    kind: 'document',
    name: 'Version sauvegardée',
    createdAt: '2024-01-04T12:00:00.000Z',
    size: 2048,
    auto: false,
  };

  const VERSIONS = [VERSION_ONE, VERSION_TWO];

  const DIFF_OPS = [
    { type: 'equal', line: 'ligne actuelle' },
    { type: 'del', line: 'ligne supprimée' },
    { type: 'add', line: 'ligne ajoutée' },
  ];

  const DIFF_SUMMARY = { added: 1, removed: 1 };

  const AUTH_USER = { id: 'u1', email: 't@t.co' };
  const AUTH_CONTEXT = {
    user: AUTH_USER,
    session: { user: AUTH_USER },
    isLoading: false,
    loading: false,
    isAuthenticated: true,
  };

  const SUPABASE_ROWS: unknown[] = [];
  const SUPABASE_QUERY_RESULT = { data: SUPABASE_ROWS, error: null };
  const SUPABASE_USER_RESULT = { data: { user: AUTH_USER }, error: null };
  const SUPABASE_SESSION_RESULT = { data: { session: AUTH_CONTEXT.session }, error: null };
  const SUPABASE_AUTH_SUBSCRIPTION = {
    data: { subscription: { unsubscribe: vi.fn() } },
    error: null,
  };

  const builder: Record<string, unknown> = {};
  const chain = () => builder;

  for (const method of [
    'select',
    'eq',
    'gte',
    'lte',
    'in',
    'order',
    'limit',
    'insert',
    'update',
    'delete',
    'upsert',
    'neq',
    'is',
    'not',
    'or',
    'ilike',
    'range',
    'contains',
    'match',
    'filter',
    'abortSignal',
    'returns',
  ]) {
    builder[method] = vi.fn(chain);
  }

  builder.single = vi.fn(() => Promise.resolve(SUPABASE_QUERY_RESULT));
  builder.maybeSingle = vi.fn(() => Promise.resolve(SUPABASE_QUERY_RESULT));
  builder.then = vi.fn(
    (
      resolve?: (value: typeof SUPABASE_QUERY_RESULT) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(SUPABASE_QUERY_RESULT).then(resolve, reject),
  );
  builder.catch = vi.fn((reject?: (reason: unknown) => unknown) =>
    Promise.resolve(SUPABASE_QUERY_RESULT).catch(reject),
  );

  return {
    AUTH_CONTEXT,
    DIFF_OPS,
    DIFF_SUMMARY,
    SAVED_VERSION,
    VERSION_ONE,
    VERSIONS,
    mockDeleteVersion: vi.fn(async () => undefined),
    mockDiffLines: vi.fn(() => DIFF_OPS),
    mockFrom: vi.fn(() => builder),
    mockListVersions: vi.fn(async () => VERSIONS),
    mockNormalizeForDiff: vi.fn((content: string) => content),
    mockRenameVersion: vi.fn(async () => undefined),
    mockSaveVersion: vi.fn(async () => SAVED_VERSION),
    mockSummarizeDiff: vi.fn(() => DIFF_SUMMARY),
    mockSupabaseGetSession: vi.fn(() => Promise.resolve(SUPABASE_SESSION_RESULT)),
    mockSupabaseGetUser: vi.fn(() => Promise.resolve(SUPABASE_USER_RESULT)),
    mockSupabaseOnAuthStateChange: vi.fn(() => SUPABASE_AUTH_SUBSCRIPTION),
    mockToastError: vi.fn(),
    mockToastSuccess: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mockSupabaseGetSession,
      getUser: mockSupabaseGetUser,
      onAuthStateChange: mockSupabaseOnAuthStateChange,
    },
    from: mockFrom,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_CONTEXT,
}));

vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: (props: { children?: ReactNode }) => <>{props.children}</>,
  useAuth: () => AUTH_CONTEXT,
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: (props: { children?: ReactNode }) => <>{props.children}</>,
  useAuth: () => AUTH_CONTEXT,
}));

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/dialog', () => {
  type RootProps = { open?: boolean; onOpenChange?: (open: boolean) => void; children?: ReactNode };
  type DivProps = HTMLAttributes<HTMLDivElement>;

  return {
    Dialog: (props: RootProps) =>
      props.open ? (
        <div data-testid="dialog-root" role="dialog">
          {props.children}
        </div>
      ) : null,
    DialogContent: (props: DivProps) => <div {...props} />,
    DialogDescription: (props: DivProps) => <p {...props} />,
    DialogFooter: (props: DivProps) => <div {...props} />,
    DialogHeader: (props: DivProps) => <div {...props} />,
    DialogTitle: (props: DivProps) => <h2 {...props} />,
  };
});

vi.mock('@/components/ui/button', () => {
  type MockButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    size?: string;
    variant?: string;
  };

  return {
    Button: (props: MockButtonProps) => {
      const { asChild, size, variant, ...buttonProps } = props;
      void asChild;
      void size;
      void variant;
      return <button {...buttonProps} />;
    },
    buttonVariants: () => '',
  };
});

vi.mock('@/components/ui/input', () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  ScrollBar: (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}));

vi.mock('@/components/ui/badge', () => {
  type BadgeProps = HTMLAttributes<HTMLDivElement> & { variant?: string };

  return {
    Badge: (props: BadgeProps) => {
      const { variant, ...badgeProps } = props;
      void variant;
      return <div {...badgeProps} />;
    },
    badgeVariants: () => '',
  };
});

vi.mock('@/components/ui/alert-dialog', () => {
  type RootProps = { open?: boolean; onOpenChange?: (open: boolean) => void; children?: ReactNode };
  type DivProps = HTMLAttributes<HTMLDivElement>;
  type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

  return {
    AlertDialog: (props: RootProps) =>
      props.open ? (
        <div data-testid="alert-dialog-root" role="alertdialog">
          {props.children}
        </div>
      ) : null,
    AlertDialogAction: (props: ButtonProps) => <button data-testid="alert-action" {...props} />,
    AlertDialogCancel: (props: ButtonProps) => <button data-testid="alert-cancel" {...props} />,
    AlertDialogContent: (props: DivProps) => <div {...props} />,
    AlertDialogDescription: (props: DivProps) => <p {...props} />,
    AlertDialogFooter: (props: DivProps) => <div {...props} />,
    AlertDialogHeader: (props: DivProps) => <div {...props} />,
    AlertDialogTitle: (props: DivProps) => <h2 {...props} />,
  };
});

vi.mock('lucide-react', () => {
  type IconProps = { className?: string };

  const Icon = (props: IconProps) => <svg aria-hidden="true" className={props.className} />;

  return {
    Check: Icon,
    History: Icon,
    Pencil: Icon,
    RotateCcw: Icon,
    Save: Icon,
    Sparkles: Icon,
    Trash2: Icon,
    X: Icon,
  };
});

vi.mock('./versionHistory', () => ({
  deleteVersion: mockDeleteVersion,
  diffLines: mockDiffLines,
  listVersions: mockListVersions,
  normalizeForDiff: mockNormalizeForDiff,
  renameVersion: mockRenameVersion,
  saveVersion: mockSaveVersion,
  summarizeDiff: mockSummarizeDiff,
}));

import { VersionHistoryDialog } from './VersionHistoryDialog';

type DialogProps = ComponentProps<typeof VersionHistoryDialog>;
type VersionList = typeof VERSIONS;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderDialog(overrides: Partial<DialogProps> = {}) {
  const props: DialogProps = {
    documentId: 'doc-1',
    documentName: 'Budget annuel',
    getCurrentContent: vi.fn(() => 'ligne actuelle\nligne ajoutée'),
    kind: 'document',
    onOpenChange: vi.fn(),
    onRestore: vi.fn(),
    open: true,
    ...overrides,
  };

  const queryClient = createQueryClient();

  const view = render(
    <QueryClientProvider client={queryClient}>
      <VersionHistoryDialog {...props} />
    </QueryClientProvider>,
  );

  return { ...view, props, queryClient };
}

beforeEach(() => {
  mockDeleteVersion.mockReset();
  mockDeleteVersion.mockResolvedValue(undefined);

  mockListVersions.mockReset();
  mockListVersions.mockResolvedValue(VERSIONS);

  mockRenameVersion.mockReset();
  mockRenameVersion.mockResolvedValue(undefined);

  mockSaveVersion.mockReset();
  mockSaveVersion.mockResolvedValue(SAVED_VERSION);

  mockDiffLines.mockClear();
  mockDiffLines.mockReturnValue(DIFF_OPS);

  mockNormalizeForDiff.mockClear();

  mockSummarizeDiff.mockClear();
  mockSummarizeDiff.mockReturnValue(DIFF_SUMMARY);

  mockToastError.mockReset();
  mockToastSuccess.mockReset();
  mockFrom.mockClear();
  mockSupabaseGetSession.mockClear();
  mockSupabaseGetUser.mockClear();
  mockSupabaseOnAuthStateChange.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('VersionHistoryDialog', () => {
  it("affiche l'état vide pendant le chargement puis sélectionne la première version", async () => {
    let resolveVersions: (value: VersionList) => void = () => undefined;
    const pendingVersions = new Promise<VersionList>((resolve) => {
      resolveVersions = resolve;
    });
    mockListVersions.mockReturnValue(pendingVersions);

    renderDialog();

    expect(screen.getByText("Aucune version enregistrée pour l'instant.")).toBeInTheDocument();
    expect(screen.getByText(/Sélectionnez une version pour visualiser les différences/)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockListVersions).toHaveBeenCalledWith('doc-1');
    });

    await act(async () => {
      resolveVersions(VERSIONS);
      await pendingVersions;
    });

    await waitFor(() => {
      expect(screen.getAllByText('Version initiale').length).toBeGreaterThanOrEqual(2);
    });

    expect(screen.getByText('Diff : version → contenu actuel')).toBeInTheDocument();
    expect(screen.queryByText("Aucune version enregistrée pour l'instant.")).not.toBeInTheDocument();
  });

  it('liste les versions, affiche les métadonnées et le diff métier de la version sélectionnée', async () => {
    renderDialog();

    await waitFor(() => {
      expect(screen.getAllByText('Version initiale').length).toBeGreaterThanOrEqual(2);
    });

    expect(screen.getByText(/Historique des versions — Budget annuel/)).toBeInTheDocument();
    expect(screen.getByText(/Créez, nommez, comparez et restaurez des versions antérieures/)).toBeInTheDocument();
    expect(screen.getByText(/L'état courant est comparé à la version sélectionnée/)).toBeInTheDocument();
    expect(screen.getByText('2 versions — 50 max.')).toBeInTheDocument();
    expect(screen.getByText('Avant modification')).toBeInTheDocument();
    expect(screen.getByText('auto')).toBeInTheDocument();
    expect(screen.getByText('1.5 Ko')).toBeInTheDocument();
    expect(screen.getByText('3.0 Ko')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('−1')).toBeInTheDocument();
    expect(screen.getAllByText('ligne actuelle').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('ligne supprimée')).toBeInTheDocument();
    expect(screen.getByText('ligne ajoutée')).toBeInTheDocument();
    expect(screen.getByText('Versions synchronisées dans le cloud (fallback local hors-ligne).')).toBeInTheDocument();

    expect(mockNormalizeForDiff).toHaveBeenCalledWith('ligne actuelle\nligne ajoutée', 'document');
    expect(mockNormalizeForDiff).toHaveBeenCalledWith(VERSION_ONE.content, 'document');
    expect(mockDiffLines).toHaveBeenCalledWith(VERSION_ONE.content, 'ligne actuelle\nligne ajoutée');
    expect(mockSummarizeDiff).toHaveBeenCalledWith(DIFF_OPS);
  });

  it('affiche une erreur explicite quand la création est demandée sans document enregistré', async () => {
    const user = userEvent.setup();

    renderDialog({ documentId: undefined });

    expect(screen.getByText('0 version — 50 max.')).toBeInTheDocument();
    expect(screen.getByText("Aucune version enregistrée pour l'instant.")).toBeInTheDocument();
    expect(mockListVersions).not.toHaveBeenCalled();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Créer/ }));
    });

    expect(mockToastError).toHaveBeenCalledWith('Enregistrez le document avant de créer une version');
    expect(mockSaveVersion).not.toHaveBeenCalled();
  });

  it('crée une version nommée avec le contenu courant et rafraîchit la liste', async () => {
    const user = userEvent.setup();

    renderDialog();

    await waitFor(() => {
      expect(screen.getAllByText('Version initiale').length).toBeGreaterThanOrEqual(2);
    });

    const nameInput = screen.getByPlaceholderText('Nom (optionnel)');
    await user.type(nameInput, 'Version nommée');

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Créer/ }));
    });

    await waitFor(() => {
      expect(mockSaveVersion).toHaveBeenCalledWith('doc-1', 'ligne actuelle\nligne ajoutée', 'document', {
        auto: false,
        name: 'Version nommée',
      });
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Version « Version sauvegardée » créée');
    expect(mockListVersions.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(nameInput).toHaveValue('');
  });

  it('restaure la version sélectionnée après création du snapshot automatique défensif', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onRestore = vi.fn();

    renderDialog({ onOpenChange, onRestore });

    await waitFor(() => {
      expect(screen.getAllByText('Version initiale').length).toBeGreaterThanOrEqual(2);
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Restaurer/ }));
    });

    expect(screen.getByText('Restaurer cette version ?')).toBeInTheDocument();
    expect(screen.getByText(/Le contenu actuel sera remplacé par « Version initiale »/)).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByTestId('alert-action'));
    });

    await waitFor(() => {
      expect(mockSaveVersion).toHaveBeenCalledWith('doc-1', 'ligne actuelle\nligne ajoutée', 'document', {
        auto: true,
        name: 'Avant restauration',
      });
    });

    expect(onRestore).toHaveBeenCalledWith(VERSION_ONE.content, VERSION_ONE);
    expect(mockToastSuccess).toHaveBeenCalledWith('Restauré : « Version initiale »');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});