/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusSelectorHeader } from './StatusSelectorHeader';

const {
  PROFILE,
  PRESENCE_ROW,
  AUTO_UPSERT_RESULT,
  CHAIN_STATE,
  mockFrom,
  mockUseCurrentProfile,
  mockUseCalendarPresence,
} = vi.hoisted(() => {
  const PROFILE = { id: 'user-1', first_name: 'Test' };
  const PRESENCE_ROW = {
    status: 'busy',
    custom_status: 'Focus',
    custom_status_emoji: null,
    auto_status: false,
    calendar_event_id: null,
  };

  const CHAIN_STATE = {
    maybeSingleResult: { data: PRESENCE_ROW, error: null },
    maybeSinglePromise: null as Promise<{
      data: typeof PRESENCE_ROW | null;
      error: { message: string } | null;
    }> | null,
    upsertResult: { data: { ok: true }, error: null },
  };

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
      upsert: vi.fn(() => Promise.resolve(CHAIN_STATE.upsertResult)),
      single: vi.fn(() => Promise.resolve(CHAIN_STATE.maybeSingleResult)),
      maybeSingle: vi.fn(() =>
        CHAIN_STATE.maybeSinglePromise ?? Promise.resolve(CHAIN_STATE.maybeSingleResult)
      ),
      then: (onFulfilled: (value: { data: { ok: boolean }; error: null }) => unknown) =>
        Promise.resolve(CHAIN_STATE.upsertResult).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve(CHAIN_STATE.upsertResult).catch(onRejected),
    };
    return builder;
  };

  const mockFrom = vi.fn(() => createBuilder());
  const mockUseCurrentProfile = vi.fn(() => ({ data: PROFILE }));
  const mockUseCalendarPresence = vi.fn();

  return {
    PROFILE,
    PRESENCE_ROW,
    AUTO_UPSERT_RESULT: { data: { ok: true }, error: null },
    CHAIN_STATE,
    mockFrom,
    mockUseCurrentProfile,
    mockUseCalendarPresence,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: mockUseCurrentProfile,
}));

vi.mock('@/hooks/calendar/useCalendarPresence', () => ({
  useCalendarPresence: mockUseCalendarPresence,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/types/pulse', () => ({
  PRESENCE_STATUS_CONFIG: {
    active: { label: 'Actif', description: 'Disponible', bgColor: 'bg-green-500' },
    away: { label: 'Absent', description: 'Temporairement absent', bgColor: 'bg-yellow-500' },
    busy: { label: 'Occupé', description: 'Concentré sur une tâche', bgColor: 'bg-orange-500' },
    dnd: { label: 'Ne pas déranger', description: 'Notifications masquées', bgColor: 'bg-red-500' },
    in_meeting: { label: 'En réunion', description: 'En réunion', bgColor: 'bg-blue-500' },
  },
}));

vi.mock('lucide-react', () => {
  const Icon = ({ children }: { children?: React.ReactNode }) => <svg>{children}</svg>;
  return {
    Check: Icon,
    ChevronDown: Icon,
    Calendar: Icon,
    Clock: Icon,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', async () => {
  const ReactModule = await import('react');
  const MenuContext = ReactModule.createContext<{
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  } | null>(null);

  const DropdownMenu = ({ children }: { children?: React.ReactNode }) => {
    const [open, setOpen] = ReactModule.useState(false);
    return <MenuContext.Provider value={{ open, setOpen }}>{children}</MenuContext.Provider>;
  };

  const DropdownMenuTrigger = ({ children }: { children?: React.ReactNode; asChild?: boolean }) => {
    const ctx = ReactModule.useContext(MenuContext);
    if (!ctx) return <>{children}</>;
    return (
      <button onClick={() => ctx.setOpen((v) => !v)} type="button">
        {children}
      </button>
    );
  };

  const DropdownMenuContent = ({ children }: { children?: React.ReactNode }) => {
    const ctx = ReactModule.useContext(MenuContext);
    if (!ctx?.open) return null;
    return <div>{children}</div>;
  };

  const DropdownMenuItem = ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button type="button" disabled={disabled} className={className} onClick={onClick}>
      {children}
    </button>
  );

  const DropdownMenuSeparator = () => <hr />;

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
  };
});

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: React.ReactNode;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children?: React.ReactNode; className?: string }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input value={value} onChange={onChange} {...props} />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children?: React.ReactNode;
    htmlFor?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children?: React.ReactNode;
  }) => (
    <div data-value={value}>
      {children}
      <button type="button" onClick={() => onValueChange?.('60')}>
        choose-60
      </button>
      <button type="button" onClick={() => onValueChange?.('0')}>
        choose-0
      </button>
    </div>
  ),
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>Sélection</span>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children?: React.ReactNode; value: string }) => <div>{children}</div>,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children?: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('StatusSelectorHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    CHAIN_STATE.maybeSingleResult = { data: PRESENCE_ROW, error: null };
    CHAIN_STATE.maybeSinglePromise = null;
    CHAIN_STATE.upsertResult = AUTO_UPSERT_RESULT;
    mockUseCurrentProfile.mockReturnValue({ data: PROFILE });
    mockUseCalendarPresence.mockImplementation(() => undefined);
  });

  it('charge la présence initiale et affiche le statut métier récupéré', async () => {
    render(<StatusSelectorHeader />, { wrapper: createWrapper() });

    expect(screen.getByText('Actif')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Focus')).toBeInTheDocument();
    });

    expect(mockFrom).toHaveBeenCalledWith('pulse_presence');

    const firstBuilder = mockFrom.mock.results[0]?.value as {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
    };

    expect(firstBuilder.select).toHaveBeenCalledWith(
      'status, custom_status, custom_status_emoji, auto_status, calendar_event_id'
    );
    expect(firstBuilder.eq).toHaveBeenCalledWith('user_id', PROFILE.id);
    expect(firstBuilder.order).toHaveBeenCalledWith('last_seen_at', { ascending: false });
    expect(firstBuilder.limit).toHaveBeenCalledWith(1);
    expect(firstBuilder.maybeSingle).toHaveBeenCalled();
  });

  it('permet un changement rapide de statut et envoie un upsert cohérent', async () => {
    render(<StatusSelectorHeader />, { wrapper: createWrapper() });

    await screen.findByText('Focus');

    fireEvent.click(screen.getAllByRole('button')[0]);

    const awayButton = screen.getByText('Absent');
    fireEvent.click(awayButton);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    const secondBuilder = mockFrom.mock.results[1]?.value as {
      upsert: ReturnType<typeof vi.fn>;
    };

    expect(secondBuilder.upsert).toHaveBeenCalledTimes(1);

    const upsertArgs = secondBuilder.upsert.mock.calls[0];
    const payload = upsertArgs[0] as Record<string, unknown>;
    const options = upsertArgs[1] as Record<string, unknown>;

    expect(payload.user_id).toBe(PROFILE.id);
    expect(payload.status).toBe('away');
    expect(payload.custom_status).toBeNull();
    expect(payload.auto_status).toBe(false);
    expect(payload.conversation_id).toBeNull();
    expect(typeof payload.last_seen_at).toBe('string');
    expect(options).toEqual({ onConflict: 'user_id,conversation_id', ignoreDuplicates: false });
  });

  it('ouvre le dialogue de statut personnalisé, enregistre le message et la durée', async () => {
    render(<StatusSelectorHeader />, { wrapper: createWrapper() });

    await screen.findByText('Focus');

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByText('Définir un statut personnalisé'));

    expect(screen.getByText('Définir votre statut')).toBeInTheDocument();

    const input = screen.getByLabelText('Message (optionnel)');
    fireEvent.change(input, { target: { value: 'Déjeuner' } });

    fireEvent.click(screen.getByText('choose-60'));
    fireEvent.click(screen.getByText('Enregistrer'));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    const secondBuilder = mockFrom.mock.results[1]?.value as {
      upsert: ReturnType<typeof vi.fn>;
    };

    const upsertArgs = secondBuilder.upsert.mock.calls[0];
    const payload = upsertArgs[0] as Record<string, unknown>;

    expect(payload.status).toBe('busy');
    expect(payload.custom_status).toBe('Déjeuner');
    expect(payload.auto_status).toBe(false);
    expect(typeof payload.status_expires_at).toBe('string');

    await waitFor(() => {
      expect(screen.queryByText('Définir votre statut')).not.toBeInTheDocument();
    });
  });

  it('réagit au statut calendrier automatique et affiche le titre de réunion', async () => {
    mockUseCalendarPresence.mockImplementation(
      ({ onStatusChange }: { enabled: boolean; onStatusChange: (status: 'in_meeting', isAutomatic: boolean, event?: { title: string } | null) => void }) => {
        React.useEffect(() => {
          onStatusChange('in_meeting', true, { title: 'Réunion produit' });
        }, [onStatusChange]);
      }
    );

    CHAIN_STATE.maybeSingleResult = { data: null, error: null };

    render(<StatusSelectorHeader />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Réunion produit')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    const secondBuilder = mockFrom.mock.results[1]?.value as {
      upsert: ReturnType<typeof vi.fn>;
    };

    const payload = secondBuilder.upsert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe('in_meeting');
    expect(payload.auto_status).toBe(true);
    expect(payload.custom_status).toBe('Réunion produit');
  });

  it("n'écrase pas une transition calendrier par une hydratation initiale retardée", async () => {
    let resolvePresence!: (value: {
      data: typeof PRESENCE_ROW;
      error: null;
    }) => void;
    CHAIN_STATE.maybeSinglePromise = new Promise((resolve) => {
      resolvePresence = resolve;
    });
    mockUseCalendarPresence.mockImplementation(
      ({ onStatusChange }: { enabled: boolean; onStatusChange: (status: 'in_meeting', isAutomatic: boolean, event?: { title: string } | null) => void }) => {
        React.useEffect(() => {
          onStatusChange('in_meeting', true, { title: 'Réunion prioritaire' });
        }, [onStatusChange]);
      }
    );

    render(<StatusSelectorHeader />, { wrapper: createWrapper() });

    await screen.findByText('Réunion prioritaire');
    await act(async () => {
      resolvePresence({ data: PRESENCE_ROW, error: null });
      await CHAIN_STATE.maybeSinglePromise;
    });

    expect(screen.getByText('Réunion prioritaire')).toBeInTheDocument();
    expect(screen.queryByText('Focus')).not.toBeInTheDocument();
  });

  it('gère une réponse en erreur sans planter et conserve l’affichage par défaut', async () => {
    CHAIN_STATE.maybeSingleResult = { data: null, error: { message: 'x' } };

    render(<StatusSelectorHeader />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(screen.queryByText('Focus')).not.toBeInTheDocument();
  });
});
