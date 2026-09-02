/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SignatureTab from './SignatureTab';

const {
  REQUEST_ACTIVE,
  REQUEST_COMPLETED,
  EVENTS,
  mockUseSignatureRequest,
  mockUseSignatureEvents,
  mockRemindMutate,
  mockCancelMutate,
  mockUseRemindSignature,
  mockUseCancelSignature,
  mockOnOpenSendDialog,
  mockFrom,
} = vi.hoisted(() => ({
  REQUEST_ACTIVE: {
    id: 'req-1',
    status: 'sent',
    created_at: '2024-01-01T10:00:00.000Z',
    expire_at: '2024-02-01T10:00:00.000Z',
    provider_url: 'https://example.test/docuseal',
    reminders_sent: 2,
    last_reminder_at: '2024-01-03T10:00:00.000Z',
    signers: [
      {
        name: 'Alice Martin',
        email: 'alice@example.test',
        role: 'Client',
        status: 'viewed',
        signed_at: null,
      },
      {
        name: 'Bob Durand',
        email: 'bob@example.test',
        role: 'Co-signataire',
        status: 'pending',
        signed_at: null,
      },
    ],
    signed_document_path: null,
    document_hash: null,
    completed_at: null,
  },
  REQUEST_COMPLETED: {
    id: 'req-2',
    status: 'completed',
    created_at: '2024-01-01T10:00:00.000Z',
    expire_at: '2024-02-01T10:00:00.000Z',
    provider_url: 'https://example.test/docuseal-finished',
    reminders_sent: 0,
    last_reminder_at: null,
    signers: [
      {
        name: 'Alice Martin',
        email: 'alice@example.test',
        role: 'Client',
        status: 'signed',
        signed_at: '2024-01-05T10:00:00.000Z',
      },
    ],
    signed_document_path: '/signed/contract.pdf',
    document_hash: 'hash-123',
    completed_at: '2024-01-05T10:00:00.000Z',
  },
  EVENTS: [
    { id: 'e1', type: 'sent', created_at: '2024-01-01T10:00:00.000Z' },
    { id: 'e2', type: 'viewed', created_at: '2024-01-02T10:00:00.000Z' },
  ],
  mockUseSignatureRequest: vi.fn(),
  mockUseSignatureEvents: vi.fn(),
  mockRemindMutate: vi.fn(),
  mockCancelMutate: vi.fn(),
  mockUseRemindSignature: vi.fn(),
  mockUseCancelSignature: vi.fn(),
  mockOnOpenSendDialog: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock('@/hooks/contracts/useSignatureRequest', () => ({
  useSignatureRequest: mockUseSignatureRequest,
  useRemindSignature: mockUseRemindSignature,
  useCancelSignature: mockUseCancelSignature,
}));

vi.mock('@/hooks/contracts/useSignatureEvents', () => ({
  useSignatureEvents: mockUseSignatureEvents,
}));

vi.mock('@/types/signature', () => ({
  SIGNATURE_STATUS_COLORS: {
    sent: 'bg-blue-100 text-blue-700',
    viewed: 'bg-amber-100 text-amber-700',
    signed: 'bg-green-100 text-green-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  },
  SIGNATURE_STATUS_LABELS: {
    sent: 'Envoyée',
    viewed: 'Consultée',
    signed: 'Signée',
    completed: 'Terminée',
    cancelled: 'Annulée',
  },
}));

vi.mock('date-fns', () => ({
  format: vi.fn(() => '01/02/2024'),
  formatDistanceToNow: vi.fn(() => 'il y a 2 jours'),
}));

vi.mock('date-fns/locale', () => ({
  fr: {},
}));

vi.mock('./SignatureTimeline', () => ({
  default: ({ events }: { events: Array<{ id: string }> }) => (
    <div data-testid="signature-timeline">Timeline:{events.length}</div>
  ),
}));

vi.mock('./SignedDocumentCard', () => ({
  default: ({
    path,
    documentHash,
    completedAt,
  }: {
    path: string;
    documentHash: string;
    completedAt: string;
  }) => (
    <div data-testid="signed-document-card">
      {path}|{documentHash}|{completedAt}
    </div>
  ),
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({
    open,
    title,
    description,
    onConfirm,
  }: {
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <div>{title}</div>
        <div>{description}</div>
        <button onClick={onConfirm}>Confirmer annulation</button>
      </div>
    ) : null,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    asChild,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    asChild?: boolean;
    disabled?: boolean;
  }) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        onClick,
        'data-disabled': disabled ? 'true' : 'false',
      });
    }
    return (
      <button onClick={onClick} disabled={disabled}>
        {children}
      </button>
    );
  },
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('lucide-react', () => ({
  Send: () => <svg data-testid="icon-send" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
  XCircle: () => <svg data-testid="icon-cancel" />,
  FileSignature: () => <svg data-testid="icon-file-signature" />,
  ExternalLink: () => <svg data-testid="icon-external-link" />,
  Clock: () => <svg data-testid="icon-clock" />,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('SignatureTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseRemindSignature.mockReturnValue({
      mutate: mockRemindMutate,
      isPending: false,
    });

    mockUseCancelSignature.mockReturnValue({
      mutate: mockCancelMutate,
      isPending: false,
    });

    mockUseSignatureEvents.mockReturnValue({
      data: EVENTS,
    });
  });

  it('affiche le chargement quand la requête est en cours', () => {
    mockUseSignatureRequest.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(
      <SignatureTab
        contratId="contract-1"
        contratStatut="draft"
        onOpenSendDialog={mockOnOpenSendDialog}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Chargement…')).toBeInTheDocument();
  });

  it('affiche l’état sans demande et permet d’ouvrir le dialogue d’envoi', () => {
    mockUseSignatureRequest.mockReturnValue({
      data: null,
      isLoading: false,
    });

    render(
      <SignatureTab
        contratId="contract-1"
        contratStatut="draft"
        onOpenSendDialog={mockOnOpenSendDialog}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Aucune demande de signature')).toBeInTheDocument();
    expect(screen.getByText(/Lancez une signature électronique via DocuSeal/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Demander une signature/i }));

    expect(mockOnOpenSendDialog).toHaveBeenCalledTimes(1);
  });

  it('affiche les données métier d’une demande active et déclenche les relances/cancel', () => {
    mockUseSignatureRequest.mockReturnValue({
      data: REQUEST_ACTIVE,
      isLoading: false,
    });

    render(
      <SignatureTab
        contratId="contract-1"
        contratStatut="sent"
        onOpenSendDialog={mockOnOpenSendDialog}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Demande de signature')).toBeInTheDocument();
    expect(screen.getByText('Envoyée')).toBeInTheDocument();
    expect(screen.getByText('Signataires (2)')).toBeInTheDocument();
    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.getByText('alice@example.test · Client')).toBeInTheDocument();
    expect(screen.getByText('Bob Durand')).toBeInTheDocument();
    expect(screen.getByText('bob@example.test · Co-signataire')).toBeInTheDocument();
    expect(screen.getByText('Consulté')).toBeInTheDocument();
    expect(screen.getByText('2 relance(s) envoyée(s) · dernière il y a 2 jours')).toBeInTheDocument();
    expect(screen.getByTestId('signature-timeline')).toHaveTextContent('Timeline:2');
    expect(screen.getByRole('link', { name: /Ouvrir DocuSeal/i })).toHaveAttribute(
      'href',
      'https://example.test/docuseal'
    );

    const remindButtons = screen.getAllByRole('button');
    fireEvent.click(remindButtons.find((button) => button.textContent?.includes('Relancer')) as HTMLButtonElement);
    expect(mockRemindMutate).toHaveBeenCalledWith({ requestId: 'req-1' });

    fireEvent.click(remindButtons[remindButtons.length - 1]);
    expect(mockRemindMutate).toHaveBeenCalledWith({
      requestId: 'req-1',
      signerEmail: 'bob@example.test',
    });

    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Confirmer annulation/i }));
    expect(mockCancelMutate).toHaveBeenCalledWith({ requestId: 'req-1' });
  });

  it('affiche le document signé pour une demande terminée', () => {
    mockUseSignatureRequest.mockReturnValue({
      data: REQUEST_COMPLETED,
      isLoading: false,
    });

    render(
      <SignatureTab
        contratId="contract-2"
        contratStatut="completed"
        onOpenSendDialog={mockOnOpenSendDialog}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Terminée')).toBeInTheDocument();
    expect(screen.getByText('Signataires (1)')).toBeInTheDocument();
    expect(screen.getByTestId('signed-document-card')).toHaveTextContent(
      '/signed/contract.pdf|hash-123|2024-01-05T10:00:00.000Z'
    );
    expect(screen.queryByRole('button', { name: /Relancer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Annuler/i })).not.toBeInTheDocument();
  });

  it('propage une erreur des hooks de données', () => {
    const error = new Error('x');
    mockUseSignatureRequest.mockImplementation(() => {
      throw error;
    });

    expect(() =>
      render(
        <SignatureTab
          contratId="contract-err"
          contratStatut="draft"
          onOpenSendDialog={mockOnOpenSendDialog}
        />,
        { wrapper: createWrapper() }
      )
    ).toThrow('x');
  });
});