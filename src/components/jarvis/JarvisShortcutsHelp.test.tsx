import React, { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { cnMock, DialogComponents, Icons, Motion, ButtonComp } = vi.hoisted(() => ({
  cnMock: (...values: Array<string | undefined | null | false>) => values.filter(Boolean).join(' '),
  DialogComponents: {
    Dialog: ({ open, children }: { open?: boolean; onOpenChange?: (v: boolean) => void; children?: React.ReactNode }) => (
      <div data-testid="dialog" data-open={open ? 'true' : 'false'}>{children}</div>
    ),
    DialogContent: ({ className, children }: { className?: string; children?: React.ReactNode }) => (
      <div className={className} data-testid="dialog-content">{children}</div>
    ),
    DialogHeader: ({ children }: { children?: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
    DialogTitle: ({ className, children }: { className?: string; children?: React.ReactNode }) => <h3 className={className}>{children}</h3>,
    DialogTrigger: ({ children }: { asChild?: boolean; children?: React.ReactNode }) => <>{children}</>,
  },
  Icons: {
    Keyboard: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="icon-keyboard" {...props} />,
    X: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="icon-x" {...props} />,
  },
  Motion: {
    Div: ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { initial?: unknown; animate?: unknown; transition?: unknown }) => (
      <div {...rest}>{children}</div>
    ),
  },
  ButtonComp: ({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button className={className} {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ButtonComp,
}));

vi.mock('@/components/ui/dialog', () => ({
  ...DialogComponents,
}));

vi.mock('lucide-react', () => ({
  ...Icons,
}));

vi.mock('framer-motion', () => ({
  motion: { div: Motion.Div },
}));

vi.mock('@/lib/utils', () => ({
  cn: cnMock,
}));

import { JarvisShortcutsHelp } from './JarvisShortcutsHelp';

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('JarvisShortcutsHelp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the shortcut trigger and lists all categories and shortcuts', () => {
    render(<JarvisShortcutsHelp />, { wrapper });

    const trigger = screen.getByRole('button', { name: /Raccourcis/i });
    expect(trigger).toBeInTheDocument();

    const content = screen.getByTestId('dialog-content');
    expect(content).toBeInTheDocument();

    // Title
    expect(screen.getByText('Raccourcis Jarvis')).toBeInTheDocument();

    // Category headings
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Saisie')).toBeInTheDocument();

    // Navigation
    expect(screen.getByText('Ouvrir/fermer Jarvis')).toBeInTheDocument();
    expect(screen.getByText('Fermer le panel')).toBeInTheDocument();
    expect(screen.getByText('Focus sur la recherche')).toBeInTheDocument();

    // Actions
    expect(screen.getByText('Envoyer le message')).toBeInTheDocument();
    expect(screen.getByText('Nouvelle conversation')).toBeInTheDocument();
    expect(screen.getByText('Activer/désactiver la voix')).toBeInTheDocument();

    // Input
    expect(screen.getByText('Ouvrir la palette de commandes')).toBeInTheDocument();
    expect(screen.getByText('Nouvelle ligne')).toBeInTheDocument();
    expect(screen.getByText('Message précédent (input vide)')).toBeInTheDocument();

    // Footer hint
    expect(screen.getByText((t) => t.includes('Tapez'))).toBeInTheDocument();
  });

  it('merges custom className onto the trigger button via cn()', () => {
    render(<JarvisShortcutsHelp className="extra-class" />, { wrapper });
    const trigger = screen.getByRole('button', { name: /Raccourcis/i });
    expect(trigger.className).toContain('extra-class');
    expect(trigger.className).toContain('h-7');
  });
});