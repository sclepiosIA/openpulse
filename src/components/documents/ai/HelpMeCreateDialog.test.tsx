import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelpMeCreateDialog } from './HelpMeCreateDialog';

const {
  mockGetSession,
  mockFunctionsInvoke,
  mockFrom,
  mockToast,
  mockExportToPdf,
  mockProcessIcsUids,
  storedButtonOnClicks,
} = vi.hoisted(() => {
  const mockGetSession = vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'u1@example.com' } } } });
  const mockFunctionsInvoke = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockFrom = vi.fn();
  const mockToast = vi.fn();
  const mockExportToPdf = vi.fn().mockResolvedValue(undefined);
  const mockProcessIcsUids = vi.fn((html: string) => html);
  const storedButtonOnClicks: Array<((...args: any[]) => any) | undefined> = [];
  return {
    mockGetSession,
    mockFunctionsInvoke,
    mockFrom,
    mockToast,
    mockExportToPdf,
    mockProcessIcsUids,
    storedButtonOnClicks,
  };
});

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => {
  // chainable builder for completeness
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
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then(onFulfilled: any, onRejected: any) {
      return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
    },
    catch(onRejected: any) {
      return Promise.resolve({ data: null, error: null }).catch(onRejected);
    },
  };

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: mockGetSession,
      },
      functions: {
        invoke: mockFunctionsInvoke,
      },
      _builder: builder,
    },
  };
});

// Mock use-toast hook
vi.mock('@/hooks/shared/use-toast', () => {
  return {
    useToast: () => ({ toast: mockToast }),
  };
});

// Mock document export
vi.mock('@/lib/documentExport', () => {
  return {
    exportToPdf: mockExportToPdf,
  };
});

// Mock ics processor
vi.mock('@/lib/icsLinkPostProcessor', () => {
  return {
    processIcsUids: mockProcessIcsUids,
  };
});

// Mock UI components used in the module
vi.mock('@/components/ui/dialog', () => {
  return {
    Dialog: ({ children, open, onOpenChange }: any) => <div data-testid="dialog" data-open={open ? '1' : '0'}>{children}</div>,
    DialogContent: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
    DialogHeader: ({ children, ...rest }: any) => <header {...rest}>{children}</header>,
    DialogTitle: ({ children, ...rest }: any) => <h2 {...rest}>{children}</h2>,
    DialogDescription: ({ children, ...rest }: any) => <p {...rest}>{children}</p>,
  };
});

vi.mock('@/components/ui/button', () => {
  return {
    Button: ({ children, onClick, ...rest }: any) => {
      const idx = storedButtonOnClicks.length;
      storedButtonOnClicks.push(onClick);
      return (
        <button data-testid={`mock-button-${idx}`} onClick={onClick} {...rest}>
          {children}
        </button>
      );
    },
  };
});

vi.mock('@/components/ui/input', () => {
  return {
    Input: (props: any) => <input {...props} />,
  };
});
vi.mock('@/components/ui/textarea', () => {
  return {
    Textarea: (props: any) => <textarea {...props} />,
  };
});
vi.mock('@/components/ui/label', () => {
  return {
    Label: (props: any) => <label {...props} />,
  };
});
vi.mock('@/components/ui/badge', () => {
  return {
    Badge: (props: any) => <span {...props} />,
  };
});
vi.mock('@/components/ui/scroll-area', () => {
  return {
    ScrollArea: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  };
});
vi.mock('@/components/ui/separator', () => {
  return {
    Separator: (props: any) => <hr {...props} />,
  };
});
vi.mock('@/components/ui/select', () => {
  return {
    Select: ({ children, value, onValueChange }: any) => (
      <select value={value} onChange={(e) => onValueChange && onValueChange(e.target.value)}>
        {children}
      </select>
    ),
    SelectContent: ({ children }: any) => <div>{children}</div>,
    SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
    SelectTrigger: ({ children }: any) => <div>{children}</div>,
    SelectValue: () => null,
  };
});

// Mock utils.cn
vi.mock('@/lib/utils', () => {
  return {
    cn: (...parts: any[]) => parts.filter(Boolean).join(' '),
  };
});

// Mock dompurify
vi.mock('dompurify', () => {
  return {
    sanitize: (s: string) => s,
    default: {
      sanitize: (s: string) => s,
    },
  };
});

// Mock lucide-react icons to simple components
vi.mock('lucide-react', () => {
  const FakeIcon = (props: any) => <svg {...props} />;
  return {
    Sparkles: FakeIcon,
    FileText: FakeIcon,
    ClipboardList: FakeIcon,
    BarChart3: FakeIcon,
    FileCheck: FakeIcon,
    StickyNote: FakeIcon,
    Mail: FakeIcon,
    Building2: FakeIcon,
    CheckSquare: FakeIcon,
    Users: FakeIcon,
    Calendar: FakeIcon,
    Loader2: FakeIcon,
    Download: FakeIcon,
    Eye: FakeIcon,
    ChevronRight: FakeIcon,
    X: FakeIcon,
    ArrowLeft: FakeIcon,
    Settings2: FakeIcon,
    Receipt: FakeIcon,
    FileSpreadsheet: FakeIcon,
    RotateCcw: FakeIcon,
    MessageSquare: FakeIcon,
    Microscope: FakeIcon,
    GraduationCap: FakeIcon,
    UserPlus: FakeIcon,
    Headphones: FakeIcon,
    Wallet: FakeIcon,
    FileSignature: FakeIcon,
    FolderOpen: FakeIcon,
  };
});

// Mock react-router/dom navigate hooks if present
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

beforeEach(() => {
  storedButtonOnClicks.length = 0;
  vi.clearAllMocks();
});

// Helper to create QueryClient with exact options required
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

describe('HelpMeCreateDialog - generation flows', () => {
  it('renderHook wrapper works (sanity for QueryClientProvider wrapper requirement)', () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => {
      const [n, setN] = useState(0);
      return { n, setN };
    }, {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    expect(result.current.n).toBe(0);
    act(() => {
      result.current.setN(5);
    });
    expect(result.current.n).toBe(5);
  });

  it('successful generation calls supabase function and shows success toast', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } } });
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { html: '<p>generated</p>', sources_used: ['emails', 'taches'] },
      error: null,
    });

    mockProcessIcsUids.mockImplementationOnce((h: string) => h);

    const client = createTestQueryClient();

    const onOpenChange = vi.fn();
    const onDocumentCreated = vi.fn();

    const utils = render(
      <QueryClientProvider client={client}>
        <HelpMeCreateDialog open={true} onOpenChange={onOpenChange} onDocumentCreated={onDocumentCreated} defaultEtablissementId="etab-1" />
      </QueryClientProvider>
    );

    const titleInput = utils.getByPlaceholderText('Ex: Compte-rendu réunion Q1 2026') as HTMLInputElement;
    expect(titleInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Mon document IA' } });
    });
    expect(titleInput.value).toBe('Mon document IA');

    const generateButton = await screen.findByRole('button', { name: /génér/i });
    expect(generateButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(generateButton);
    });

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalled();
    });

    const [fnName, options] = mockFunctionsInvoke.mock.calls[0];
    expect(fnName).toBe('help-me-create-document');
    expect(options).toBeDefined();
    expect(options.body).toBeDefined();
    expect(options.body.document_type).toBe('compte_rendu');
    expect(options.body.title).toBe('Mon document IA');
    expect(Array.isArray(options.body.sources)).toBe(true);
    expect(options.body.sources).toContain('emails');

    const toastCalls = mockToast.mock.calls;
    const matched = toastCalls.some(call => {
      const arg = call[0];
      return arg && typeof arg.title === 'string' && arg.title.includes('Document généré');
    });
    expect(matched).toBe(true);
  });

  it('generation returns error from supabase -> shows destructive toast', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } } });
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    });

    const client = createTestQueryClient();
    const utils = render(
      <QueryClientProvider client={client}>
        <HelpMeCreateDialog open={true} onOpenChange={() => {}} />
      </QueryClientProvider>
    );

    const titleInput = utils.getByPlaceholderText('Ex: Compte-rendu réunion Q1 2026') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Titre erreur' } });
    });

    const generateButton = await screen.findByRole('button', { name: /génér/i });
    await act(async () => {
      fireEvent.click(generateButton);
    });

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalled();
    });

    const found = mockToast.mock.calls.some(call => {
      const arg = call[0];
      return arg && arg.title && arg.title.includes('Erreur de génération') && arg.variant === 'destructive';
    });
    expect(found).toBe(true);
  });

  it('generation without session triggers non connecté error toast and does not call invoke', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    mockFunctionsInvoke.mockClear();

    const client = createTestQueryClient();
    const utils = render(
      <QueryClientProvider client={client}>
        <HelpMeCreateDialog open={true} onOpenChange={() => {}} />
      </QueryClientProvider>
    );

    const titleInput = utils.getByPlaceholderText('Ex: Compte-rendu réunion Q1 2026') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Titre offline' } });
    });

    const generateButton = await screen.findByRole('button', { name: /génér/i });
    await act(async () => {
      fireEvent.click(generateButton);
    });

    await waitFor(() => {
      expect(mockFunctionsInvoke).not.toHaveBeenCalled();
    });

    const found = mockToast.mock.calls.some(call => {
      const arg = call[0];
      return arg && arg.title && arg.title.includes('Erreur de génération') && typeof arg.description === 'string' && arg.description.includes('Non connecté');
    });
    expect(found).toBe(true);
  });
});