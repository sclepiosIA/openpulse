// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JarvisSmartInput } from './JarvisSmartInput';

const { vibrateSelection, vibrateSuccess, JARVIS_LAYOUT } = vi.hoisted(() => ({
  vibrateSelection: vi.fn(),
  vibrateSuccess: vi.fn(),
  JARVIS_LAYOUT: {
    safeArea: {
      bottom: 'safe-bottom-class',
    },
  },
}));

vi.mock('@/lib/haptics', () => ({
  vibrateSelection,
  vibrateSuccess,
}));

vi.mock('./JarvisDesignSystem', () => ({
  JARVIS_LAYOUT,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined | string[]>) =>
    classes
      .flatMap((item) => (Array.isArray(item) ? item : [item]))
      .filter(Boolean)
      .join(' '),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    'aria-label': ariaLabel,
    'aria-pressed': ariaPressed,
    title,
    type,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    className?: string;
    'aria-label'?: string;
    'aria-pressed'?: boolean;
    title?: string;
    type?: 'button' | 'submit' | 'reset';
    variant?: string;
    size?: string;
  }) => (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      title={title}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

vi.mock('framer-motion', async () => {
  const ReactModule = await import('react');

  const cleanProps = (props: Record<string, unknown>) => {
    const {
      initial,
      animate,
      exit,
      transition,
      whileHover,
      whileTap,
      layout,
      ...domProps
    } = props;
    void initial;
    void animate;
    void exit;
    void transition;
    void whileHover;
    void whileTap;
    void layout;
    return domProps;
  };

  const createComponent = (tag: 'div' | 'button' | 'p') =>
    ReactModule.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }>(
      ({ children, ...props }, ref) =>
        ReactModule.createElement(tag, { ...cleanProps(props), ref }, children)
    );

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: createComponent('div'),
      button: createComponent('button'),
      p: createComponent('p'),
    },
  };
});

vi.mock('lucide-react', () => {
  const Icon =
    (name: string) =>
    ({ className }: { className?: string }) =>
      <svg data-testid={name} className={className} />;

  return {
    ArrowUp: Icon('arrow-up'),
    Mic: Icon('mic'),
    Square: Icon('square'),
    Loader2: Icon('loader'),
    Sparkles: Icon('sparkles'),
    Zap: Icon('zap'),
    Mail: Icon('mail'),
    Calendar: Icon('calendar'),
  };
});

describe('JarvisSmartInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche les suggestions rapides quand la valeur est vide et déclenche onQuickAction avec le prompt réel', async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const onQuickAction = vi.fn();

    render(
      <JarvisSmartInput
        value=""
        onChange={onChange}
        onSubmit={onSubmit}
        onQuickAction={onQuickAction}
      />
    );

    expect(screen.getByText('Briefing')).toBeInTheDocument();
    expect(screen.getByText('Emails')).toBeInTheDocument();
    expect(screen.getByText('Tâches')).toBeInTheDocument();
    expect(screen.getByText('Agenda')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /briefing/i }));

    expect(vibrateSelection).toHaveBeenCalledTimes(1);
    expect(onQuickAction).toHaveBeenCalledWith('Génère mon briefing du jour');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('masque les suggestions quand la prop value devient non vide et appelle onChange avec les caractères saisis', async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    const { rerender } = render(
      <JarvisSmartInput
        value=""
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    const textarea = screen.getByPlaceholderText("Demandez-moi n'importe quoi...");

    await userEvent.type(textarea, 'Bonjour Jarvis');

    expect(onChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenNthCalledWith(1, 'B');
    expect(onChange).toHaveBeenLastCalledWith('s');

    rerender(
      <JarvisSmartInput
        value="Bonjour Jarvis"
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    expect(screen.queryByText('Briefing')).not.toBeInTheDocument();
    expect(screen.queryByText('Emails')).not.toBeInTheDocument();
    expect(screen.queryByText('Tâches')).not.toBeInTheDocument();
    expect(screen.queryByText('Agenda')).not.toBeInTheDocument();
  });

  it('soumet avec Entrée sans Shift quand la valeur est non vide', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <JarvisSmartInput
        value="Envoyer ceci"
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    const textarea = screen.getByDisplayValue('Envoyer ceci');
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(vibrateSelection).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('ne soumet pas avec Shift+Entrée', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <JarvisSmartInput
        value="Texte multiline"
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    const textarea = screen.getByDisplayValue('Texte multiline');
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(vibrateSelection).not.toHaveBeenCalled();
  });

  it('soumet via le bouton envoyer et déclenche vibrateSuccess quand canSubmit est vrai', async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <JarvisSmartInput
        value="Message prêt"
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    const submitButton = screen.getByRole('button', { name: 'Envoyer le message' });
    expect(submitButton).toBeEnabled();

    await userEvent.click(submitButton);

    expect(vibrateSuccess).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('désactive le bouton envoyer si la valeur est vide ou whitespace seulement', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <JarvisSmartInput
        value="   "
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByRole('button', { name: 'Envoyer le message' })).toBeDisabled();
  });

  it('gère le mode chargement avec icône loader et bouton voix désactivé', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const onVoiceToggle = vi.fn();

    render(
      <JarvisSmartInput
        value="Message"
        onChange={onChange}
        onSubmit={onSubmit}
        onVoiceToggle={onVoiceToggle}
        isLoading
      />
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByTestId('arrow-up')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Démarrer la dictée vocale' })).toBeDisabled();
  });

  it('toggle la dictée vocale avec les libellés et icônes corrects', async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const onVoiceToggle = vi.fn();

    const { rerender } = render(
      <JarvisSmartInput
        value=""
        onChange={onChange}
        onSubmit={onSubmit}
        onVoiceToggle={onVoiceToggle}
        isVoiceActive={false}
      />
    );

    const voiceButton = screen.getByRole('button', { name: 'Démarrer la dictée vocale' });
    expect(voiceButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('mic')).toBeInTheDocument();

    await userEvent.click(voiceButton);

    expect(vibrateSelection).toHaveBeenCalledTimes(1);
    expect(onVoiceToggle).toHaveBeenCalledTimes(1);

    rerender(
      <JarvisSmartInput
        value=""
        onChange={onChange}
        onSubmit={onSubmit}
        onVoiceToggle={onVoiceToggle}
        isVoiceActive
      />
    );

    expect(screen.getByRole('button', { name: 'Arrêter la dictée vocale' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('square')).toBeInTheDocument();
  });

  it('affiche l’indication clavier au focus quand il y a du texte puis la masque au blur', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <JarvisSmartInput
        value="Texte présent"
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    const textarea = screen.getByDisplayValue('Texte présent');

    fireEvent.focus(textarea);
    expect(screen.getByText(/pour envoyer/i)).toBeInTheDocument();
    expect(screen.getByText(/nouvelle ligne/i)).toBeInTheDocument();

    fireEvent.blur(textarea);
    expect(screen.queryByText(/pour envoyer/i)).not.toBeInTheDocument();
  });

  it('utilise le placeholder personnalisé et respecte disabled', async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const onVoiceToggle = vi.fn();

    render(
      <JarvisSmartInput
        value="Texte"
        onChange={onChange}
        onSubmit={onSubmit}
        onVoiceToggle={onVoiceToggle}
        placeholder="Écrivez votre demande"
        disabled
      />
    );

    expect(screen.getByPlaceholderText('Écrivez votre demande')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Envoyer le message' })).toBeDisabled();

    fireEvent.keyDown(screen.getByPlaceholderText('Écrivez votre demande'), { key: 'Enter', code: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Démarrer la dictée vocale' }));
    expect(onVoiceToggle).toHaveBeenCalledTimes(1);
  });

  it('quand onQuickAction est absent, injecte le prompt réel puis soumet après timeout', async () => {
    vi.useFakeTimers();

    try {
      const onChange = vi.fn();
      const onSubmit = vi.fn();

      render(
        <JarvisSmartInput
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /emails/i }));

      expect(vibrateSelection).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('Résume mes emails importants');
      expect(onSubmit).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(onSubmit).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ne montre pas les suggestions si showQuickSuggestions=false', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <JarvisSmartInput
        value=""
        onChange={onChange}
        onSubmit={onSubmit}
        showQuickSuggestions={false}
      />
    );

    expect(screen.queryByText('Briefing')).not.toBeInTheDocument();
    expect(screen.queryByText('Emails')).not.toBeInTheDocument();
    expect(screen.queryByText('Tâches')).not.toBeInTheDocument();
    expect(screen.queryByText('Agenda')).not.toBeInTheDocument();
  });
});