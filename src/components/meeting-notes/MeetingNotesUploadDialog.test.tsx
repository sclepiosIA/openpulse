/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MeetingNotesUploadDialog } from './MeetingNotesUploadDialog';

const {
  mockFrom,
  stableUser,
  mockNavigate,
} = vi.hoisted(() => {
  const resolved = { data: null, error: null };

  const createBuilder = () => {
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
      single: vi.fn(async () => resolved),
      maybeSingle: vi.fn(async () => resolved),
      then: (
        onFulfilled?: ((value: typeof resolved) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null
      ) => Promise.resolve(resolved).then(onFulfilled ?? undefined, onRejected ?? undefined),
      catch: (onRejected?: ((reason: unknown) => unknown) | null) =>
        Promise.resolve(resolved).catch(onRejected ?? undefined),
    };
    return builder;
  };

  return {
    mockFrom: vi.fn(() => createBuilder()),
    stableUser: {
      user: { id: 'u1', email: 'user@test.local' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockNavigate: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => stableUser,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableUser,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableUser,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
    onOpenChange,
  }: {
    open: boolean;
    children: React.ReactNode;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="dialog-root" data-open={open ? 'true' : 'false'}>
      <button type="button" onClick={() => onOpenChange(false)}>
        dialog-close
      </button>
      {children}
    </div>
  ),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type = 'button',
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    children: React.ReactNode;
  }) => (
    <div>
      <select
        aria-label="Langue"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={disabled}
      >
        <option value="fr">🇫🇷 Français</option>
        <option value="en">🇬🇧 English</option>
        <option value="de">🇩🇪 Deutsch</option>
        <option value="es">🇪🇸 Español</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>value</span>,
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Upload: Icon,
    FileAudio: Icon,
    X: Icon,
    Loader2: Icon,
    CheckCircle2: Icon,
    XCircle: Icon,
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

describe('MeetingNotesUploadDialog', () => {
  it('crée un wrapper QueryClientProvider compatible renderHook', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => 'ready', { wrapper });

    expect(result.current).toBe('ready');
  });

  it('affiche l’état de chargement/traitement et bloque les actions', async () => {
    const onOpenChange = vi.fn();
    const onUpload = vi.fn();

    render(
      <MeetingNotesUploadDialog
        open={true}
        onOpenChange={onOpenChange}
        onUpload={onUpload}
        uploadStatus={{ status: 'uploading', message: 'Téléversement en cours' }}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Téléversement en cours')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /annuler/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /traitement/i })).toBeDisabled();
    expect(screen.getByText('Traitement...')).toBeInTheDocument();

    await act(async () => {
      await userEvent.setup().click(screen.getByText('dialog-close'));
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('sélectionne un fichier, préremplit le titre, change la langue et upload avec les valeurs métier attendues', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onUpload = vi.fn().mockResolvedValue('session-ok');

    const { container } = render(
      <MeetingNotesUploadDialog
        open={true}
        onOpenChange={onOpenChange}
        onUpload={onUpload}
        uploadStatus={{ status: 'idle', message: '' }}
      />,
      { wrapper: createWrapper() }
    );

    const file = new File(['audio-data'], 'Sprint_12-review.mp3', { type: 'audio/mp3' });
    const input = container.querySelector('input[type="file"]');
    if (!input) {
      throw new Error('file input not found');
    }

    await user.upload(input, file);

    expect(screen.getByText('Sprint_12-review.mp3')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sprint 12 review')).toBeInTheDocument();
    expect(screen.getByText('0.0 Mo')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Langue'), 'en');

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /transcrire/i }));
    });

    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload).toHaveBeenCalledWith(file, { title: 'Sprint 12 review', language: 'en' });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ex: Point hebdo Sprint 12')).toHaveValue('');
    });

    expect(screen.queryByText('Sprint_12-review.mp3')).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('ne retient pas un fichier trop volumineux et empêche la soumission', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockResolvedValue('session-ignore');

    const { container } = render(
      <MeetingNotesUploadDialog
        open={true}
        onOpenChange={vi.fn()}
        onUpload={onUpload}
        uploadStatus={{ status: 'idle', message: '' }}
      />,
      { wrapper: createWrapper() }
    );

    const oversized = new File(['x'], 'huge.mp3', { type: 'audio/mp3' });
    Object.defineProperty(oversized, 'size', { value: 51 * 1024 * 1024 });

    const input = container.querySelector('input[type="file"]');
    if (!input) {
      throw new Error('file input not found');
    }

    await user.upload(input, oversized);

    expect(screen.queryByText('huge.mp3')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: Point hebdo Sprint 12')).toHaveValue('');
    expect(screen.getByRole('button', { name: /transcrire/i })).toBeDisabled();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('affiche le succès métier avec le message fourni', () => {
    render(
      <MeetingNotesUploadDialog
        open={true}
        onOpenChange={vi.fn()}
        onUpload={vi.fn().mockResolvedValue('session-done')}
        uploadStatus={{ status: 'done', message: 'Transcription terminée' }}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Transcription terminée')).toBeInTheDocument();
  });

  it('affiche l’état d’erreur métier et permet la fermeture quand le traitement est terminé', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <MeetingNotesUploadDialog
        open={true}
        onOpenChange={onOpenChange}
        onUpload={vi.fn().mockResolvedValue(null)}
        uploadStatus={{ status: 'error', message: 'x' }}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('x')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /annuler/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /transcrire/i })).toBeDisabled();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /annuler/i }));
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('retire le fichier sélectionné via le bouton Fermer', async () => {
    const user = userEvent.setup();

    const { container } = render(
      <MeetingNotesUploadDialog
        open={true}
        onOpenChange={vi.fn()}
        onUpload={vi.fn().mockResolvedValue('session-remove')}
        uploadStatus={{ status: 'idle', message: '' }}
      />,
      { wrapper: createWrapper() }
    );

    const file = new File(['audio-data'], 'meeting.wav', { type: 'audio/wav' });
    const input = container.querySelector('input[type="file"]');
    if (!input) {
      throw new Error('file input not found');
    }

    await user.upload(input, file);
    expect(screen.getByText('meeting.wav')).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /fermer/i }));
    });

    expect(screen.queryByText('meeting.wav')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: Point hebdo Sprint 12')).toHaveValue('meeting');
    expect(screen.getByRole('button', { name: /transcrire/i })).toBeDisabled();
  });

  it('ne soumet pas si le titre est vide après trim', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockResolvedValue('session-nope');

    const { container } = render(
      <MeetingNotesUploadDialog
        open={true}
        onOpenChange={vi.fn()}
        onUpload={onUpload}
        uploadStatus={{ status: 'idle', message: '' }}
      />,
      { wrapper: createWrapper() }
    );

    const file = new File(['audio-data'], 'retro.mp3', { type: 'audio/mp3' });
    const input = container.querySelector('input[type="file"]');
    if (!input) {
      throw new Error('file input not found');
    }

    await user.upload(input, file);

    const titleInput = screen.getByPlaceholderText('Ex: Point hebdo Sprint 12');
    await user.clear(titleInput);
    await user.type(titleInput, '   ');

    expect(screen.getByRole('button', { name: /transcrire/i })).toBeDisabled();

    expect(onUpload).not.toHaveBeenCalled();
  });
});