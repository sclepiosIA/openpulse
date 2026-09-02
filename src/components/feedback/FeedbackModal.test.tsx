/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeedbackModal } from './FeedbackModal';

const {
  AUTH_STATE,
  LOCATION_STATE,
  LOGS,
  ERROR_LOGS,
  toastSpy,
  onOpenChangeSpy,
  debugErrorSpy,
  insertSpy,
  uploadSpy,
  getPublicUrlSpy,
  fromExtendedSpy,
  mockFrom,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const LOCATION_STATE = {
    pathname: '/feedback/page',
    search: '?tab=details',
  };

  const LOGS = [
    { timestamp: '2024-01-01T10:00:00.000Z', level: 'info', args: ['premier', 'log'] },
    { timestamp: '2024-01-01T10:01:00.000Z', level: 'error', args: ['erreur', 'console'] },
  ];

  const ERROR_LOGS = [
    { timestamp: '2024-01-01T10:01:00.000Z', level: 'error', args: ['erreur', 'console'] },
  ];

  return {
    AUTH_STATE,
    LOCATION_STATE,
    LOGS,
    ERROR_LOGS,
    toastSpy: vi.fn(),
    onOpenChangeSpy: vi.fn(),
    debugErrorSpy: vi.fn(),
    insertSpy: vi.fn(),
    uploadSpy: vi.fn(),
    getPublicUrlSpy: vi.fn(),
    fromExtendedSpy: vi.fn(),
    mockFrom: vi.fn(),
  };
});

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorSpy,
  },
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => LOCATION_STATE,
  useNavigate: () => vi.fn(),
}));

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: fromExtendedSpy,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}));

vi.mock('@/lib/consoleCapture', () => ({
  consoleCapture: {
    getLogs: () => LOGS,
    getErrorLogs: () => ERROR_LOGS,
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  return {
    supabase: {
      from: mockFrom.mockImplementation(() => builder),
      storage: {
        from: vi.fn(() => ({
          upload: uploadSpy,
          getPublicUrl: getPublicUrlSpy,
        })),
      },
    },
  };
});

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  DialogFooter: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    type = 'button',
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
    ...props
  }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label htmlFor={htmlFor} {...props}>
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Bug: Icon,
    Lightbulb: Icon,
    HelpCircle: Icon,
    MessageSquare: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    Image: Icon,
    Terminal: Icon,
    Send: Icon,
    Loader2: Icon,
    AlertTriangle: Icon,
    AlertCircle: Icon,
    Info: Icon,
    Minus: Icon,
  };
});

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

describe('FeedbackModal', () => {
  beforeAll(() => {
    vi.stubGlobal(
      'URL',
      Object.assign(globalThis.URL, {
        createObjectURL: vi.fn(() => 'blob:preview-url'),
        revokeObjectURL: vi.fn(),
      }),
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();

    AUTH_STATE.user = { id: 'u1', email: 'user@test.local' };
    LOCATION_STATE.pathname = '/feedback/page';
    LOCATION_STATE.search = '?tab=details';

    insertSpy.mockResolvedValue({ error: null });
    fromExtendedSpy.mockReturnValue({
      insert: insertSpy,
    });

    uploadSpy.mockResolvedValue({
      data: { path: 'u1/mock-feedback.png' },
      error: null,
    });

    getPublicUrlSpy.mockReturnValue({
      data: { publicUrl: 'https://public.local/feedback.png' },
    });
  });

  it('affiche les éléments clés, la preview screenshot et les logs capturés', () => {
    const screenshot = new Blob(['img'], { type: 'image/png' });
    render(<FeedbackModal open onOpenChange={onOpenChangeSpy} screenshot={screenshot} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Donner un retour')).toBeInTheDocument();
    expect(screen.getByLabelText(/Titre/i)).toHaveValue('');
    expect(screen.getByLabelText(/Description/i)).toHaveValue('');
    expect(screen.getByAltText("Capture d'écran")).toHaveAttribute('src', 'blob:preview-url');
    expect(screen.getByText(/Sera jointe automatiquement/i)).toBeInTheDocument();
    expect(screen.getByText(/Logs console \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 erreur/)).toBeInTheDocument();
    expect(screen.getByText(/INFO:/)).toBeInTheDocument();
    expect(screen.getByText(/premier log/)).toBeInTheDocument();
    expect(screen.getByText(/ERROR:/)).toBeInTheDocument();
    expect(screen.getByText(/erreur console/)).toBeInTheDocument();
  });

  it('valide le titre requis avant envoi', async () => {
    render(<FeedbackModal open onOpenChange={onOpenChangeSpy} screenshot={null} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Titre requis',
          description: 'Veuillez donner un titre à votre retour.',
          variant: 'destructive',
        }),
      );
    });

    expect(insertSpy).not.toHaveBeenCalled();
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it('soumet avec succès le feedback, upload le screenshot et ferme la modal', async () => {
    const screenshot = new Blob(['png'], { type: 'image/png' });

    render(<FeedbackModal open onOpenChange={onOpenChangeSpy} screenshot={screenshot} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Question' }));
    fireEvent.click(screen.getByRole('button', { name: 'Critique' }));

    fireEvent.change(screen.getByLabelText(/Titre/i), {
      target: { value: '  Un problème critique  ' },
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: '  Détails de reproduction  ' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(insertSpy).toHaveBeenCalledTimes(1);
    });

    expect(uploadSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^u1\/\d+-feedback\.png$/),
      screenshot,
      {
        contentType: 'image/png',
        upsert: false,
      },
    );

    expect(getPublicUrlSpy).toHaveBeenCalledWith('u1/mock-feedback.png');

    expect(fromExtendedSpy).toHaveBeenCalledWith('user_feedbacks');
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        type: 'question',
        priority: 'critical',
        title: 'Un problème critique',
        description: 'Détails de reproduction',
        screenshot_url: 'https://public.local/feedback.png',
        current_route: '/feedback/page?tab=details',
        console_logs: LOGS,
      }),
    );

    const insertArg = insertSpy.mock.calls[0][0] as {
      browser_info: {
        userAgent: string;
        language: string;
        platform: string;
        screenWidth: number;
        screenHeight: number;
        windowWidth: number;
        windowHeight: number;
        timestamp: string;
      };
    };

    expect(insertArg.browser_info.userAgent).toBe(navigator.userAgent);
    expect(insertArg.browser_info.language).toBe(navigator.language);
    expect(insertArg.browser_info.platform).toBe(navigator.platform);
    expect(insertArg.browser_info.screenWidth).toBe(window.screen.width);
    expect(insertArg.browser_info.screenHeight).toBe(window.screen.height);
    expect(insertArg.browser_info.windowWidth).toBe(window.innerWidth);
    expect(insertArg.browser_info.windowHeight).toBe(window.innerHeight);
    expect(insertArg.browser_info.timestamp).toEqual(expect.any(String));

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Merci pour votre retour ! 🙏',
          description: 'Votre feedback a été envoyé avec succès.',
        }),
      );
    });

    expect(onOpenChangeSpy).toHaveBeenCalledWith(false);
  });

  it('affiche une erreur si utilisateur non connecté', async () => {
    AUTH_STATE.user = null;

    render(<FeedbackModal open onOpenChange={onOpenChangeSpy} screenshot={null} />, {
      wrapper: createWrapper(),
    });

    fireEvent.change(screen.getByLabelText(/Titre/i), {
      target: { value: 'Retour sans connexion' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Non connecté',
          description: 'Vous devez être connecté pour envoyer un feedback.',
          variant: 'destructive',
        }),
      );
    });

    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("gère l'erreur d'insertion et affiche le toast d'échec", async () => {
    insertSpy.mockResolvedValue({
      error: { message: 'x' },
    });

    render(<FeedbackModal open onOpenChange={onOpenChangeSpy} screenshot={null} />, {
      wrapper: createWrapper(),
    });

    fireEvent.change(screen.getByLabelText(/Titre/i), {
      target: { value: 'Erreur insertion' },
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Contexte erreur' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(debugErrorSpy).toHaveBeenCalledWith('[FeedbackModal] Erreur soumission:', { message: 'x' });
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Erreur',
          description: "Impossible d'envoyer le feedback. Veuillez réessayer.",
          variant: 'destructive',
        }),
      );
    });

    expect(onOpenChangeSpy).not.toHaveBeenCalledWith(false);
  });

  it("continue l'envoi même si l'upload screenshot échoue", async () => {
    const screenshot = new Blob(['png'], { type: 'image/png' });

    uploadSpy.mockResolvedValue({
      data: null,
      error: { message: 'upload failed' },
    });

    render(<FeedbackModal open onOpenChange={onOpenChangeSpy} screenshot={screenshot} />, {
      wrapper: createWrapper(),
    });

    fireEvent.change(screen.getByLabelText(/Titre/i), {
      target: { value: 'Erreur upload' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(insertSpy).toHaveBeenCalledTimes(1);
    });

    expect(debugErrorSpy).toHaveBeenCalledWith('[FeedbackModal] Erreur upload screenshot:', { message: 'upload failed' });
    expect(getPublicUrlSpy).not.toHaveBeenCalled();
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        screenshot_url: null,
        title: 'Erreur upload',
      }),
    );
    expect(onOpenChangeSpy).toHaveBeenCalledWith(false);
  });

  it('réinitialise le formulaire quand la modal est fermée puis rouverte', () => {
    const { rerender } = render(<FeedbackModal open onOpenChange={onOpenChangeSpy} screenshot={null} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Amélioration' }));
    fireEvent.click(screen.getByRole('button', { name: 'Haute' }));
    fireEvent.change(screen.getByLabelText(/Titre/i), {
      target: { value: 'Texte à effacer' },
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Description à effacer' },
    });

    rerender(<FeedbackModal open={false} onOpenChange={onOpenChangeSpy} screenshot={null} />);
    rerender(<FeedbackModal open onOpenChange={onOpenChangeSpy} screenshot={null} />);

    expect(screen.getByLabelText(/Titre/i)).toHaveValue('');
    expect(screen.getByLabelText(/Description/i)).toHaveValue('');
  });
});