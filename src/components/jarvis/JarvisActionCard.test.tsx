import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { JarvisActionCard } from './JarvisActionCard';

const {
  baseAction,
  actionWithSources,
  approveDeferred,
  rejectDeferred,
  approveMock,
  rejectMock,
  modifyMock,
  sourceBadgeMock,
} = vi.hoisted(() => {
  const createDeferred = () => {
    let resolve: (() => void) | undefined;
    let reject: ((reason?: unknown) => void) | undefined;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return {
      promise,
      resolve: () => {
        if (resolve) resolve();
      },
      reject: (reason?: unknown) => {
        if (reject) reject(reason);
      },
    };
  };

  return {
    baseAction: {
      id: 'action-1',
      expires_at: '2030-01-01T12:00:00.000Z',
      proposed_action: {
        type: 'send_email',
        confidence_score: 0.92,
        preview_text: 'Envoyer un email de suivi au prospect',
        reasoning: 'Le prospect a demandé une confirmation après démonstration.',
      },
      kb_sources: [],
    },
    actionWithSources: {
      id: 'action-2',
      expires_at: null,
      proposed_action: {
        type: 'summarize',
        confidence_score: 0.68,
        preview_text: 'Résumer les points clés de la réunion',
        reasoning: 'Les notes sont longues et doivent être synthétisées.',
      },
      kb_sources: [
        { article_id: 'art-1', title: 'Guide commercial' },
        { article_id: 'art-2', title: 'Script d’appel' },
      ],
    },
    approveDeferred: createDeferred(),
    rejectDeferred: createDeferred(),
    approveMock: vi.fn(),
    rejectMock: vi.fn(),
    modifyMock: vi.fn(),
    sourceBadgeMock: vi.fn(),
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      data-variant={variant}
      data-size={size}
      className={className}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value?: number; className?: string }) => (
    <div data-testid="progress" data-value={String(value ?? 0)} className={className} />
  ),
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({
    children,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  CollapsibleContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="collapsible-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '3 jours'),
}));

vi.mock('date-fns/locale', () => ({
  fr: {},
}));

vi.mock('./JarvisSourceBadge', () => ({
  JarvisSourceBadge: ({ source }: { source: { article_id: string; title?: string } }) => {
    sourceBadgeMock(source);
    return <div data-testid={`source-${source.article_id}`}>{source.title ?? source.article_id}</div>;
  },
}));

vi.mock('lucide-react', () => {
  const icon = (name: string) => ({ className }: { className?: string }) =>
    <svg data-testid={name} className={className} />;
  return {
    Mail: icon('mail-icon'),
    CheckSquare: icon('checksquare-icon'),
    Building2: icon('building2-icon'),
    Calendar: icon('calendar-icon'),
    Ticket: icon('ticket-icon'),
    Check: icon('check-icon'),
    X: icon('x-icon'),
    Pencil: icon('pencil-icon'),
    Clock: icon('clock-icon'),
    ChevronDown: icon('chevrondown-icon'),
    ChevronUp: icon('chevronup-icon'),
    Loader2: icon('loader2-icon'),
    BookOpen: icon('bookopen-icon'),
  };
});

describe('JarvisActionCard', () => {
  beforeEach(() => {
    approveMock.mockReset();
    rejectMock.mockReset();
    modifyMock.mockReset();
    sourceBadgeMock.mockClear();
    approveMock.mockImplementation(() => Promise.resolve());
    rejectMock.mockImplementation(() => Promise.resolve());
  });

  it('affiche les informations métier de l’action avec confiance, raisonnement et expiration', () => {
    render(
      <JarvisActionCard
        action={baseAction}
        onApprove={approveMock}
        onReject={rejectMock}
        onModify={modifyMock}
      />
    );

    expect(screen.getByText('Email à envoyer')).toBeInTheDocument();
    expect(screen.getAllByText('92%')).toHaveLength(2);
    expect(screen.getByText('Envoyer un email de suivi au prospect')).toBeInTheDocument();
    expect(screen.getByText(/Le prospect a demandé une confirmation/)).toBeInTheDocument();
    expect(screen.getByText('Confiance')).toBeInTheDocument();
    expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '92');
    expect(screen.getByText('Expire dans 3 jours')).toBeInTheDocument();
    expect(screen.getByTestId('mail-icon')).toBeInTheDocument();
  });

  it('affiche les sources KB et rend un badge par source', () => {
    render(
      <JarvisActionCard
        action={actionWithSources}
        onApprove={approveMock}
        onReject={rejectMock}
        onModify={modifyMock}
      />
    );

    expect(screen.getByText('Résumé')).toBeInTheDocument();
    expect(screen.getByText('2 sources utilisées')).toBeInTheDocument();
    expect(screen.getAllByText('68%')).toHaveLength(2);
    expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '68');
    expect(screen.getByTestId('source-art-1')).toBeInTheDocument();
    expect(screen.getByTestId('source-art-2')).toBeInTheDocument();
    expect(sourceBadgeMock).toHaveBeenCalledTimes(2);
    expect(sourceBadgeMock).toHaveBeenNthCalledWith(1, actionWithSources.kb_sources[0]);
    expect(sourceBadgeMock).toHaveBeenNthCalledWith(2, actionWithSources.kb_sources[1]);
  });

  it('déclenche onApprove avec l’id et désactive les actions pendant le traitement', async () => {
    approveMock.mockImplementation(() => approveDeferred.promise);

    render(
      <JarvisActionCard
        action={baseAction}
        onApprove={approveMock}
        onReject={rejectMock}
        onModify={modifyMock}
      />
    );

    const approveButton = screen.getByRole('button', { name: /Approuver/i });
    const modifyButton = screen.getByRole('button', { name: /Modifier/i });
    const buttons = screen.getAllByRole('button');
    const rejectButton = buttons.find((button) => button.textContent === '');

    if (!rejectButton) {
      throw new Error('Reject button not found');
    }

    fireEvent.click(approveButton);

    expect(approveMock).toHaveBeenCalledTimes(1);
    expect(approveMock).toHaveBeenCalledWith('action-1');

    await waitFor(() => {
      expect(approveButton).toBeDisabled();
      expect(modifyButton).toBeDisabled();
      expect(rejectButton).toBeDisabled();
    });

    approveDeferred.resolve();

    await waitFor(() => {
      expect(approveButton).not.toBeDisabled();
      expect(modifyButton).not.toBeDisabled();
      expect(rejectButton).not.toBeDisabled();
    });
  });

  it('déclenche onReject avec l’id et réactive les boutons après traitement', async () => {
    rejectMock.mockImplementation(() => rejectDeferred.promise);

    render(
      <JarvisActionCard
        action={baseAction}
        onApprove={approveMock}
        onReject={rejectMock}
        onModify={modifyMock}
      />
    );

    const approveButton = screen.getByRole('button', { name: /Approuver/i });
    const modifyButton = screen.getByRole('button', { name: /Modifier/i });
    const buttons = screen.getAllByRole('button');
    const rejectButton = buttons.find((button) => button.textContent === '');

    if (!rejectButton) {
      throw new Error('Reject button not found');
    }

    fireEvent.click(rejectButton);

    expect(rejectMock).toHaveBeenCalledTimes(1);
    expect(rejectMock).toHaveBeenCalledWith('action-1');

    await waitFor(() => {
      expect(approveButton).toBeDisabled();
      expect(modifyButton).toBeDisabled();
      expect(rejectButton).toBeDisabled();
    });

    rejectDeferred.resolve();

    await waitFor(() => {
      expect(approveButton).not.toBeDisabled();
      expect(modifyButton).not.toBeDisabled();
      expect(rejectButton).not.toBeDisabled();
    });
  });

  it('déclenche onModify avec l’id de l’action', () => {
    render(
      <JarvisActionCard
        action={baseAction}
        onApprove={approveMock}
        onReject={rejectMock}
        onModify={modifyMock}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Modifier/i }));

    expect(modifyMock).toHaveBeenCalledTimes(1);
    expect(modifyMock).toHaveBeenCalledWith('action-1');
  });

  it('désactive les boutons externement quand isApproving ou isRejecting est vrai et affiche le loader correspondant', () => {
    const { rerender } = render(
      <JarvisActionCard
        action={baseAction}
        onApprove={approveMock}
        onReject={rejectMock}
        onModify={modifyMock}
        isApproving
      />
    );

    const buttonsApproving = screen.getAllByRole('button');
    expect(buttonsApproving[0]).toBeDisabled();
    expect(buttonsApproving[1]).toBeDisabled();
    expect(buttonsApproving[2]).toBeDisabled();
    expect(screen.getByTestId('loader2-icon')).toBeInTheDocument();

    rerender(
      <JarvisActionCard
        action={baseAction}
        onApprove={approveMock}
        onReject={rejectMock}
        onModify={modifyMock}
        isRejecting
      />
    );

    const buttonsRejecting = screen.getAllByRole('button');
    expect(buttonsRejecting[0]).toBeDisabled();
    expect(buttonsRejecting[1]).toBeDisabled();
    expect(buttonsRejecting[2]).toBeDisabled();
    expect(screen.getByTestId('loader2-icon')).toBeInTheDocument();
  });

  it('utilise les valeurs par défaut quand proposed_action est absent', () => {
    render(
      <JarvisActionCard
        action={{
          id: 'action-3',
          expires_at: null,
          proposed_action: undefined,
          kb_sources: [],
        }}
        onApprove={approveMock}
        onReject={rejectMock}
        onModify={modifyMock}
      />
    );

    expect(screen.getByText('Tâche à créer')).toBeInTheDocument();
    expect(screen.getAllByText('0%')).toHaveLength(2);
    expect(screen.getByText('Action en attente de validation')).toBeInTheDocument();
    expect(screen.getByTestId('checksquare-icon')).toBeInTheDocument();
  });
});