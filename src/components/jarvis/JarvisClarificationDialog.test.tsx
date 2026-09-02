// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { JarvisClarificationDialog, JarvisClarificationInline } from './JarvisClarificationDialog';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
    button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
      <button {...props}>{children}</button>
    ),
  },
}));

vi.mock('lucide-react', () => ({
  HelpCircle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="help-icon" {...props} />,
  Send: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="send-icon" {...props} />,
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="close-icon" {...props} />,
  MessageCircle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="message-icon" {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    className,
    variant,
    size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
    variant?: string;
    size?: string;
  }) => (
    <button data-variant={variant} data-size={size} className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
    props,
    ref
  ) {
    return <input ref={ref} {...props} />;
  }),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    variant,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode; variant?: string }) => (
    <div data-variant={variant} className={className} {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}));

describe('JarvisClarificationDialog', () => {
  const clarification = {
    id: 'clar-1',
    question: 'Quel format souhaitez-vous pour le rapport ?',
    options: ['PDF', 'Tableau', 'Résumé'],
    context: 'rapport',
    priority: 'high' as const,
  };

  it('affiche le contenu métier et la priorité importante', () => {
    const onAnswer = vi.fn();
    const onDismiss = vi.fn();

    render(
      <JarvisClarificationDialog
        clarification={clarification}
        onAnswer={onAnswer}
        onDismiss={onDismiss}
        className="custom-class"
      />
    );

    expect(screen.getByText("Jarvis a besoin d'une précision")).toBeInTheDocument();
    expect(screen.getByText('Quel format souhaitez-vous pour le rapport ?')).toBeInTheDocument();
    expect(screen.getByText('Important')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('Tableau')).toBeInTheDocument();
    expect(screen.getByText('Résumé')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ou tapez votre réponse...')).toBeInTheDocument();
    expect(screen.getByText('Appuyez sur Entrée ou cliquez sur une option')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: 'Fermer' });
    expect(closeButton).toBeInTheDocument();

    const sendButton = screen.getByRole('button', { name: 'Envoyer' });
    expect(sendButton).toBeDisabled();
  });

  it('appelle onDismiss au clic sur fermer', () => {
    const onAnswer = vi.fn();
    const onDismiss = vi.fn();

    render(
      <JarvisClarificationDialog
        clarification={clarification}
        onAnswer={onAnswer}
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('envoie une réponse prédéfinie au clic sur une option', () => {
    const onAnswer = vi.fn();
    const onDismiss = vi.fn();

    render(
      <JarvisClarificationDialog
        clarification={clarification}
        onAnswer={onAnswer}
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByText('Tableau'));

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith('Tableau');
  });

  it('active le bouton envoyer quand une réponse custom non vide est saisie puis envoie la valeur trimée et réinitialise le champ', () => {
    const onAnswer = vi.fn();
    const onDismiss = vi.fn();

    render(
      <JarvisClarificationDialog
        clarification={clarification}
        onAnswer={onAnswer}
        onDismiss={onDismiss}
      />
    );

    const input = screen.getByPlaceholderText('Ou tapez votre réponse...') as HTMLInputElement;
    const sendButton = screen.getByRole('button', { name: 'Envoyer' });

    fireEvent.change(input, { target: { value: '   Réponse libre   ' } });

    expect(sendButton).not.toBeDisabled();
    expect(input.value).toBe('   Réponse libre   ');

    fireEvent.click(sendButton);

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith('Réponse libre');
    expect(input.value).toBe('');
    expect(sendButton).toBeDisabled();
  });

  it("n'envoie rien si la saisie custom ne contient que des espaces", () => {
    const onAnswer = vi.fn();
    const onDismiss = vi.fn();

    render(
      <JarvisClarificationDialog
        clarification={clarification}
        onAnswer={onAnswer}
        onDismiss={onDismiss}
      />
    );

    const input = screen.getByPlaceholderText('Ou tapez votre réponse...');
    const sendButton = screen.getByRole('button', { name: 'Envoyer' });

    fireEvent.change(input, { target: { value: '    ' } });

    expect(sendButton).toBeDisabled();

    fireEvent.click(sendButton);

    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("soumet avec Entrée sans Shift et empêche l'action par défaut", () => {
    const onAnswer = vi.fn();
    const onDismiss = vi.fn();

    render(
      <JarvisClarificationDialog
        clarification={clarification}
        onAnswer={onAnswer}
        onDismiss={onDismiss}
      />
    );

    const input = screen.getByPlaceholderText('Ou tapez votre réponse...');

    fireEvent.change(input, { target: { value: 'Ma réponse' } });

    const preventDefault = vi.fn();
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false, preventDefault });

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith('Ma réponse');
  });

  it("ne soumet pas avec Shift+Entrée", () => {
    const onAnswer = vi.fn();
    const onDismiss = vi.fn();

    render(
      <JarvisClarificationDialog
        clarification={clarification}
        onAnswer={onAnswer}
        onDismiss={onDismiss}
      />
    );

    const input = screen.getByPlaceholderText('Ou tapez votre réponse...');

    fireEvent.change(input, { target: { value: 'Ma réponse' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('affiche le libellé de priorité Question pour medium', () => {
    const onAnswer = vi.fn();
    const onDismiss = vi.fn();

    render(
      <JarvisClarificationDialog
        clarification={{ ...clarification, priority: 'medium' }}
        onAnswer={onAnswer}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText('Question')).toBeInTheDocument();
  });

  it('affiche le libellé de priorité Optionnel pour low', () => {
    const onAnswer = vi.fn();
    const onDismiss = vi.fn();

    render(
      <JarvisClarificationDialog
        clarification={{ ...clarification, priority: 'low' }}
        onAnswer={onAnswer}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText('Optionnel')).toBeInTheDocument();
  });

  it("n'affiche pas la liste d'options quand elle est absente", () => {
    const onAnswer = vi.fn();
    const onDismiss = vi.fn();

    render(
      <JarvisClarificationDialog
        clarification={{ ...clarification, options: undefined }}
        onAnswer={onAnswer}
        onDismiss={onDismiss}
      />
    );

    expect(screen.queryByText('PDF')).not.toBeInTheDocument();
    expect(screen.queryByText('Tableau')).not.toBeInTheDocument();
    expect(screen.queryByText('Résumé')).not.toBeInTheDocument();
  });
});

describe('JarvisClarificationInline', () => {
  const clarification = {
    id: 'clar-2',
    question: 'Sur quelle période faut-il filtrer ?',
    options: ['7 jours', '30 jours', '90 jours'],
    context: 'filtres',
    priority: 'medium' as const,
  };

  it('affiche la question et les options inline', () => {
    const onAnswer = vi.fn();

    render(<JarvisClarificationInline clarification={clarification} onAnswer={onAnswer} className="inline-class" />);

    expect(screen.getByText('Sur quelle période faut-il filtrer ?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7 jours' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 jours' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90 jours' })).toBeInTheDocument();
  });

  it('appelle onAnswer avec la bonne option au clic', () => {
    const onAnswer = vi.fn();

    render(<JarvisClarificationInline clarification={clarification} onAnswer={onAnswer} />);

    fireEvent.click(screen.getByRole('button', { name: '30 jours' }));

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith('30 jours');
  });

  it("n'affiche pas d'options si elles sont absentes", () => {
    const onAnswer = vi.fn();

    render(
      <JarvisClarificationInline
        clarification={{ ...clarification, options: undefined }}
        onAnswer={onAnswer}
      />
    );

    expect(screen.getByText('Sur quelle période faut-il filtrer ?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '7 jours' })).not.toBeInTheDocument();
  });
});