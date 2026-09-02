/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisAppleInput } from './JarvisAppleInput';

const { mockVibrateSelection } = vi.hoisted(() => ({
  mockVibrateSelection: vi.fn(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      whileTap: _whileTap,
      animate: _animate,
      layout: _layout,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      children?: React.ReactNode;
      whileTap?: unknown;
      animate?: unknown;
      layout?: unknown;
    }) => <div {...props}>{children}</div>,
  },
}));

vi.mock('lucide-react', () => ({
  ArrowUp: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-arrow-up" {...props} />,
  Mic: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-mic" {...props} />,
  Square: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-square" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    className,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/lib/haptics', () => ({
  vibrateSelection: mockVibrateSelection,
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

describe('JarvisAppleInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le placeholder et l’état initial désactivé quand la valeur est vide', () => {
    render(<JarvisAppleInput value="" onChange={vi.fn()} onSubmit={vi.fn()} placeholder="Écrire ici" />, {
      wrapper: createWrapper(),
    });

    const textarea = screen.getByPlaceholderText('Écrire ici');
    const submitButton = screen.getByRole('button', { name: 'Chargement' });

    expect(textarea).toHaveValue('');
    expect(submitButton).toBeDisabled();
    expect(screen.getByTestId('icon-arrow-up')).toBeInTheDocument();
  });

  it('déclenche onChange avec la valeur saisie réelle', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<JarvisAppleInput value="" onChange={onChange} onSubmit={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    const textarea = screen.getByPlaceholderText('Message...');
    await user.type(textarea, 'Bonjour');

    expect(onChange).toHaveBeenCalledTimes(7);
    expect(onChange).toHaveBeenNthCalledWith(1, 'B');
    expect(onChange).toHaveBeenLastCalledWith('r');
  });

  it('soumet au clic quand la valeur est non vide et déclenche la vibration', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<JarvisAppleInput value="Salut" onChange={vi.fn()} onSubmit={onSubmit} />, {
      wrapper: createWrapper(),
    });

    const submitButton = screen.getByRole('button', { name: 'Chargement' });

    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
  });

  it('soumet avec Enter sans Shift', () => {
    const onSubmit = vi.fn();

    render(<JarvisAppleInput value="Question" onChange={vi.fn()} onSubmit={onSubmit} />, {
      wrapper: createWrapper(),
    });

    const textarea = screen.getByPlaceholderText('Message...');

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
  });

  it('ne soumet pas avec Shift+Enter', () => {
    const onSubmit = vi.fn();

    render(<JarvisAppleInput value="Question" onChange={vi.fn()} onSubmit={onSubmit} />, {
      wrapper: createWrapper(),
    });

    const textarea = screen.getByPlaceholderText('Message...');

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(mockVibrateSelection).not.toHaveBeenCalled();
  });

  it('affiche l’état loading et bloque les interactions de soumission', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onVoiceToggle = vi.fn();

    render(
      <JarvisAppleInput
        value="Texte"
        onChange={vi.fn()}
        onSubmit={onSubmit}
        onVoiceToggle={onVoiceToggle}
        isLoading
      />,
      { wrapper: createWrapper() }
    );

    const textarea = screen.getByPlaceholderText('Message...');
    const submitButton = screen.getByRole('button', { name: 'Chargement' });
    const voiceButton = screen.getByRole('button', { name: 'Démarrer la dictée vocale' });

    expect(textarea).toBeDisabled();
    expect(submitButton).toBeDisabled();
    expect(voiceButton).toBeDisabled();
    expect(screen.getByTestId('icon-loader')).toBeInTheDocument();

    await user.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(mockVibrateSelection).not.toHaveBeenCalled();
  });

  it('gère le bouton vocal actif et déclenche onVoiceToggle avec vibration', async () => {
    const user = userEvent.setup();
    const onVoiceToggle = vi.fn();

    render(
      <JarvisAppleInput
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onVoiceToggle={onVoiceToggle}
        isVoiceActive
      />,
      { wrapper: createWrapper() }
    );

    const voiceButton = screen.getByRole('button', { name: 'Arrêter la dictée vocale' });

    expect(voiceButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('icon-square')).toBeInTheDocument();

    await user.click(voiceButton);

    expect(onVoiceToggle).toHaveBeenCalledTimes(1);
    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
  });

  it('désactive la saisie et la soumission si disabled=true mais laisse le bouton vocal cliquable', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onVoiceToggle = vi.fn();

    render(
      <JarvisAppleInput
        value="Contenu"
        onChange={vi.fn()}
        onSubmit={onSubmit}
        onVoiceToggle={onVoiceToggle}
        disabled
      />,
      { wrapper: createWrapper() }
    );

    const textarea = screen.getByPlaceholderText('Message...');
    const submitButton = screen.getByRole('button', { name: 'Chargement' });
    const voiceButton = screen.getByRole('button', { name: 'Démarrer la dictée vocale' });

    expect(textarea).toBeDisabled();
    expect(submitButton).toBeDisabled();
    expect(voiceButton).toBeEnabled();

    await user.click(voiceButton);
    expect(onVoiceToggle).toHaveBeenCalledTimes(1);
    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);

    await user.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('met à jour la hauteur de la textarea selon scrollHeight avec un plafond à 120px', () => {
    const { rerender } = render(<JarvisAppleInput value="Court" onChange={vi.fn()} onSubmit={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    const textarea = screen.getByPlaceholderText('Message...') as HTMLTextAreaElement;

    Object.defineProperty(textarea, 'scrollHeight', {
      configurable: true,
      get: () => 80,
    });

    rerender(<JarvisAppleInput value={'Ligne 1\nLigne 2'} onChange={vi.fn()} onSubmit={vi.fn()} />);

    expect(textarea.style.height).toBe('80px');

    Object.defineProperty(textarea, 'scrollHeight', {
      configurable: true,
      get: () => 160,
    });

    rerender(
      <JarvisAppleInput value={'L1\nL2\nL3\nL4\nL5\nL6'} onChange={vi.fn()} onSubmit={vi.fn()} />
    );

    expect(textarea.style.height).toBe('120px');
  });

  it('ajoute la classe de focus au conteneur lors du focus puis la retire au blur', () => {
    render(<JarvisAppleInput value="" onChange={vi.fn()} onSubmit={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    const textarea = screen.getByPlaceholderText('Message...');
    const container = textarea.closest('.relative.flex.items-end.gap-2.rounded-3xl');

    expect(container?.className).toContain('border-border/50');

    fireEvent.focus(textarea);
    expect(container?.className).toContain('border-primary/30');
    expect(container?.className).toContain('bg-muted/70');

    fireEvent.blur(textarea);
    expect(container?.className).toContain('border-border/50');
  });

  it('ne soumet pas si la valeur ne contient que des espaces', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<JarvisAppleInput value="   " onChange={vi.fn()} onSubmit={onSubmit} />, {
      wrapper: createWrapper(),
    });

    const submitButton = screen.getByRole('button', { name: 'Chargement' });
    const textarea = screen.getByPlaceholderText('Message...');

    expect(submitButton).toBeDisabled();

    await user.click(submitButton);
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(mockVibrateSelection).not.toHaveBeenCalled();
  });
});