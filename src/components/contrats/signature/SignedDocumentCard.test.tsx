/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SignedDocumentCard from './SignedDocumentCard';

const {
  TOAST_FN,
  CREATE_SIGNED_URL,
  OPEN_FN,
  FIXED_DATE,
} = vi.hoisted(() => ({
  TOAST_FN: vi.fn(),
  CREATE_SIGNED_URL: vi.fn(),
  OPEN_FN: vi.fn(),
  FIXED_DATE: '2024-02-03T14:05:00.000Z',
}));

vi.mock('@/services/contrats/signedDocumentUrl', () => ({
  createContratSignedUrl: CREATE_SIGNED_URL,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void | Promise<void>;
    disabled?: boolean;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
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
    <span data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

vi.mock('lucide-react', () => ({
  CheckCircle2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-check" {...props} />,
  Download: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-download" {...props} />,
  FileText: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-file" {...props} />,
  ShieldCheck: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-shield" {...props} />,
}));

vi.mock('date-fns', () => ({
  format: (date: Date) => {
    const d = String(date.getUTCDate()).padStart(2, '0');
    const month = 'février';
    const year = date.getUTCFullYear();
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${d} ${month} ${year} à ${hours}:${minutes}`;
  },
}));

vi.mock('date-fns/locale', () => ({
  fr: {},
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

describe('SignedDocumentCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'open', {
      writable: true,
      value: OPEN_FN,
    });
  });

  it('affiche les informations métier du document signé', () => {
    const Wrapper = createWrapper();

    render(
      <SignedDocumentCard
        path="contracts/customer/contrat-signe.pdf"
        documentHash="abc123def456"
        completedAt={FIXED_DATE}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('Document signé')).toBeInTheDocument();
    expect(screen.getByText('contrat-signe.pdf')).toBeInTheDocument();
    expect(screen.getByText('Complété le 03 février 2024 à 14:05')).toBeInTheDocument();
    expect(screen.getByText('Hash du document (SHA-256)')).toBeInTheDocument();
    expect(screen.getByText('abc123def456')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Télécharger le PDF signé/i })).toBeEnabled();
  });

  it('masque la date et le hash quand ils sont absents', () => {
    const Wrapper = createWrapper();

    render(<SignedDocumentCard path="contracts/final.pdf" documentHash={null} completedAt={null} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('final.pdf')).toBeInTheDocument();
    expect(screen.queryByText(/Complété le/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Hash du document (SHA-256)')).not.toBeInTheDocument();
  });

  it('gère le chargement puis le succès du téléchargement signé', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();

    let resolveUrl: ((value: string) => void) | undefined;
    CREATE_SIGNED_URL.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveUrl = resolve;
        })
    );

    render(
      <SignedDocumentCard
        path="contracts/customer/contrat-signe.pdf"
        documentHash="abc123def456"
        completedAt={FIXED_DATE}
      />,
      { wrapper: Wrapper }
    );

    const button = screen.getByRole('button', { name: /Télécharger le PDF signé/i });
    await user.click(button);

    expect(CREATE_SIGNED_URL).toHaveBeenCalledWith('contracts/customer/contrat-signe.pdf');
    expect(screen.getByRole('button', { name: /Génération…/i })).toBeDisabled();

    if (resolveUrl) {
      resolveUrl('https://example.test/signed.pdf');
    }

    await waitFor(() => {
      expect(OPEN_FN).toHaveBeenCalledWith('https://example.test/signed.pdf', '_blank', 'noopener');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Télécharger le PDF signé/i })).toBeEnabled();
    });

    expect(TOAST_FN).not.toHaveBeenCalled();
  });

  it('gère l’erreur de génération du lien signé et réactive le bouton', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();

    CREATE_SIGNED_URL.mockRejectedValueOnce(new Error('x'));

    render(
      <SignedDocumentCard
        path="contracts/customer/contrat-signe.pdf"
        documentHash="abc123def456"
        completedAt={FIXED_DATE}
      />,
      { wrapper: Wrapper }
    );

    await user.click(screen.getByRole('button', { name: /Télécharger le PDF signé/i }));

    await waitFor(() => {
      expect(TOAST_FN).toHaveBeenCalledWith({
        title: 'Erreur',
        description: 'Impossible de générer le lien signé',
        variant: 'destructive',
      });
    });

    expect(OPEN_FN).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Télécharger le PDF signé/i })).toBeEnabled();
    });
  });
});