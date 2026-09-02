import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIDiffOverlay } from './AIDiffOverlay';

const { mockToastSuccess, mockToastError, mockSanitize } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockSanitize: vi.fn((html: string) => html),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('dompurify', () => ({
  default: {
    sanitize: mockSanitize,
  },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children?: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('lucide-react', () => ({
  Check: () => null,
  X: () => null,
  Copy: () => null,
}));

function makeProps(overrides: Partial<Parameters<typeof AIDiffOverlay>[0]> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    actionLabel: 'Résumer',
    originalText: 'Texte original',
    proposal: 'Texte proposé par IA',
    onAccept: vi.fn(),
    onReject: vi.fn(),
    ...overrides,
  };
}

describe('AIDiffOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ne rend rien quand open=false', () => {
    render(<AIDiffOverlay {...makeProps({ open: false })} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('affiche le titre avec le libellé de l’action, le texte original et la proposition', () => {
    render(<AIDiffOverlay {...makeProps()} />);
    expect(screen.getByText('Aperçu IA — Résumer')).toBeInTheDocument();
    expect(
      screen.getByText("Vérifiez le résultat avant de l'insérer dans le document."),
    ).toBeInTheDocument();
    expect(screen.getByText('Texte original')).toBeInTheDocument();
    expect(screen.getByText('Texte proposé par IA')).toBeInTheDocument();
    expect(screen.getByText('Avant')).toBeInTheDocument();
    expect(screen.getByText('Proposition IA')).toBeInTheDocument();
  });

  it('affiche "(vide)" quand originalText est vide', () => {
    render(<AIDiffOverlay {...makeProps({ originalText: '' })} />);
    expect(screen.getByText('(vide)')).toBeInTheDocument();
  });

  it('sanitize et rend le HTML quand proposalIsHtml=true', () => {
    render(
      <AIDiffOverlay
        {...makeProps({ proposal: '<p>Contenu HTML</p>', proposalIsHtml: true })}
      />,
    );
    expect(mockSanitize).toHaveBeenCalledWith('<p>Contenu HTML</p>');
    expect(screen.getByText('Contenu HTML')).toBeInTheDocument();
  });

  it('appelle onAccept puis onOpenChange(false) au clic sur Accepter', async () => {
    const props = makeProps();
    render(<AIDiffOverlay {...props} />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Accepter' }));
    });
    expect(props.onAccept).toHaveBeenCalledTimes(1);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onReject).not.toHaveBeenCalled();
  });

  it('appelle onReject puis onOpenChange(false) au clic sur Rejeter', async () => {
    const props = makeProps();
    render(<AIDiffOverlay {...props} />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Rejeter' }));
    });
    expect(props.onReject).toHaveBeenCalledTimes(1);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onAccept).not.toHaveBeenCalled();
  });

  it('copie la proposition texte brut et affiche un toast de succès', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(<AIDiffOverlay {...makeProps()} />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Copier' }));
    });
    expect(writeText).toHaveBeenCalledWith('Texte proposé par IA');
    expect(mockToastSuccess).toHaveBeenCalledWith('Copié dans le presse-papier');
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('copie la proposition HTML en supprimant les balises', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(
      <AIDiffOverlay
        {...makeProps({ proposal: '<p>Contenu <b>riche</b></p>', proposalIsHtml: true })}
      />,
    );
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Copier' }));
    });
    expect(writeText).toHaveBeenCalledWith('Contenu riche');
    expect(mockToastSuccess).toHaveBeenCalledWith('Copié dans le presse-papier');
  });

  it('affiche un toast d’erreur si la copie échoue', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(<AIDiffOverlay {...makeProps()} />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Copier' }));
    });
    expect(mockToastError).toHaveBeenCalledWith('Impossible de copier');
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});