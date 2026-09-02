import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuditLogViewer } from './AuditLogViewer';

const {
  MOCK_AUDIT_LOGS,
  MOCK_ARCHIVES,
  mockUsePulseAuditLog,
  mockUsePulseMessageArchives,
  mockRestoreArchivedMessage,
  mockToastSuccess,
  mockToastError,
  mockInvalidateQueries,
} = vi.hoisted(() => {
  const MOCK_AUDIT_LOGS = [
    {
      id: 'log1',
      created_at: '2024-01-01T10:00:00.000Z',
      action: 'message_created',
      actor_id: 'user1',
      status: 'success',
      details: { foo: 'bar' },
      error_message: null,
    },
    {
      id: 'log2',
      created_at: '2024-01-02T11:30:00.000Z',
      action: 'message_deleted',
      actor_id: null,
      status: 'failure',
      details: { reason: 'spam' },
      error_message: 'Suppression échouée',
    },
  ];

  const MOCK_ARCHIVES = [
    {
      id: 'arch1',
      deleted_at: '2024-01-03T12:00:00.000Z',
      deletion_reason: 'Contenu inapproprié',
      content_snapshot: {
        content: 'Message archivé 1',
        content_html: null,
        mentions: [],
        created_at: '2024-01-01T09:00:00.000Z',
      },
    },
  ];

  const mockUsePulseAuditLog = vi.fn();
  const mockUsePulseMessageArchives = vi.fn();
  const mockRestoreArchivedMessage = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockInvalidateQueries = vi.fn();

  return {
    MOCK_AUDIT_LOGS,
    MOCK_ARCHIVES,
    mockUsePulseAuditLog,
    mockUsePulseMessageArchives,
    mockRestoreArchivedMessage,
    mockToastSuccess,
    mockToastError,
    mockInvalidateQueries,
  };
});

// Mocks UI components
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (o: boolean) => void;
  }) => (
    <div data-testid="sheet-root" data-open={open} onClick={() => onOpenChange(open)}>
      {children}
    </div>
  ),
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({
    children,
    value,
    onValueChange,
    className,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
    className?: string;
  }) => (
    <div data-testid="tabs-root" data-value={value} data-class={className}>
      {React.Children.map(children, (child) => {
        if (
          React.isValidElement(child) &&
          (child.props as { value?: string }).value === value &&
          child.type === TabsContent
        ) {
          return React.cloneElement(child);
        }
        if (child.type === TabsList || child.type === TabsContent) {
          return child;
        }
        return child;
      })}
    </div>
  ),
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`tabs-content-${value}`}>{children}</div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({
    children,
    value,
    ...rest
  }: {
    children: React.ReactNode;
    value: string;
    onClick?: () => void;
  }) => (
    <button type="button" data-testid={`tabs-trigger-${value}`} {...rest}>
      {children}
    </button>
  ),
}));

// Dummy components to keep reference equality in Tabs mock
const TabsContent = ({ children, value }: { children: React.ReactNode; value: string }) => (
  <div data-testid={`tabs-content-${value}`}>{children}</div>
);
const TabsList = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <div
      data-testid={`select-${value || 'none'}`}
      onClick={() => onValueChange && onValueChange(value || '')}
    >
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`select-item-${value}`}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" data-class={className} />
  ),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

// Mock hooks
vi.mock('@/hooks/pulse/usePulseAuditLog', () => ({
  usePulseAuditLog: (filters: unknown) => mockUsePulseAuditLog(filters),
  usePulseMessageArchives: (conversationId?: string) =>
    mockUsePulseMessageArchives(conversationId),
  restoreArchivedMessage: (archiveId: string) => mockRestoreArchivedMessage(archiveId),
}));

// Mock react-query useQueryClient to return an object with invalidateQueries
vi.mock('@tanstack/react-query', async () => {
  const actual = await import('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

// Mock react-router-dom (MemoryRouter is used directly in test, but ensure no other hooks break)
vi.mock('react-router-dom', async () => {
  const actual = await import('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    MemoryRouter: actual.MemoryRouter,
  };
});

// Mock lucide-react icons to simple spans
vi.mock('lucide-react', () => {
  const Icon = ({ name }: { name: string }) => <span data-icon={name} />;
  return {
    Shield: () => <Icon name="Shield" />,
    RefreshCw: () => <Icon name="RefreshCw" />,
    Download: () => <Icon name="Download" />,
    Filter: () => <Icon name="Filter" />,
    RotateCcw: () => <Icon name="RotateCcw" />,
    MessageSquare: () => <Icon name="MessageSquare" />,
    Trash2: () => <Icon name="Trash2" />,
    Edit: () => <Icon name="Edit" />,
    UserPlus: () => <Icon name="UserPlus" />,
    UserMinus: () => <Icon name="UserMinus" />,
    Archive: () => <Icon name="Archive" />,
    Eye: () => <Icon name="Eye" />,
    CheckCircle: () => <Icon name="CheckCircle" />,
    XCircle: () => <Icon name="XCircle" />,
    Clock: () => <Icon name="Clock" />,
  };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe('AuditLogViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure URL methods exist in jsdom environment
    if (!('createObjectURL' in URL)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (URL as any).createObjectURL = vi.fn(() => 'blob:mock-default');
    }
    if (!('revokeObjectURL' in URL)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (URL as any).revokeObjectURL = vi.fn();
    }
  });

  it('affiche les skeletons de chargement pour les logs et les archives', () => {
    mockUsePulseAuditLog.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: vi.fn(),
    });
    mockUsePulseMessageArchives.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: vi.fn(),
    });

    renderWithProviders(
      <AuditLogViewer open={true} onOpenChange={() => {}} conversationId="conv1" />
    );

    expect(screen.getByText("Journal d'audit Pulse")).toBeInTheDocument();
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('affiche un message vide quand aucun log', () => {
    mockUsePulseAuditLog.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    mockUsePulseMessageArchives.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });

    renderWithProviders(
      <AuditLogViewer open={true} onOpenChange={() => {}} conversationId="conv1" />
    );

    expect(screen.getByText('Aucune entrée dans le journal')).toBeInTheDocument();
  });

  it('affiche les logs avec leurs actions, statut et messages d’erreur', () => {
    mockUsePulseAuditLog.mockReturnValue({
      data: MOCK_AUDIT_LOGS,
      isLoading: false,
      refetch: vi.fn(),
    });
    mockUsePulseMessageArchives.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });

    renderWithProviders(
      <AuditLogViewer open={true} onOpenChange={() => {}} conversationId="conv1" />
    );

    expect(screen.getByText('message created')).toBeInTheDocument();
    expect(screen.getByText('message deleted')).toBeInTheDocument();
    expect(screen.getByText('Suppression échouée')).toBeInTheDocument();
  });

  it('affiche les archives et permet de restaurer un message avec succès', async () => {
    const refetchArchives = vi.fn();

    mockUsePulseAuditLog.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    mockUsePulseMessageArchives.mockReturnValue({
      data: MOCK_ARCHIVES,
      isLoading: false,
      refetch: refetchArchives,
    });
    mockRestoreArchivedMessage.mockResolvedValue(true);

    renderWithProviders(
      <AuditLogViewer open={true} onOpenChange={() => {}} conversationId="conv1" />
    );

    const archivesTab = screen.getByTestId('tabs-trigger-archives');
    await act(async () => {
      fireEvent.click(archivesTab);
    });

    expect(screen.getByText('Message archivé 1')).toBeInTheDocument();

    const restoreButton = screen.getByText('Restaurer');
    await act(async () => {
      fireEvent.click(restoreButton);
    });

    expect(mockRestoreArchivedMessage).toHaveBeenCalledWith('arch1');
    expect(mockToastSuccess).toHaveBeenCalledWith('Message restauré avec succès');
    expect(refetchArchives).toHaveBeenCalled();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['pulse-messages'] });
  });

  it('affiche une erreur quand la restauration échoue', async () => {
    mockUsePulseAuditLog.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    mockUsePulseMessageArchives.mockReturnValue({
      data: MOCK_ARCHIVES,
      isLoading: false,
      refetch: vi.fn(),
    });
    mockRestoreArchivedMessage.mockResolvedValue(false);

    renderWithProviders(
      <AuditLogViewer open={true} onOpenChange={() => {}} conversationId="conv1" />
    );

    const archivesTab = screen.getByTestId('tabs-trigger-archives');
    await act(async () => {
      fireEvent.click(archivesTab);
    });

    const restoreButton = screen.getByText('Restaurer');
    await act(async () => {
      fireEvent.click(restoreButton);
    });

    expect(mockRestoreArchivedMessage).toHaveBeenCalledWith('arch1');
    expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la restauration');
  });

  it('exporte un CSV quand des logs sont présents', () => {
    mockUsePulseAuditLog.mockReturnValue({
      data: MOCK_AUDIT_LOGS,
      isLoading: false,
      refetch: vi.fn(),
    });
    mockUsePulseMessageArchives.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });

    const createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(() => 'blob:mock' as any);
    const revokeObjectURLSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    const clickMock = vi.fn();

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        const anchor: Partial<HTMLAnchorElement> = {
          click: clickMock,
        };
        return anchor as HTMLAnchorElement;
      }
      return originalCreateElement(tagName);
    });

    renderWithProviders(
      <AuditLogViewer open={true} onOpenChange={() => {}} conversationId="conv1" />
    );

    const csvButton = screen.getByText('CSV');
    fireEvent.click(csvButton);

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith('Export CSV téléchargé');
  });

  it('ne fait rien pour l’export CSV quand il n’y a pas de logs', () => {
    mockUsePulseAuditLog.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    mockUsePulseMessageArchives.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');

    renderWithProviders(
      <AuditLogViewer open={true} onOpenChange={() => {}} conversationId="conv1" />
    );

    const csvButton = screen.getByText('CSV');
    fireEvent.click(csvButton);

    expect(createObjectURLSpy).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('permet de rafraîchir les logs et les archives', () => {
    const refetchLogs = vi.fn();
    const refetchArchives = vi.fn();

    mockUsePulseAuditLog.mockReturnValue({
      data: MOCK_AUDIT_LOGS,
      isLoading: false,
      refetch: refetchLogs,
    });
    mockUsePulseMessageArchives.mockReturnValue({
      data: MOCK_ARCHIVES,
      isLoading: false,
      refetch: refetchArchives,
    });

    renderWithProviders(
      <AuditLogViewer open={true} onOpenChange={() => {}} conversationId="conv1" />
    );

    // Premier bouton de rafraîchissement dans l'onglet logs
    const refreshButtons = screen.getAllByRole('button');
    const refreshLogButton = refreshButtons.find(
      (btn) => btn.querySelector('[data-icon="RefreshCw"]') !== null
    );
    if (!refreshLogButton) {
      throw new Error('Bouton de rafraîchissement des logs non trouvé');
    }
    fireEvent.click(refreshLogButton);
    expect(refetchLogs).toHaveBeenCalled();

    const archivesTab = screen.getByTestId('tabs-trigger-archives');
    fireEvent.click(archivesTab);

    const refreshButtonsAfterTab = screen.getAllByRole('button');
    const refreshArchivesButton = refreshButtonsAfterTab
      .filter((btn) => btn.querySelector('[data-icon="RefreshCw"]') !== null)
      .slice(-1)[0];

    fireEvent.click(refreshArchivesButton);
    expect(refetchArchives).toHaveBeenCalled();
  });
});