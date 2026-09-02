import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { HTMLAttributes, ReactElement, ReactNode, SVGProps } from 'react';

type ClassValue = string | false | null | undefined | ClassValue[];

const {
  mockToast,
  mockVibrateSelection,
  mockVibrateSuccess,
  mockMarkdownRenderer,
  mockClipboardWriteText,
  USER_CONTENT,
  ASSISTANT_CONTENT,
  STREAMING_CONTENT,
} = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockVibrateSelection: vi.fn(),
  mockVibrateSuccess: vi.fn(),
  mockMarkdownRenderer: vi.fn(),
  mockClipboardWriteText: vi.fn(() => Promise.resolve()),
  USER_CONTENT: 'Bonjour Jarvis',
  ASSISTANT_CONTENT: 'Voici une réponse utile.',
  STREAMING_CONTENT: 'Réponse en cours',
}));

vi.mock('@/lib/utils', () => {
  const flatten = (value: ClassValue): string[] => {
    if (Array.isArray(value)) {
      return value.flatMap(flatten);
    }

    if (typeof value === 'string') {
      return [value];
    }

    return [];
  };

  return {
    cn: (...values: ClassValue[]) => values.flatMap(flatten).join(' '),
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    variant: _variant,
    size: _size,
    ...props
  }: HTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/lib/haptics', () => ({
  vibrateSelection: mockVibrateSelection,
  vibrateSuccess: mockVibrateSuccess,
}));

vi.mock('@/assets/jarvis-logo.png', () => ({
  default: 'jarvis-logo.png',
}));

vi.mock('./JarvisMarkdownRenderer', () => ({
  JarvisMarkdownRenderer: (props: { content: string }) => {
    mockMarkdownRenderer(props);

    return <div data-testid="markdown-content">{props.content}</div>;
  },
}));

vi.mock('lucide-react', () => {
  const Icon = ({ 'aria-label': ariaLabel, ...props }: SVGProps<SVGSVGElement>) => (
    <svg aria-label={ariaLabel} {...props} />
  );

  return {
    Check: Icon,
    Copy: Icon,
    RefreshCw: Icon,
    ThumbsUp: Icon,
    ThumbsDown: Icon,
  };
});

vi.mock('framer-motion', async () => {
  const ReactModule = await import('react');

  type MotionExtraProps = {
    initial?: unknown;
    animate?: unknown;
    exit?: unknown;
    transition?: unknown;
  };

  type MotionDivProps = HTMLAttributes<HTMLDivElement> & MotionExtraProps;
  type MotionSpanProps = HTMLAttributes<HTMLSpanElement> & MotionExtraProps;

  const MotionDiv = ReactModule.forwardRef<HTMLDivElement, MotionDivProps>(
    ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    ),
  );

  const MotionSpan = ReactModule.forwardRef<HTMLSpanElement, MotionSpanProps>(
    ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }, ref) => (
      <span ref={ref} {...props}>
        {children}
      </span>
    ),
  );

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: {
      div: MotionDiv,
      span: MotionSpan,
    },
  };
});

import { JarvisPremiumMessage } from './JarvisPremiumMessage';

const createQueryClient = () =>
  new QueryClient({
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

const renderWithProviders = (ui: ReactElement) => {
  const queryClient = createQueryClient();

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

const getRenderedRoot = (container: HTMLElement): Element => {
  const root = container.firstElementChild;

  if (root === null) {
    throw new Error('Racine du composant introuvable');
  }

  return root;
};

describe('JarvisPremiumMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockClipboardWriteText,
      },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('affiche un message utilisateur avec son contenu et son horodatage', () => {
    const timestamp = new Date(2024, 0, 2, 9, 5);

    renderWithProviders(
      <JarvisPremiumMessage
        role="user"
        content={USER_CONTENT}
        timestamp={timestamp}
        className="message-personnalise"
      />,
    );

    expect(screen.getByText(USER_CONTENT)).toBeInTheDocument();
    expect(screen.getByText('09:05')).toBeInTheDocument();
    expect(screen.queryByAltText('Jarvis')).not.toBeInTheDocument();
    expect(screen.queryByTestId('markdown-content')).not.toBeInTheDocument();
  });

  it('affiche un message assistant avec avatar, rendu markdown et actions après ouverture', () => {
    const timestamp = new Date(2024, 0, 2, 14, 30);
    const onFeedback = vi.fn();
    const onRegenerate = vi.fn();

    const { container } = renderWithProviders(
      <JarvisPremiumMessage
        role="assistant"
        content={ASSISTANT_CONTENT}
        timestamp={timestamp}
        onFeedback={onFeedback}
        onRegenerate={onRegenerate}
      />,
    );

    expect(screen.getByAltText('Jarvis')).toBeInTheDocument();
    expect(screen.getByText('14:30')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-content')).toHaveTextContent(ASSISTANT_CONTENT);
    expect(mockMarkdownRenderer).toHaveBeenCalledWith({ content: ASSISTANT_CONTENT });
    expect(screen.queryByRole('button', { name: /copier/i })).not.toBeInTheDocument();

    fireEvent.click(getRenderedRoot(container));

    expect(screen.getByRole('button', { name: /copier/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "J'aime" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Je n'aime pas" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualiser' })).toBeInTheDocument();
  });

  it('copie le contenu assistant dans le presse-papiers et affiche le retour de copie', async () => {
    const { container } = renderWithProviders(<JarvisPremiumMessage role="assistant" content={ASSISTANT_CONTENT} />);

    const root = getRenderedRoot(container);
    fireEvent.click(root);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copier/i }));
    });

    expect(mockClipboardWriteText).toHaveBeenCalledWith(ASSISTANT_CONTENT);
    expect(mockVibrateSuccess).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith({ description: 'Copié dans le presse-papiers' });

    fireEvent.click(root);

    expect(screen.getByRole('button', { name: /copié/i })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole('button', { name: /copier/i })).toBeInTheDocument();
  });

  it('transmet un feedback positif et déclenche la régénération', () => {
    const onFeedback = vi.fn();
    const onRegenerate = vi.fn();

    const { container } = renderWithProviders(
      <JarvisPremiumMessage
        role="assistant"
        content={ASSISTANT_CONTENT}
        onFeedback={onFeedback}
        onRegenerate={onRegenerate}
      />,
    );

    const root = getRenderedRoot(container);
    fireEvent.click(root);
    fireEvent.click(screen.getByRole('button', { name: "J'aime" }));

    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(onFeedback).toHaveBeenCalledWith('positive');
    expect(mockToast).toHaveBeenCalledWith({ description: 'Merci pour votre retour positif !' });

    fireEvent.click(root);
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));

    expect(mockVibrateSelection).toHaveBeenCalledTimes(2);
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('masque les actions et l’horodatage pendant le streaming', () => {
    const timestamp = new Date(2024, 0, 2, 18, 45);
    const onFeedback = vi.fn();
    const onRegenerate = vi.fn();

    const { container } = renderWithProviders(
      <JarvisPremiumMessage
        role="assistant"
        content={STREAMING_CONTENT}
        isStreaming
        timestamp={timestamp}
        onFeedback={onFeedback}
        onRegenerate={onRegenerate}
      />,
    );

    expect(screen.getByTestId('markdown-content')).toHaveTextContent(STREAMING_CONTENT);
    expect(screen.queryByText('18:45')).not.toBeInTheDocument();

    fireEvent.click(getRenderedRoot(container));

    expect(screen.queryByRole('button', { name: /copier/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "J'aime" })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualiser' })).not.toBeInTheDocument();
  });
});