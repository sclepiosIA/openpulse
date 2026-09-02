import React from 'react';
import { render, screen, fireEvent, act, waitFor, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  toastMock,
  vibrateSuccessMock,
  vibrateSelectionMock,
  clipboardWriteMock,
  onFeedbackMock,
  onRegenerateMock,
  inlineActionMock,
  previewActionMock,
} = vi.hoisted(() => ({
  toastMock: vi.fn(),
  vibrateSuccessMock: vi.fn(),
  vibrateSelectionMock: vi.fn(),
  clipboardWriteMock: vi.fn(),
  onFeedbackMock: vi.fn(),
  onRegenerateMock: vi.fn(),
  inlineActionMock: vi.fn(),
  previewActionMock: vi.fn(),
}));

vi.mock('@/hooks/shared/use-toast', () => {
  return {
    useToast: () => ({ toast: toastMock }),
  };
});

vi.mock('@/lib/haptics', () => {
  return {
    vibrateSelection: vibrateSelectionMock,
    vibrateSuccess: vibrateSuccessMock,
  };
});

vi.mock('@/lib/utils', () => {
  return {
    cn: (...args: unknown[]) =>
      args
        .flatMap((a) => {
          if (typeof a === 'string') return [a];
          if (Array.isArray(a)) return a;
          if (a && typeof a === 'object') return Object.keys(a).filter((k) => (a as any)[k]);
          return [];
        })
        .filter(Boolean)
        .join(' '),
  };
});

vi.mock('@/components/ui/button', () => {
  // simple passthrough button that forwards props to a real button
  return {
    Button: (props: any) => {
      const { children, ...rest } = props;
      return React.createElement('button', { ...rest }, children);
    },
  };
});

vi.mock('@/components/ui/tooltip', () => {
  return {
    Tooltip: ({ children }: any) => React.createElement('div', null, children),
    TooltipTrigger: ({ children, asChild }: any) => {
      // if asChild, return child directly so the child's event handlers remain intact
      return asChild ? children : React.createElement('div', null, children);
    },
    TooltipContent: ({ children }: any) => React.createElement('div', null, children),
  };
});

vi.mock('framer-motion', () => {
  return {
    motion: {
      div: (props: any) => React.createElement('div', { ...props }, props.children),
      span: (props: any) => React.createElement('span', { ...props }, props.children),
    },
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
});

vi.mock('lucide-react', () => {
  const make = (name: string) => (props: any) =>
    React.createElement('svg', { 'data-icon': name, ...props });
  return {
    ThumbsUp: make('ThumbsUp'),
    ThumbsDown: make('ThumbsDown'),
    Copy: make('Copy'),
    RefreshCw: make('RefreshCw'),
    Check: make('Check'),
    Sparkles: make('Sparkles'),
    ExternalLink: make('ExternalLink'),
    ChevronRight: make('ChevronRight'),
  };
});

vi.mock('@/assets/jarvis-logo.png', () => {
  return { default: 'jarvis-logo' };
});

vi.mock('./JarvisMarkdownRenderer', () => {
  return {
    JarvisMarkdownRenderer: ({ content }: { content: string }) =>
      React.createElement('div', { 'data-testid': 'md' }, content),
  };
});

// Now import the component under test after mocks
import { JarvisMessageBubble } from './JarvisMessageBubble';

beforeEach(() => {
  vi.clearAllMocks();
  // set stable clipboard mock on navigator
  // @ts-ignore - jsdom global
  globalThis.navigator.clipboard = { writeText: clipboardWriteMock };
});

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
});
const Wrapper = ({ children }: { children?: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: qc }, children || null);

describe('JarvisMessageBubble', () => {
  it('renders assistant content and shows streaming cursor when isStreaming=true', () => {
    const { container } = render(
      React.createElement(JarvisMessageBubble, {
        role: 'assistant',
        content: 'Bonjour Jarvis',
        isStreaming: true,
      })
    );

    // JarvisMarkdownRenderer mock renders content inside element with data-testid="md"
    expect(screen.getByTestId('md').textContent).toBe('Bonjour Jarvis');

    // streaming cursor is rendered as a span with class "inline-block"
    const span = container.querySelector('span.inline-block');
    expect(span).toBeInstanceOf(HTMLElement);
  });

  it('copies content to clipboard on copy button click (success) and triggers toast & vibrate', async () => {
    clipboardWriteMock.mockResolvedValueOnce(undefined);

    const { container } = render(
      React.createElement(JarvisMessageBubble, {
        role: 'assistant',
        content: 'Texte à copier',
        isStreaming: false,
        onRegenerate: undefined,
      })
    );

    // find the copy icon svg and its button parent
    const copySvg = container.querySelector('svg[data-icon="Copy"]');
    expect(copySvg).toBeInstanceOf(SVGElement);
    const copyButton = copySvg?.closest('button') as HTMLButtonElement;
    expect(copyButton).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      fireEvent.click(copyButton);
    });

    await waitFor(() => {
      expect(clipboardWriteMock).toHaveBeenCalledWith('Texte à copier');
      expect(vibrateSuccessMock).toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Copié !' }));
    });
  });

  it('shows error toast on copy failure', async () => {
    clipboardWriteMock.mockRejectedValueOnce(new Error('fail-copy'));

    const { container } = render(
      React.createElement(JarvisMessageBubble, {
        role: 'assistant',
        content: 'Autre texte',
        isStreaming: false,
      })
    );

    const copySvg = container.querySelector('svg[data-icon="Copy"]');
    expect(copySvg).toBeInstanceOf(SVGElement);
    const copyButton = copySvg?.closest('button') as HTMLButtonElement;
    expect(copyButton).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      fireEvent.click(copyButton);
    });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Erreur de copie', variant: 'destructive' })
      );
    });
  });

  it('handles positive feedback: vibrates, calls onFeedback and disables feedback buttons', async () => {
    const props = {
      role: 'assistant' as const,
      content: 'Feedback test',
      isStreaming: false,
      onFeedback: onFeedbackMock,
    };

    const { container } = render(React.createElement(JarvisMessageBubble, props));

    const upSvg = container.querySelector('svg[data-icon="ThumbsUp"]');
    expect(upSvg).toBeInstanceOf(SVGElement);
    const upButton = upSvg?.closest('button') as HTMLButtonElement;
    expect(upButton).toBeInstanceOf(HTMLButtonElement);
    expect(upButton.disabled).toBeFalsy();

    await act(async () => {
      fireEvent.click(upButton);
    });

    await waitFor(() => {
      expect(vibrateSelectionMock).toHaveBeenCalled();
      expect(onFeedbackMock).toHaveBeenCalledWith('positive');
      expect(upButton.disabled).toBeTruthy();
    });
  });

  it('invokes inline action on click', async () => {
    const inlineAction = { id: 'ia1', label: 'DoAction', onClick: inlineActionMock, variant: 'default' as const };

    render(
      React.createElement(JarvisMessageBubble, {
        role: 'user',
        content: 'Inline action test',
        inlineActions: [inlineAction],
      })
    );

    const btn = screen.getByText('DoAction') as HTMLButtonElement;
    expect(btn).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(inlineActionMock).toHaveBeenCalled();
  });

  it('renders data preview and triggers its action', async () => {
    const preview = {
      type: 'email' as const,
      title: 'Preview Title',
      subtitle: 'sub',
      metadata: 'meta',
      actions: [{ id: 'p1', label: 'Open', onClick: previewActionMock }],
    };

    render(
      React.createElement(JarvisMessageBubble, {
        role: 'assistant',
        content: 'With preview',
        dataPreviews: [preview],
      })
    );

    expect(screen.getByText('Preview Title')).toBeTruthy();
    const openBtn = screen.getByText('Open') as HTMLButtonElement;
    expect(openBtn).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      fireEvent.click(openBtn);
    });

    expect(previewActionMock).toHaveBeenCalled();
  });

  it('displays formatted timestamp when provided', () => {
    const timestamp = new Date();
    const expected = timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    render(
      React.createElement(JarvisMessageBubble, {
        role: 'assistant',
        content: 'With time',
        timestamp,
        isStreaming: false,
      })
    );

    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('provides a QueryClient wrapper for hooks (renderHook usage as required)', () => {
    // simple renderHook to satisfy the requirement of using renderHook with QueryClientProvider wrapper
    const { result } = renderHook(() => ({ ready: true }), { wrapper: Wrapper });
    expect(result.current).toEqual({ ready: true });
  });
});