import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TranscriptionShareModal } from './TranscriptionShareModal';

const { mockSetResponses, mockFrom, mockFunctionsInvoke } = vi.hoisted(() => {
  const responses = {
    participants: [],
    participantsError: null,
    sessionData: { status: 'processing' },
    sessionError: null,
    functionsInvokeResult: { error: null },
  };

  const setResponses = (partial: Partial<typeof responses>) => {
    Object.assign(responses, partial);
  };

  const builderFactory = (table: string) => {
    let maybeSingleFlag = false;
    const builder: any = {
      table,
      select: (_q: any) => builder,
      eq: (_k: any, _v: any) => builder,
      gte: (_k?: any, _v?: any) => builder,
      lte: (_k?: any, _v?: any) => builder,
      in: (_k?: any, _v?: any) => builder,
      order: (_k?: any, _v?: any) => builder,
      limit: (_n?: any) => builder,
      insert: (_d: any) => builder,
      update: (_d: any) => builder,
      delete: () => builder,
      single: () => {
        maybeSingleFlag = true;
        return builder;
      },
      maybeSingle: () => {
        maybeSingleFlag = true;
        return builder;
      },
      then: (onFulfilled: any) => {
        let payload: any = { data: null, error: null };
        if (table === 'visio_transcription_participants') {
          payload = { data: responses.participants, error: responses.participantsError };
        } else if (table === 'visio_transcription_sessions') {
          payload = { data: responses.sessionData, error: responses.sessionError };
        } else {
          payload = { data: null, error: null };
        }
        if (maybeSingleFlag && Array.isArray(payload.data)) {
          payload = { data: payload.data[0] || null, error: payload.error };
        }
        return Promise.resolve(payload).then(onFulfilled);
      },
      catch: (fn: any) => Promise.resolve().catch(fn),
    };
    // make thenable
    (builder as any).then = builder.then;
    (builder as any).catch = builder.catch;
    return builder;
  };

  const mockFromFn = vi.fn((table: string) => builderFactory(table));

  const mockInvoke = vi.fn(async (_fnName: string, _opts: any) => {
    return responses.functionsInvokeResult;
  });

  return {
    mockSetResponses: setResponses,
    mockFrom: mockFromFn,
    mockFunctionsInvoke: mockInvoke,
  };
});

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom,
      functions: {
        invoke: (...args: any[]) => mockFunctionsInvoke(...args),
      },
    },
  };
});

// Stable toast mocks
const { mockToastSuccess, mockToastError, mockToastInfo } = vi.hoisted(() => {
  return {
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockToastInfo: vi.fn(),
  };
});

vi.mock('sonner', () => {
  return {
    toast: {
      success: mockToastSuccess,
      error: mockToastError,
      info: mockToastInfo,
    },
  };
});

// Mock debug
const { mockDebugError, mockDebugWarn } = vi.hoisted(() => {
  return { mockDebugError: vi.fn(), mockDebugWarn: vi.fn() };
});
vi.mock('@/lib/debug', () => ({ debug: { error: mockDebugError, warn: mockDebugWarn } }));

// Mock UI components used by the module
vi.mock('@/components/ui/dialog', () => {
  const React = require('react');
  return {
    Dialog: (props: any) => React.createElement('div', { 'data-open': props.open, onClick: props.onOpenChange }, props.children),
    DialogContent: (props: any) => React.createElement('div', props, props.children),
    DialogHeader: (props: any) => React.createElement('div', props, props.children),
    DialogTitle: (props: any) => React.createElement('div', props, props.children),
    DialogFooter: (props: any) => React.createElement('div', props, props.children),
    DialogDescription: (props: any) => React.createElement('div', props, props.children),
  };
});

vi.mock('@/components/ui/button', () => {
  const React = require('react');
  return {
    Button: (props: any) =>
      React.createElement(
        'button',
        {
          ...props,
          type: props.type || 'button',
          onClick: props.onClick,
          'data-variant': props.variant,
          disabled: props.disabled,
          'aria-label': props['aria-label'],
        },
        props.children
      ),
  };
});

vi.mock('@/components/ui/checkbox', () => {
  const React = require('react');
  return {
    Checkbox: (props: any) =>
      React.createElement('input', {
        type: 'checkbox',
        id: props.id,
        checked: props.checked,
        onChange: () => props.onCheckedChange && props.onCheckedChange(!props.checked),
      }),
  };
});

vi.mock('@/components/ui/input', () => {
  const React = require('react');
  return {
    Input: (props: any) =>
      React.createElement('input', {
        ...props,
      }),
  };
});

vi.mock('@/components/ui/scroll-area', () => {
  const React = require('react');
  return {
    ScrollArea: (props: any) => React.createElement('div', props, props.children),
  };
});

vi.mock('@/components/ui/avatar', () => {
  const React = require('react');
  return {
    Avatar: (props: any) => React.createElement('div', props, props.children),
    AvatarFallback: (props: any) => React.createElement('div', props, props.children),
  };
});

// Mock lucide-react icons to simple spans
vi.mock('lucide-react', () => {
  const React = require('react');
  const Icon = (props: any) => React.createElement('span', props, props.children);
  return {
    Loader2: Icon,
    Mail: Icon,
    FileText: Icon,
    X: Icon,
  };
});

// Mock any other app imports that could affect react tree (no-op)
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 't@t.co' }, isLoading: false }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 't@t.co' }, isLoading: false }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

describe('TranscriptionShareModal', () => {
  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetResponses({
      participants: [],
      participantsError: null,
      sessionData: { status: 'processing' },
      sessionError: null,
      functionsInvokeResult: { error: null },
    });
  });

  it('renders processing state and shows no participants when none are returned', async () => {
    const queryClient = createQueryClient();

    renderHook(
      () => {
        return {};
      },
      {
        wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
      }
    );

    const onClose = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <TranscriptionShareModal open={true} onOpenChange={onOpenChange} sessionId={'s1'} onClose={onClose} />
      </QueryClientProvider>
    );

    expect(screen.getByText('Le résumé est en cours de génération...')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Aucun participant trouvé')).toBeTruthy();
    });

    expect(mockToastSuccess).not.toHaveBeenCalledWith('Résumé généré !');
  });

  it('fetches participants, selects emails, adds custom email and sends successfully', async () => {
    const queryClient = createQueryClient();

    mockSetResponses({
      participants: [
        { id: 'p1', display_name: 'Alice Example', profile: { email: 'alice@example.com' } },
        { id: 'p2', display_name: 'Bob NoEmail', profile: {} },
      ],
      sessionData: { status: 'archived', summary: 'summary text' },
      sessionError: null,
      functionsInvokeResult: { error: null },
    });

    renderHook(
      () => ({}),
      {
        wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
      }
    );

    const onClose = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <TranscriptionShareModal open={true} onOpenChange={onOpenChange} sessionId={'s-session'} onClose={onClose} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Example')).toBeTruthy();
      expect(screen.getByText('Bob NoEmail')).toBeTruthy();
      expect(screen.getByText('alice@example.com')).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText('1 destinataire(s) sélectionné(s)')).toBeTruthy();
    });

    const input = screen.getByPlaceholderText('Ajouter un email...');
    act(() => {
      fireEvent.change(input, { target: { value: 'new@custom.test' } });
    });

    const emailButton = screen.getByLabelText('E-mail');
    act(() => {
      fireEvent.click(emailButton);
    });

    await waitFor(() => {
      expect(screen.getByText('2 destinataire(s) sélectionné(s)')).toBeTruthy();
    });

    const sendButton = screen.getByText((content) => content === 'Envoyer');

    await act(async () => {
      fireEvent.click(sendButton);
      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalled();
      });
    });

    expect(mockFunctionsInvoke).toHaveBeenCalledWith(
      'send-transcription-email',
      expect.objectContaining({
        body: expect.objectContaining({
          sessionId: 's-session',
          emails: expect.arrayContaining(['alice@example.com', 'new@custom.test']),
        }),
      })
    );

    expect(onClose).toHaveBeenCalled();

    expect(mockToastSuccess).toHaveBeenCalledWith('Résumé généré !');

    expect(
      mockToastSuccess.mock.calls.find((c: any[]) => typeof c[0] === 'string' && c[0].includes('Compte-rendu envoyé'))
    ).toBeTruthy();
  });

  it('shows an error toast when sending fails and does not close the modal', async () => {
    const queryClient = createQueryClient();

    mockSetResponses({
      participants: [{ id: 'p1', display_name: 'Charlie', profile: { email: 'charlie@test' } }],
      sessionData: { status: 'archived', summary: 'ok' },
      sessionError: null,
      functionsInvokeResult: { error: { message: 'sending failed' } },
    });

    renderHook(
      () => ({}),
      {
        wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
      }
    );

    const onClose = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <TranscriptionShareModal open={true} onOpenChange={onOpenChange} sessionId={'s-err'} onClose={onClose} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeTruthy();
      expect(screen.getByText('charlie@test')).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText('1 destinataire(s) sélectionné(s)')).toBeTruthy();
    });

    const sendButton = screen.getByText((content) => content === 'Envoyer');

    await act(async () => {
      fireEvent.click(sendButton);
      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalled();
      });
    });

    expect(mockToastError).toHaveBeenCalledWith('sending failed');

    expect(onClose).not.toHaveBeenCalled();
  });
});